# Phase 1: Foundation - Research

**Researched:** 2026-04-21
**Domain:** Mobile auth (Expo + Supabase) + Postgres schema/RLS foundation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema Scope**
- **D-01:** Ship the **full Postgres schema upfront** in Phase 1 — `profiles`, `groups`, `group_members`, `submissions`, `invites`, `notifications_outbox` — along with all RLS policies and the `is_group_member` / `is_group_admin` `security definer` helpers. Tables stay empty until their owning phase populates them.
- **D-02:** Denormalized counter columns (`points`, `current_streak`, `last_rolled_date`) are **added in P1 with empty trigger stubs**. Trigger bodies are filled in Phase 4 (social surfaces) and Phase 5 (rollover). The shape is locked now so later phases don't rewrite the table.
- **D-03:** The `submissions` storage bucket is **created in P1 with path-encoded RLS policies** (`group_id/user_id/date` path). Bucket stays empty until Phase 3. `storage.objects` policies are covered by the CI check.

**RLS CI Check**
- **D-04:** Implementation = **SQL probe in GitHub Actions**. CI job spins up a Postgres instance (via `supabase start` or a service container), applies migrations, runs a query against `pg_tables WHERE schemaname='public' AND rowsecurity=false`, exits non-zero on any row. Also verifies `storage.objects` has policies for the `submissions` and `avatars` buckets.
- **D-05:** Enforcement point = **CI only** (no pre-commit or pre-push hooks).

**Environments & Migrations**
- **D-06:** **Local + one remote Supabase project.** Supabase CLI for local Postgres during dev/testing; one remote Supabase project serves as "prod".
- **D-07:** Migrations live in **`supabase/migrations/*.sql`, committed to the repo**, applied via `supabase db push`. Git diff is the source of truth.
- **D-08:** **`supabase/seed.sql`** checked into repo provides a known test user, test group, and sample members. Runs on `supabase db reset`.

**Auth UX**
- **D-09:** **Email confirmation OFF** for MVP (Supabase Auth "Confirm email" disabled). Users log in immediately after signup.
- **D-10:** **Password reset IS shipped in Phase 1** — Supabase forgot-password + reset screen + deep link handler.

**Avatar**
- **D-11:** **Avatar upload ships in Phase 1** — dedicated `avatars` public bucket, `expo-image-picker` for selection, client-side resize to ~512px max, stored at `{user_id}/avatar.jpg`. Profile row stores storage path (not signed URL). Fallback: initials-on-color placeholder.

**App Shell / Routing**
- **D-12:** **Auth stack + Profile screen only** in P1:
  - `app/(auth)/` — login, signup, forgot-password, reset-password
  - `app/(app)/profile` — view/edit display name + avatar, logout
  - Root layout handles session-aware redirect (`(auth)` ↔ `(app)`)
  - Other tabs get introduced by later phases.

### Claude's Discretion
- **CI enforcement point (D-05):** CI-only picked; add pre-push hook later if needed.
- **Avatar resize target (D-11):** 512px max longest edge.
- **Display-name validation rules:** Default = 2–32 chars, trimmed, non-empty, allow unicode incl. emoji, no uniqueness requirement.
- **Profile timezone field:** Do NOT store on `profiles` in P1 (it lives on `groups`).
- **TypeScript type generation from schema:** Use `supabase gen types typescript --local` wired into a `pnpm types:gen` script; regenerated after every migration.

### Deferred Ideas (OUT OF SCOPE)
- Turn on email confirmation before public launch
- Dev/prod Supabase project separation
- Preview Branches (per-PR Supabase envs)
- Pre-commit / pre-push RLS hook
- Profile-level timezone field
- Stricter display-name rules (uniqueness, profanity, length)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up with email + password | Supabase Auth `signUp({ email, password })`; `profiles` row auto-created via trigger on `auth.users` |
| AUTH-02 | Login persists across app restarts | supabase-js `createClient` with AsyncStorage + SecureStore hybrid (encryption key in SecureStore, encrypted session JSON in AsyncStorage); `AppState` listener toggles `startAutoRefresh`/`stopAutoRefresh` |
| AUTH-03 | User can log out | `supabase.auth.signOut()` + navigation reset to `(auth)` group |
| AUTH-04 | Profile with display name + avatar | `profiles` table with `display_name`, `avatar_url`; `expo-image-picker` → client resize → upload to `avatars` bucket at `{user_id}/avatar.jpg`; RHF + Zod form |
| PLAT-01 | iOS + Android via Expo SDK 55 | `create-expo-app --template default@sdk-55`; verified on physical iOS + Android with Expo Go (P1 has no push, so dev client not yet required) |
| PLAT-02 | RLS on every table + CI check fails builds | GitHub Actions job: `supabase start` → apply migrations → SQL probe on `pg_tables`; also check `storage.objects` has policies for `submissions` + `avatars` |
</phase_requirements>

## Summary

Phase 1 locks in identity and authorization. The work is standard, well-documented Supabase + Expo territory — Supabase's own Expo RN Auth quickstart plus their React Native Auth blog post cover every line of code needed for AUTH-01..04 and PLAT-01. The novel/high-risk surface is (a) the RLS CI check — this must actually fail a build, not just exist — and (b) getting the *full* schema shape correct on the first migration so later phases don't rewrite it. Both have clear playbooks here.

The research workflow for this phase is best described as "apply canonical patterns from `.planning/research/STACK.md` and `.planning/research/ARCHITECTURE.md`, plus three phase-specific investigations: (1) the AsyncStorage+SecureStore hybrid recipe, (2) the exact SQL shape of the RLS CI probe, (3) the avatar resize pipeline on RN." Everything else is already pinned in upstream research.

