# План реализации платформы ai-code-agent

## Цель

Внутренняя команда получает от клиентов MVP в виде одного HTML, сгенерированного ИИ, — это не подходит.
Платформа даёт пользователю веб-чат с coding-агентом, который реализует идею **в свежем клоне нашего
Angular-стартера**, соблюдая наши правила. Результат — стандартизированный проект, который команда
забирает в работу.

## Архитектура (целевая)

```
Браузер: Angular-чат (сообщения, действия агента, вопросы, план, превью)
   │  POST /api/chats/:id/run  →  ответ SSE-потоком событий AG-UI
Сервер платформы (server/, Express 5)
   ├─ реестр чатов (слой 1: память → слой 3: файл)
   ├─ воркспейсы: <workspaces.root>/<chatId> = git clone стартера (repo + ref из конфига)
   ├─ pi SDK: одна AgentSession на чат, cwd = воркспейс
   ├─ LLM-провайдеры из конфига: juapi (OpenAI-совместимый шлюз, по умолчанию) | gemini
   └─ транслятор событий pi → AG-UI
(слой 5: агент и воркспейс переезжают в Docker-контейнер на проект, + превью ng serve)
```

Ключевые решения:
- **Один агент с режимами** `plan` / `agent`, а не два агента: контекст уточнений не теряется. Режим
  ограничивает инструменты через extension-хуки pi (слой 2).
- **Стартер клонирует платформа**, а не агент: воспроизводимо, фиксированный ref.
- **AG-UI как протокол** между сервером и UI: стандартная модель событий, возможность позже подключить
  готовые клиенты (например, CopilotKit) без переделки сервера.
- **Воркспейсы лежат вне репозитория платформы**: pi читает `AGENTS.md` из cwd и всех родительских папок,
  иначе агент подхватит правила платформы вместо правил стартера.

## Слои

Каждый слой — рабочее состояние. После слоя пользователь сам делает commit + push.

| Слой | Файл | Результат |
|---|---|---|
| 1 | [layer-1.md](layer-1.md) | База: чат ↔ агент pi, стрим текста и действий, Stop |
| 2 | [layer-2.md](layer-2.md) | Возможности: markdown, карточки действий, режимы plan/agent, вопросы, todo, утверждение плана, правила и скилы |
| 3 | [layer-3.md](layer-3.md) | История чатов: сохранение сессий, список, продолжение после рестарта |
| 4 | [layer-4.md](layer-4.md) | Память: проектная и глобальная, тул `remember` |
| 5 | [layer-5.md](layer-5.md) | Изоляция (Docker на проект) и живое превью |
| 6 | [layer-6.md](layer-6.md) | Результат: zip, публикация по ссылке, экспорт в GitLab |

Детально расписан слой 1. Слои 2–6 расписаны на уровне задач: **перед началом слоя сверь задачи с
текущим кодом и `memorybank.md`**, уточни детали и запиши их в `memorybank.md`.

## Порядок работы

См. раздел «Как работать над задачами плана» в [AGENTS.md](../../AGENTS.md). Коротко: задачи по порядку →
критерии готовности → обновить `memorybank.md` → в конце слоя остановиться, **без commit/push**.

## Справочник API (проверено 2026-09-30)

При сомнениях — источник истины `.d.ts` в `node_modules`.

### pi (`@earendil-works/pi-coding-agent@0.99.1`, `@earendil-works/pi-ai@0.99.1`)
- ESM-only, Node ≥ 22.19. Старые пакеты `@mariozechner/*` — deprecated, не использовать.
- Документация: https://github.com/earendil-works/pi/tree/main/packages/coding-agent/docs
  (`sdk.md`, `extensions.md`, `skills.md`), примеры: `packages/coding-agent/examples/sdk/`.

```ts
import {
  createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager,
  type AgentSessionEvent, type ExtensionAPI,
} from '@earendil-works/pi-coding-agent';

const modelRuntime = await ModelRuntime.create({ authPath, modelsPath });
// в проекте ключ читается один раз при старте и удаляется из process.env (см. layer-1, задача 1.3)
await modelRuntime.setRuntimeApiKey('google', geminiKey);
const model = modelRuntime.getModel('google', 'gemini-2.5-pro'); // Model | undefined

const resourceLoader = new DefaultResourceLoader({
  cwd, agentDir,
  extensionFactories: [(pi: ExtensionAPI) => { /* слой 2 */ }],
  // additionalSkillPaths: ['/abs/dir'],
});
await resourceLoader.reload(); // обязательно до createAgentSession

const { session } = await createAgentSession({
  cwd, agentDir, modelRuntime, model, thinkingLevel: 'medium',
  tools: ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls'],
  resourceLoader,
  sessionManager: SessionManager.inMemory(cwd), // слой 3: SessionManager.create(cwd, sessionDir)
});

const unsubscribe = session.subscribe((e: AgentSessionEvent) => { /* ... */ });
await session.prompt(text); // резолвится после завершения рана (вкл. ретраи); если ран уже идёт — reject
await session.abort();      // прервать и дождаться idle
session.isStreaming;        // идёт ли ран
session.dispose();
```

