# Memory Bank

Живой журнал реализации. Обновляется **после каждой задачи**: статус, решения, особенности API,
отклонения от плана. Читать первым делом перед началом работы.

## Текущее состояние

- **Слой:** 2 реализован и проверен вживую; ждёт ревью пользователя → коммит. Слой 3 не начинать
  без команды пользователя.
- **Ветки:** слой 1 — `feat/layer-1-chat-agent` (коммит `daa9090`); слой 2 — `feat/layer-2-agent-ui`
  (от слоя 1), не закоммичен.
- **Стартер:** правила и скилы подготовлены в локальном клоне `D:\Projects\ai code agent\starter`
  (не закоммичено). Пользователь коммитит, пушит и ставит тег `starter-v1`; после этого поменять
  `starter.ref` в `server/config/*.json` на `starter-v1`.

**Живая проверка слоя 2 (2026-09-30, juapi `gemini-3.1-flash-lite`):** «сайт-визитка для кофейни» →
`ask_user` (2 вопроса карточкой, ход завершился) → ответы через карточку → `docs/PLAN.md` →
карточка плана → «Утвердить» → режим agent, `update_todo` 4/4, ошибки тулов подсвечены, агент сам
сделал `npm install` и чинил сборку до зелёного `npm run build` → коммит-чекпоинт, «Изменено файлов: 21»
(все легитимные). Замечание: flash-lite пишет упрощённый план (без путей и «Done when» из скилла
`writing-plans`) и несколько раз спотыкается на сборке — для качества MVP сравнить с моделью сильнее.

**Живая проверка слоя 1 (2026-09-30, ключ в `server/.env`):**
- вопрос по проекту → `ls` + потоковый ответ ✅;
- «создай компонент hello и подключи» → 8 тулов подряд (bash, write, read, edit…), файлы созданы,
  контекст чата сохраняется ✅ — проблема `thought_signature` через juapi **не проявилась**;
- «выполни env» → в выводе нет `JUAPI_API_KEY`/`GEMINI_API_KEY` ✅; `.pi-state/auth.json` = `{}` ✅;
- браузер: стрим, строки действий, «Стоп» во время `npm install` → процесс на сервере убит, действие
  помечено «остановлено», следующее сообщение работает ✅.
- Наблюдение для слоя 2: без правил агент пишет `standalone: true` и не следует нашим Angular-правилам
  (ожидаемо — правила подключаются в 2.7/2.8). Markdown в ответах пока сырой (2.1).

## Статус слоёв

| Слой | Статус | Примечание |
|---|---|---|
| 0. Подготовка (Express-сервер, документы) | ✅ готово | сервер — коммит `b1f6a94` |
| 1. База: чат ↔ pi | ✅ закоммичен | `daa9090` |
| 2. Возможности чата и агента | 🔍 на ревью | проверено вживую; стартер ждёт push + тег `starter-v1` |
| 3. История чатов | ⏳ | |
| 4. Память | ⏳ | |
| 5. Изоляция и превью | ⏳ | |
| 6. Результат (zip, публикация, GitLab) | ⏳ | |

### Слой 1 — задачи

| # | Задача | Статус |
|---|---|---|
| 1.1 | Конфиг и зависимости сервера | ✅ |
| 1.2 | Воркспейсы | ✅ проверено офлайн (клон стартера + коммит) |
| 1.3 | Агент (pi SDK), `llm.ts` | ✅ проверено офлайн (модель juapi резолвится, ключ не на диске) |
| 1.4 | Реестр чатов | ✅ |
| 1.5 | Транслятор pi → AG-UI | ✅ 7 тестов |
| 1.6 | Роуты чатов (AG-UI endpoint) | ✅ SSE проверен с фиктивным ключом (RUN_STARTED → RUN_ERROR) |
| 1.7 | Фронт: инфраструктура | ✅ proxy, HttpClient, lazy-роут, `App` = только `<router-outlet />` |
| 1.8 | Фронт: состояние чата | ✅ редьюсер `applyAgUiEvent` + `stopRunningTools` (4 теста) + `AgentSessionService` |
| 1.9 | Фронт: компоненты чата | ✅ проверено в браузере с реальной моделью: стрим, тулы, ошибка, Стоп, 375px |

### Слой 2 — задачи