**Primary recommendation:** Follow Supabase's official "React Native Auth" + "Using Supabase with Expo" guides verbatim for the client; codify the full schema-and-policies DDL as a single migration (`0001_foundation.sql`) that the CI check validates on every push.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sign up / sign in / sign out | Supabase Auth (GoTrue) | Client (form + navigation) | Auth is a managed service; client only renders forms and reacts to session events [CITED: supabase.com/docs/guides/getting-started/quickstarts/expo-react-native] |
| Session persistence | Client (AsyncStorage + SecureStore) | supabase-js | supabase-js reads/writes from the provided storage adapter; the hybrid encryption pattern is client-side only [CITED: supabase.com/blog/react-native-authentication] |
| Password reset flow | Supabase Auth + Client deep link | Expo Router | `resetPasswordForEmail` sends a magic link; Expo Router handles the `/reset-password` route when the user taps the email link |
| Profile CRUD | Postgres (via PostgREST) | Client (RHF form) | `profiles` table + RLS "own row" policy; no edge function needed [VERIFIED: .planning/research/ARCHITECTURE.md] |
| Avatar upload | Supabase Storage (`avatars` bucket) | Client (image picker + resize) | Direct client → Storage upload with user JWT; RLS gates write to `{user_id}/*` path |
| Avatar display | Client (`expo-image`) | Supabase Storage (public read) | `avatars` is public-read; no signed URLs needed (unlike `submissions`) |
| Authorization (RLS) | Postgres | — | Single authorization layer for every table. Client uses anon key; `auth.uid()` is the identity source |
| RLS CI enforcement | GitHub Actions | Supabase CLI (local Postgres) | Runs on every push/PR; SQL probe against `pg_tables` fails the build if any public table has `rowsecurity=false` [VERIFIED: CONTEXT.md D-04] |
| Schema migrations | Supabase CLI | Git | `supabase/migrations/*.sql` committed to repo; `supabase db push` applies to remote [VERIFIED: CONTEXT.md D-07] |
| Type generation | Supabase CLI | TypeScript | `supabase gen types typescript --local` → `src/types/database.ts`; regenerated per migration |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo` | `~55.0.16` | App framework / SDK | Pinned by project. Current stable. [VERIFIED: npm view expo version] |
| `expo-router` | `~5.1.x` (ships with SDK 55, bundle v6 deep-link features) | File-based routing | Default in new SDK 55 projects; auto deep-link generation [CITED: STACK.md] |
| `@supabase/supabase-js` | `^2.58` (verified `2.104.0` current on npm) | Auth + Postgres + Storage client | Chosen backend SDK. Use `^2.58` min to match canonical research. [VERIFIED: npm view @supabase/supabase-js version = 2.104.0] |
| `@react-native-async-storage/async-storage` | `^2.x` (SDK 55 compatible) | Session storage adapter | Required for `createClient({ auth: { storage: AsyncStorage }})`. Official Supabase+Expo quickstart pattern. [CITED: docs.expo.dev/guides/using-supabase] |
| `expo-secure-store` | SDK 55 version (verified `~15.x` current; expo auto-pins) | Store AES encryption key for session | Hybrid pattern: 256-bit AES key in SecureStore, encrypted session in AsyncStorage (SecureStore has ~2KB value cap) [CITED: supabase.com/blog/react-native-authentication] |
| `aes-js` | `^3.x` | AES-256 primitive for session encryption | Used by Supabase's own RN auth recipe. Pure JS, no native deps. [CITED: supabase.com/blog/react-native-authentication] |
| `react-native-get-random-values` | `^1.x` | CSPRNG polyfill for key generation | Required by `aes-js` key generation in RN (no native `crypto.getRandomValues`). Must be imported at the top of the supabase client file. [CITED: supabase.com/blog/react-native-authentication] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | `^5.x` (verified `5.99.2` current) | Server state for the profile read/write | Wrap all Supabase reads. Set up the QueryClientProvider at root layout. [VERIFIED: npm] |
| `react-hook-form` | `^7.x` (verified `7.73.1`) | Forms (signup, login, forgot-password, profile edit) | Uncontrolled inputs, minimal re-renders, pairs with Zod. [VERIFIED: npm] |
| `@hookform/resolvers` | `^5.x` | Zod → RHF bridge | `zodResolver(schema)` |
| `zod` | `^4.x` (verified `4.3.6`) | Runtime validation + TS types for form schemas | Standard pair with RHF. [VERIFIED: npm] |
| `expo-image-picker` | SDK 55 version | Pick avatar from photo library | Works in Expo Go; camera roll is acceptable for avatars (unlike submissions per PITFALLS §submissions). [CITED: STACK.md] |
| `expo-image-manipulator` | SDK 55 version | Client-side resize to 512px | Standard Expo module for resize/compress before upload. |
| `expo-image` | SDK 55 version | Display avatar with caching + blurhash fallback | Faster than `<Image>`; supports placeholder. [CITED: STACK.md] |
| `expo-linking` | SDK 55 version | Parse password-reset deep link | `createURL` + `useURL` for `/reset-password?token=...` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AsyncStorage + SecureStore hybrid | Plain AsyncStorage | Simpler but Supabase's own docs call plain AsyncStorage "not secure enough by default." Upgrade before friend-group testing. Since CONTEXT.md locks the hybrid, no decision needed. [CITED: STACK.md] |
| `expo-image-manipulator` for resize | Third-party resize lib (`react-native-image-resizer`) | Expo-maintained module upgrades in lockstep with SDK; third-party libs risk New-Arch incompatibility. Stay with Expo's. |
| `expo-image-picker` | `expo-camera` for avatar capture | Avatars don't need proof-of-moment; picker is simpler UX. |
| Zod | Yup, Joi | Zod wins for TS-first schemas; already the 2026 default [CITED: STACK.md]. |
| Supabase managed Auth UI | Hand-rolled screens | Managed UI is web-first; RN needs custom screens anyway. |

**Installation:**

```bash
# Scaffold
npx create-expo-app@latest accountibuzz --template default@sdk-55
cd accountibuzz

# Auth + persistence
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage expo-secure-store
npm install aes-js react-native-get-random-values

# State + forms
npm install @tanstack/react-query react-hook-form @hookform/resolvers zod

# Avatar + deep links
npx expo install expo-image-picker expo-image-manipulator expo-image expo-linking

