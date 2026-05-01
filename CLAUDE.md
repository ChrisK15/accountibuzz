## Project

Accountibuzz

## Process — JIRA + commit convention

When committing under a phase scope (e.g. `fix(03-04): ...`, `feat(02-05): ...`), update the matching JIRA story in the same session:

- Move status forward at most one step (To Do → In Progress on first commit; In Progress → In Review or Done on the closing commit).
- Log time spent via `+ Add work log` on the story, rounded to 15-min increments.
- Identify which JIRA story by reading `.planning/phases/<phase>/<plan>-PLAN.md` and matching its requirement IDs against the SCRUM epic's child stories.

JIRA project: `SCRUM` at `comp586.atlassian.net` (Atlassian MCP). Full convention + rationale: [`docs/processes/03-requirements-status-tracking.md`](docs/processes/03-requirements-status-tracking.md). Source-of-truth process docs: [`docs/processes/`](docs/processes/).

A commit that touches a phase scope but does not update JIRA is treated as a process defect — the audit on 2026-04-28 (SCRUM-25–30 rollback) is the canonical example of what happens when this is skipped.

## Technology Stack

# Stack Research — Accountibuzz

**Domain:** Mobile accountability / social-gamification app (iOS + Android, solo-builder MVP)
**Researched:** 2026-04-21
**Confidence:** HIGH (core picks verified against Expo SDK 55 official docs and Supabase official quickstart; a few ancillary library pins are MEDIUM)

Scope validated against upstream constraints: React Native + Expo + Supabase are already chosen. This doc pins *specific* libraries/versions for SDK 55 (released Feb 25, 2026 — the current stable line) and flags which ones force a development build vs. staying in Expo Go.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Expo SDK** | `55` (expo@~55.0.x) | App framework / native build system | Current stable (Feb 2026). Ships RN 0.83.1 + React 19.2, New Architecture only, Hermes v1. First-party libraries for camera, video, notifications, secure store, linking — all the pieces t

