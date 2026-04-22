# State: Accountibuzz

**Initialized:** 2026-04-21
**Mode:** yolo
**Granularity:** standard

## Project Reference

- **Core Value:** A missed day is visible to your group within hours — the social cost of skipping is what keeps you accountable.
- **Current Focus:** Foundation — identity, schema, RLS before any feature code
- **Stack (pinned):** Expo SDK 55 (RN 0.83.1, React 19.2, New Arch) + Supabase (Postgres + Auth + Storage + Realtime + Edge Functions + pg_cron)
- **Granularity:** standard
- **Parallelization:** true

## Current Position

- **Phase:** 1 — Foundation (not started)
- **Plan:** none yet
- **Status:** Roadmap approved, ready for `/gsd-plan-phase 1`
- **Progress:** `░░░░░░░░░░` 0% (0 / 6 phases complete)

## Roadmap At-a-Glance

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation | Not started |
| 2 | Groups & Invites | Not started |
| 3 | Capture & Admin Review | Not started |
| 4 | Social Surfaces | Not started |
| 5 | Push & Daily Rollover | Not started |
| 6 | Pre-Rollout Hardening | Not started |

## Performance Metrics

- Phases complete: 0 / 6
- Plans complete: 0 / ?
- Requirements shipped (validated): 0 / 40

## Accumulated Context

### Key Decisions (from PROJECT.md)

- React Native + Expo (solo, cross-platform, fastest ship)
- Supabase backend (auth/Postgres/storage/realtime/cron in one)
- Single creator-as-admin (simplest trust model)
- Invite-only via link/code (leverages social trust, no discovery surface)
- Group-timezone midnight cutoff (one setting, no per-user tz math)
- Submission type fixed per group by admin (consistent group norm)
- Strict streak reset on miss (the core pressure mechanic)
- 1 point per verified day, flat (simplest leaderboard)
- Pending-until-reviewed (human trust anchor)

### Research Flags (from SUMMARY.md)

- **Phase 3:** TUS resumable upload compatibility with Expo SDK 55 + supabase-js 2.58 — run reference client against pinned versions before locking upload architecture
- **Phase 5:** `pg_cron` DST-boundary correctness; EAS credentials checklist for APNs+FCM; Supabase DB webhook config for outbox
- **Phase 6:** Small-group retention intervention patterns — acceptable "re-entry ritual" without violating strict-reset

### Open Questions

- Universal-link domain ownership (`accountibuzz.app` or similar) — decide by start of Phase 2 planning; fall back to custom scheme if not hosted
- Photo-only vs photo-or-video at MVP — decide at Phase 3 planning based on first testing groups' preferences

### Todos

(none yet)

### Blockers

(none)

## Session Continuity

- **Last session:** 2026-04-21 — project initialized, requirements defined, research completed, roadmap drafted
- **Next session:** Run `/gsd-plan-phase 1` to decompose Foundation into plans
- **Resume hint:** Start Phase 1 with schema + RLS + CI check; auth and profiles build on that foundation

---
*State initialized: 2026-04-21*
