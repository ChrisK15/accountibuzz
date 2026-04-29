# 3. Requirements Status Tracking

How the team always knows, for any requirement, whether it is open, in progress, blocked, or done — and where to look for the evidence.

## Sources of truth

There is no single status field that lives in one place. Instead, three artifacts mirror each other and are kept in sync as part of the change-control process:

| Artifact | What it tracks | Granularity |
|---|---|---|
| `.planning/REQUIREMENTS.md` | The 30+ requirement IDs that define v1 | One checkbox per requirement (`AUTH-01`, `GRP-01`, …) |
| `.planning/ROADMAP.md` | Phase-level rollup | One checkbox per phase + per plan |
| **JIRA** (project `SCRUM`) | Day-to-day work tracking | Epic / Story / Bug, each with workflow state |

Disagreement between any two of these is itself a tracked issue — the resolution rule is that JIRA is authoritative for *which work is currently being done*, and `REQUIREMENTS.md` is authoritative for *what the project promised to deliver*.

## Statuses

### Markdown checkbox states (REQUIREMENTS.md, ROADMAP.md)

| Marker | Meaning |
|---|---|
| `[ ]` | Open — not started |
| `[x]` | Done — verified against acceptance criteria |
| `(blocked: <reason>)` after the title | Blocked — work has begun or is queued but cannot proceed |
| `(superseded by <NEW-ID>)` | Superseded — kept for traceability but no longer counted toward v1 |

### JIRA workflow states

The `SCRUM` project uses these four statuses:

| Status | Definition |
|---|---|
| **To Do** | Backlog or sprint-committed work that has not started. |
| **In Progress** | Active development. Exactly the items the team is currently working on. |
| **In Review** | Implementation complete, awaiting code review or UAT verification. |
| **Done** | Verified, merged to `main`, and the matching `REQUIREMENTS.md` checkbox flipped. |

Transitions are not silent — every status change creates an audit entry on the JIRA issue so the timeline is recoverable.

## Definition of Done

A requirement (and the JIRA story implementing it) is **Done** only when *all* of these are true:

1. The implementation is merged to `main`.
2. CI is green on `main` (typecheck + Jest + RLS check).
3. Acceptance criteria from the parent phase plan are demonstrated, either through automated tests or through the `/gsd-verify-work` UAT walkthrough recorded in `VERIFICATION.md`.
4. The matching checkbox in `REQUIREMENTS.md` is flipped to `[x]`.
5. The JIRA story is transitioned to **Done** with story points and time-spent recorded.

Items 4 and 5 are the most commonly-skipped steps; the change-control process treats not closing them as a defect.

## Daily / per-session updates

State updates are made continuously, not in a weekly batch:

- **Inside an editing session**, status updates land via `.planning/STATE.md` — a short rolling log of "what was just done / what is queued next." This is the single piece of state we expect to be wrong if you have not committed in the last 30 minutes.
- **At commit time**, the commit scope (`fix(02-07): ...`) communicates which phase/plan was advanced.
- **At phase completion**, all three artifacts (REQUIREMENTS.md, ROADMAP.md, JIRA) are updated together as part of the same closing commit (`docs(NN): close phase`).

## Story points and effort capture

Story points (Fibonacci 1, 2, 3, 5, 8) are estimated **before** execution begins and live in JIRA's `customfield_10016`. Points are estimates of *relative complexity*, not hours. Epics are intentionally unpointed — points roll up from their child stories.

**Actual time worked** is captured per JIRA issue using the Work Log (`+ Add work log`) on each ticket. Conventions:

- Log time as soon as a session ends, not at the end of the week.
- Use the smallest unit of practical resolution: `30m`, `1h`, `1h 30m`. Avoid logging less than 15 minutes — round up.
- Add a one-line comment on the work log describing what was actually done in that session, especially if the time deviates significantly from the estimate.

The estimate-vs-actual delta is reviewed at sprint close and informs the next sprint's pointing calibration. See [04-tracing.md](./04-tracing.md) for how this connects back to requirement-level effort.

## Sprint mechanics

- One sprint per major phase. Sprint name carries the phase scope (e.g., `Sprint 4 - Upload + Admin Review`).
- Sprint length is not fixed; it is whatever the phase length is. A short phase produces a short sprint.
- The active sprint at any time is visible in JIRA → Backlog. Closed sprints retain their burndown chart for retrospective.
- Stories are added to a sprint only after they have story points — this is a hard rule because the burndown chart relies on it.

## Reporting

Three reports are produced from the tracked data:

1. **Per-phase progress** — derivable from `ROADMAP.md` checkboxes; used in weekly status updates.
2. **Sprint burndown** — JIRA → Reports → Burndown Chart for the active sprint. Plotted in story-points-remaining over time.
3. **Requirements distribution chart** — categorical breakdown of requirements by category (Auth, Groups, Submissions, …) and by priority (Highest/High/Medium/Low). Generated by exporting JIRA issues to CSV and charting in Sheets, or by reading directly off the `SCRUM` board's Priority swimlane.

## Per-commit JIRA update convention (going-forward)

The team learned the hard way that JIRA status drifts when it is updated in batches at sprint close. The audit on **2026-04-28** found six Admin-Review stories (SCRUM-25 through SCRUM-30) marked Done in JIRA even though the underlying implementation was still queued in Phase 3. They were rolled back to To Do and a corrective comment was added to each. To prevent this recurring, the team now follows this convention every time a phase plan produces a commit:

1. **Open the JIRA story** that the commit advances. Identify it from the commit scope: `fix(03-04): ...` → look at `.planning/phases/03-capture-admin-review/03-04-PLAN.md` → cross-reference the requirement IDs in that plan against the SCRUM epic's child stories.
2. **Move status forward at most one step.** A first commit on a story moves it from To Do → In Progress. A closing commit (the one that satisfies the AC) moves it from In Progress → In Review (or Done if the verification step has already happened).
3. **Log time spent** on the story in the same session, using `+ Add work log`. Round to 15-minute increments. Add a one-line comment when actual time deviates more than 50% from the estimate.
4. **Reference the commit hash** in a JIRA comment if the connection is non-obvious (e.g., when one commit advances multiple stories). Example: `Implements AC #2 and #3 — see commit 3a64581.`

A status change that is not paired with a commit (or vice versa) is itself a process defect — the audit and rollback above is the canonical example of what happens when the convention is skipped.

## Why batches fail

The deeper reason this matters: any time tooling can update JIRA in bulk (sprint-close automation, a one-shot status sweep, an "I'll catch up Friday" pattern), the connection between *what was actually built* and *what JIRA reports* gets weaker. Batches optimize for convenience and lose verifiability. Per-commit updates optimize for verifiability and add 15 seconds of friction per commit — friction that pays off the moment anyone has to defend the project's status to a stakeholder, a grader, or a sprint retrospective.
