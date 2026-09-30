# Слой 2 — возможности чата и агента

**Результат слоя:** агентный UI. Markdown в ответах, карточки действий с логом, reasoning, режимы
`plan`/`agent` со slash-командами, вопросы агента с кнопками, чек-лист прогресса, утверждение плана.
Агент работает по правилам стартера и платформенным скилам процесса (уточнить → план → код).

**Перед началом:** сверь задачи с текущим кодом и `memorybank.md`, уточнённые детали запиши в memorybank.
Задачи 2.1–2.2 — UI, 2.3–2.6 — режимы и флоу, 2.7–2.8 — правила/скилы, 2.9 — чекпоинты.

---

## 2.1 Markdown и reasoning
- **Сервер:** в `PiToAgUiTranslator` — `thinking_start/delta/end` → `REASONING_START`,
  `REASONING_MESSAGE_START/CONTENT/END`, `REASONING_END` (точные поля сверить с `@ag-ui/core`);
  `closeOpen()` закрывает и их. Тесты.
- **Фронт:** зависимость `marked` (точная версия). Пайп/компонент `MarkdownView`: `marked.parse` →
  `DomSanitizer`-санитайзинг через `[innerHTML]` (Angular санитайзит автоматически, `bypassSecurityTrust*`
  **не использовать**). Код-блоки моноширинные с горизонтальным скроллом.
- `ChatItem` += `{ kind: 'reasoning'; id; text }`, сворачиваемый блок «Размышления», по умолчанию свёрнут.
- **Готово:** ответы рендерятся markdown'ом; reasoning модели (если провайдер его отдаёт) виден свёрнутым; тесты зелёные.

## 2.2 Карточки действий
- **Сервер:** `tool_execution_update` → `CUSTOM { name: 'tool_output', value: { toolCallId, text } }`
  (текст из `partialResult`; для bash — накопленный вывод). Ошибка тула → `CUSTOM { name: 'tool_status',
  value: { toolCallId, isError: true } }` перед `TOOL_CALL_RESULT`.
- **Фронт:** `ToolCallCard` вместо `ToolCallItem`: иконка и человекочитаемая подпись по типу тула
  (`read` → «Читает `path`», `write` → «Создаёт `path`», `edit` → «Правит `path`», `bash` → «`$ command`»,
  `grep/find/ls` → «Ищет …»); статус running (спиннер) / done / error; раскрывающийся лог (живой вывод bash).
- **Готово:** во время `npm install`/`ng build` в карточке идёт живой вывод; ошибки подсвечены.

## 2.3 Режимы plan / agent
- **Модель данных:** `Chat.mode: 'plan' | 'agent'` (по умолчанию `plan`), `Chat.todo` (2.5).
- **Передача:** клиент шлёт режим в `forwardedProps.mode` каждого рана; сервер сохраняет в чате.
  После `RUN_STARTED` сервер шлёт `STATE_SNAPSHOT { snapshot: { mode, todo } }`.
- **Extension** `server/src/agent/extensions/mode.extension.ts` — фабрика `modeExtension(getChat)`,
  подключается в `createSession` через `extensionFactories`:
  - `before_agent_start`: `e.systemPromptOptions.sections['mode'] = <инструкция режима>`
    (plan: «только исследуй и уточняй, задавай вопросы через ask_user, итог — docs/PLAN.md»;
    agent: «реализуй утверждённый docs/PLAN.md, веди update_todo, после изменений запускай сборку»);
  - `tool_call` в режиме plan: блокировать `write`/`edit`, кроме пути `docs/PLAN.md`, и `bash`
    (`{ block: true, reason: 'Plan mode: …' }`). Разрешены `read/grep/find/ls`, `ask_user`, `update_todo`.
- **Фронт:** переключатель режима над композером; slash-команды в композере: `/plan`, `/agent`
  (переключают режим; текст после команды отправляется сообщением); подсказка при вводе `/`.
- **Готово:** в plan агент не может писать файлы (карточка показывает блокировку); переключение работает.

## 2.4 Вопросы агента: тул `ask_user`
- `server/src/agent/tools/ask-user.tool.ts`, регистрируется в extension (`pi.registerTool`):
  параметры `{ questions: [{ id, text, options: string[], multiSelect?: boolean }] }` (TypeBox).
  `execute` возвращает текст «Вопросы показаны пользователю. Заверши ход и дождись ответа.»
