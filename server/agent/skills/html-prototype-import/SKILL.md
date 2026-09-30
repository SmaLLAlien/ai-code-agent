---
name: html-prototype-import
description: Use when the user provides an AI-generated single-file HTML prototype (pasted or as a file in the workspace) and wants it turned into a proper Angular project on the starter. Treat the HTML as a visual and functional reference, never copy it as one blob.
---

# Turning an HTML prototype into a starter project

The prototype shows what the user wants; the starter defines how it is built.

## In plan mode

1. Read the HTML fully. List what it contains:
   - screens/sections and navigation between them → pages and routes;
   - repeated blocks (cards, list items, forms) → components;
   - data in the markup or inline JS → typed models and a service (static data first);
   - inline scripts → component logic or services; drop dead code;
   - styles: colours, fonts, spacing → CSS custom properties in `src/styles.css` + component styles.
2. Ask with `ask_user` only about real gaps: which parts are must-have, what the fake data should become,
   whether to keep the exact look or clean it up.
3. Write `docs/PLAN.md` (skill `writing-plans`) with one task per page/component group, and a table
   "prototype part → Angular file".

## In agent mode

- Rebuild with the project rules: standalone components, signals, native control flow, lazy routes.
- No `innerHTML` with prototype markup, no copied inline `<script>`, no global jQuery-style DOM code.
- Keep texts and visual design recognisable; fix obvious accessibility issues (labels, contrast, alt).
- Put the original file under `docs/prototype/` for reference instead of deleting it.
