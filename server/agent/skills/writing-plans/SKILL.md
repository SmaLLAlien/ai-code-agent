---
name: writing-plans
description: Use in plan mode once requirements are clear, to write docs/PLAN.md — an implementation plan split into small, verifiable tasks with exact file paths, which the user approves before any code is written.
---

<!-- Inspired by the writing-plans skill of obra/superpowers (MIT). Rewritten for this platform. -->

# Writing the implementation plan

Write the plan to `docs/PLAN.md` (the only file you may write in plan mode). The user reads it in the
UI and approves it, so write it in the user's language and keep it scannable.

## Structure

```markdown
# <MVP name>

## Goal
2-3 sentences: what the user gets.

## Decisions
- Key choices from the brainstorming (data source, pages, style), one line each.

## Out of scope
- What the MVP deliberately does not do.

## Tasks
### 1. <short title>
- Files: `src/app/...` (create) / `src/app/app.routes.ts` (modify)
- Steps: 2-4 bullets
- Done when: a concrete check (builds, page shows X, test passes)
```

## Rules

- Tasks are small (a few minutes each) and ordered so the app builds after every task.
- Name exact files. Follow the starter's structure (`src/app/<feature>/`, lazy routes).
- The first task usually sets up routes/layout, the last one is a full build and self-check.
- 3-10 tasks for an MVP. If it needs more, the scope is too big — say so and propose a cut.
- Also write the key decisions from the brainstorming to `docs/DECISIONS.md`
  (`## <date> — <decision>` + one line why).
- After writing, reply with a 3-5 line summary and ask the user to approve the plan.
