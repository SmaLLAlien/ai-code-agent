# Component templates and styles

Team rules for every Angular component. They override "Prefer inline templates for small components"
from `angular-best-practices.md`.

## Files

- Every component has its own files next to the class: `<name>.ts`, `<name>.html`, `<name>.scss`
  (and `<name>.spec.ts`). Use `templateUrl` and `styleUrl`; **never** `template:` or `styles:` inline,
  even for tiny components.
- Styles are SCSS. Global styles: `src/styles.scss`; theme: `src/theme.scss`; shared mixins:
  `src/styles/_mixins.scss` (`@use 'mixins' as *;` — `src/styles` is on the Sass load path).
- `ng generate component` already creates `.html` + `.scss` (schematics default `style: scss`).

## BEM with SCSS nesting

- **Block** = the component. Put the block class on the host element:
  `host: { class: 'chat-page' }` (kebab-case name of the component). Styles of the host element
  itself go into `:host { … }` (with emulated encapsulation a `.chat-page { … }` rule does not match
  the host element).
- **Elements** = `block__element`, **modifiers** = `block__element--modifier` (or `block--modifier`).
  Every styled element in the template gets a BEM class; do not style by tag (`header`, `li`, `button`).
- Write them nested in SCSS with `&`:

```scss
@use 'mixins' as *;

:host {
  display: flex;
}

.chat-page {
  &__header {
    display: flex;
  }

  &__title {
    @include ellipsis;
  }

  &__send {
    background: var(--mat-sys-primary);

    &:disabled {
      opacity: 0.5;
    }

    &--stop {
      background: var(--mat-sys-error);
    }
  }
}
```

- Modifiers are toggled with class bindings: `[class.chat-page__send--stop]="running()"` — never
  `ngClass`. State that also matters for accessibility keeps its ARIA attribute (`aria-pressed`,
  `aria-checked`) **in addition** to the modifier class.
- An element depending on a parent's modifier: nest the parent selector —
  `&__status { .tool-call-item__summary--error & { color: var(--mat-sys-error); } }`.
- Nesting depth: block → element → modifier/pseudo-class. No `.block__a__b` element chains: elements
  belong to the block, not to other elements.
- The only exception to "no tag selectors": HTML you do not control (e.g. rendered Markdown inside
  `.markdown-view__content`), scoped under a BEM element.
- Colours, typography and spacing come from theme tokens (`--mat-sys-*` or the app's own tokens that
  map to them), never hard-coded values. Material components are styled through their tokens
  (`--mat-button-filled-container-color: …`), not by overriding their internal classes.
- A scroll container that holds absolutely positioned children (e.g. `.visually-hidden` labels) gets
  `position: relative`, otherwise those children escape it and stretch the page.
