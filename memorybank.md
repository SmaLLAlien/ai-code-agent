# Memory Bank

Живой журнал реализации. Обновляется **после каждой задачи**: статус, решения, особенности API,
отклонения от плана. Читать первым делом перед началом работы.

## Текущее состояние

- **Рефакторинг стиля кода — закоммичен и запушен** (ветка платформы `feat/scss-bem-templates` от
  `feat/layer-6-export`; стартер слит в `main`, тег `starter-v4` = `c730570`, `starter.ref` = `starter-v4`;
  в рабочую `server/data/memory.md` дописаны пункты про templateUrl/SCSS/BEM). Требования пользователя: все шаблоны во
  внешних `.html`, стили — SCSS (и в стартере), BEM с вложенностью SCSS. Правила:
  `.agents/rules/component-templates-and-styles.md` (в обоих репо), override в angular-best-practices,
  AGENTS.md, `server/agent/memory.default.md`. Попутно: найден и исправлен старый баг — `.visually-hidden`
  (`position: absolute`) вылетал из ленты и растягивал документ на длинных чатах → у прокручиваемых
  контейнеров `position: relative`. После коммита стартера — тег `starter-v4` и переключение `starter.ref`.
- **Слой 6.1** (скачать zip) закоммичен (`a8267f4`). 6.2 (публикация) и 6.3 (GitLab) отложены.
  Слой 5 (песочницы) — после решения DevOps.
- **Ветки:** слой 1 — `feat/layer-1-chat-agent`; слой 2 — `feat/layer-2-agent-ui`; слой 3 —
  `feat/layer-3-history`; слой 4 — `feat/layer-4-memory` (`66696f2`); слой 6 — `feat/layer-6-export`
  (от слоя 4), не закоммичен. Слои 1–4 запушены.
- **Слой 5 — согласованная идея (не реализовано):** «мозг в платформе, руки в песочнице» — pi, ключи
  и чат остаются в контейнере платформы, встроенные тулы pi получают свои `operations`
  (`createBashTool(cwd, { operations })` и аналоги для read/write/edit/find…), команды и `ng serve`
  выполняются в контейнере проекта. Интерфейс `Sandbox` с реализациями `local` / `docker`
  (соседние контейнеры через socket-proxy) / `k8s` (Pod на проект). Ждём от пользователя:
  инфраструктура DevOps (k8s / Docker-хост) и наличие Docker на машине разработки.

**Живая проверка 6.1 (2026-10-01, тестовый сервер :3001):** zip 205 КБ, корень `project-<id>/`,
`node_modules` нет, незакоммиченный файл есть (снимок перед выгрузкой), `repo.bundle` клонируется с
историей (`starter` → «Снимок для выгрузки»); кнопка в шапке отдаёт `application/zip`.
- **Стартер:** `starter-v3` (`5c53387`, запушен) — v2 (Angular Material + тема `#4ea524`, правила
  TypeScript) + пустая оболочка `app.html` (`<router-outlet />` вместо заглушки Angular, иначе агент
  дописывал UI под неё) + Material Symbols для `<mat-icon>`. `starter.ref` = `starter-v3`.
- **Исправлено после ревью слоя 4:** `<router-outlet>` занимал ячейку сетки оболочки → чат уезжал под
  сайдбар в узкую колонку, страница прокручивалась, сайдбар «пропадал» сверху. Outlet обёрнут в
  `.content`, строка ленты `minmax(0, 1fr)`; убран вложенный скролл карточки плана; `mat-icon`
  настроен на Material Symbols (`MatIconRegistry.setDefaultFontSetClass`).
  Урок: проверять раскладку скриншотом на десктопной ширине, а не только размерами элементов.

**Живая проверка слоя 4 (2026-10-01, juapi):** чат A «запомни … appearance="outline"» → тул `remember`,
карточка «Запоминает» ✅ → новый чат B без напоминаний перечисляет Material, `#4ea524` и outline (из
памяти в системном промпте, без чтения файлов) ✅; диалог «Память команды» (Material): факт виден,
правка сохраняется ✅; режим plan пишет `docs/DECISIONS.md` + `docs/PLAN.md`, коммит плана ✅; после
добавления даты в промпт — правильная дата и русский язык, агент сам применил правило из памяти ✅.