- Сервер при `tool_execution_start` с `toolName === 'ask_user'` шлёт
  `CUSTOM { name: 'ask_user', value: { toolCallId, questions } }`.
- **Завершение хода после вопроса — проверить механизм pi** (кандидаты: `terminate: true` в результате
  хука `tool_call`/`tool_result`, `ctx.abort()` в `execute`). Выбранный вариант записать в memorybank.
- **Фронт:** `QuestionCard` — вопросы с кнопками вариантов (+ «Свой вариант» текстом), кнопка «Ответить»
  формирует одно user-сообщение вида `Ответы:\n- <вопрос>: <ответ>` и отправляет его.
- **Готово:** на расплывчатую идею агент задаёт вопросы карточкой, не додумывает; ответ продолжает работу.

## 2.5 Прогресс: тул `update_todo`
- Параметры `{ items: [{ text, status: 'pending' | 'in_progress' | 'done' }] }`; сохраняет в `Chat.todo`,
  сервер шлёт `STATE_SNAPSHOT { snapshot: { mode, todo } }`.
- **Фронт:** `TodoPanel` (над лентой или сбоку), обновляется по `STATE_SNAPSHOT`.
- **Готово:** во время реализации видно, какой шаг сделан/делается.

## 2.6 Утверждение плана
- Сервер: успешный `write`/`edit` файла `docs/PLAN.md` в режиме plan → после рана
  `CUSTOM { name: 'plan_ready', value: { content } }` (до `RUN_FINISHED`).
- **Фронт:** `PlanApprovalCard` — markdown плана + «Утвердить» (режим → `agent`, сообщение
  «План утверждён, приступай к реализации») и «Доработать» (фокус в композер).
- **Готово:** полный флоу: идея → вопросы → план → утверждение → реализация.

## 2.7 Платформенные правила и скилы (`server/agent/` = agentDir)
- `server/agent/AGENTS.md` — системные правила платформы для агента: язык ответов (язык пользователя),
  флоу уточнить → план → код, не трогать `server/` и конфиги стартера без запроса, после изменений
  `npm run build`, отвечать кратко и сообщать что сделано.
- `server/agent/skills/`: взять из https://github.com/obra/superpowers скилы `brainstorming`,
  `writing-plans`, `executing-plans`. **Сначала проверить лицензию** и сохранить атрибуцию в файле.
  Адаптировать: заменить ссылки на TodoWrite/субагентов/инструменты Claude Code на `update_todo`,
  `ask_user` и наш флоу режимов. Плюс свой скилл `feature-workflow` (фазы: discovery → clarifying
  questions → plan → implement → verify, по мотивам плагина feature-dev).
- Если скилы не подхватываются из agentDir — передать `additionalSkillPaths` в `DefaultResourceLoader`.
- **Готово:** в `session.systemPrompt` видны AGENTS.md платформы и список скилов (залогировать при старте в dev).

## 2.8 Правила в репозитории стартера (отдельный репо / ref из конфига)
- В стартере: `AGENTS.md` (стек, структура, команды, definition of done: `ng build` и `ng test` проходят),
  `CLAUDE.md` (`@AGENTS.md`), `.agents/rules/angular-best-practices.md` (копия из этого репо),
  `.agents/skills/add-page/SKILL.md` (новая страница: компонент + lazy route),
  `.agents/skills/add-api-endpoint/SKILL.md` (роутер в `server/src/routes`).
- Обновить `starter.ref` в конфигах на новый тег (например, `starter-v1`). Тег создаёт пользователь.
- **Готово:** в новом чате агент следует правилам стартера (проверить промптом «добавь страницу About»).

## 2.9 Git-чекпоинты
- После каждого рана в режиме agent, если есть изменения (`git status --porcelain`): `git add -A` +
  коммит с сообщением из первой строки запроса пользователя; затем `CUSTOM { name: 'files_changed',
  value: { commit, files: string[] } }` до `RUN_FINISHED`.
- **Фронт:** под ответом агента — компактный список изменённых файлов.
- **Готово:** история воркспейса — по коммиту на ход.

---

## Проверка слоя
1. Тесты и сборки сервера и клиента зелёные.
2. E2E: «хочу сайт-визитку для кофейни» → вопросы карточкой → ответы → план → «Утвердить» → реализация
   с todo и карточками действий → список изменённых файлов → `ng build` в воркспейсе проходит.
3. В режиме plan попытка записи файла блокируется.
4. Обновить `memorybank.md`.

**Стоп.** Сообщить пользователю, что слой 2 готов к commit + push.