# Dev: Supabase CLI (local Postgres + migrations + type gen)
npm install -D supabase
npx supabase init
```

**Version verification (conducted 2026-04-21 via `npm view`):**
- `expo@55.0.16` (current)
- `@supabase/supabase-js@2.104.0` (far above the `^2.58` floor in STACK.md — safe to pin `^2.58`)
- `expo-router@5.1.x` / SDK 55 bundles Expo Router; use `expo install` not npm pin
- `@react-native-async-storage/async-storage@3.0.2` (use `expo install` to pin SDK-compat version)
- `expo-secure-store@55.0.13` (SDK-versioned)
- `@tanstack/react-query@5.99.2`
- `react-hook-form@7.73.1`
- `zod@4.3.6` (note: 3.x → 4.x had minor API changes; project has no existing Zod code so pick 4.x directly)
- `luxon@3.7.2` (not used in P1 but listed for later phases)

## Architecture Patterns

### System Architecture Diagram

```
                  ┌──────────────────────────────┐
                  │   User opens Expo app        │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
           ┌─────────────────────────────────────────┐
           │  app/_layout.tsx  (Root Layout)         │
           │  • QueryClientProvider                  │
           │  • AuthProvider (wraps                  │
           │    supabase.auth.onAuthStateChange)     │
           │  • AppState listener →                  │
           │    start/stopAutoRefresh                │
           └──────────────┬──────────────────────────┘
                          │
            Session?──────┤
              │           │
              ▼           ▼
        ┌─────────┐  ┌──────────┐
        │ (auth)  │  │   (app)  │
        │ group   │  │  group   │
        └────┬────┘  └─────┬────┘
             │             │
             ▼             ▼
     ┌──────────────┐  ┌──────────────┐
     │ login        │  │ profile      │
     │ signup       │  │ (view/edit   │
     │ forgot-pw    │  │  + avatar    │
     │ reset-pw     │  │  + logout)   │
     └──────┬───────┘  └──────┬───────┘
            │                 │
            │  supabase.auth  │  from('profiles')
            │  .signInWith…   │  storage.from('avatars')
            ▼                 ▼
  ┌────────────────────────────────────────┐
  │      supabase-js v2 client             │
  │  (singleton at src/lib/supabase.ts)    │
  │   storage: encrypted AsyncStorage       │
  │   autoRefreshToken: true                │
  │   persistSession: true                  │
  │   detectSessionInUrl: false             │
  └──────────────┬─────────────────────────┘
                 │ HTTPS
                 ▼
  ┌────────────────────────────────────────┐
  │  Supabase (managed)                    │
  │  ┌─────────┐ ┌──────────┐ ┌─────────┐  │
  │  │  Auth   │ │ PostgREST│ │ Storage │  │
  │  │ (GoTrue)│ │          │ │ avatars │  │
  │  └────┬────┘ └────┬─────┘ └────┬────┘  │
  │       │           │             │      │
  │       ▼           ▼             ▼      │
  │  ┌─────────────────────────────────┐   │
  │  │  Postgres 15 + RLS              │   │
  │  │  • trigger on auth.users → INSERT│   │
  │  │    profiles (id=new.id,         │   │
  │  │    display_name='')             │   │
  │  │  • all public tables RLS=ON     │   │
  │  │  • helpers:                     │   │
  │  │      is_group_member(g uuid)    │   │
  │  │      is_group_admin(g uuid)     │   │
  │  └─────────────────────────────────┘   │
  └────────────────────────────────────────┘

                  ┌──────────────────────────────┐
                  │  GitHub Actions CI           │
                  │   (on push / PR)             │
                  └──────────────┬───────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
    supabase start        apply migrations     SQL probe:
    (local Postgres)   supabase db push          SELECT * FROM
                                                 pg_tables
                                                 WHERE schemaname='public'
                                                 AND rowsecurity=false;
                                                 (any row = fail build)
                                                 + check storage.objects
                                                   has policies for
                                                   'submissions' + 'avatars'
```

### Recommended Project Structure (Phase 1 scope only)

```
accountibuzz/
├── app/
│   ├── _layout.tsx                # Root: Query/Auth providers, session redirect
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   └── (app)/
│       ├── _layout.tsx
│       └── profile.tsx            # view/edit display name + avatar + logout
├── src/
│   ├── lib/
│   │   ├── supabase.ts            # singleton, encrypted-storage adapter
│   │   ├── queryClient.ts
│   │   └── storage-adapter.ts     # aes-js-backed adapter
│   ├── features/
│   │   ├── auth/
│   │   │   ├── AuthProvider.tsx   # onAuthStateChange → context
│   │   │   ├── useSession.ts
│   │   │   └── schemas.ts         # Zod: signup, login, reset
│   │   └── profile/
│   │       ├── useProfile.ts      # TanStack Query hooks
│   │       ├── useUpdateProfile.ts
│   │       ├── useAvatarUpload.ts
│   │       └── schemas.ts         # Zod: display_name, avatar
│   ├── components/                # shared UI (AvatarInitials fallback, etc.)
│   └── types/
│       └── database.ts            # supabase gen types output
├── supabase/
│   ├── migrations/
│   │   └── 0001_foundation.sql    # full schema + RLS + helpers + storage policies
│   ├── seed.sql
│   └── config.toml
├── .github/
│   └── workflows/
│       └── rls-check.yml          # CI probe
├── app.config.ts
└── package.json
```

### Pattern 1: Supabase Client Singleton with Encrypted Storage Adapter

**What:** One `supabase` client for the whole app, with a custom storage adapter that AES-encrypts session JSON before writing to AsyncStorage.

**When to use:** Always — this is the Phase 1 foundation. Never construct a second client.

**Example:**

```typescript
// src/lib/supabase.ts
// Source: https://supabase.com/blog/react-native-authentication (official)
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import { AppState } from 'react-native';

class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1)
    );
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(
      key,
      aesjs.utils.hex.fromBytes(encryptionKey)
    );
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return await this._decrypt(key, encrypted);
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // CRITICAL: must be false on RN
    },
  }
);

