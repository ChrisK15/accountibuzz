# Process Documentation — Accountibuzz (COMP586)

This folder captures the four engineering processes the team uses to manage the Accountibuzz project end-to-end.

| # | Process | Document | What it covers |
|---|---|---|---|
| 1 | Version Control | [01-version-control.md](./01-version-control.md) | Git, branching, commit conventions, GitHub, CI |
| 2 | Change Control | [02-change-control.md](./02-change-control.md) | How a new or changed requirement enters the system |
| 3 | Requirements Status Tracking | [03-requirements-status-tracking.md](./03-requirements-status-tracking.md) | How we know what's done, in progress, or open |
| 4 | Tracing | [04-tracing.md](./04-tracing.md) | The chain: requirement → epic → story → commit → release |

## Tools at a glance

| Tool | Purpose |
|---|---|
| **Git + GitHub** (`ChrisK15/accountibuzz`) | Source of truth for code; immutable commit history |
| **GitHub Actions** | CI: typecheck, Jest, Supabase RLS check on every push/PR |
| **Jira** (comp586.atlassian.net, project `SCRUM`) | Work item tracking — epics, stories, bugs, sprints, story points, time logging |
| **`.planning/` directory** | Project-level planning artifacts: requirements, roadmap, phase plans, state |
| **`REQUIREMENTS.md`** | Authoritative list of v1 requirements with stable IDs (AUTH-01, GRP-01, …) |
| **`ROADMAP.md`** | Phase breakdown that maps each phase to a set of requirement IDs |
| **CLAUDE.md** | AI-assistant guardrails (stack pins, conventions) so generated work matches project standards |

## Document conventions

- All process documents are checked into the repo (`docs/processes/`), not stored in a wiki, so they version with the code they describe.
- Each document leads with a one-paragraph summary, then walks through the steps of the process, then shows a worked example from this project.
- "Process changes" follow the same change-control flow as a code change: edit the doc, commit with `docs(process):` prefix, push, merge.
