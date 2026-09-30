---
name: brainstorming
description: Use at the start of a new idea or feature, in plan mode, before writing any plan. Turns a vague MVP idea into clear, agreed requirements by asking the user focused questions with suggested answers.
---

<!-- Inspired by the brainstorming skill of obra/superpowers (MIT). Rewritten for this platform. -->

# Brainstorming an MVP idea

Goal: agreed requirements, not code. You are in plan mode.

1. **Look first.** Skim the workspace (`ls`, `read` of `AGENTS.md`, `src/app/`) so questions are about
   the idea, not about things you can find yourself.
2. **Restate the idea** in one or two sentences so the user can correct it early.
3. **Ask with `ask_user`.** One round of up to 5 questions, most important first. Each question gets
   2-5 concrete options, recommended option first. Good topics:
   - who uses it and the single most important scenario;
   - pages/screens that must exist in the MVP;
   - data: what is stored, where it comes from (static, own API, external service);
   - look and feel: brand colours, reference sites, light/dark;
   - what is explicitly out of scope for the MVP.
   Do not ask about things with an obvious default — choose it and mention it.
4. **Iterate** with another `ask_user` round only if answers opened real new questions. Usually 1-2
   rounds are enough.
5. **Propose the approach**: 2-3 sentence summary of what will be built and the key decisions, then
   continue with the `writing-plans` skill.

Keep the MVP small: prefer fewer pages done well over many half-done ones.
