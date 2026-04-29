# 2. Change Control

How a new requirement, a change to an existing requirement, or any other scope change moves from "someone had an idea" to "the change is part of the plan and reflected in code." The goal is no surprise scope.

## Inputs to change control

A change can originate from any of these sources:

| Source | Example |
|---|---|
| Customer/user feedback | Beta tester says "I want to leave a group" |
| Manual QA | Tester finds a bug in the release APK |
| Code review | Reviewer flags a missing edge case |
| Stakeholder/instructor | Course feedback during demo |
| Engineering | Tech-debt or architectural concern surfaces during execution |
| Compliance / data integrity | Audit finds a silent data-corruption bug (see SCRUM-49, SCRUM-50) |

## The intake → triage → planning pipeline

```
┌──────────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐
│  Intake  │ -> │ Triage  │ -> │  Plan    │ -> │ Execute  │ -> │ Verify │
└──────────┘    └─────────┘    └──────────┘    └──────────┘    └────────┘
   (capture)    (classify)     (sequence)      (commit)        (close)
```

### Step 1 — Intake (capture without losing context)

The team uses one of three lightweight capture commands so nothing falls on the floor:

- **`/gsd-add-backlog <idea>`** — non-urgent, future-milestone idea. Lands in the parking lot at `999.x` so it does not pollute the active roadmap.
- **`/gsd-plant-seed <idea>`** — forward-looking idea with a trigger condition (e.g., "when push notifications phase starts, also consider quiet hours"). Surfaces automatically when the trigger fires.
- **`/gsd-add-todo <task>`** — small actionable item that should be done soon but does not warrant a full phase plan.
- **`/gsd-note <observation>`** — zero-friction free-text note for things that may or may not become work.

Bugs found in production or QA are filed directly as **Bug** issues in JIRA (the `SCRUM` project) with steps-to-reproduce, expected vs. actual, environment, and a severity rationale. Examples already in the system: `SCRUM-48` through `SCRUM-54`.

### Step 2 — Triage (classify the change)

Within ~48 hours the team triages each new item and decides one of:

| Outcome | Action |
|---|---|
| **Reject / out of scope** | Add a one-line rationale to the item and close. Document in `.planning/notes/` if it might come up again. |
| **Accept into current milestone** | Promote to `REQUIREMENTS.md` (if it is a new requirement), add to `ROADMAP.md` under the appropriate phase, and create a JIRA story with the matching parent epic. |
| **Accept into a future milestone** | Leave it in the backlog (`999.x`) but mark it confirmed. |
| **Convert to bug** | File as a JIRA Bug, link to the parent epic, set priority by severity. |

A change that **modifies an already-implemented requirement** is treated as a new requirement plus a deprecation note on the old one. The old requirement keeps its ID in `REQUIREMENTS.md` but is annotated `(superseded by <NEW-ID>)` so historical commits and tickets remain traceable.

### Step 3 — Plan (sequence the work)

Once accepted into the active milestone, the change moves through the standard GSD planning loop:

1. `/gsd-spec-phase` — refine *what* is being delivered, with falsifiable acceptance criteria, before any implementation decisions.
2. `/gsd-discuss-phase` — gather context: codebase patterns, gray areas, assumptions.
3. `/gsd-plan-phase` — produce a `PLAN.md` per work-stream, broken into atomic-commit-sized plans, with goal-backward verification.
4. (Optional) `/gsd-review` — cross-AI peer review of the plan to catch missed concerns before any code is written.

The plan files live at `.planning/phases/NN-phase-name/NN-MM-PLAN.md` and are committed under `docs(NN): create phase plan` so the planning record is permanent and reviewable.

### Step 4 — Execute (atomic commits)

Each plan in a phase is implemented and committed in one atomic commit (`fix(NN-MM): ...` or `feat(NN-MM): ...`). Tests are part of the same commit unless the plan explicitly carves them out. CI must be green before the next plan starts.

### Step 5 — Verify (close the loop)

When all plans in a phase are complete:

1. `/gsd-verify-work` walks through the phase's success criteria one by one (UAT-style) and produces `VERIFICATION.md`.
2. `/gsd-code-review` produces `REVIEW.md` with severity-classified findings; `/gsd-code-review-fix` applies them as new atomic commits (e.g., `fix(02): WR-05 swap Alert.alert ...`).
3. The phase row in `ROADMAP.md` flips from `[ ]` to `[x]`.
4. The corresponding requirement IDs in `REQUIREMENTS.md` flip from `[ ]` to `[x]`.
5. The matching epic in JIRA is transitioned to **Done**.

## Configuration / environment changes

- **Dependency upgrades** are landed as a single `chore: bump <package> <old> -> <new>` commit, after `npm install` regenerates `package-lock.json`. The CLAUDE.md technology stack section is updated in the same commit if the upgrade crosses a major-version boundary.
- **Schema / migration changes** (`supabase/migrations/`) are append-only — never edit a migration that has already been applied. A new migration is added, the change goes through the same plan/execute/verify loop, and the `rls-check.yml` workflow guards against accidentally introducing a public table without RLS.

## What change control is *not* allowed to do

- **Silently re-scope a phase mid-execution.** If a new requirement appears mid-phase, it goes through intake/triage like anything else; if accepted, it lands in a *future* phase or as a decimal phase (`/gsd-insert-phase`) — never bolted into the running phase without an explicit re-plan.
- **Bypass CI.** Force-pushes, `--no-verify`, and skipping the typecheck/RLS workflows are not permitted.
- **Bury a decision.** Every accept/reject decision leaves an artifact: a doc, a backlog entry, a JIRA comment, or a closed issue.
