# Quality gates — what must pass before merge

> Part of [`engineering/`](README.md).

Enforced via `.github/workflows/ci.yml` (created in Phase 0, see
[`build-sequence.md`](build-sequence.md)), running on every PR:

1. `npm run lint` — ESLint, zero warnings tolerated on changed files.
2. `npm run typecheck` — `tsc --noEmit`, zero errors.
3. `npm test` — Vitest, all tests pass.
4. `npm run build` — production build must succeed.

Locally, run all four before pushing — CI catching something you could
have caught in 30 seconds locally is wasted round-trip time.
