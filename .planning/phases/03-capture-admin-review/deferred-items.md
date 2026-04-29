# Phase 3 — Deferred Items

## Pre-existing tsc errors in `design_refs/` directory

**Discovered:** 03-01, Task 2 (typecheck verification)
**Status:** Out of scope — pre-existing condition

The `design_refs/` directory at the repo root contains Lovable-exported design reference code (untracked in git). Its files are matched by `tsconfig.json`'s `"include": ["**/*.ts", "**/*.tsx"]` glob, producing 188 tsc errors against `npx tsc --noEmit`:

- Missing modules: `lucide-react`, `@/lib/utils`, `react-router-dom`, `vitest`, `vite`, `@vitejs/plugin-react-swc`, `lovable-tagger`, `tailwindcss`, etc. (all web-stack deps not in the RN project)
- Implicit-any binding errors in `vite.config.ts`

Verified pre-existing: stashing the Task 2 `app.config.ts` change and re-running tsc produces the same 188 errors with **0 project-source errors**. The Phase 3 expo-camera plugin tuple typechecks cleanly.

**Recommended fix (future hardening, e.g. Phase 6):** Add `"design_refs"` to `tsconfig.json` `"exclude"` array. One-line change, but out of scope for Phase 3 capture work.

**Why not fix now:** `tsconfig.json` is not in any Phase 3 plan's `files_modified`. Touching it from a feature plan crosses scope boundaries. Tracked here so Phase 6 hardening or a future tooling pass can sweep it.

## Pre-existing jest failure in `design_refs/` directory

**Discovered:** 03-01, Task 3 (`pnpm test` run)
**Status:** Out of scope — pre-existing condition

Jest discovers `design_refs/design_code_for_claude/accounti-buzz-spark-main/src/test/example.test.ts` because `jest.config.js` `testPathIgnorePatterns` does not exclude `/design_refs/`. The file imports `vitest`, which is not (and should not be) in this project's deps, so the suite fails to load.

Verified pre-existing: stashing the Task 3 `jest.setup.ts` change and re-running `npx jest` produces identical results — 25 passed, 1 failed (the vitest design_refs suite), 120/120 actual tests passing. The Phase 3 mocks do not introduce any test failures.

**Recommended fix (future hardening):** Add `'/design_refs/'` to `jest.config.js` `testPathIgnorePatterns`. One-line change.

**Why not fix now:** `jest.config.js` is not in any Phase 3 plan's `files_modified`. Touching it from a feature plan crosses scope boundaries.