// Required: pause/resume token refresh across foreground/background
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

[CITED: https://supabase.com/blog/react-native-authentication]
[CITED: https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native]

### Pattern 2: Root Layout with Session-Aware Redirect

**What:** `app/_layout.tsx` subscribes to auth state and uses Expo Router's `<Stack>` to route between `(auth)` and `(app)` groups.

**Example:**

```typescript
// app/_layout.tsx
// Source: pattern from docs.expo.dev/router/reference/authentication/
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '../src/lib/supabase';

const queryClient = new QueryClient();

function useProtectedRoute(session: Session | null) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) router.replace('/(auth)/login');
    else if (session && inAuthGroup) router.replace('/(app)/profile');
  }, [session, segments]);
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useProtectedRoute(session);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
```

### Pattern 3: `profiles` Auto-Insert Trigger

**What:** Postgres trigger on `auth.users` inserts a matching `profiles` row on signup. Avoids a client-side round trip and means `profiles.id` always exists when referenced.

**Example:**

```sql
-- supabase/migrations/0001_foundation.sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own_or_shared_group" on public.profiles
  for select using (
    id = auth.uid()
    -- group-shared visibility is added by later phases; P1 sees only own row
  );

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

[CITED: https://supabase.com/docs/guides/auth/managing-user-data]

### Pattern 4: RLS CI Probe

**What:** A GitHub Actions job that boots a local Supabase stack, applies migrations, then runs a SQL probe that exits non-zero if any public table has RLS disabled.

**Example:**

```yaml
# .github/workflows/rls-check.yml
name: RLS Check
on: [push, pull_request]
jobs:
  rls:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start
      - run: supabase db reset  # applies migrations + seed
      - name: Probe RLS status
        run: |
          OFF=$(supabase db execute --db-url "postgresql://postgres:postgres@localhost:54322/postgres" <<'SQL'
            SELECT format('%I.%I', schemaname, tablename)
            FROM pg_tables
            WHERE schemaname = 'public' AND rowsecurity = false;
          SQL
          )
          if [ -n "$OFF" ]; then
            echo "::error::Tables without RLS: $OFF"
            exit 1
          fi
      - name: Probe storage bucket policies
        run: |
          MISSING=$(supabase db execute --db-url "..." <<'SQL'
            WITH required AS (SELECT unnest(ARRAY['submissions','avatars']) AS bucket)
            SELECT r.bucket
            FROM required r
            WHERE NOT EXISTS (
              SELECT 1 FROM storage.objects_policies p
              WHERE p.bucket_id = r.bucket
            );
          SQL
          )
          if [ -n "$MISSING" ]; then
            echo "::error::Buckets missing policies: $MISSING"
            exit 1
          fi
```

*Note:* The exact `storage.objects_policies` probe shape should be validated during implementation — Supabase exposes storage policies through `storage.buckets` + `pg_policies` where `tablename='objects'`. A concrete query using `pg_policies` is more portable:

```sql
SELECT b.id AS bucket
FROM storage.buckets b
WHERE b.id IN ('submissions', 'avatars')
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND qual LIKE '%' || b.id || '%'
  );
```

[ASSUMED: exact SQL shape for storage-policy probe — validate in Wave 0]

### Pattern 5: Avatar Upload Pipeline

**What:** Pick → resize to 512px → read as base64 → decode to ArrayBuffer → upload to `avatars/{user_id}/avatar.jpg` → write path to `profiles.avatar_path`.

```typescript
// src/features/profile/useAvatarUpload.ts
// Source: pattern from supabase.com/blog/react-native-storage adapted for avatars
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';