| # | Задача | Статус |
|---|---|---|
| 2.1 | Markdown + reasoning | ✅ `marked` → `[innerHTML]` (санитайзер Angular), `thinking_*` → `REASONING_*`, свёрнутый блок |
| 2.2 | Карточки действий | ✅ глаголы по тулам, живой вывод (`CUSTOM tool_output`), статус ошибки (`CUSTOM tool_status`) |
| 2.3 | Режимы plan/agent | ✅ `forwardedProps.mode`, `STATE_SNAPSHOT`, `mode.extension.ts` (промпт + блокировки), переключатель + `/plan` `/agent` |
| 2.4 | `ask_user` | ✅ `terminate: true` в результате тула завершает ход; `QuestionCard` |
| 2.5 | `update_todo` | ✅ `STATE_SNAPSHOT.todo` → `TodoPanel` |
| 2.6 | Утверждение плана | ✅ `CUSTOM plan_ready` → `PlanCard`; план коммитится при каждой записи |
| 2.7 | Платформенные правила и скилы | ✅ `server/agent/AGENTS.md` + 5 скилов (brainstorming, writing-plans, executing-plans, verification-before-completion, html-prototype-import) |
| 2.8 | Правила в стартере | 🟡 подготовлено в локальном клоне, ждёт commit/push/тег от пользователя |
| 2.9 | Git-чекпоинты | ✅ `commitCheckpoint` после рана в agent → `CUSTOM files_changed` |

## Что уже есть

- Angular 21 (`@angular/build:application`), сборка → `dist/ai-code-agent/browser`. Zoneless по умолчанию.
- `server/` — отдельный пакет: Express 5, ESM, `compression`, пакет `config`.
  - `src/index.ts` — `http.createServer(app)`, обработка `EADDRINUSE`, graceful shutdown (SIGINT/SIGTERM).
  - `src/app.ts` — `createApp(clientDist)`: compression → `/api` → статика (хэшированные файлы
    `immutable` на год, остальное `no-cache`) → JSON error handler без стека. SPA fallback **нет**
    (решение пользователя).
  - `src/routes/api.ts` — `GET /api/health`, JSON-404 для `/api/*`.
  - `config/{dev,test,prod}.json` — порты 3000 / 3001 / 8080. Выбор файла — `NODE_CONFIG_ENV`.

## Слой 1 — что сделано (для ревью)

**Сервер (`server/`):**
- `config/{dev,test,prod}.json` — `workspaces`, `starter`, `agent.llm` (провайдеры juapi/gemini).
- `src/config.ts` — типизированный конфиг + валидация `agent.llm.active`.
- `src/agent/llm.ts` — ключи из env → память, удаление из `process.env`, генерация `models.json`,
  `ModelRuntime`, выбор модели активного провайдера. Тест `llm.test.ts`.
- `src/agent/create-session.ts` — pi-сессия на воркспейс (tools: read, bash, edit, write, grep, find, ls).
- `src/workspaces/workspace.service.ts` — `git clone` стартера → свой git с коммитом `starter`.
- `src/chats/chat.registry.ts` — чаты в памяти, `disposeAll` при shutdown.
- `src/agui/pi-to-agui.ts` — транслятор событий (+ 8 тестов вместе с llm).
- `src/routes/chats.ts` — `POST /api/chats`, `POST /api/chats/:id/run` (SSE), `POST /api/chats/:id/abort`.
- `src/app.ts` — SSE исключён из compression; `express.json`; 4xx из middleware не превращаются в 500.
- `src/index.ts` — `loadLlmKeys()` до старта, понятная ошибка без ключа.

**Фронт (`src/`):** `proxy.conf.json`; `app/chat/`: `chat-items.ts` (редьюсер + spec),
`agent-session.service.ts`, `chat-page`, `message-list`, `tool-call-item`, `composer`; `styles.css` —
токены цветов со светлой/тёмной темой.

**Отклонения от плана:** ошибки модели ловятся по `message_end` (см. Gotchas); добавлена правка
error handler'а; `Composer` чистит поле напрямую; статус тула `stopped`; ключи — через `server/.env`
(`--env-file-if-exists`), шаблон `server/.env.example`.

## Принятые решения

