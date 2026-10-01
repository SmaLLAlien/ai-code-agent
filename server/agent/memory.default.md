# Память команды

Договорённости, которые агент учитывает в каждом чате. Правится в интерфейсе («Память команды»).
Подробные правила — в проекте: `.agents/rules/angular-best-practices.md` и
`.agents/rules/typescript-best-practices.md`.

## UI

- Интерфейс строим на **Angular Material** (`@angular/material`): кнопки, поля, диалоги, меню, списки,
  тулбар, sidenav — компоненты Material, а не самописные аналоги.
- Цвета и типографика — только из темы Material (`--mat-sys-*` токены), без захардкоженных цветов.
  Фирменный цвет — `#4ea524` (primary). Светлая и тёмная тема — по системной настройке.
- Иконки — Material Symbols (`<mat-icon>`).
- У каждого компонента свои `.html` и `.scss` (`templateUrl` / `styleUrl`), без инлайн-шаблонов и стилей.
- Стили — SCSS в стиле **BEM** с вложенностью: класс блока на хосте (`host: { class: 'block' }`),
  `&__element`, `&--modifier`; без стилей по тегам. Подробно — `.agents/rules/component-templates-and-styles.md`.

## Angular

- Standalone-компоненты (без `standalone: true`), `ChangeDetectionStrategy.OnPush`.
- Состояние — signals, производное — `computed()`; `input()` / `output()` / `model()` вместо декораторов.
- Встроенный control flow (`@if`, `@for`, `@switch`); без `ngClass`/`ngStyle` — привязки `class`/`style`.
- `inject()` вместо конструкторной инъекции; сервисы-синглтоны — `providedIn: 'root'`.
- Каждая страница — lazy route. Формы — Reactive Forms.
- Доступность: проходит AXE, WCAG AA (контраст, фокус, aria, подписи полей, `alt`).

## TypeScript

- `strict`, без `any` — `unknown` и сужение типов.
- Явные типы для публичных API (параметры и возврат экспортируемых функций), внутри — вывод типов.
- `readonly` и неизменяемые обновления; размеченные объединения вместо флагов; без `!` там, где можно
  проверить.
- Не глотать ошибки: `catch` либо обрабатывает, либо пробрасывает с контекстом.

## Запомнено агентом