export async function pickAndUploadAvatar(userId: string) {
  const pick = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (pick.canceled) return null;

  const resized = await ImageManipulator.manipulateAsync(
    pick.assets[0].uri,
    [{ resize: { width: 512 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );

  const base64 = await FileSystem.readAsStringAsync(resized.uri, {
    encoding: 'base64',
  });
  const buf = decode(base64);

  const path = `${userId}/avatar.jpg`;
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, buf, {
      contentType: 'image/jpeg',
      upsert: true, // avatars always replace
    });
  if (upErr) throw upErr;

  const { error: dbErr } = await supabase
    .from('profiles')
    .update({ avatar_path: path, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (dbErr) throw dbErr;

  return path;
}
```

**Note:** Add `base64-arraybuffer` to installs (missed in the STACK.md Phase-1-scope subset above). It's listed in canonical STACK.md but not re-installed here unless avatar upload ships in P1 — which it does (D-11).

### Anti-Patterns to Avoid

- **Client-side session introspection:** Don't decode the JWT manually to read `auth.uid()`. Use `supabase.auth.getUser()` or rely on RLS to enforce it. [CITED: .planning/research/PITFALLS.md §3]
- **`detectSessionInUrl: true` on RN:** Causes auth glitches — the flag is web-only. [CITED: STACK.md What NOT to Use]
- **Service role key in the RN bundle:** Ever. Ships publicly, bypasses all RLS. [CITED: PITFALLS.md §3]
- **RLS enabled without policies:** Silent empty results, developer "fixes it" with service_role. Always pair `enable row level security` with at least one policy in the same migration. [CITED: PITFALLS.md §3]
- **Using `user_metadata` in RLS policies:** Users can modify `user_metadata`. Use `app_metadata` or join against `profiles`/`group_members`. [CITED: PITFALLS.md §3]
- **Plain Blob upload to Supabase Storage from RN:** Silent 0-byte uploads. Always base64 → ArrayBuffer. [CITED: PITFALLS.md §8 + STACK.md]
- **Public `avatars` bucket with path-guessable filenames for private content:** Avatars are intentionally public (CONTEXT.md D-11); this is correct for avatars only. `submissions` must be private. [CITED: ARCHITECTURE.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session storage encryption | A custom token-encrypting wrapper from scratch | `aes-js` + `expo-secure-store` hybrid per Supabase's own recipe | Supabase already documents the canonical pattern; rolling your own means untested crypto [CITED: supabase.com/blog/react-native-authentication] |
| Form state + validation | Manual `useState` per field + hand-coded validators | RHF + Zod | Standard 2026 pairing; schemas double as TS types [CITED: STACK.md] |
| Password reset flow | Custom token generation + SMTP | `supabase.auth.resetPasswordForEmail()` + `updateUser({password})` + deep link | Supabase handles token, email, expiry |
| Session propagation across screens | Custom event bus / Redux auth slice | `supabase.auth.onAuthStateChange` + React Context | Single source; supabase-js fires events on sign-in/out/refresh |
| Avatar image resize | Custom native module | `expo-image-manipulator` | First-party Expo module, SDK-pinned |
| Image picker | Custom camera-roll UI | `expo-image-picker` | Works in Expo Go; handles permissions |
| RLS enforcement | App-layer permission checks | Postgres RLS policies | Single authorization layer; defense-in-depth is impossible if policies are bypassed anyway |
| Database migrations | Hand-run SQL scripts | `supabase/migrations/*.sql` + `supabase db push` | Source-of-truth in git; reproducible local dev; CI-compatible |
| TypeScript types for DB | Hand-maintained interfaces | `supabase gen types typescript --local` | Never drifts from schema; regen on every migration |

**Key insight:** Every feature in Phase 1 has a first-party library or official Supabase recipe. The only custom code is assembly — the storage adapter, the root-layout session redirect, and the migration file. Anything beyond that is a warning sign.

## Runtime State Inventory

*Not applicable — Phase 1 is greenfield. No existing runtime state, rename, or migration work.*

## Common Pitfalls

(Upstream canonical pitfall catalogue is `.planning/research/PITFALLS.md`. Below are the P1-specific subset + two P1-specific additions.)

### Pitfall 1: RLS Enabled Without Policies (or forgotten on a new table)

**What goes wrong:** Query returns `[]` with no error; developer "fixes" by using service_role. Or: a table is added in a later migration without `enable row level security` — the CI check catches it, but only if the check is actually running.

**Why it happens:** RLS is off-by-default on new tables. 170+ Lovable-generated apps leaked in Jan 2025 from this. [CITED: PITFALLS.md §3]

**How to avoid:**
- Every `create table` in every migration MUST be immediately followed by `alter table … enable row level security` + at least one policy.
- The RLS CI check (D-04) is the backstop. It MUST actually run on PR (not just push).
- Test every policy with two user fixtures — a row owner and a non-owner — as a pgTAP or integration test.

**Warning signs:**
- `SELECT * FROM table` returns rows to an unauthenticated client in Postgres inspector
- A query works "too easily" after turning on RLS without writing a policy (hint: you're on service_role somewhere)

### Pitfall 2: `detectSessionInUrl: true` on React Native

**What goes wrong:** Auth bugs on iOS (tokens not persisted or double-parsed) because the default assumes a web redirect flow.

**How to avoid:** Explicitly set `detectSessionInUrl: false` in `createClient` config. [CITED: STACK.md]

### Pitfall 3: Auto-Refresh Hammering the Backend in Background

**What goes wrong:** supabase-js keeps refreshing the token even when the app is backgrounded, eating battery and potentially hitting rate limits.

**How to avoid:** Wire an `AppState` listener that calls `startAutoRefresh()` on foreground and `stopAutoRefresh()` on background. [CITED: supabase.com/docs/guides/getting-started/quickstarts/expo-react-native]

### Pitfall 4: `profiles` Trigger Missing `security definer`

**What goes wrong:** The `handle_new_user` trigger inserts into `public.profiles` — but if it runs with the caller's permissions (the user signing up), RLS on `profiles` blocks the insert. User sign-up appears to succeed in auth, but no profile row exists.

**How to avoid:** The trigger function MUST be `security definer` AND owned by a superuser (Supabase's `postgres` role). Test by creating a user through Supabase Studio's Auth tab and confirming a `profiles` row appears.

**Warning sign:** `profiles` table is empty after test signups despite `auth.users` rows existing.

### Pitfall 5: Password Reset Deep Link Not Handled

**What goes wrong:** User taps the email link → browser opens → nothing happens, or app opens but the token isn't extracted.

**How to avoid:**
- Configure the Supabase Auth "Site URL" to include the app's deep-link scheme (e.g., `accountibuzz://reset-password`).
- In Expo Router, the `app/(auth)/reset-password.tsx` route must parse the token from the URL via `useLocalSearchParams()` and call `supabase.auth.updateUser({ password })` with the token in the session.
- Test on a real device — deep links behave differently in simulators.

**Warning signs:** Password reset email received, tap does nothing, or opens browser to Supabase's default hosted page.

### Pitfall 6: Avatar Upload on Public Bucket with No Write Policy

**What goes wrong:** `avatars` bucket is public-read (correct), but without a write policy gating insert by path prefix, *any* authenticated user can overwrite *any* avatar at `{other_user_id}/avatar.jpg`.

**How to avoid:** Storage RLS policy on `storage.objects` for `avatars` bucket:

```sql
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

Plus a read policy allowing anyone (public-read bucket):

```sql
create policy "avatars_select_public" on storage.objects
  for select using (bucket_id = 'avatars');
```

[CITED: supabase.com/docs/guides/storage/security/access-control]

### Pitfall 7: Supabase CLI Version Drift in CI

**What goes wrong:** Local dev on `supabase CLI 2.x`; CI pulls `latest` which auto-updates to a breaking minor release; RLS check passes locally but fails on CI for reasons unrelated to RLS.

**How to avoid:** Pin the `supabase/setup-cli` action version to a specific CLI release (e.g., `with: { version: 1.219.0 }`). Bump deliberately, not implicitly. [ASSUMED — follow project's general pattern of pinning tool versions]

## Code Examples

Verified patterns from official sources. All examples above in "Architecture Patterns" are canonical.

Additional: **Signup form with RHF + Zod:**

```typescript
// src/features/auth/schemas.ts
// Source: standard RHF + Zod pattern
import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Min 8 characters')
    .regex(/[A-Z]/, 'Must include uppercase')
    .regex(/[0-9]/, 'Must include a digit'),
});

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'At least 2 characters')
  .max(32, 'At most 32 characters');
```

```typescript
// app/(auth)/signup.tsx (abridged)
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema } from '../../src/features/auth/schemas';
import { supabase } from '../../src/lib/supabase';

export default function Signup() {
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { /* show toast */ return; }
    // AuthProvider listener will redirect to (app)/profile
  });

  // ... render <Controller> inputs for email/password
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `expo-av` for video/audio | `expo-video` + `expo-audio` | SDK 55 | Not P1, but applies to later phases [CITED: STACK.md] |
| Plain AsyncStorage for Supabase session | AsyncStorage + SecureStore encryption hybrid | 2025 (Supabase RN auth blog post) | P1 uses this — plain AsyncStorage is "not secure enough by default" per Supabase [CITED: supabase.com/blog/react-native-authentication] |
| TanStack Query `isLoading` | `isPending` | v5 (2024) | Watch for stale v4 tutorials [CITED: STACK.md] |
| Expo Legacy Architecture | New Architecture only | SDK 55 | Mandatory; verify all deps are New-Arch compatible [CITED: STACK.md] |
| `@react-navigation/*` direct pinning | Transitive via `expo-router@6` | SDK 55 | Don't pin nav versions by hand |
| Manual TypeScript DB interfaces | `supabase gen types typescript` | Supabase CLI feature, 2023+ | Regen on every migration |

**Deprecated / outdated for P1:**
- Supabase Auth UI (`@supabase/auth-ui-react`) — web-only; not applicable to RN. Build custom screens.
- Email-link magic-link as default login — CONTEXT.md D-09 uses email/password only; magic link is Out of Scope per PROJECT.md (OAuth/magic-link/phone OTP explicitly excluded for MVP per REQUIREMENTS.md).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact `storage.objects_policies` vs `pg_policies` probe shape for storage bucket policy check | Pattern 4 + Pitfall CI probe | LOW — will be validated during Wave 0 when the CI workflow is actually run; failure mode is a loud build error, not a silent miss |
| A2 | Supabase CLI version pinning in CI (suggested `1.219.0`) | Pitfall 7 | LOW — choose the current stable CLI version at implementation time |
| A3 | `base64-arraybuffer` is not duplicated in P1 install list above (STACK.md has it canonical) | Installation | LOW — ensure install script for P1 includes it since avatar upload ships in P1 |
| A4 | Custom deep-link scheme `accountibuzz://reset-password` for password reset | Pitfall 5 | LOW — if universal links aren't set up yet (that's P2), custom scheme is the only option and is well-documented |