**Живая проверка слоя 3 (2026-10-01, juapi):**
- **SPA fallback включён** (решение пользователя в слое 3, отменяет решение слоя 0): GET/HEAD без
  расширения файла с `Accept: text/html` → `index.html` (`no-cache`); `/api` и отсутствующие файлы — 404.
  Проверено на прод-сборке (`npm start`) и тестами `server/src/app.test.ts`.

Два чата («АПЕЛЬСИН», «БАНАН») → чат создаётся при
первой отправке, режим «Агент» переносится, заголовок из первого сообщения → полный рестарт сервера
(вместе с `tsx watch`) → оба в списке, история и режим восстановлены, агент отвечает «АПЕЛЬСИН» —
контекст поднят из файла сессии pi ✅; переключение между чатами (переиспользование компонента) ✅;
переименование ✅; удаление открытого чата → переход на «Новый чат», с диска удалены воркспейс,
`data/chats/<id>` и запись в `chats.json` ✅; guard «агент ещё работает» при уходе (отказ → остаёмся,
ран продолжается) ✅; перезагрузка по прямой ссылке восстанавливает карточки тулов из журнала ✅;
375px: сайдбар выезжает, бэкдроп закрывает, без горизонтального скролла ✅.
- **Стартер:** `starter-v1` (`26b9cea`, запушен) — AGENTS.md, CLAUDE.md, правила Angular, скилы
  `add-page`, `add-api-endpoint`. `starter.ref` в `server/config/*.json` = `starter-v1` (проверено:
  новый воркспейс содержит AGENTS.md и скилы). Локальный клон стартера: `D:\Projects\ai code agent\starter`
  (push по SSH).

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
| 2. Возможности чата и агента | ✅ закоммичен | `b7cd662`; стартер `starter-v1` |
| 3. История чатов | ✅ закоммичен | `773bf69`; SPA fallback включён |
| 4. Память, правила, Material | ✅ закоммичен | `120d297`; стартер `starter-v2` |
| 5. Изоляция и превью | ⏸ ждёт решения DevOps | архитектура согласована (см. «Текущее состояние») |
| 6. Результат (zip, публикация, GitLab) | ✅ 6.1 закоммичен | `a8267f4`; 6.2, 6.3 отложены |

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
| 2.8 | Правила в стартере | ✅ `starter-v1` запушен, платформа переключена на него |
| 2.9 | Git-чекпоинты | ✅ `commitCheckpoint` после рана в agent → `CUSTOM files_changed` |

### Слой 3 — задачи

| # | Задача | Статус |
|---|---|---|
| 3.1 | Хранилище метаданных | ✅ `ChatStore` + `JsonFileChatStore` (`data/chats.json`, атомарная запись, сериализация записей) |
| 3.2 | Сохранение сессий pi | ✅ `SessionManager.continueRecent(cwd, data/chats/<id>/session)` — создаёт или продолжает; ленивая загрузка, выгрузка по простою (`agent.sessionIdleMinutes`) |
| 3.3 | API | ✅ `GET /api/chats`, `GET/PATCH/DELETE /api/chats/:id`; заголовок из первого сообщения |
| 3.4 | UI | ✅ сайдбар (список, новый, переименовать, удалить), `/chat/:id`, guard, выдвижной сайдбар на мобильных |

**Отклонение от плана (3.3):** вместо конвертера `session.messages → ChatItem[]` — **журнал AG-UI-событий**
чата (`data/chats/<id>/events.jsonl`). Сервер пишет всё, что показал за ран (плюс сообщение пользователя
как `TEXT_MESSAGE_*` с `role: 'user'`), сжимая дельты; клиент восстанавливает ленту тем же редьюсером
(`replayHistory`). Причина: карточки вопросов/плана, файлы, reasoning есть только в событиях UI, а не в
истории модели. Чат создаётся лениво — при первой отправке (не при открытии страницы), первое
сообщение и режим передаются через `history.state` навигации.

