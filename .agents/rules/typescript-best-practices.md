# TypeScript best practices

Rules for all TypeScript in this project (client and server). The compiler runs in `strict` mode.

## Types

- No `any`. Use `unknown` for values of unknown shape and narrow them (`typeof`, `in`, type guards).
- Let inference work for local variables; write explicit types for exported functions (parameters and
  return type), public class members and module boundaries (API payloads, events, config).
- Model alternatives with discriminated unions (`{ kind: 'a'; … } | { kind: 'b'; … }`) and exhaustive
  `switch` statements instead of boolean flags or optional fields that depend on each other.
- Prefer `interface` for object shapes that are extended, `type` for unions, mapped and utility types.
- Use literal unions (`'plan' | 'agent'`) or `as const` objects instead of `enum`.
- Avoid non-null assertions (`!`) and type assertions (`as`); when one is unavoidable (e.g. data from
  `JSON.parse`), keep it at the boundary and validate the shape.
- Use `readonly` for data that must not change (`readonly T[]`, `Readonly<T>`); update immutably.
- Type external input (HTTP bodies, files, env) as `unknown` and validate before use.

## Functions and modules

- Small functions with one responsibility; pure functions for logic, side effects at the edges.
- Return early instead of nesting; no flag parameters that switch behaviour — split the function.
- Named exports; one concept per module; no circular imports.
- `async`/`await` over raw promise chains; always `await` or explicitly `void` a promise.

## Errors

- Throw `Error` (or subclasses) with a clear message; add context with `{ cause }` when re-throwing.
- Never swallow errors silently: a `catch` handles the error, maps it to a user-facing result, or
  re-throws. Narrow `catch (err)` (`err instanceof Error`) before reading properties.

## Naming and style

- `camelCase` for values and functions, `PascalCase` for types and classes, `UPPER_SNAKE_CASE` only for
  true constants. Names say what, not how (`activeChats`, not `arr2`).
- Comments explain *why*, not *what*. Keep them up to date with the code.
- Formatting is Prettier's job (`printWidth: 100`, `singleQuote: true`).

## Tests

- Test behaviour through the public API; pure logic gets unit tests with explicit inputs and outputs.
- One reason to fail per test; descriptive test names.
