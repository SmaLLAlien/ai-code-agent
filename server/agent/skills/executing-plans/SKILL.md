---
name: executing-plans
description: Use in agent mode to implement an approved docs/PLAN.md task by task, keeping the user-visible progress list (update_todo) current and the project building after each task.
---

<!-- Inspired by the executing-plans skill of obra/superpowers (MIT). Rewritten for this platform. -->

# Executing the approved plan

1. **Read `docs/PLAN.md`** and the starter's `AGENTS.md` and rules.
2. **Publish the progress list** with `update_todo`: one item per plan task, all `pending`.
3. **For each task, in order:**
   - mark it `in_progress` (exactly one item in progress at a time);
   - implement only what the task says, following the project rules;
   - run its "Done when" check (at least `npm run build` when code changed); fix failures before moving on;
   - mark it `done`.
4. **If something in the plan is wrong or blocked**, stop and explain it (use `ask_user` if the user
   must choose). Do not silently change the scope.
5. **Finish** with the `verification-before-completion` skill, then a short summary: what works now,
   how to see it, what is left out.

Dependencies: run `npm install` once if `node_modules` is missing before the first build.
