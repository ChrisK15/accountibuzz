# 1. Version Control

How source code, documentation, and planning artifacts are versioned, reviewed, and integrated for the Accountibuzz project.

## Tools

- **Git** — local version control on every developer machine.
- **GitHub** — single remote of record at `https://github.com/ChrisK15/accountibuzz`. Public repository.
- **GitHub Actions** — CI runs on every push and pull request. Two workflows live in `.github/workflows/`:
  - `ci.yml` — Node 20, `npx tsc --noEmit` (typecheck), `jest` test suite.
  - `rls-check.yml` — boots Supabase locally and asserts every public-schema table has Row-Level Security enabled.
  - **Note: We are still working on getting this functioning, don't know if it's worth having CI since app runs on expo for development**
- **Conventional Commits** for the commit message style (no automated tooling enforces it; the team applies it manually).

## Branching strategy

The project uses a **trunk-based** flow with a single long-lived branch:

- `main` is the only persistent branch and is always shippable.
- The team 2 developers and the cadence is fast, so feature branches are not used during normal phase execution. Commits land directly on `main` after they pass the developer's local checks.
- **Worktree branches** (`worktree-agent-*`) are used as throwaway scratch areas for AI-assisted parallel work; they are merged back into `main` via fast-forward and then deleted, never pushed to GitHub.
- For larger or riskier work, we will open a PR branch in the form `phase/NN-short-description`, push it, and open a pull request against `main` — see "Pull request flow" below.

## Commit conventions

Every commit message follows the pattern `<type>(<scope>): <imperative summary>`. Types and scopes used by this project:

| Type | When to use |
|---|---|
| `feat` | New user-visible feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation, planning artifacts, or process docs only |
| `refactor` | Code change with no behavior change |
| `test` | Adding or modifying tests only |
| `chore` | Tooling, dependencies, build scripts |

**Scope** is the phase number (`02`, `02-07`, `03`) or `state` for state-tracking commits. This makes it easy to pull every commit related to a specific phase.

Examples drawn from `git log`:

```
fix(02): WR-05 swap Alert.alert kebab for ActionSheetIOS + Android sheet
fix(02-07): clear React Query cache on SIGNED_OUT
docs(03): UI design contract for capture & admin review
docs(state): record Phase 3 planned (8 plans, ready to execute)
```

The scope tells you which phase the work belongs to; the imperative summary tells you what changed; references like `WR-05` (a code-review finding) and requirement IDs (`AUTH-04`) embedded in the body or summary close the loop with our tracing process (see [04-tracing.md](./04-tracing.md)).

## Pull request flow (when used)

1. Branch from `main`: `git switch -c phase/03-capture`.
2. Push: `git push -u origin phase/03-capture`.
3. Open a PR against `main` with `gh pr create`. PR title follows the same `type(scope): summary` rule.
4. Wait for both CI workflows to pass (`ci.yml` and `rls-check.yml`).
5. Squash-and-merge into `main`. Delete the branch.

## What is versioned

Everything in the repository is versioned, including:

- Application source (`app/`, `src/`, `supabase/`, `tests/`).
- Configuration files (`app.config.ts`, `babel.config.js`, `metro.config.js`, `package.json`, `tsconfig.json`).
- Planning artifacts (`.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/phases/**`).
- Process documentation (this folder).
- AI-assistant guardrails (`CLAUDE.md`).
- CI workflows (`.github/workflows/`).

What is **not** versioned (per `.gitignore`): `node_modules/`, `.expo/`, native build artifacts (`*.jks`, `*.p8`, `*.key`), local `.env` files (the example `.env.example` *is* committed so new contributors know what variables are required).

## Releases and tags

Released milestones will be tagged with `v<major>.<minor>.<patch>` once the MVP ships. The current pre-release state is untagged; the head of `main` is treated as "current".

## Recovery and reversibility

- All commits are atomic and individually revertible. The GSD (Get Shit Done) workflow enforces this — every plan in `.planning/phases/NN/` becomes one commit.
- Force-pushes to `main` are forbidden. The remote will reject them via repository settings; the team will not bypass this.
