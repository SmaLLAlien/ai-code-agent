# AGENTS.md

Инструкции для AI-агентов (Claude Code, Cursor, Codex, pi и др.), работающих в этом репозитории.

## Что это за проект

**ai-code-agent** — платформа, где пользователь в веб-чате общается с coding-агентом, а агент реализует
его идею MVP в свежем клоне нашего Angular-стартера. Агент — [pi](https://github.com/earendil-works/pi)
(SDK; LLM-провайдеры подключаются через конфиг: шлюз juapi.net и Google Gemini) на сервере; чат — Angular; поток событий агента — протокол
[AG-UI](https://docs.ag-ui.com) поверх SSE.

План реализации (послойный) — [docs/plan/README.md](docs/plan/README.md).
Текущее состояние работ, решения и найденные особенности — [memorybank.md](memorybank.md).

## Структура

```
src/                  Angular 21 клиент (standalone, signals, zoneless); чат — src/app/chat/
server/               Express 5 + TypeScript, ОТДЕЛЬНЫЙ пакет (свой package.json, node_modules)
  src/index.ts        запуск http-сервера, graceful shutdown
  src/app.ts          createApp(): compression, /api, раздача сборки Angular
  src/config.ts       типизированная обёртка над пакетом `config`
  src/routes/         Express-роутеры (/api/*), chats.ts — AG-UI endpoint
  src/agent/          pi: провайдеры LLM (llm.ts), фабрика сессий, tools/ (ask_user, update_todo),
                      extensions/ (режимы plan/agent)
  src/agui/           транслятор событий pi → AG-UI (+ CUSTOM-события UI)
  src/chats/          реестр чатов (ленивая загрузка, выгрузка по простою), состояние чата,
                      хранилище метаданных (chat.store.ts), журнал событий ленты (event-log.ts)
  data/               (не в git) chats.json, chats/<id>/events.jsonl, chats/<id>/session/ — сессии pi
  src/workspaces/     клонирование стартера в воркспейс чата, git-чекпоинты
  agent/              agentDir pi: платформенные правила агента (AGENTS.md) и skills/
  config/             dev.json | test.json | prod.json (пакет `config`)
docs/plan/            план по слоям: README.md + layer-N.md
.agents/rules/        правила кода (обязательны к соблюдению)
memorybank.md         журнал реализации
```

## Команды

| Где | Команда | Что делает |
|---|---|---|
| корень | `npm start` | Angular dev-server (http://localhost:4200) |
| корень | `npm run build` | сборка Angular в `dist/ai-code-agent/browser` |
| корень | `npm test` | unit-тесты Angular (Vitest) |
| `server/` | `npm run dev` | сервер в watch-режиме (tsx), конфиг `dev`, порт 3000 |
| `server/` | `npm run build` | компиляция TS в `server/dist` |
| `server/` | `npm start` | прод-запуск, конфиг `prod`, порт 8080 |
| `server/` | `npm test` | тесты сервера (node:test + tsx, файлы `src/**/*.test.ts`) |

Node ≥ 22.19 (требование pi SDK).

## Правила кода

### Общие
- TypeScript strict, без `any` (используй `unknown` и сужение типов).
- Prettier: `printWidth: 100`, `singleQuote: true` (см. `.prettierrc`).
- Пиши код в стиле окружающего кода: та же плотность комментариев, нейминг, идиомы.
- Не добавляй зависимости без необходимости; версии pi и AG-UI пинятся точно (без `^`).

### Angular (`src/`)
- **Обязательно следуй [.agents/rules/angular-best-practices.md](.agents/rules/angular-best-practices.md)**,
  включая раздел overrides для Angular 21 в его начале (OnPush явно, `@Injectable`, Reactive Forms).
- TypeScript (клиент и сервер): [.agents/rules/typescript-best-practices.md](.agents/rules/typescript-best-practices.md).
- **Шаблоны и стили: [.agents/rules/component-templates-and-styles.md](.agents/rules/component-templates-and-styles.md).**
  У каждого компонента свои `.html` (`templateUrl`) и `.scss` (`styleUrl`), без инлайна. Стили — BEM с
  вложенностью SCSS: класс блока на хосте (`host: { class: 'chat-page' }`), `&__element`, `&--modifier`;
  общие миксины — `src/styles/_mixins.scss`.
- UI: Angular Material с фирменной темой (`src/theme.scss`, primary `#4ea524`). Новый UI — на
  компонентах Material; цвета — через токены (`--mat-sys-*` или наши `--accent`, `--surface`… из
  `src/styles.scss`, которые на них ссылаются). Старые самописные компоненты переводим постепенно.
- Фичи — в папках `src/app/<feature>/`, маршруты — lazy (`loadComponent`).
- HTTP к серверу — только через относительные пути `/api/...` (в dev проксируется на :3000).

### Сервер (`server/`)
- ESM (`"type": "module"`): в относительных импортах указывай расширение `.js`.
- Конфигурация — только через пакет `config` и типизированный `server/src/config.ts`. Файл конфига
  выбирается переменной `NODE_CONFIG_ENV` (`dev|test|prod`); `NODE_ENV` остаётся стандартным.
- **Секреты только из переменных окружения** (`JUAPI_API_KEY`, `GEMINI_API_KEY`), никогда в
  `config/*.json` и не в git. Провайдеры LLM — только через `agent.llm` в конфиге и `server/src/agent/llm.ts`.

### Секреты (строго)
- **Никогда не читай и не выводи значения секретов**: не запускай `env`, `printenv`, `echo $JUAPI_API_KEY`,
  `Get-ChildItem env:`, не открывай `.env`/`*.env` файлы (в т.ч. `server/.env`), не логируй ключи.
- Ключи лежат в `server/.env` (в `.gitignore`, шаблон — `server/.env.example`); `npm run dev|start`
  подгружают его сами (`--env-file-if-exists`). Запускать сервер с ним можно, читать файл — нельзя.
- Тебе не нужен ключ: unit-тесты работают без него. Ручную проверку с реальной моделью выполняет
  пользователь — в конце слоя опиши ему шаги.
- Если для задачи кажется, что ключ нужен, — остановись и спроси пользователя.
- Роутеры — в `server/src/routes/`, подключаются в `apiRouter` **до** JSON-404.
- Никогда не отдавай stack trace клиенту (есть общий error handler в `app.ts`).
- Внешние процессы (`git` и т.п.) — через `execFile`/`spawn` с массивом аргументов, без shell.

## Как работать над задачами плана

1. Прочитай [memorybank.md](memorybank.md) — где остановились, какие решения уже приняты.
2. Открой текущий слой `docs/plan/layer-N.md` и бери задачи **строго по порядку**.
3. Для каждой задачи: реализуй → выполни её «Критерии готовности» → обнови `memorybank.md`
   (статус задачи, решения, найденные особенности API, отклонения от плана).
4. Если реальный API библиотеки расходится с планом — следуй реальному API (смотри `.d.ts` в
   `node_modules`) и запиши расхождение в `memorybank.md` → «Gotchas».
5. **Не делай `git commit` / `git push`.** В конце слоя выполни «Проверку слоя», обнови `memorybank.md`
   и остановись: сообщи пользователю, что слой готов к коммиту.
6. Не начинай следующий слой без явной команды пользователя.