**Решение:** удаление чата удаляет запись, журнал, сессию pi и воркспейс (UI спрашивает подтверждение).

**Хранение (`server/data`, в `.gitignore`):** `chats.json`; `chats/<id>/events.jsonl`; `chats/<id>/session/*.jsonl`.

### Слой 4 — задачи (объём пересмотрен 2026-10-01)

| # | Задача | Статус |
|---|---|---|
| 4.1 | Глобальная память команды | ✅ `data/memory.md` из шаблона `server/agent/memory.default.md`; секция `team_memory` в каждом ране; `GET/PUT /api/memory` (лимит 16 КБ) |
| 4.2 | Тул `remember` | ✅ дописывает в «## Запомнено агентом» без дублей |
| 4.3 | `docs/DECISIONS.md` | ✅ правила + скилы; запись разрешена в plan; дата сегодня передаётся в промпт (`today`) |
| 4.4 | Сжатие длинных чатов | ✅ `server/agent/settings.json` (compaction: reserve 16384, keepRecent 20000 — дефолты pi, зафиксированы явно); `compaction_end` → `CUSTOM compaction` → пометка в ленте. Вживую не триггерилось (окно 200K) |
| 4.5 | Правила TypeScript | ✅ `.agents/rules/typescript-best-practices.md` в платформе и стартере |
| 4.6 | Angular Material | ✅ платформа: тема M3 `#4ea524` (`src/theme.scss`), наши токены ссылаются на `--mat-sys-*`, на Material — диалог памяти и подтверждения; стартер: Material + тема + правила (`starter-v2`) |
| 4.7 | UI памяти | ✅ кнопка «Память команды» в сайдбаре → `MemoryDialog` (лениво загружается) |

## Что уже есть

- Angular 21 (`@angular/build:application`), сборка → `dist/ai-code-agent/browser`. Zoneless по умолчанию.
- `server/` — отдельный пакет: Express 5, ESM, `compression`, пакет `config`.
  - `src/index.ts` — `http.createServer(app)`, обработка `EADDRINUSE`, graceful shutdown (SIGINT/SIGTERM).
  - `src/app.ts` — `createApp(clientDist)`: compression → `/api` → статика (хэшированные файлы
    `immutable` на год, остальное `no-cache`) → SPA fallback на `index.html` (с слоя 3) → JSON error
    handler без стека.
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

Проверено в слое 4:
- pi: компакция включена по умолчанию (`enabled ?? true`), настройки читаются из
  `<agentDir>/settings.json` и `<cwd>/.pi/settings.json`.
- pi: обработчик `before_agent_start` может быть async — память читается свежей на каждый ран.
- Модели не знают текущую дату → секция `today` в промпте (иначе выдумывают даты в DECISIONS.md).
- Angular Material 21: тема из одного цвета — `ng generate @angular/material:theme-color
  --primary-color "#4ea524" --is-scss`; `mat.theme()` + `color-scheme: light dark` даёт светлую/тёмную
  тему через `light-dark()`. `@angular/animations` не нужен.
- Бюджет initial 500 КБ: диалоги с формами Material в сайдбаре (eager) → грузить через `import()`.
- flash-lite иногда пишет документы по-английски вопреки правилу — явное «in the user's language»
  в правилах помогает.

Проверено в слое 3:
- pi: `SessionManager.continueRecent(cwd, sessionDir)` — один вызов и для нового чата, и для
  восстановления; файл сессии ~20 КБ на старте (системный промпт).
- Angular: при переходе `/chat/a` → `/chat/b` компонент переиспользуется → загрузка по `effect` на
  `input` id (`withComponentInputBinding`); `canDeactivate` срабатывает и при смене параметра.
- Angular target ES2022 → нет `findLastIndex`.
- Панель браузера Claude, когда скрыта, не проигрывает CSS-transition — при автопроверках вёрстки
  отключать `transition`.
- Удаление открытого чата: сначала навигация на `/` (guard), потом `DELETE`.

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
