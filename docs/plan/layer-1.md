# Слой 1 — база: чат ↔ агент pi

**Результат слоя:** в браузере пользователь пишет задачу → видит потоковый ответ агента и список его
действий (read/write/bash…) → файлы появляются в воркспейсе чата. Кнопка Stop прерывает ран. Повторный
запрос в том же чате помнит контекст.

**Вне слоя:** правила/скилы, markdown, режимы, история чатов после рестарта, Docker, превью.
Сессии живут в памяти процесса.

Справочник API — [README.md](README.md#справочник-api-проверено-2026-09-30).

**LLM-провайдеры:** подключаются через конфиг, активный выбирается ключом `agent.llm.active`.
Сразу поддерживаются два: **`juapi`** (OpenAI-совместимый шлюз https://www.juapi.net, используется по
умолчанию) и **`gemini`** (Google Gemini API). Ключи (`JUAPI_API_KEY`, `GEMINI_API_KEY`) задаёт
**пользователь** в окружении запуска сервера (например, `node --env-file=<файл вне проекта>` или
`$env:JUAPI_API_KEY=...` в сессии PowerShell). Исполнитель ключи не читает и не выводит (см. AGENTS.md →
«Секреты»): код и unit-тесты пишутся без ключей, e2e с реальной моделью выполняет пользователь.

---

## 1.1 Конфиг и зависимости сервера

**Цель:** у сервера есть всё для запуска агента, конфиг типизирован.

**Файлы:** `server/package.json`, `server/config/{dev,test,prod}.json`, `server/src/config.ts`,
`server/.gitignore`, `server/agent/.gitkeep`.

**Шаги:**
1. В `server/`:
   ```bash
   npm install --save-exact @earendil-works/pi-coding-agent@0.99.1 @earendil-works/pi-ai@0.99.1 @ag-ui/core@1.0.1 @ag-ui/encoder@1.0.1
   ```
2. В `server/package.json` добавить `"engines": { "node": ">=22.19" }` и скрипт
   `"test": "cross-env NODE_CONFIG_ENV=test node --import tsx --test \"src/**/*.test.ts\""`.
   (Если glob не раскрывается на Windows — перечислить файлы или использовать `--test src/` и записать
   решение в memorybank.)
3. Во все три конфига добавить (порт и `clientDist` не трогать):
   ```json
   "workspaces": { "root": "../../workspaces" },
   "starter": { "repo": "https://github.com/SmaLLAlien/starter.git", "ref": "starter-v0" },
   "agent": {
     "dir": "./agent",
     "stateDir": "./.pi-state",
     "thinkingLevel": "medium",
     "llm": {
       "active": "juapi",
       "providers": {
         "juapi": {
           "piProvider": "juapi",
           "model": "gemini-3.1-flash-lite",
           "apiKeyEnv": "JUAPI_API_KEY",
           "custom": {
             "baseUrl": "https://www.juapi.net/v1",
             "api": "openai-completions",
             "contextWindow": 200000,
             "maxTokens": 32000
           }
         },
         "gemini": {
           "piProvider": "google",
           "model": "gemini-2.5-pro",
           "apiKeyEnv": "GEMINI_API_KEY"
         }
       }
     }
   }
   ```
   - `workspaces.root` резолвится от `server/` → папка **вне** репозитория (см. README, «Ключевые
     решения»). Для `test.json` — `"root": "../../workspaces-test"`.
   - Стартер — **отдельный публичный репозиторий**, клонируется по HTTPS без авторизации. Этот репо —
     платформа, его клонировать нельзя (в воркспейс попадут AGENTS.md и docs/plan платформы).
   - `piProvider` — id провайдера внутри pi: встроенный (`google`) или собственный (`juapi`, описан
     в `custom`). `custom` есть только у провайдеров, которых нет в pi из коробки.
   - Модель juapi выбрана пользователем (memorybank). Список моделей ключа — `GET
     https://www.juapi.net/v1/models` (запрос делает пользователь). См. memorybank → Gotchas про
     `thought_signature` у Gemini 3 через ретранслятор.
4. `server/src/config.ts`: расширить `AppConfig`:
   ```ts
   export interface LlmProviderConfig {
     piProvider: string;
     model: string;
     apiKeyEnv: string;
     custom?: { baseUrl: string; api: 'openai-completions' | 'openai-responses'; contextWindow: number; maxTokens: number };
   }
   export interface AppConfig {
     port: number;
     clientDist: string;          // abs
     workspacesRoot: string;      // abs
     starter: { repo: string; ref: string };
     agent: {
       dir: string;               // abs
       stateDir: string;          // abs
       thinkingLevel: ThinkingLevel;
       llm: { active: string; providers: Record<string, LlmProviderConfig> };
     };
   }
   ```
   `ThinkingLevel` — импортировать тип из pi, если экспортируется; иначе строковый union
   `'off' | 'minimal' | 'low' | 'medium' | 'high'` (сверить с `.d.ts`). Пути — `path.resolve(...)`.
   Если `llm.active` отсутствует в `llm.providers` — ошибка при старте.
   (Объекты из пакета `config` иммутабельны — копировать поля, а не отдавать объект как есть.)
5. `server/.gitignore`: добавить `/.pi-state`. Создать `server/agent/.gitkeep` (agentDir платформы,
   наполняется в слое 2).
6. Чтение ключей — задача 1.3 (`loadLlmKeys()`), вызывается при старте в `index.ts` до `listen`:
   если нет ключа **активного** провайдера — сервер падает с понятным сообщением
   (`JUAPI_API_KEY is not set (active LLM provider: juapi)`). Ключи неактивных провайдеров не обязательны.

**Критерии готовности:** `npm run build` в `server/` без ошибок; без ключа `npm run dev` падает с понятным
сообщением; с ключом (проверяет пользователь) — стартует.

---

## 1.2 Воркспейсы

**Цель:** для каждого чата — чистая копия стартера со своим git.

**Файлы:** `server/src/workspaces/workspace.service.ts`.

**Шаги:**
1. `export async function createWorkspace(chatId: string): Promise<string>`:
   - `dir = path.join(appConfig.workspacesRoot, chatId)`; `fs.mkdir(appConfig.workspacesRoot, { recursive: true })`.
   - `execFile('git', ['clone', '--depth', '1', '--branch', ref, repo, dir])` (promisified,
     `node:child_process` + `node:util`), **без shell**.
   - `fs.rm(path.join(dir, '.git'), { recursive: true, force: true })`.
   - `git init`, `git add -A`, `git -c user.name=ai-agent -c user.email=agent@localhost commit -m "starter"`
     (все с `cwd: dir`). Свой `.git` нужен: pi ищет `.agents/skills` вверх до корня git-репо, а слой 2
     делает коммиты-чекпоинты.
   - Вернуть `dir`.
2. При ошибке клонирования удалить частично созданную папку и пробросить ошибку с понятным текстом.

**Критерии готовности:** временный вызов (или тест) создаёт папку `workspaces/<id>` с файлами стартера и
одним коммитом `starter`.

---

## 1.3 Агент (pi SDK)

**Цель:** фабрика сессий pi для заданного воркспейса.

**Файлы:** `server/src/agent/llm.ts`, `server/src/agent/llm.test.ts`, `server/src/agent/create-session.ts`.

**Шаги:**
1. `llm.ts` — единственное место, которое знает о провайдерах:
   - `loadLlmKeys(): void` — вызывается **один раз при старте** (1.1, п.6). Для каждого провайдера из
     `appConfig.agent.llm.providers` читает `process.env[apiKeyEnv]` в приватную `Map<name, key>`, затем
     **`delete process.env[apiKeyEnv]`** для всех провайдеров. Иначе bash-тул pi (дочерний процесс)
     унаследует ключ, и пользователь чата получит его командой `env`. Нет ключа активного провайдера —
     `Error('<ENV> is not set (active LLM provider: <name>)')`. Ключи нигде не логировать.
   - `buildCustomModels(providers): object` — **чистая функция** (покрыть тестом `llm.test.ts`):
     из провайдеров с `custom` строит содержимое pi `models.json`:
     ```json
     { "providers": { "juapi": {
         "baseUrl": "https://www.juapi.net/v1",
         "api": "openai-completions",
         "models": [{ "id": "<model>", "name": "<model>", "contextWindow": 200000, "maxTokens": 32000, "input": ["text"] }]
     } } }
     ```
     **Без `apiKey`** — ключ передаётся только в рантайме (п. ниже), в файл не пишется. Точный формат
     сверить с https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md
     (раздел про custom providers и поле `compat` — если модель juapi падает на `developer`-роли или
     `max_tokens`, это настраивается там; найденное записать в memorybank).
   - `getModelRuntime(): Promise<ModelRuntime>` — ленивый синглтон (кэшировать promise):
     `fs.mkdir(stateDir, recursive)` → записать `buildCustomModels(...)` в `<stateDir>/models.json` →
     `ModelRuntime.create({ authPath: <stateDir>/auth.json, modelsPath: <stateDir>/models.json })` →
     для каждого провайдера с ключом `setRuntimeApiKey(piProvider, key)`.
   - `getAgentModel(): Promise<Model>` → активный провайдер → `runtime.getModel(piProvider, model)`;
     `undefined` → `Error('Unknown model <piProvider>/<model>')`.
   - **Проверить после первого запуска** (пользователь запускает с ключом, исполнитель смотрит файлы, не
     значения env): `.pi-state/auth.json` не содержит ключей. Если `setRuntimeApiKey` не работает для
     собственного провайдера или пишет ключ на диск — найти альтернативу в `.d.ts` (`ModelRuntime.create
     ({ credentials })`, `pi.registerProvider` в extension) и записать в memorybank.
   - Переключение провайдера = смена `agent.llm.active` в конфиге и рестарт. Остальной код про
     конкретных провайдеров не знает.
2. `create-session.ts` — `export async function createSession(cwd: string): Promise<AgentSession>`:
   - `new DefaultResourceLoader({ cwd, agentDir: appConfig.agent.dir })` → `await loader.reload()`.
   - `createAgentSession({ cwd, agentDir, modelRuntime, model, thinkingLevel, tools: ['read', 'bash',
     'edit', 'write', 'grep', 'find', 'ls'], resourceLoader, sessionManager: SessionManager.inMemory(cwd) })`.
   - Вернуть `session`. Тип `AgentSession` — из пакета (сверить имя экспорта в `.d.ts`).
   - Если `createAgentSession` возвращает `modelFallbackMessage` — залогировать `console.warn`.

**Критерии готовности:** компилируется; `llm.test.ts` зелёный (`buildCustomModels`: juapi → запись с
`baseUrl`/`api`/`models`, gemini без `custom` не попадает, в результате нет ключей). Живую проверку
(`prompt('list files')` возвращает ответ) выполняет пользователь с ключом — дать ему команду.

---

## 1.4 Реестр чатов

**Цель:** хранение чатов и их сессий в памяти.

**Файлы:** `server/src/chats/chat.registry.ts`; правка `server/src/index.ts`.

**Шаги:**
1. ```ts
   export interface Chat { id: string; workspacePath: string; session: AgentSession; createdAt: Date }
   export const chatRegistry = {
     async create(): Promise<Chat>,      // id = crypto.randomUUID(); createWorkspace; createSession
     get(id: string): Chat | undefined,
     disposeAll(): void,                 // session.dispose() у всех
   };
   ```
   Можно классом `ChatRegistry` с экспортом одного экземпляра — главное, один источник.
2. В `index.ts` в `shutdown()` вызвать `chatRegistry.disposeAll()` до `server.close`.

**Критерии готовности:** компилируется; `create()` возвращает чат с рабочей сессией.

---

## 1.5 Транслятор pi → AG-UI

**Цель:** чистая (без I/O) логика преобразования событий, покрытая тестами.

**Файлы:** `server/src/agui/pi-to-agui.ts`, `server/src/agui/pi-to-agui.test.ts`.

**Шаги:**
1. ```ts
   export class PiToAgUiTranslator {
     translate(event: AgentSessionEvent): BaseEvent[];
     /** Закрывает незакрытые сообщения/тул-коллы — вызывать перед RUN_FINISHED/RUN_ERROR. */
     closeOpen(): BaseEvent[];
     /** Текст ошибки LLM, если ран завершился ошибкой (см. п.3). */
     readonly error: string | undefined;
   }
   ```
   `BaseEvent`, `EventType` — из `@ag-ui/core`. Id сообщений — `crypto.randomUUID()`.
2. Маппинг:
   | pi | AG-UI |
   |---|---|
   | `message_update` + `text_start` | `TEXT_MESSAGE_START { messageId: new, role: 'assistant' }` (запомнить как открытое) |
   | `message_update` + `text_delta` | `TEXT_MESSAGE_CONTENT { messageId: открытое, delta }` (пустой `delta` не отправлять — AG-UI его отвергает) |
   | `message_update` + `text_end` | `TEXT_MESSAGE_END { messageId }` (закрыть) |
   | `tool_execution_start` | `TOOL_CALL_START { toolCallId, toolCallName: toolName }`, `TOOL_CALL_ARGS { toolCallId, delta: JSON.stringify(args) }`, `TOOL_CALL_END { toolCallId }` |
   | `tool_execution_end` | `TOOL_CALL_RESULT { messageId: new, toolCallId, content }` — `content`: текстовые части `result.content` через `\n`; при `isError` — префикс `Error: ` |
   | `message_update` + `error` c `reason: 'error'` | сохранить текст ошибки в `error` (поле с текстом ошибки у `AssistantMessage` — сверить в `.d.ts` pi-ai, напр. `errorMessage`) |
   | остальное | `[]` |
   Если `text_delta` пришёл без открытого сообщения — сначала сгенерировать `TEXT_MESSAGE_START`.
   Опциональные поля не заполнять `null`/`undefined` — просто не указывать.
3. Тесты (`node:test` + `node:assert/strict`), события pi конструировать вручную как объекты
   (`as AgentSessionEvent`):
   - text_start → delta → delta → text_end даёт START, CONTENT×2, END с одним `messageId`;
   - `closeOpen()` после text_start без text_end возвращает `TEXT_MESSAGE_END`;
   - tool_execution_start/end дают START, ARGS, END, RESULT с одним `toolCallId`;
   - пустой delta пропускается.

**Критерии готовности:** `npm test` в `server/` зелёный.

---

## 1.6 Роуты чатов (AG-UI endpoint)

**Цель:** HTTP API чатов; ран агента стримится SSE-событиями AG-UI.

**Файлы:** `server/src/routes/chats.ts`; правки `server/src/routes/api.ts`, `server/src/app.ts`.

**Шаги:**
1. `app.ts`:
   - перед `app.use('/api', apiRouter)` добавить `app.use('/api', express.json({ limit: '1mb' }))`;
   - **исключить SSE из сжатия**, иначе поток буферизуется:
     ```ts
     app.use(compression({
       filter: (req, res) =>
         !String(res.getHeader('Content-Type') ?? '').startsWith('text/event-stream') &&
         compression.filter(req, res),
     }));
     ```
2. `api.ts`: `apiRouter.use('/chats', chatsRouter)` — до JSON-404.
3. `chats.ts`:
   - `POST /` → `chatRegistry.create()` → `201 { id }`. Ошибка создания → передать в `next(err)`.
   - `POST /:id/run` — тело `RunAgentInput` (тип из `@ag-ui/core`):
     1. нет чата → `404 { error }`; `session.isStreaming` → `409 { error: 'Run already in progress' }`;
     2. текст = последнее сообщение с `role === 'user'` из `body.messages`; `content` — строка или
        массив частей (взять `type === 'text'` части). Нет текста → `400`;
     3. заголовки: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`,
        затем `res.flushHeaders()`;
     4. `const encoder = new EventEncoder(); const send = (e) => res.write(encoder.encode(e));`
     5. `send(RUN_STARTED { threadId: id, runId: body.runId })`;
     6. `translator = new PiToAgUiTranslator()`; `unsubscribe = session.subscribe(e => translator.translate(e).forEach(send))`;
     7. `res.on('close', ...)`: если ран не завершён — `void session.abort()` (клиент нажал Stop/закрыл вкладку);
     8. `try { await session.prompt(text); closeOpen → send; translator.error ? send(RUN_ERROR{message}) : send(RUN_FINISHED{threadId, runId}) }`
        `catch (err) { closeOpen → send; send(RUN_ERROR { message: 'Agent run failed' }); console.error(err) }`
        `finally { unsubscribe(); res.end(); }`.
     Сервер **игнорирует историю из `body.messages`** — историю держит сессия pi.
   - `POST /:id/abort` → `await session.abort()` → `204`; нет чата → `404`.

**Критерии готовности:** компилируется; проверку ниже выполняет **пользователь** (сервер с ключом),
исполнитель даёт ему команды:
```bash
curl -s -X POST http://localhost:3000/api/chats
curl -N -X POST http://localhost:3000/api/chats/<id>/run -H "Content-Type: application/json" -d "{\"threadId\":\"<id>\",\"runId\":\"r1\",\"messages\":[{\"id\":\"m1\",\"role\":\"user\",\"content\":\"list files\"}],\"tools\":[],\"context\":[]}"
```
показывает поток `data: {"type":"RUN_STARTED"...}` … `RUN_FINISHED` в реальном времени (не одной пачкой).

---

## 1.7 Фронт: инфраструктура

**Файлы:** `package.json` (корень), `proxy.conf.json`, `angular.json`, `src/app/app.config.ts`,
`src/app/app.html`, `src/app/app.css`, `src/app/app.routes.ts`, `src/app/app.spec.ts`.

**Шаги:**
1. Корень: `npm install --save-exact @ag-ui/client@1.0.1`.
2. `proxy.conf.json`: `{ "/api": { "target": "http://localhost:3000", "secure": false } }`;
   в `angular.json` → `serve.options.proxyConfig: "proxy.conf.json"`.
3. `app.config.ts`: добавить `provideHttpClient(withFetch())`.
4. `app.html` → только `<router-outlet />`, `app.css` очистить; поправить `app.spec.ts` под новый шаблон
   (проверять, что компонент создаётся).
5. `app.routes.ts`: `{ path: '', loadComponent: () => import('./chat/chat-page').then(m => m.ChatPage) }`.

**Критерии готовности:** `ng build` проходит (чат-страница — в lazy-чанке, бюджет initial не превышен).

---

## 1.8 Фронт: состояние чата

**Цель:** вся логика событий — в чистом редьюсере (тестируемо), сервис — тонкая обёртка.

**Файлы:** `src/app/chat/chat-items.ts`, `src/app/chat/chat-items.spec.ts`,
`src/app/chat/agent-session.service.ts`.

**Шаги:**
1. `chat-items.ts`:
   ```ts
   export type ChatItem =
     | { kind: 'user'; id: string; text: string }
     | { kind: 'assistant'; id: string; text: string }
     | { kind: 'tool'; id: string; name: string; args: string; result?: string; status: 'running' | 'done' };
   export function applyAgUiEvent(items: readonly ChatItem[], event: BaseEvent): ChatItem[];
   ```
   `TEXT_MESSAGE_START` → добавить assistant; `TEXT_MESSAGE_CONTENT` → дописать `delta` по `messageId`;
   `TOOL_CALL_START` → добавить tool (`running`); `TOOL_CALL_ARGS` → дописать в `args`;
   `TOOL_CALL_RESULT` → `result`, `status: 'done'`; остальное — без изменений. Иммутабельно.
2. `chat-items.spec.ts` (Vitest через `ng test`): последовательности событий → ожидаемые `items`.
3. `agent-session.service.ts` — `@Injectable()` (без root; провайдится в `ChatPage`):
   - signals: `items = signal<ChatItem[]>([])`, `isRunning`, `error = signal<string | null>(null)`, `chatId`;
   - `async init()`: `POST /api/chats` (HttpClient + `firstValueFrom`) → `chatId`,
     `agent = new HttpAgent({ url: '/api/chats/<id>/run', threadId: id })`;
   - `async send(text)`: игнорировать пустой текст и повторный вызов во время рана; добавить user-item;
     `agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: text })`;
     `isRunning.set(true)`; `await agent.runAgent({}, { onEvent: ({ event }) => items.update(i => applyAgUiEvent(i, event)), onRunErrorEvent: ({ event }) => error.set(event.message) })`;
     `catch` — если не отмена пользователем, `error.set(...)`; `finally isRunning.set(false)`;
   - `stop()`: `agent.abortRun()` + `POST /api/chats/<id>/abort` (ошибку игнорировать).
   Точные сигнатуры subscriber'а сверить с `.d.ts` `@ag-ui/client`.

**Критерии готовности:** `ng test` зелёный (редьюсер покрыт тестами).

---

## 1.9 Фронт: компоненты чата

**Файлы:** `src/app/chat/chat-page.ts`, `message-list.ts`, `tool-call-item.ts`, `composer.ts`
(inline-шаблоны допустимы для маленьких компонентов, стили — рядом).

**Правила:** [.agents/rules/angular-best-practices.md](../../.agents/rules/angular-best-practices.md)
(OnPush явно, `input()/output()`, `@if/@for`, без `ngClass`, доступность: aria-label у кнопок, фокус).

**Шаги:**
1. `ChatPage`: `providers: [AgentSessionService]`; в конструкторе/`ngOnInit` → `init()`; раскладка:
   лента сообщений (скролл, автопрокрутка вниз при новых items) + композер снизу; показ `error`.
2. `MessageList` (`input.required<ChatItem[]>()`): user справа, assistant слева
   (`white-space: pre-wrap`), tool — через `ToolCallItem`.
3. `ToolCallItem`: одна строка «⚙ {name} {краткий аргумент: path или command}», статус running/done;
   по клику раскрывает args и result (`<pre>`).
4. `Composer`: `<textarea>`; Enter — отправить, Shift+Enter — новая строка; кнопка «Отправить» /
   «Стоп» (при `isRunning`); `output()` `send` и `stop`; поле блокируется, пока идёт `init`.

**Критерии готовности:** `ng build`, `ng test` зелёные; вёрстка читаема на ширине 375px.

---

## Проверка слоя

1. `server/`: `npm test`, `npm run build` — зелёные.
2. Корень: `ng build`, `ng test` — зелёные.
3. Ручной e2e **выполняет пользователь** (исполнитель пишет ему инструкцию): терминал 1 —
   `server/ npm run dev` с ключом; терминал 2 — корень `npm start`; открыть http://localhost:4200:
   - «Создай компонент hello, который выводит "Hello", и подключи его в app.html» → текст идёт потоком,
     появляются строки действий (read/write/edit), в `workspaces/<id>/src/app/` появились файлы;
   - повторный запрос «переименуй его в greeting» — агент помнит контекст;
   - длинная задача → «Стоп» → ран прерывается, UI возвращается в состояние ввода, сервер без ошибок;
   - «выполни команду env и покажи вывод» → в выводе **нет** `JUAPI_API_KEY` / `GEMINI_API_KEY`;
   - `.pi-state/auth.json` не содержит ключей;
   - (если есть ключ Gemini) `agent.llm.active: "gemini"` → рестарт → тот же сценарий работает.
4. Обновить `memorybank.md`: статус слоя, gotchas, отклонения.

**Стоп.** Сообщить пользователю, что слой 1 готов к commit + push. Не коммитить самостоятельно.
