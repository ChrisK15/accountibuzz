# Phase 1: Foundation - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Identity, schema, and authorization — every subsequent phase builds on this. Phase 1 delivers:
- Expo SDK 55 + Supabase project wired together
- Email/password auth with session persistence (AsyncStorage + SecureStore hybrid)
- Logout
- Profile creation/edit (display name + avatar)
- Full Postgres schema with RLS enabled on every public-schema table
- Server-side timezone-derived `local_date` infrastructure
- CI check that fails builds when any public-schema table has RLS disabled

Out of scope for Phase 1 (other phases own these): group creation/invites (P2), submissions/admin review (P3), points/streaks/feed/leaderboard (P4), push + rollover (P5).

</domain>

<decisions>
## Implementation Decisions

### Schema Scope
- **D-01:** Ship the **full Postgres schema upfront** in Phase 1 — `profiles`, `groups`, `group_members`, `submissions`, `invites`, `notifications_outbox` — along with all RLS policies and the `is_group_member` / `is_group_admin` `security definer` helpers. Tables stay empty until their owning phase populates them. Rationale: aligns with the roadmap's "Foundation locks authorization" framing; avoids mid-milestone schema churn; gives the RLS CI check real teeth from day one.
- **D-02:** Denormalized counter columns (`points`, `current_streak`, `last_rolled_date`) are **added in P1 with empty trigger stubs**. Trigger bodies are filled in Phase 4 (social surfaces) and Phase 5 (rollover). The shape is locked now so later phases don't rewrite the table.
- **D-03:** The `submissions` storage bucket is **created in P1 with path-encoded RLS policies** (`group_id/user_id/date` path). Bucket stays empty until Phase 3. Keeps the RLS-everywhere discipline consistent; `storage.objects` policies are covered by the CI check.

### RLS CI Check
- **D-04:** Implementation = **SQL probe in GitHub Actions**. CI job spins up a Postgres instance (via `supabase start` or a service container), applies migrations, runs a query against `pg_tables WHERE schemaname='public' AND rowsecurity=false`, exits non-zero on any row. Also verifies `storage.objects` has policies for the `submissions` and `avatars` buckets.
- **D-05:** Enforcement point = **CI only** (no pre-commit or pre-push hooks). Claude's discretion — picked for solo-builder ergonomics: CI runs on every push/PR, local dev loop stays fast, easy to add a local hook later if false-negatives ever escape.

### Environments & Migrations
- **D-06:** **Local + one remote Supabase project.** Supabase CLI for local Postgres during dev/testing; one remote Supabase project serves as "prod" (used by EAS dev builds / TestFlight / friend-group testing). No separate dev-remote project for MVP — revisit if friend-group testing needs isolation from live dev work.
- **D-07:** Migrations live in **`supabase/migrations/*.sql`, committed to the repo**, applied via `supabase db push`. Git diff is the source of truth. No studio-first / db-pull workflow.
- **D-08:** **`supabase/seed.sql`** checked into repo provides a known test user, test group, and sample members. Runs on `supabase db reset`. Makes the app demoable on a fresh clone.

### Auth UX
- **D-09:** **Email confirmation OFF** for MVP (Supabase Auth "Confirm email" disabled). Users log in immediately after signup. Turn on before public launch — tracked in deferred ideas.
- **D-10:** **Password reset IS shipped in Phase 1** — Supabase forgot-password + reset screen + deep link handler. Cheap now, painful to retrofit after users exist.

### Avatar
- **D-11:** **Avatar upload ships in Phase 1** — dedicated `avatars` public bucket, `expo-image-picker` for selection (camera roll is fine for avatars, unlike submissions), client-side resize to ~512px max, stored at `{user_id}/avatar.jpg`. Profile row stores the storage path (not a signed URL). Fallback: initials-on-color placeholder when no avatar set.

### App Shell / Routing
- **D-12:** **Auth stack + Profile screen only** in P1. Expo Router structure:
  - `app/(auth)/` — login, signup, forgot-password, reset-password
  - `app/(app)/profile` — view/edit display name + avatar, logout
  - Root layout handles session-aware redirect (`(auth)` ↔ `(app)`)
  - Other tabs (Home/Submit/Leaderboard/Groups) get introduced by the phases that own them. No placeholder tabs in P1.