| Решение | Почему |
|---|---|
| Движок агента — pi SDK (`@earendil-works/*`), не Flue | Нужен реальный Node-воркспейс (ng build, превью); Flue — beta и лишний слой поверх SDK |
| LLM через провайдеры в конфиге (`agent.llm.active` + `providers`), вся логика в `server/src/agent/llm.ts` | Смена модели/шлюза без правок кода |
| Провайдер по умолчанию — `juapi` (juapi.net, OpenAI-совместимый, `JUAPI_API_KEY`); второй — `gemini` (`GEMINI_API_KEY`, корпоративный) | У пользователя есть ключ juapi; Gemini — позже, ключ задаст сам |
| Ключи LLM: читаются при старте и удаляются из `process.env`; в файлы не пишутся | bash-тул pi наследует env сервера |
| Локально ключи — в `server/.env` (gitignored, шаблон `.env.example`), грузятся `--env-file-if-exists` в `dev/start` | Агент-разработчик может запускать живые проверки, не видя ключ |
| Один агент с режимами `plan`/`agent`, не два агента | Контекст уточнений не теряется; режимы через extension-хуки pi |
| Протокол UI — AG-UI поверх SSE, UI — свои Angular-компоненты | pi-web-ui заморожен и гоняет агента в браузере; CopilotKit Angular pre-1.0 |
| Стартер — git URL + ref из конфига, клонирует платформа | Воспроизводимость; агент не тратит на это шаги |
| Стартер — **отдельный репозиторий** (начат с `b1f6a94`: Angular + Express), версии — теги `starter-vN` | Этот репо — платформа; у стартера своя история, AGENTS.md и скилы (слой 2.8) |
| Воркспейсы вне репозитория платформы | pi читает AGENTS.md из всех родительских папок cwd |
| Порядок: история (3) раньше памяти (4) | Память между чатами имеет смысл, когда чаты сохраняются |
| Конфиги строго `dev/test/prod`, выбор через `NODE_CONFIG_ENV` | Требование пользователя; `NODE_ENV` остаётся стандартным для Express |
| Правила Angular — вендоренная копия с overrides для v21 | Upstream написан под v22 (OnPush по умолчанию, `@Service`, Signal Forms) |
| Пользователи — внутренняя команда; песочницы — свой Docker-хост | Ответы пользователя |

## Gotchas (особенности библиотек)

Проверено в слое 2:
- pi: завершить ход после тула — `terminate: true` в `AgentToolResult` (срабатывает, если все тулы
  пачки его вернули; `ask_user` просит модель не звать другие тулы в том же ходе).
- pi: при явном `tools: [...]` включаются **только** перечисленные — кастомные (`ask_user`,
  `update_todo`) нужно добавлять и в `tools`, и в `customTools`.
- pi: `event.input` в `tool_call` — union типов входов встроенных тулов; путь брать через приведение
  `(event.input as { path?: unknown }).path`.
- pi: `agentDir/AGENTS.md` + `agentDir/skills/*` и `AGENTS.md` + `.agents/skills/*` воркспейса грузятся
  одновременно (проверено по `session.systemPrompt`).
- `typebox` 1.3.27 — прямая зависимость сервера (та же версия, что у pi).
- AG-UI reasoning: `REASONING_START{messageId}` (id спана) + `REASONING_MESSAGE_START{messageId, role:'reasoning'}`.
- Windows: `fs.rm` папки сразу после неудачного `git clone` может дать `EBUSY` → очистка с
  `maxRetries` и без маскировки исходной ошибки.
- Dev-окружение: при остановке серверов гасить и `tsx watch` (иначе он перезапускает сервер и держит порт).
- Бандл чата вырос до ~860 КБ raw / ~124 КБ gzip (+`marked`).

Проверено в слое 1 (по коду pi 0.99.1 / AG-UI 1.0.1):
- pi: `setRuntimeApiKey` кладёт ключ в in-memory `overrides` (`runtime-credentials.js`), на диск не
  пишет; `.pi-state/auth.json` создаётся, но без ключа. Проверено.
- pi: **ошибка запроса к модели** (auth/4xx/5xx) не даёт `message_update:error` — приходит
  `message_end` с `message.stopReason === 'error'` и `errorMessage`; `prompt()` при этом резолвится,
  не реджектится. Транслятор ловит это → `RUN_ERROR`.
- pi: `ThinkingLevel` из `pi-agent-core` не импортируется напрямую (пакет не поднят в node_modules) →
  тип выводится как `NonNullable<CreateAgentSessionOptions['thinkingLevel']>` (`server/src/config.ts`).
- pi: схема `models.json` — `model-config.d.ts` (`providers.<id>.{baseUrl, api, apiKey?, models[{id,
  name, contextWindow, maxTokens, input, compat?}]}`); `compat` для openai-completions:
  `supportsDeveloperRole`, `maxTokensField`, `requiresToolResultName` и др.
- pi: импорт пакета медленный (~15 с на холодный старт тестов) — нормально.
- juapi: с фиктивным ключом `POST /v1/chat/completions` → **пустой 404** (не 401) — так juapi
  отвечает на неверный ключ. С настоящим ключом всё работает (проверено).
