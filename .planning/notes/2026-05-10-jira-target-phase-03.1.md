# JIRA Target — Phase 03.1 (Polish & Realtime Hardening)

**Captured:** 2026-05-10
**Plan:** 03.1-01 Task 1 (`checkpoint:human-action` — confirm or create JIRA target story)
**Outcome:** SKIPPED for this execution session (rationale below).

## Context

The CLAUDE.md JIRA convention requires every `(03.1-NN)`-scoped commit to update a matching SCRUM story (status forward + 15-min-rounded work log). Phase 03.1 (Polish & Realtime Hardening) has no requirement IDs, so a single SCRUM target story must be identified or created to satisfy the convention.

Suggested title (per Plan 03.1-01 user_setup): "[P3.1] Polish & Realtime Hardening — modal + admin-realtime + shutter".

## Why this session skips

This session is being executed by a parallel-mode worktree executor agent that does NOT have access to the Atlassian MCP tools (`mcp__atlassian__*`) — only Read/Write/Edit/Bash. The MCP-driven creation/lookup steps in Task 1's `<what-to-do>` block cannot be performed here, and the worktree cannot pause for human input mid-run (the orchestrator force-removes the worktree on return — uncommitted state would be lost).

Documenting this skip is the explicit fallback path defined in Task 6 acceptance criteria: "If skipped: rationale documented in `.planning/notes/` or VERIFICATION.md so the audit trail is preserved (per CLAUDE.md — skipping is a 'process defect' unless the rationale is captured)."

## Follow-up — required before next 03.1-scoped session

Before the next interactive (non-parallel-worktree) session that will commit under a `(03.1-NN)` scope, the user (or an orchestrator agent with Atlassian MCP access) MUST:

1. Identify or create one SCRUM story for Phase 03.1 (suggested title above).
2. Append the SCRUM ID to this file under a new `## Resolved SCRUM ID` heading.
3. Retroactively log the cumulative time spent on Plan 03.1-01 (Tasks 2-5) against that story:
   - 15 min: Wave 0 RED test scaffold for `useReviewQueueRealtime`
   - 30 min: Implement Realtime hook for admin pending-review queue + count
   - 15 min: Wire admin-gated Realtime mount points
   - 15 min: Cross-device UAT prep / receipts capture (when Task 5 runs)
4. Move the SCRUM story status forward per the closing convention (To Do → In Progress on first historical commit; In Progress → In Review or Done if the phase is wrapping).

Plans 02 + 03 of this phase will inherit the SCRUM ID once captured here.

## Audit trail

This skip is intentional, documented, and confined to this single parallel-worktree session. It is NOT a silent process defect — it is a deferral with a recovery plan attached. The 2026-04-28 audit (SCRUM-25–30 rollback) is the canonical example of what happens when JIRA sync is silently skipped without documentation; this note prevents that failure mode for Plan 03.1-01.