- Провайдер Gemini: id `google`, переменная `GEMINI_API_KEY`. Модели: `gemini-2.5-pro`,
  `gemini-2.5-flash`, `gemini-3.1-pro-preview`, `gemini-3-flash-preview` и др.
- Собственные провайдеры (OpenAI-совместимые): описываются в `models.json` (путь — `modelsPath` у
  `ModelRuntime.create`): `{ "providers": { "<id>": { "baseUrl", "api": "openai-completions" |
  "openai-responses", "models": [{ "id", "name", "contextWindow", "maxTokens", "input" }] } } }`.
  Порядок поиска ключа: runtime → `auth.json` → `apiKey` в models.json (`$ENV`) → env провайдера.
  Документация: `packages/coding-agent/docs/models.md`.
- **juapi.net** — ретранслятор на базе open-source new-api: base URL `https://www.juapi.net/v1`,
  `Authorization: Bearer <key>`, `POST /v1/chat/completions` (stream, tools), `POST /v1/responses`,
  `GET /v1/models` — список моделей, доступных ключу (id моделей зависят от аккаунта).
- События (`AgentSessionEvent`), важные для UI:
  - `message_update` → `assistantMessageEvent`: `text_start|text_delta{delta}|text_end`,
    `thinking_start|thinking_delta|thinking_end`, `toolcall_*` (стрим аргументов от LLM — не используем),
    `done`, `error{reason: 'aborted'|'error', error}`;
  - `tool_execution_start{toolCallId, toolName, args}`, `tool_execution_update{partialResult}`,
    `tool_execution_end{toolCallId, toolName, result: {content: (Text|Image)[]}, isError}`;
  - `agent_start`, `agent_end{willRetry}`, `agent_settled` (pi больше ничего не сделает сам).
- Extensions: `pi.on('tool_call', (e) => ({ block: true, reason }))` — запрет вызова (`e.toolName`,
  `e.input`); `pi.on('before_agent_start', (e) => { e.systemPromptOptions.sections['mode'] = '...'; })`;
  `pi.registerTool({ name, label, description, parameters: Type.Object({...}), execute(toolCallId, params,
  signal, onUpdate, ctx) { return { content: [{ type: 'text', text }], details: {} }; } })`,
  `Type` из пакета `typebox` (1.x).
- Контекст и скилы: `AGENTS.md`/`CLAUDE.md` грузятся из `agentDir`, `cwd` и всех родителей;
  скилы — `<agentDir>/skills`, `<cwd>/.pi/skills`, `.agents/skills` (вверх до корня git-репо),
  формат Agent Skills (`<name>/SKILL.md` с frontmatter `name`, `description`).
- **Песочницы нет**: `bash` выполняется с правами процесса сервера (изоляция — слой 5).

### AG-UI (`@ag-ui/core`, `@ag-ui/encoder`, `@ag-ui/client` — все 1.0.1)
- Документация: https://docs.ag-ui.com/concepts/events
- Один `POST` на ран (тело `RunAgentInput`), ответ — SSE-поток событий.
- Сервер: `new EventEncoder().encode(event)` → строка `data: {...}\n\n`.
- Клиент: `new HttpAgent({ url, threadId })`, `agent.addMessage({ id, role: 'user', content })`,
  `await agent.runAgent({}, subscriber)`, `agent.abortRun()`.
- **Клиент валидирует поток** и падает, если: первое событие не `RUN_STARTED`; что-то после
  `RUN_FINISHED`/`RUN_ERROR`; `RUN_FINISHED` при незакрытых сообщениях/тул-коллах; `CONTENT`/`END` без
  `START`; опциональное поле равно `null` (его надо не указывать).

| Событие | Обязательные поля |
|---|---|
| `RUN_STARTED` | `threadId`, `runId` |
| `RUN_FINISHED` | `threadId`, `runId` |
| `RUN_ERROR` | `message` |
| `TEXT_MESSAGE_START` / `_CONTENT` / `_END` | `messageId` (+ `role` / `delta`) |
| `TOOL_CALL_START` | `toolCallId`, `toolCallName` |
| `TOOL_CALL_ARGS` | `toolCallId`, `delta` (строка JSON) |
| `TOOL_CALL_END` | `toolCallId` |
| `TOOL_CALL_RESULT` | `messageId`, `toolCallId`, `content` |
| `STATE_SNAPSHOT` | `snapshot` |
| `CUSTOM` | `name`, `value` |