**All other claims** are either [VERIFIED] against npm registry + Context7 research in STACK.md, or [CITED] against Supabase / Expo official docs (already captured in canonical `.planning/research/*` files). Confidence HIGH overall.

## Open Questions (RESOLVED)

1. **Should the `profiles.display_name` default be empty string or NULL?**
   - What we know: trigger inserts a row at signup; user hasn't chosen a name yet; REQUIREMENTS.md says "can create a profile" (implies deferred).
   - What's unclear: whether the profile screen should soft-gate other routes until name is non-empty.
   - RESOLVED: Use empty string default (NOT NULL). The soft gate on `profile` screen comes from CONTEXT.md specifics ("land directly on Profile screen prompting for display name + avatar"). Soft gate = UI-level, not DB-level.

2. **What happens to the avatar file when a user is deleted?**
   - What we know: `profiles.id REFERENCES auth.users ON DELETE CASCADE` removes the profile row. Storage objects don't cascade from table deletes by default.
   - What's unclear: whether P1 needs orphan cleanup.
   - RESOLVED: Add a TODO for Phase 6 hardening (final RLS audit). Not needed for P1 MVP — users aren't being deleted yet.

3. **Does the RLS CI check need to run against the remote Supabase project, or is local sufficient?**
   - What we know: CONTEXT.md D-04 says "CI job spins up a Postgres instance (via `supabase start` or a service container)". Local-only.
   - What's unclear: whether schema drift between local and remote could sneak through.
   - RESOLVED: Local is sufficient for P1; `supabase db push` is the only way schema reaches remote, and CI gates the push. Schema drift detection is a Phase 6 concern.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js (≥20) | Expo SDK 55, `create-expo-app` | Need to verify | — | — |
| `npx` / `npm` | Package installs | Need to verify | — | — |
| Supabase CLI | Migrations + local dev + type gen | Need to verify (install via `npm install -D supabase`) | latest stable | — |
| Docker | `supabase start` (spins up local Postgres) | Need to verify | — | — |
| iOS Simulator (Xcode) | Running Expo Go on iOS for dev | macOS-only; project host is macOS | Xcode 15+ | Physical iOS device via Expo Go |
| Android Emulator (Android Studio) OR physical Android device | Running on Android for PLAT-01 verification | — | — | Physical Android device via Expo Go (minimum) |
| `eas-cli` | NOT needed in P1 (P1 can run in Expo Go since no push) | — | — | — |
| A remote Supabase project | D-06 one-remote-project setup | User must create | — | Local-only, but "prod" milestone deferred |

**Missing dependencies with no fallback:**
- Docker (required for `supabase start` locally and in CI). If not present, local dev can still use the remote Supabase project, but the CI check (D-04) depends on Docker via the `supabase/setup-cli` action, which runs on GitHub's Ubuntu runners (Docker pre-installed there).

**Missing dependencies with fallback:**
- iOS Simulator not available → test on physical iOS device via Expo Go (required for PLAT-01 acceptance anyway).
- Android Emulator not available → test on physical Android device via Expo Go.

