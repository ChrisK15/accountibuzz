# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 01-foundation
**Areas discussed:** Schema scope in Phase 1, RLS CI check mechanism, Environments & migrations, Auth UX + avatar + app shell

---

## Schema scope in Phase 1

### Q1: How much of the Postgres schema should land in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Full schema upfront (Recommended) | All tables + RLS + security definer helpers now; later phases populate. | ✓ |
| Auth-only (profiles + helpers) | Only profiles + helper stubs; each later phase adds its own tables. | |
| Core triad only | profiles + groups + group_members only; defer submissions/invites/outbox. | |

**User's choice:** Full schema upfront

### Q2: How should derived/counter columns be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Columns + empty triggers now (Recommended) | Add points/current_streak/last_rolled_date + trigger stubs in P1; bodies filled later. | ✓ |
| Columns only, no triggers | Defer all trigger logic to the owning phase. | |
| Minimal columns — add later | Ship only auth-critical columns; add derived columns in Phase 4. | |

**User's choice:** Columns + empty triggers now

### Q3: Should Phase 1 include the submissions storage bucket + RLS?

| Option | Description | Selected |
|--------|-------------|----------|
| Create bucket + path-encoded RLS now (Recommended) | submissions bucket + path RLS; stays empty until P3. | ✓ |
| Defer to Phase 3 | Bucket created with capture feature. | |

**User's choice:** Create bucket + path-encoded RLS now

---

## RLS CI check mechanism

### Q1: How should the build-failing RLS check be implemented?

| Option | Description | Selected |
|--------|-------------|----------|
| SQL probe in GitHub Actions (Recommended) | Query pg_tables for rowsecurity=false; non-zero exit on any row. | ✓ |
| Supabase branching + advisor | Use Preview Branches + advisor API. | |
| Custom migration linter | Lint SQL files for ENABLE ROW LEVEL SECURITY. | |

**User's choice:** SQL probe in GitHub Actions

### Q2: Where else should the check run?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-push git hook (local) | Runs probe before push. | |
| Pre-commit hook | Runs on every commit. | |
| CI only | Rely on CI as sole gate. | ✓ (Claude's discretion) |

**User's choice:** "I don't know, you decide and tell me what you picked."
**Claude picked:** CI only — solo builder, fast local loop, CI runs on every push/PR.

---

## Environments & migrations

### Q1: How should Supabase environments be split?

| Option | Description | Selected |
|--------|-------------|----------|
| Local + remote prod (Recommended) | CLI local + one remote project for testing. | ✓ |
| Local + dev-remote + prod-remote | Two remote projects for isolation. | |
| Preview Branches | Per-PR Supabase envs (paid). | |

**User's choice:** Local + remote prod

### Q2: How are schema changes managed?

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase CLI migrations in repo (Recommended) | supabase/migrations/*.sql committed; db push. | ✓ |
| Studio-first, squash later | Edit in Studio; db pull into migrations. | |

**User's choice:** Supabase CLI migrations in repo

### Q3: Seed data strategy for local dev?

| Option | Description | Selected |
|--------|-------------|----------|
| supabase/seed.sql (Recommended) | Checked-in SQL; runs on db reset. | ✓ |
| No seed — sign up fresh each reset | Keep repo minimal; recreate by hand. | |
| TypeScript seed script | tsx script using supabase-js. | |

**User's choice:** supabase/seed.sql

---

## Auth UX + avatar + app shell

### Q1: Email confirmation on signup?

| Option | Description | Selected |
|--------|-------------|----------|
| Off for MVP (Recommended) | Immediate login after signup. | ✓ |
| On, with pending state | Require confirmation link. | |

**User's choice:** Off for MVP

### Q2: Password reset flow in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Include it (Recommended) | Forgot + reset screens + deep link. | ✓ |
| Defer to Phase 6 hardening | Manual dashboard reset until then. | |

**User's choice:** Include it

### Q3: Avatar upload in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship it: avatars bucket + upload (Recommended) | Public avatars bucket, expo-image-picker, client resize. | ✓ |
| Display-name only now, avatar later | Defer image upload. | |

**User's choice:** Ship it

### Q4: App shell / routing in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Auth stack + Profile only (Recommended) | (auth) + (app)/profile; other tabs come later. | ✓ |
| Full tab skeleton with placeholders | All 5 tabs as "Coming in Phase X" placeholders. | |

**User's choice:** Auth stack + Profile only

---

## Claude's Discretion

- RLS CI enforcement location (CI only, no local hooks)
- Avatar resize target (~512px max edge)
- Display-name validation defaults (2–32 chars, unicode ok, non-unique)
- No profile-level timezone field in P1
- Type generation via `supabase gen types typescript --local` in a `pnpm types:gen` script

## Deferred Ideas

- Enable email confirmation before public launch
- Dev/prod Supabase project separation
- Preview Branches
- Local pre-commit/pre-push RLS hook
- Profile-level timezone field
- Stricter display-name rules (uniqueness, length, profanity filter)
