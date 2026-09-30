---
name: verification-before-completion
description: Use before saying work is done, fixed or passing. Run the actual checks and report their real result instead of assuming success.
---

<!-- Inspired by the verification-before-completion skill of obra/superpowers (MIT). Rewritten for this platform. -->

# Verify before claiming completion

Never say "done", "works" or "fixed" based on having edited files. Evidence first:

1. `npm run build` in the workspace root — must finish without errors.
2. `npm test -- --watch=false` if the project has tests for what you changed.
3. Re-read the plan's "Done when" for the tasks you touched and check each one.

Report honestly: what passed, what failed (with the key error line), what you could not verify.
If a check fails, fix it or say clearly that it is still failing — do not hide it.