- AG-UI: после «Стоп» `TOOL_CALL_RESULT` не приходит → клиент по завершении рана помечает
  незавершённые тулы как `stopped` (`stopRunningTools`).
- TS target ES2022 → нет `Array.prototype.findLast`.
- Тестовые файлы `*.test.ts` исключены из `tsc` (не попадают в `dist`), запускаются через tsx без
  проверки типов.
- `express.json` на битый JSON → error handler теперь отвечает его 4xx-статусом, а не 500.
- AG-UI client: при `abortRun()` сам отдаёт подписчику `RUN_ERROR` («BodyStreamBuffer was aborted»)
  → в `AgentSessionService` ошибки после пользовательского «Стоп» игнорируются (флаг `stopped`).
- Angular zoneless + `[value]` у textarea: если Enter нажат в том же кадре, что и последний ввод,
  биндинг ещё не отрисован с текстом, и `text.set('')` не считается изменением → поле не очищается.
  В `Composer` поле очищается напрямую через `viewChild`.
- Бандл: lazy-чанк чата ~796 КБ raw / ~108 КБ gzip — в основном `@ag-ui/client` (zod, proto).
  Бюджет initial не затронут. Если станет проблемой — свой лёгкий SSE-клиент вместо `HttpAgent`.
- `npm audit` (server): 1 high — `brace-expansion` внутри `pi-coding-agent` (DoS на glob-паттернах).
  `npm audit fix` не лечит (диапазон зафиксирован pi). Риск низкий до слоя 5 (изоляция); можно
  закрыть `overrides` в `server/package.json` после проверки совместимости.

- pi: пакеты `@mariozechner/*` deprecated → только `@earendil-works/*`. ESM-only, Node ≥ 22.19.
- pi: `session.prompt()` отклоняется, если ран уже идёт → на сервере проверять `session.isStreaming` (409).
- pi: `DefaultResourceLoader` требует `await loader.reload()` до `createAgentSession`.
- pi: историю сессии нельзя подменять присваиванием `session.agent.state.messages` — только через `SessionManager`.
- AG-UI клиент строго валидирует порядок событий и запрещает `null` в опциональных полях.
- pi `bash`-тул — дочерний процесс сервера и наследует его env → ключи LLM удалять из
  `process.env` после чтения при старте (слой 1, задача 1.3). Полностью закрывается в слое 5.
- juapi.net — ретранслятор на new-api: id моделей зависят от аккаунта, смотреть `GET /v1/models`.
- ~~Риск `thought_signature` у Gemini 3 через ретранслятор~~ — проверено: 8 вызовов тулов подряд через
  juapi (`openai-completions`) работают. Если всплывёт на других моделях — `"api": "openai-responses"`
  или `compat`-опции из pi `docs/models.md`.
- `gemini-3.1-flash-lite` — лёгкая модель: для отладки платформы ок, качество кода может быть слабым.
  Для оценки качества MVP (слой 2) сравнить с более сильной моделью.
- `compression` буферизует `text/event-stream` → SSE нужно исключать из сжатия (слой 1, задача 1.6).
- Angular dev-proxy: `/api` → `localhost:3000` (`proxy.conf.json`, слой 1).

## Команды

```bash
# клиент (корень)
npm start          # http://localhost:4200
npm run build
npm test
# сервер (server/)
npm run dev        # http://localhost:3000, нужен ключ активного LLM-провайдера (со слоя 1)
npm run build && npm start
```

## Открытые вопросы

- [x] **URL репозитория стартера:** `https://github.com/SmaLLAlien/starter.git` (публичный, клонируется
      без авторизации), ref `starter-v0` → `b1f6a94`. Подставить вместо `<STARTER_REPO_URL>` в
      `server/config/*.json` (задача 1.1). Для клонирования сервером — только HTTPS (SSH-ключей на
      сервере нет); пушить в стартер вручную можно по SSH.
- [x] **Модель juapi:** `gemini-3.1-flash-lite` (выбор пользователя). Подставить вместо `<JUAPI_MODEL_ID>`
      в `server/config/*.json`. `contextWindow`/`maxTokens` в конфиге оставлены консервативными
      (200000 / 32000) — реальные лимиты модели через juapi не проверены.
- [ ] Удалять ли воркспейс и файл сессии при удалении чата (слой 3).
- [ ] LLM-прокси, чтобы ключи LLM не попадали в контейнер runner'а (слой 5).
- [ ] Сервисный токен и группа корпоративного GitLab (слой 6, DevOps).