**Action for planner:** First wave should include an "environment bootstrap" task that verifies Node ≥20, Docker running, Supabase CLI installed, and prompts user to create the remote Supabase project + paste URL/anon key into `.env`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **Jest** (Expo default via `jest-expo` preset) + **pgTAP** (for RLS policy tests) |
| Config file | `package.json` (Jest via `jest-expo` preset) + `supabase/tests/` (pgTAP SQL files) |
| Quick run command | `pnpm test` (Jest only) — under 15s for P1 scope |
| Full suite command | `pnpm test:all` = `pnpm test && supabase test db` (runs pgTAP) |

**Why this combination:**
- **Jest / jest-expo** is the standard RN/Expo test runner; ships with `create-expo-app` default template.
- **pgTAP** is the standard way to test Postgres functions and RLS policies. Supabase's own examples use it. Alternative: integration tests via a test Supabase project, but slower.

[CITED: https://jestjs.io/ + https://supabase.com/docs/guides/local-development/testing/pgtap-extended]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | `supabase.auth.signUp` creates an `auth.users` row | integration (mock supabase client) | `pnpm test -- signup.test.ts` | ❌ Wave 0 |
| AUTH-01 | Trigger creates matching `profiles` row | pgTAP RLS/trigger test | `supabase test db` (runs `supabase/tests/profiles_trigger.sql`) | ❌ Wave 0 |
| AUTH-02 | Session persists via encrypted storage adapter | unit | `pnpm test -- storage-adapter.test.ts` | ❌ Wave 0 |
| AUTH-02 | `createClient` config has `persistSession: true` and `detectSessionInUrl: false` | unit (config snapshot) | `pnpm test -- supabase-client.test.ts` | ❌ Wave 0 |
| AUTH-03 | `signOut` clears encrypted storage | unit | `pnpm test -- signout.test.ts` | ❌ Wave 0 |
| AUTH-04 | `display_name` Zod schema: rejects <2, >32, empty | unit | `pnpm test -- profile-schemas.test.ts` | ❌ Wave 0 |
| AUTH-04 | `profiles.update` RLS: can update own, cannot update other | pgTAP | `supabase test db` (`supabase/tests/profiles_rls.sql`) | ❌ Wave 0 |
| AUTH-04 | Avatar upload writes to `{user_id}/avatar.jpg` and updates `profiles.avatar_path` | integration | manual-only (requires real Storage) — smoke test during phase demo | — |
| PLAT-01 | App launches on iOS + Android in Expo Go without error | manual-only | Physical device walkthrough during `/gsd-verify-work` | — |
| PLAT-02 | Every public-schema table has `rowsecurity = true` | CI (SQL probe) | `.github/workflows/rls-check.yml` job `rls` | ❌ Wave 0 |
| PLAT-02 | `storage.objects` has policies for `submissions` and `avatars` buckets | CI (SQL probe) | same workflow, second step | ❌ Wave 0 |
| PLAT-02 | RLS helpers `is_group_member` / `is_group_admin` return correct results | pgTAP | `supabase test db` (`supabase/tests/rls_helpers.sql`) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test` (Jest only, under 15s — RHF schemas, storage adapter, client config).
- **Per wave merge:** `pnpm test:all` (Jest + pgTAP) — adds ~30s for DB tests.
- **Phase gate:** Full suite green + the RLS CI workflow passes + manual PLAT-01 walkthrough on both iOS and Android before `/gsd-verify-work`.

### Wave 0 Gaps

Phase 1 is greenfield — no test infrastructure exists. Wave 0 must create:

- [ ] `package.json` — add `jest-expo` preset + `@testing-library/react-native` + `@testing-library/jest-native`
- [ ] `jest.config.js` or jest block in `package.json` — configure `jest-expo` preset, `setupFilesAfterEach`
- [ ] `jest.setup.ts` — mock `expo-secure-store`, `expo-image-picker`, `@react-native-async-storage/async-storage`
- [ ] `tests/storage-adapter.test.ts` — covers AUTH-02 (encryption round-trip)
- [ ] `tests/supabase-client.test.ts` — covers AUTH-02 config snapshot
- [ ] `tests/profile-schemas.test.ts` — covers AUTH-04 display_name validation
- [ ] `tests/signup.test.ts` — covers AUTH-01 (mocked `supabase.auth.signUp`)
- [ ] `tests/signout.test.ts` — covers AUTH-03
- [ ] `supabase/tests/profiles_trigger.sql` (pgTAP) — covers AUTH-01 trigger
- [ ] `supabase/tests/profiles_rls.sql` (pgTAP) — covers AUTH-04 RLS policies
- [ ] `supabase/tests/rls_helpers.sql` (pgTAP) — covers PLAT-02 security-definer helpers
- [ ] `.github/workflows/rls-check.yml` — covers PLAT-02 CI check
- [ ] `.github/workflows/ci.yml` (or similar) — runs `pnpm test` + `supabase test db` per push
- [ ] Framework install: `npm install -D jest jest-expo @testing-library/react-native @testing-library/jest-native`
- [ ] Framework install: `supabase` CLI already a dev dep; no extra pgTAP install (bundled with local Postgres via `supabase start`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **yes** | Supabase Auth (GoTrue) — managed. Password hashing (argon2id), brute-force rate limiting, secure token generation — all handled by Supabase. |
| V3 Session Management | **yes** | supabase-js token lifecycle with AsyncStorage + SecureStore hybrid; `autoRefreshToken` + `AppState`-gated refresh; explicit `signOut` clears storage. |
| V4 Access Control | **yes** | **Postgres RLS** on every table + `security definer` helpers (`is_group_member`, `is_group_admin`). CI probe enforces RLS-on-every-table. |
| V5 Input Validation | **yes** | **Zod** schemas for every form (signup, login, reset, profile edit). Server-side validation via Postgres CHECK constraints + RLS `with check` clauses. |
| V6 Cryptography | **yes** | `aes-js` AES-256-CTR for session encryption (Supabase's canonical recipe). `expo-secure-store` for key storage (backed by iOS Keychain / Android Keystore). **Never hand-roll crypto.** |
| V7 Error Handling & Logging | partial | P1: log auth errors to console + user-facing toasts. Full structured logging deferred to Phase 6 (pre-rollout hardening). |
| V8 Data Protection | **yes** | Session encrypted at rest (AES-CTR); HTTPS enforced by Supabase; no PII beyond email + display name in P1; avatars public-read but path-gated on write. |
| V9 Communication | **yes** | TLS 1.2+ enforced by Supabase edge (managed); no HTTP fallback. |
| V13 API and Web Service | partial | PostgREST API is gated by RLS; anon key ships in client (intended); no custom API endpoints in P1 (no edge functions shipped in P1). |
| V14 Configuration | **yes** | `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` (safe — anon key is public by design). Service role key never in RN bundle. |

### Known Threat Patterns for Expo + Supabase (Phase 1 surface)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **RLS bypass via service_role key in client** | Elevation of Privilege | Lint rule forbidding `SUPABASE_SERVICE_ROLE_KEY` import in `app/` or `src/`; never expose in `.env` with `EXPO_PUBLIC_` prefix [CITED: PITFALLS.md §3] |
| **RLS-off-by-default on new table** | Information Disclosure | CI probe (D-04); PR review checklist; pgTAP test for each table's policies [CITED: PITFALLS.md §3] |
| **Session token leak via unencrypted AsyncStorage** | Information Disclosure | AsyncStorage + SecureStore hybrid with AES encryption [CITED: supabase.com/blog/react-native-authentication] |
| **`user_metadata` privilege escalation** | Elevation of Privilege | RLS policies reference `auth.uid()` or `app_metadata` only — never `user_metadata` (user-modifiable) [CITED: PITFALLS.md §3] |
| **Avatar path traversal / overwrite other user's avatar** | Tampering | Storage RLS policy: `(storage.foldername(name))[1] = auth.uid()::text` |
| **Public `avatars` bucket leaks intended-private data** | Information Disclosure | Bucket is intentionally public-read; only avatar JPEGs stored; no PII in filenames (`{user_id}/avatar.jpg` — user_id is not PII per GDPR definitions). `submissions` bucket (P3) is private. |
| **Password reset token replay** | Authentication | Supabase issues single-use tokens with ~1h TTL (managed); deep link must consume token within the app session |
| **Deep-link interception (malicious app registers same custom scheme)** | Spoofing | Custom scheme fallback only; upgrade to Universal Links / App Links in Phase 2 (has domain hosting dependency — see STATE.md open questions) |
| **JWT `detectSessionInUrl: true` side effect on RN** | Authentication bug (not strictly a threat but a correctness hole) | Explicit `false` in `createClient` config [CITED: STACK.md] |
| **Leaked anon key reused elsewhere** | Denial of Service / low-impact | Anon key is public by design; rate-limit configured at Supabase project level; abuse requires user auth for any RLS-gated action |

**STRIDE coverage for P1:** S ✓ · T ✓ · R (repudiation — partial; Supabase Auth logs every signin in `auth.audit_log_entries`; adequate for MVP) · I ✓ · D (partial; rely on Supabase platform defaults) · E ✓

## Sources

### Primary (HIGH confidence)

- `.planning/research/STACK.md` — Expo SDK 55, supabase-js, AsyncStorage+SecureStore hybrid, pinned versions (LOCKED)
- `.planning/research/ARCHITECTURE.md` — Postgres schema, RLS matrix, `security definer` helpers, storage layout
- `.planning/research/PITFALLS.md` §1 (timezone), §2 (streak races), §3 (RLS-off-by-default)
- `.planning/research/SUMMARY.md` — Phase 1 notes ("standard Supabase Auth + Expo session quickstarts cover this fully")
- [Supabase: Using Supabase with Expo](https://docs.expo.dev/guides/using-supabase/) — AsyncStorage session adapter pattern
- [Supabase: Expo React Native quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native) — canonical `createClient` config including `detectSessionInUrl: false` + AppState auto-refresh
- [Supabase: Getting started with React Native authentication](https://supabase.com/blog/react-native-authentication) — SecureStore + AsyncStorage encryption hybrid with `aes-js`
- [Supabase: Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — path-encoded RLS for `avatars` + `submissions`
- [Supabase: Auth managing user data](https://supabase.com/docs/guides/auth/managing-user-data) — trigger-on-auth.users pattern
- [Expo Router: Authentication](https://docs.expo.dev/router/reference/authentication/) — session-aware redirect pattern
- `npm view` verified versions for: `expo`, `@supabase/supabase-js`, `expo-secure-store`, `@tanstack/react-query`, `zod`, `react-hook-form`, `expo-router`, `@react-native-async-storage/async-storage`, `luxon` (all verified 2026-04-21)

### Secondary (MEDIUM confidence)

- [pgTAP testing with Supabase](https://supabase.com/docs/guides/local-development/testing/pgtap-extended) — RLS policy test framework
- [GitHub Actions: supabase/setup-cli](https://github.com/supabase/setup-cli) — CI action for Supabase CLI
- [Expo Image Manipulator](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/) — avatar resize

### Tertiary (LOW confidence)

- Exact `storage.objects` policy introspection SQL (probe syntax) — needs Wave 0 validation; `pg_policies` approach documented in the assumption log

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — all pins verified against npm + canonical research; versions cross-checked 2026-04-21.
- **Architecture:** HIGH — every pattern is a direct quote of or minor adaptation from official Supabase and Expo documentation.
- **Pitfalls:** HIGH for RLS, session, and crypto pitfalls (cited from PITFALLS.md + first-party post-mortems); MEDIUM for two new P1-specific pitfalls (storage CI probe, CLI version pinning) — both flagged in the Assumptions Log.
- **Validation architecture:** HIGH for Jest/jest-expo (greenfield default); MEDIUM for pgTAP (well-documented but not yet wired in this repo — Wave 0 will).
- **Security domain:** HIGH for managed Supabase surfaces (Auth, RLS, TLS); MEDIUM for deep-link interception threat (custom scheme is a known limitation deferred to Phase 2).

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days — stack is stable, Supabase/Expo docs change slowly at the pattern level)
