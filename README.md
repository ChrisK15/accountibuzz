# Accountibuzz

A missed day is visible to your group within hours — the social cost of skipping is what keeps you accountable.

## Stack

- **Expo SDK 55** (React Native 0.83.1, React 19.2, New Architecture only, Hermes v1)
- **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions + pg_cron)
- **Expo Router** for navigation, **TanStack Query** for server state, **react-hook-form + Zod** for forms
- **Jest + jest-expo** for client tests, **pgTAP** (`supabase test db`) for RLS/trigger tests

See `.planning/phases/01-foundation/01-CONTEXT.md` for the full architectural decision log.

## Prerequisites

- Node 20+
- Docker Desktop (required by `supabase start` for the local stack)
- Supabase CLI (installed as a dev dep — invoke via `npx supabase`)
- Expo Go app on a physical iOS or Android device
- Xcode (macOS) or Android Studio if you want simulator/emulator support

## First-time setup

1. `npm install`
2. Create a Supabase project at <https://supabase.com/dashboard>.
3. Copy `.env.example` → `.env` and paste:
   - `EXPO_PUBLIC_SUPABASE_URL` — Project Settings → API → Project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API → `anon` / `public` key
4. In the Supabase Dashboard → **Authentication**:
   - Providers → Email → **Disable "Confirm email"** (decision D-09 in `01-CONTEXT.md`)
   - **Email Templates → Reset Password → replace the body so it uses
     `{{ .Token }}` (6-digit code) instead of `{{ .ConfirmationURL }}`.**
     Phase 01 uses an OTP code flow, not a deep-link — the user pastes the
     code into `/(auth)/reset-password`. See
     `.planning/phases/01-foundation/01-06-SUMMARY.md` for the design note.
     A fresh project pointed at the default template will send a link email,
     and `verifyOtp` will fail with "invalid token" with no code to paste.
   - URL Configuration → add `accountibuzz://reset-password` to the Redirect
     URLs list (reserved for the P2 invite universal-link flow; not used by
     reset in P1).
5. Link the CLI to your remote project:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
6. Apply the schema:
   ```bash
   npx supabase db push
   ```

For local-only work (no remote project required), run `npx supabase start` once and use
`npx supabase db reset` to apply the migration + seed into the local stack.

## Local dev loop

| Command | What it does |
|---------|--------------|
| `npm run start` | Expo dev server + QR code; scan with Expo Go |
| `npm run ios` | Expo dev server targeting the iOS simulator |
| `npm run android` | Expo dev server targeting the Android emulator |
| `npm test` | Jest (client-side unit tests) |
| `npm run test:all` | Jest **plus** `supabase test db` (pgTAP against the local Postgres) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run types:gen` | Regenerate `src/types/database.ts` from the local Supabase schema |
| `npx supabase start` | Boot the local Supabase stack (Postgres + Auth + Storage) |
| `npx supabase db reset` | Drop + reapply migrations + seed locally |
| `npx supabase db push` | Apply new migrations to your linked remote project |

Run `npm run types:gen` any time you add or change a migration so TypeScript stays in sync.

## RLS CI check

`.github/workflows/rls-check.yml` boots a local Supabase stack on every push / PR, applies
the migration, and probes `pg_tables` for any `public` schema table where
`rowsecurity = false`. It also confirms the `avatars` and `submissions` storage buckets
have policies attached. Any RLS-off-by-default table fails the build — this is the
automated enforcement backing success criterion #5 for Phase 1.

`.github/workflows/ci.yml` runs `npm run typecheck` and `npm test` on the same events.

## Project layout

```
app/                            Expo Router routes
  (auth)/                         login, signup, forgot-password, reset-password
  (app)/                          profile (view / edit / onboarding)
src/
  lib/                          Supabase client singleton + encrypted session storage
  features/                     Feature modules (auth, profile)
  components/                   Hand-rolled RN UI primitives (per 01-UI-SPEC.md)
  theme/                        Design tokens + ThemeProvider
  types/database.ts             Generated Supabase types (do not edit by hand)
supabase/
  migrations/0001_foundation.sql  Full Phase 1 schema + RLS + helpers
  tests/*.sql                     pgTAP RLS + trigger tests
  seed.sql                        Local seed data
.planning/                      Phase plans, research, SUMMARY artifacts
```

## Planning artifacts

The `.planning/` directory holds the full GSD (Get-Shit-Done) workflow outputs: phase plans,
per-plan SUMMARY files, roadmap, state, and context. `gsd-*` commands drive the workflow.
Start with `.planning/STATE.md` for the current position and `.planning/ROADMAP.md` for the
phase map.