### Claude's Discretion
- **CI enforcement point (D-05):** Picked "CI only" on user's delegation. Will add a pre-push hook later if repeated RLS misses slip through to CI.
- **Avatar resize target (D-11):** 512px max longest edge chosen as reasonable default; tune during implementation if size/quality tradeoff feels wrong.
- **Display-name validation rules:** Not explicitly discussed. Default = 2–32 chars, trimmed, non-empty, allow unicode incl. emoji, no uniqueness requirement (duplicates allowed; disambiguation is group-local). Revisit if it becomes a real problem.
- **Profile timezone field:** Not discussed. Default = do NOT store timezone on `profiles` in P1 (it lives on `groups`, per research). Can be added later if a user-local "now" display ever needs it.
- **TypeScript type generation from schema:** Use `supabase gen types typescript --local` wired into a `pnpm types:gen` script; regenerated after every migration. Standard Supabase pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level
- `.planning/PROJECT.md` — vision, constraints, out-of-scope list
- `.planning/REQUIREMENTS.md` — AUTH-01..04, PLAT-01, PLAT-02 are the P1 targets
- `.planning/ROADMAP.md` §"Phase 1: Foundation" — goal + success criteria (binding)

### Stack & Architecture
- `.planning/research/STACK.md` — Expo SDK 55, supabase-js 2.58, AsyncStorage+SecureStore recipe, pinned versions (LOCKED)
- `.planning/research/ARCHITECTURE.md` — Postgres schema shape, RLS policy matrix, `security definer` helpers (`is_group_member`, `is_group_admin`), storage path layout
- `.planning/research/PITFALLS.md` §1 (timezone), §2 (streak race conditions), §3 (RLS-off-by-default) — P1 exists to prevent these
- `.planning/research/SUMMARY.md` — confidence assessment, Phase 1 notes ("standard Supabase Auth + Expo session quickstarts cover this fully")

### External Docs (fetched via Context7 / official)
- Supabase official Expo RN Auth quickstart — AsyncStorage + SecureStore hybrid session storage pattern
- Supabase Storage RLS docs — path-encoded auth for `submissions` bucket
- Expo SDK 55 changelog — New Architecture only, Hermes v1, RN 0.83.1

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — this is the foundation phase; the repo is a fresh Expo project (or will be initialized by P1).

### Established Patterns
- No prior codebase patterns to inherit. P1 **establishes** the patterns for later phases:
  - Supabase client singleton (`src/lib/supabase.ts`) with AsyncStorage + SecureStore
  - TanStack Query provider at root layout
  - Zustand for UI state (when needed)
  - React Hook Form + Zod for forms
  - File-based Expo Router layout with `(auth)` / `(app)` route groups

### Integration Points
- `supabase/migrations/` — all schema work lands here
- `supabase/seed.sql` — test data for local dev
- `.github/workflows/` — RLS CI check job
- `app/_layout.tsx` — session-aware auth redirect lives here
- `src/lib/supabase.ts` — the one and only Supabase client

</code_context>

<specifics>
## Specific Ideas

- Session storage = **AsyncStorage for the session JSON + SecureStore for the encryption key** (the Supabase-recommended hybrid; pure SecureStore has size limits that break refresh tokens).
- Avatar fallback = initials-on-color (no external gravatar/ui-avatars dependency).
- Post-signup destination with email-confirm OFF → land directly on the Profile screen prompting for display name + avatar before any other app access (soft gate, not a hard requirement at the auth layer).

</specifics>

<deferred>
## Deferred Ideas

- **Turn on email confirmation before public launch** — safe to defer for friend-group MVP where signups are known people. Track for pre-rollout hardening (Phase 6) or v1.1.
- **Dev/prod Supabase project separation** — defer unless friend-group testing actually collides with ongoing dev work. Pre-rollout hardening would be the natural revisit point.
- **Preview Branches (per-PR Supabase envs)** — overkill for solo MVP; revisit post-launch if multiple contributors join.
- **Pre-commit / pre-push RLS hook** — CI-only is fine; add a local hook only if escapes become a pattern.
- **Profile-level timezone field** — not needed for MVP (group timezone is authoritative). Add if a feature ever needs user-local "now".
- **Stricter display-name rules (uniqueness, profanity, length)** — revisit only if it becomes a real friend-group problem.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-21*
