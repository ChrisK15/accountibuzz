# Phase 2: Groups & Invites — Research

**Researched:** 2026-04-24
**Domain:** Group formation + deep-link invite flow on Expo SDK 55 / React Native 0.83 / Supabase (Postgres + RLS + RPC)
**Confidence:** HIGH (stack is locked and P1 is the authoritative analog; schema reality directly inspected; all RPC patterns verified against Supabase docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Invite Model**
- **D-01:** Single-use per row. The `invites` table shipped in P1 (`code`, `expires_at`, `used_at`, `used_by`) is the source of truth. Each invite is one row; once `used_at` is set it's dead. Admin can mint additional invites at any time. This supersedes the "single rotatable code on `groups`" sketch in `research/ARCHITECTURE.md` — schema reality wins.
- **D-02:** Code format = 8-char uppercase alphanumeric, ambiguity-stripped (no `0/O/1/I/L`). Display chunked as `ABCD-EF12`. ~33⁸ ≈ 10¹² combinations.
- **D-03:** Default expiry = 7 days (`expires_at = now() + interval '7 days'`). Admin can regenerate; regenerate stamps `used_at` on the previous active row and creates a new one. No automatic rotation.
- **D-04:** One active invite at a time per group (soft constraint at the RPC level — creating a new one closes the previous active row).

**Deep Linking**
- **D-05:** Custom scheme only in P2. `accountibuzz://invite/{code}` registered via `app.config.ts`. Universal Links + AASA/assetlinks deferred to Phase 6.
- **D-06:** Code-entry screen is the load-bearing path, not the deep link. Share message includes both the code and the custom-scheme link; recipients can tap or type.
- **D-07:** Pre-auth invite preview via `get_invite_preview(code text)` SECURITY DEFINER RPC. Returns `{ group_name, member_count, admin_display_name }` only — never member lists or submissions. Unauthenticated callers can hit it. Invite code held in `expo-secure-store` across the auth detour and replayed after login.

**Membership & Lifecycle**
- **D-08:** Hard member cap = 10, enforced inside `redeem_invite` RPC. Reject with typed error (`'group_full'`). No admin override at MVP.
- **D-09:** Member leave = hard DELETE on `group_members` row. Their `submissions` rows stay (for future P3+ history). They lose RLS read on the group entirely.
- **D-10:** Admin cannot leave. Attempting "Leave group" as admin surfaces a modal with two paths: Transfer admin or Delete group (cascade to `group_members`, `submissions`, `invites`; irreversible).
- **D-11:** All write paths go through SECURITY DEFINER RPCs — `redeem_invite`, `leave_group`, `transfer_admin`, `delete_group`, `regenerate_invite`, `create_group`. The placeholder `invites_mark_used_as_self` policy (from 0002) should be removed or hardened to disallow direct UPDATE by end users; redemption is RPC-only.

**App Shell & Navigation**
- **D-12:** Stack-based shell with Groups list as the signed-in home.
  - `app/(app)/index.tsx` — groups list (replaces today's profile-only home)
  - `app/(app)/groups/new.tsx` — create-group form
  - `app/(app)/groups/[id]/index.tsx` — group detail
  - `app/(app)/groups/join.tsx` — code-entry screen
  - `app/(app)/profile.tsx` — already exists; reachable via header avatar tap
  - `app/invite/[code].tsx` — deep-link target (resolves preview RPC, routes to auth or join)
  - No tab bar yet — introduce in P3.
- **D-13:** Empty state shows two equal-weight CTAs. Once the user has at least one group, list shows a `+` icon and a kebab menu with "Join with code".
- **D-14:** Group detail screen (P2 scope) — header, members list, admin invite panel, leave/transfer/delete at the bottom.

**Create-Group UX**
- **D-15:** Single screen, all fields visible. Reuses Phase 1 form patterns. Submit type = segmented control (photo | video). Timezone = read-only display tappable to open a searchable IANA picker.
- **D-16:** Timezone default = device tz via `Intl.DateTimeFormat().resolvedOptions().timeZone`, editable.
- **D-17:** Goal description = required, 5–140 chars. Multiline with char counter. Enforced client-side and at DB (`check (length(goal) between 5 and 140)`).
- **D-18:** Post-create destination = the new group's detail screen with one-time banner. Code generated server-side as part of the create transaction (returned by `create_group` RPC).

**Share UX**
- **D-19:** Native share sheet via React Native `Share.share`. Pre-formatted message with code + custom-scheme link + store link placeholder.
- **D-20:** No QR code in P2.

### Claude's Discretion

- Exact error-state copy — already written in `02-UI-SPEC.md`.
- Loading skeletons / spinners for groups list and group detail.
- Whether `create_group` is a single RPC or a client-side insert chain (RPC preferred for atomicity).
- Whether deep-link landing (`app/invite/[code].tsx`) navigates to auth via `router.replace` or shows an inline "Sign in to join" sheet.
- IANA picker library choice (or roll our own with flat list + search).
- Whether the `redeem_invite` RPC returns the full group row or just `group_id`.
- Realtime subscription for the group-detail member list.

### Deferred Ideas (OUT OF SCOPE)

- Universal Links + AASA/assetlinks hosting (Phase 6).
- Admin remove-member action (deferred; "kick" button is a quick add later).
- QR code generation.
- Multiple active invites per group (schema supports it; UI ships "one at a time").
- Invite analytics (no UI in P2).
- Group rename / edit goal / change submission-type after creation.
- Per-user real "store link" in share message (P6 replaces placeholder).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRP-01 | User can create a group with name, goal, IANA timezone, submission type (photo OR video) | §Standard Stack (RPC pattern, RHF+Zod), §Pattern 1 (create_group RPC), §Pattern 4 (timezone picker) |
| GRP-02 | Group creator is admin | §Pattern 1 (create_group atomically inserts group row with admin_user_id + 'admin' group_members row) |
| GRP-03 | User can view the list of groups they belong to | §Pattern 5 (TanStack Query key shape + groups_select_member policy) |
| GRP-04 | User can view a group's details, members, and rules | §Pattern 5 (scoped query keys + SELECT via existing RLS: groups_select_member + group_members_select_own_or_same_group) |
| GRP-05 | User can leave a group | §Pattern 1 (leave_group RPC), §Pitfall 2 (admin cannot leave; see branching flow) |
| INV-01 | Admin can generate a shareable invite link/code | §Pattern 1 (regenerate_invite RPC), §Pattern 2 (code generation) |
| INV-02 | User can join a group by opening an invite link OR entering a code | §Pattern 1 (redeem_invite + get_invite_preview RPCs), §Pattern 3 (deep-link auth-detour flow) |
| INV-03 | Group size capped at 10 members (soft cap for MVP) | §Pattern 1 (count + raise inside redeem_invite RPC under SERIALIZABLE / row-lock), §Pitfall 5 (concurrent redeem race) |

</phase_requirements>

## Project Constraints (from CLAUDE.md and MEMORY.md)

| Constraint | Source | Impact on Planning |
|------------|--------|--------------------|
| **Dev build only (no Expo Go)** | CLAUDE.md §stack + MEMORY.md `reference_rn_dev_build_required` | `npx expo run:ios` from day one; deep-link testing requires dev build (Expo Go strips custom schemes) |
| **Stack pinned to Expo SDK 55 / RN 0.83.1 / React 19.2 / Hermes / TypeScript / Supabase** | CLAUDE.md §Technology Stack (LOCKED) | No alternative library choices at the stack layer |
| **Supabase skills must be consulted before implementing** | MEMORY.md `feedback_consult_skills` | Plans should reference `.claude/skills/supabase` + `expo` + `expo-router` before coding |
| **New Architecture is mandatory (SDK 55)** | CLAUDE.md + app.config.ts `newArchEnabled: true` | All P2 libraries must be New-Arch-compatible |
| **Never commit `.env`; never use service_role key in client** | `.planning/research/PITFALLS.md` §3 | Enforced; don't regress in P2 |
| **RLS is ON for every public-schema table; CI probe enforces this** | PITFALLS.md §3 + `.github/workflows/rls-check.yml` | New P2 migration must enable RLS on anything it creates (none planned — all new surface is functions, not tables) |
| **Migrations never edited in place; only new numbered files** | `01-CONTEXT.md` D-07 | `0004_phase2_groups_invites.sql` is the only P2 SQL file |

---

## Summary

Phase 2 is almost entirely about **server-side correctness in Postgres** plus **the deep-link auth-detour dance** on the client. The schema already exists (tables `groups`, `group_members`, `invites` shipped in `0001` and were hardened in `0002`). P2 layers SECURITY DEFINER RPCs on top of that schema, removes the P1-placeholder `invites_mark_used_as_self` update policy in favor of RPC-only redemption, and wires up 6 new screens against existing P1 primitives.

The three hardest problems are:

1. **Atomicity of group creation** — three inserts (groups, group_members admin row, first invite) must be all-or-nothing. Single-RPC is the only correct shape.
2. **Membership-cap race on concurrent redeem** — two users redeeming the 10th slot simultaneously. Requires `SELECT ... FOR UPDATE` on the group row (or equivalent advisory lock) inside `redeem_invite`. Count-then-insert without a lock is a classic lost-update bug.
3. **Deep-link auth detour** — the canonical share path is code-entry (per D-06), but the custom-scheme link must still work for already-installed authed users. Persisting the pending code across the auth boundary via `expo-secure-store` is the same pattern Phase 1 used for OTP recovery.

**Primary recommendation:**

- **One migration, six RPCs:** `create_group`, `redeem_invite`, `get_invite_preview` (unauthenticated, SECURITY DEFINER), `leave_group`, `transfer_admin`, `delete_group`, `regenerate_invite`. All but `get_invite_preview` require an authenticated `auth.uid()`.
- **Server-side code generation** inside `create_group` / `regenerate_invite` using a plpgsql helper `generate_invite_code()` with ambiguity-stripped alphabet + collision retry loop against the `invites_code_key` UNIQUE index.
- **Hand-rolled timezone picker** using `Intl.supportedValuesOf('timeZone')` if available at runtime, with a bundled static fallback list (Hermes iOS Intl support for `supportedValuesOf` is not guaranteed across RN 0.83 builds — verify with a Wave 0 dev-build probe).
- **No realtime in P2.** Pull-to-refresh + refetch on focus covers the group-detail member list. Realtime is a P4 deliverable and adding it here risks bleeding scope.
- **Deep-link landing does `router.replace`**, not an inline sheet — matches Phase 1's auth-navigation pattern (`router.replace('/(auth)/login')` in `useProtectedRoute`).

## Architectural Responsibility Map

P2 is a 2-tier app: Expo RN client + Supabase (Postgres + Auth). There is no separate frontend-server or CDN tier. The tier mapping below flags what must live server-side (authorization + integrity) vs. client-side (UX + navigation).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Group creation (name, goal, timezone, submission_type) | **Database (RPC)** | Client (form) | Three inserts must be atomic — admin membership + first invite bundled with group row. RLS alone can't enforce atomicity. |
| Invite code generation | **Database (plpgsql helper)** | — | Ambiguity-stripped alphabet + UNIQUE(code) collision retry lives where UNIQUE lives. Client-side generation breaks atomicity and trusts client for a server-visible UNIQUE value. |
| Invite redemption (insert group_members row, enforce 10-cap, mark used) | **Database (RPC)** | — | Cap check + insert must be atomic under concurrency (Pitfall 5). RLS alone cannot close the TOCTOU gap. |
| Pre-auth invite preview (group name, member count, admin display name) | **Database (SECURITY DEFINER RPC)** | — | Query needs to bypass RLS to read a group the unauth caller is not a member of — SECURITY DEFINER is the only safe primitive. |
| Member leave / admin transfer / group delete | **Database (RPC)** | — | Each has invariants RLS cannot express (e.g., admin cannot leave, transfer must atomically swap `groups.admin_user_id` + `group_members.role`, delete must cascade and close open invites). |
| Deep-link routing (`accountibuzz://invite/{code}`) | **Client (expo-router)** | — | expo-router owns custom-scheme deep-link dispatch; `app.config.ts` already registers scheme. |
| Auth detour (persist pending code across sign-in) | **Client (expo-secure-store)** | — | Same pattern Phase 1 used for password recovery; reuses the `LargeSecureStore` encryption adapter. |
| Groups-list / group-detail reads | **Database (RLS-gated SELECT via PostgREST)** | Client (TanStack Query) | Existing `groups_select_member` + `group_members_select_own_or_same_group` policies cover read authorization; client reads use PostgREST `select()` via supabase-js. |
| Share sheet | **Client (RN `Share` API)** | — | Platform-native; no server involvement. |
| Timezone picker | **Client (Intl + JS filter)** | — | Pure display/input concern; tz value is just a string passed to the RPC. |

**Key invariants this map enforces:**
- No business logic in edge functions for P2 (per ARCHITECTURE.md anti-pattern #3 — RPCs + RLS suffice).
- No client-side code generation (server owns UNIQUE namespace).
- No client-side 10-cap check as authority (client can advise UI, but the RPC is the truth).

## Standard Stack

### Core (already installed — no new deps at the database or core-client layer)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.58.0` | RPC calls via `supabase.rpc('...')`, PostgREST reads, session | P1 singleton already wired; reuse directly [VERIFIED: `package.json`] |
| `@tanstack/react-query` | `^5.59.0` | Server-state cache, mutations, optimistic updates | v5 naming (`isPending`, not `isLoading`); P1 pattern established [VERIFIED: `package.json`] |
| `react-hook-form` | `^7.53.0` | Form state for create-group + join-with-code screens | P1 auth forms use this pattern [VERIFIED: `package.json`] |
| `@hookform/resolvers` | `^5.0.1` | Zod bridge for RHF | P1 established [VERIFIED: `package.json`] |
| `zod` | `^4.0.0` | Create-group + join-with-code validation schemas | P1 auth/profile schemas follow this pattern [VERIFIED: `package.json`] |
| `expo-router` | `~55.0.13` | File-based routing for the 6 new routes + `app/invite/[code].tsx` | SDK 55 default [VERIFIED: `package.json`] |
| `expo-secure-store` | `~55.0.13` | Persist `pending_invite_code` across auth detour | Same adapter P1 uses for Supabase session [VERIFIED: `package.json`] |
| `expo-linking` | `~55.0.14` | Deep-link parsing (`accountibuzz://invite/{code}`) — expo-router reads this under the hood | Already installed [VERIFIED: `package.json`] |

### New dependencies (three small, first-party Expo modules)

| Library | Version | Purpose | Why Needed in P2 |
|---------|---------|---------|------------------|
| `expo-clipboard` | `~55.0.13` | Copy invite code in admin panel; install command: `npx expo install expo-clipboard` | UI-SPEC `InviteCodeChip` component's `Copy` action [VERIFIED: npmjs.com page confirms 55.0.13 for SDK 55] |
| `expo-haptics` | `~55.0.14` | Success haptic on code copy (UI-SPEC Interaction Contracts) | UI-SPEC requires `Haptics.notificationAsync(Success)` on copy [VERIFIED: npmjs.com] |
| `expo-localization` | `~55.x` (install via `npx expo install`) | Optional — current-tz display label resolution. Only if `Intl.supportedValuesOf` proves flaky on Hermes iOS. | Fallback for timezone picker [CITED: docs.expo.dev/guides/localization] |

**React Native platform APIs (no install — bundled with RN):**

| API | Purpose | SDK 55 Notes |
|-----|---------|--------------|
| `Share` (`react-native`) | Native share sheet | `Share.share({ message })` — no options object beyond `message`/`url`/`title`. iOS respects `message`; Android uses `message` only [CITED: reactnative.dev Share API docs] |
| `Intl.DateTimeFormat().resolvedOptions().timeZone` | Device-tz default | Works in Hermes iOS + Android under SDK 55 — confirmed by P1's working build |
| `Intl.supportedValuesOf('timeZone')` | IANA tz list for picker | **Availability is NOT guaranteed across RN 0.83 Hermes builds on iOS.** See §Assumptions A2. [ASSUMED for availability; VERIFIED for risk per Hermes Intl history] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled timezone picker | `react-native-timezone-picker` (or similar) | No well-maintained New-Arch-compatible picker found that doesn't drag in a large city DB. Hand-rolled on `Intl.supportedValuesOf` + fallback static list is lighter. Aligns with UI-SPEC D-discretion ("lightest workable option"). |
| `luxon` or `date-fns-tz` for tz label | `Intl.DateTimeFormat('en', { timeZoneName: 'long' })` | Platform Intl is already there for `resolvedOptions`; adding Luxon purely for display label is overkill. Revisit for P5 rollover. |
| `nanoid` for client-side code gen | Server-side plpgsql `generate_invite_code()` | Client-side violates atomicity (D-01) and moves UNIQUE collision retry to client. Server-side is the only correct design. |
| Universal Links for P2 | Custom scheme only | LOCKED in D-05; no domain hosted yet. Universal Links land in P6. |
| Edge function for `redeem_invite` | Postgres RPC (SECURITY DEFINER) | ARCHITECTURE.md anti-pattern #3: "Don't put business logic in edge functions when triggers/RPCs suffice." Cap check + insert is pure SQL. |

**Installation (Wave 0 / first plan):**

```bash
npx expo install expo-clipboard expo-haptics
# expo-localization only if Wave 0 probe shows Intl.supportedValuesOf missing:
# npx expo install expo-localization
```

**Version verification:**

```bash
npm view expo-clipboard version   # expect 55.0.13 family
npm view expo-haptics version     # expect 55.0.14 family
```

Pin via `expo install` (SDK-matched), not `npm install`. [VERIFIED: npmjs.com/package/expo-clipboard and npmjs.com/package/expo-haptics both list ~55.0.x as SDK 55 targets]

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                   CLIENT (Expo RN / SDK 55 / Hermes)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐        ┌──────────────────────────────┐    │
│  │ Deep-link dispatch  │─tap──▶│ app/invite/[code].tsx        │    │
│  │ (OS → expo-router)  │        │ (outside (app) group)        │    │
│  └─────────────────────┘        └───────────────┬──────────────┘    │
│                                                  │                   │
│                                        ┌─────────┴──────────┐        │
│                    no session ────────▶│ AUTH DETOUR        │        │
│                                        │ SecureStore.set    │        │
│                                        │ pending_invite_code│        │
│                                        └─────────┬──────────┘        │
│                                                  │                   │
│                                        ┌─────────▼──────────┐        │
│                                        │ router.replace     │        │
│                                        │ /(auth)/login      │        │
│                                        └─────────┬──────────┘        │
│                                                  │  after sign-in    │
│                                                  ▼                   │
│                                        ┌────────────────────┐        │
│                                        │ Root layout checks │        │
│                                        │ SecureStore key →  │        │
│                                        │ replace /invite/X  │        │
│                                        └─────────┬──────────┘        │
│                                                  │                   │
│                                        ┌─────────▼──────────┐        │
│                                        │ /invite/[code].tsx │        │
│                                        │ (authed branch)    │        │
│                                        └─────────┬──────────┘        │
│                                                  │                   │
│  ┌───────────────────┐                           │                   │
│  │ /(app)/index      │◀── groups list ◀──────────┤                   │
│  │ (signed-in home)  │                           │                   │
│  └─────────┬─────────┘                           │                   │
│            │                                     │                   │
│    ┌───────┴─────┬──────────┬──────────┐         │                   │
│    ▼             ▼          ▼          ▼         │                   │
│  new.tsx   [id]/index   join.tsx   profile.tsx   │                   │
│  (create)  (detail)    (code)                    │                   │
│                                                  │                   │
│           TanStack Query mutations + reads       │                   │
│                       │                          │                   │
│                       ▼                          ▼                   │
│  ┌───────────────────────────────────────────────────────┐           │
│  │    supabase client singleton (src/lib/supabase.ts)    │           │
│  │    .rpc('create_group' | 'redeem_invite' | ...)       │           │
│  │    .from('groups').select()  /  .from('group_members')│           │
│  └──────────────────────────┬────────────────────────────┘           │
└─────────────────────────────┼────────────────────────────────────────┘
                              │ HTTPS (PostgREST + RPC endpoints)
┌─────────────────────────────▼────────────────────────────────────────┐
│                    SUPABASE (Postgres + Auth)                         │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐      │
│  │       RPCs (all SECURITY DEFINER, search_path = public)     │      │
│  │                                                             │      │
│  │  create_group         — 1 tx: insert group + admin row +   │      │
│  │                          first invite; returns group+code  │      │
│  │  regenerate_invite    — closes current invite, mints new   │      │
│  │  redeem_invite        — cap check w/ row lock, inserts     │      │
│  │                          group_members, marks invite used  │      │
│  │  get_invite_preview   — UNAUTH-callable; returns name/     │      │
│  │                          member_count/admin_display_name   │      │
│  │  leave_group          — DELETE group_members row           │      │
│  │                          (blocks admin; error 'admin_cannot_leave')│
│  │  transfer_admin       — swap groups.admin_user_id +        │      │
│  │                          group_members.role atomically     │      │
│  │  delete_group         — cascade delete (group → members,   │      │
│  │                          submissions, invites via FK CASCADE)│    │
│  └─────────────────────────┬───────────────────────────────────┘      │
│                            │                                          │
│  ┌─────────────────────────▼───────────────────────────────────┐      │
│  │              Tables (RLS on, P1 + P2 policies)              │      │
│  │  groups · group_members · invites · profiles · submissions  │      │
│  │  Helpers: is_group_member(g) · is_group_admin(g)            │      │
│  │  P2 migration adds: generate_invite_code() helper           │      │
│  └─────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (P2 additions — extends P1 layout verbatim)

```
app/
├── _layout.tsx              (MODIFIED: add pending-invite replay on post-auth mount)
├── (app)/
│   ├── _layout.tsx          (unchanged)
│   ├── index.tsx            (REPLACE placeholder w/ groups list)
│   ├── profile.tsx          (unchanged)
│   ├── groups/
│   │   ├── new.tsx          (NEW — create-group form)
│   │   ├── join.tsx         (NEW — code-entry screen)
│   │   └── [id]/
│   │       └── index.tsx    (NEW — group detail)
└── invite/
    └── [code].tsx           (NEW — deep-link landing, outside (app) group)

src/
├── features/
│   └── groups/              (NEW folder — mirrors features/auth layout)
│       ├── schemas.ts                 (Zod: create-group + join-code)
│       ├── useGroupsList.ts           (TanStack read)
│       ├── useGroup.ts                (TanStack read, per-id)
│       ├── useGroupMembers.ts         (TanStack read, per-id)
│       ├── useActiveInvite.ts         (TanStack read, admin-only, per-id)
│       ├── useCreateGroup.ts          (mutation → create_group RPC)
│       ├── useRedeemInvite.ts         (mutation → redeem_invite RPC)
│       ├── useGetInvitePreview.ts     (unauth-safe preview read)
│       ├── useLeaveGroup.ts           (mutation → leave_group RPC)
│       ├── useTransferAdmin.ts        (mutation → transfer_admin RPC)
│       ├── useDeleteGroup.ts          (mutation → delete_group RPC)
│       ├── useRegenerateInvite.ts     (mutation → regenerate_invite RPC)
│       ├── usePendingInvite.ts        (SecureStore get/set/clear)
│       ├── formatInviteCode.ts        (XXXXXXXX ↔ XXXX-XXXX utility)
│       └── timezones.ts               (static fallback list + Intl-first resolver)
├── components/
│   ├── SegmentedControl.tsx           (NEW — UI-SPEC addition 1)
│   ├── InviteCodeChip.tsx             (NEW — UI-SPEC addition 2)
│   └── Modal.tsx                      (NEW — UI-SPEC addition 3)
└── types/database.ts                  (regenerate after P2 migration)

supabase/
├── migrations/
│   └── 0004_phase2_groups_invites.sql (NEW — all RPCs + helper + policy cleanup)
└── tests/
    ├── create_group.sql               (NEW pgTAP — atomicity + admin row creation)
    ├── redeem_invite.sql              (NEW pgTAP — cap + expiry + used + already-member)
    ├── leave_group.sql                (NEW pgTAP — admin-blocked + member-ok)
    ├── transfer_admin.sql             (NEW pgTAP — atomicity of role swap)
    ├── delete_group.sql               (NEW pgTAP — cascade + admin-only)
    ├── regenerate_invite.sql          (NEW pgTAP — closes previous + mints new)
    └── get_invite_preview.sql         (NEW pgTAP — unauth-safe; leaks only 3 fields)
```

### Structure Rationale

- **`src/features/groups/` mirrors `src/features/auth/`** — one folder per domain, hooks co-located with their Zod schemas. Established by Phase 1.
- **`app/invite/[code].tsx` lives OUTSIDE `(app)`** — the unauthenticated preview path must NOT trigger the `(app)` gate in `useProtectedRoute`. Root layout handles both auth and unauth landings for this route.
- **One migration file (`0004_*`)** — append-only per Phase 1 convention. Numbered `0004` continues from `0003_phase1_review_fixes_2.sql`.
- **pgTAP per-RPC file** — one SQL test file per RPC lets the planner assign each file to a plan. Matches P1 pattern (`profiles_trigger.sql`, `profiles_rls.sql`, `rls_helpers.sql`).

---

### Pattern 1: SECURITY DEFINER RPC with typed error codes

**What:** All P2 write paths are RPCs executed as SECURITY DEFINER so they can enforce invariants that RLS cannot (atomic multi-table writes, cap checks under concurrency, cross-row references). Client destructures `{ data, error }` from supabase-js; typed errors surface as PostgreSQL error messages the client can branch on.

**When to use:** Any write that spans multiple tables or needs a race-safe cap/uniqueness check.

**Canonical shape (drafting template for `redeem_invite` — illustrative, not the final file):**

```sql
-- From Supabase docs (CITED: supabase.com/docs/guides/database/functions):
--   `raise exception 'message'` reverts the transaction and bubbles up to
--   supabase-js as an error with `.message` and `.code` fields.
create or replace function public.redeem_invite(code_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invites%rowtype;
  member_count int;
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- 1. Look up the invite. Lock the row to serialize with concurrent redeems
  -- targeting the same code (D-04: only one active invite, but two clients
  -- could race the same code).
  select * into inv
    from public.invites
    where code = code_input
    for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;
  if inv.used_at is not null then
    raise exception 'invite_already_used' using errcode = 'P0001';
  end if;
  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  -- 2. Already-member check (before cap check so "already_member" is surfaced
  -- without consuming the invite slot).
  if exists (select 1 from public.group_members
             where group_id = inv.group_id and user_id = caller) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  -- 3. Cap check under row-lock on the group row — closes the TOCTOU race.
  -- Lock the group row so two concurrent redeems serialize on it.
  perform 1 from public.groups where id = inv.group_id for update;

  select count(*) into member_count
    from public.group_members where group_id = inv.group_id;

  if member_count >= 10 then
    raise exception 'group_full' using errcode = 'P0001';
  end if;

  -- 4. Atomic: insert member + mark invite used.
  insert into public.group_members (group_id, user_id, role)
    values (inv.group_id, caller, 'member');

  update public.invites
    set used_at = now(), used_by = caller
    where id = inv.id;

  return inv.group_id;
end;
$$;

-- Grant execute to authenticated role (anon cannot call this one).
revoke execute on function public.redeem_invite(text) from public;
grant  execute on function public.redeem_invite(text) to authenticated;
```

**Client call shape (P1-established pattern — Shared Pattern 4 in `01-PATTERNS.md`):**

```typescript
// src/features/groups/useRedeemInvite.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function useRedeemInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('redeem_invite', { code_input: code });
      if (error) throw new Error(error.message); // message is 'group_full' / 'invite_expired' / ...
      return data as string; // group_id
    },
    onSuccess: (groupId) => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['group', groupId, 'members'] });
    },
  });
}
```

**Why this is the standard:**

- `raise exception 'code'` is how Supabase's own docs recommend surfacing typed errors from PL/pgSQL (CITED: Context7 `/supabase/supabase` — "Create function with logging at multiple severity levels"). The message string IS the error code for client branching.
- SECURITY DEFINER is the only way a single function can write to `group_members` (which normal users can't INSERT into via the P1-hardened policy without being admin or self) AND write `used_at`/`used_by` on `invites`.
- `for update` row locks close the TOCTOU gap. Without them, two redeems of the 10th slot both see `count() = 9`, both insert, ending at 11. [CITED: PostgreSQL docs — `SELECT ... FOR UPDATE` locks at row level, serializes against concurrent UPDATE/DELETE/FOR UPDATE on same rows.]

### Pattern 2: Server-side invite code generation with ambiguity-stripped alphabet + collision retry

**What:** A plpgsql helper `generate_invite_code()` returns a 32-char-alphabet (no `0 O 1 I L`) 8-char code. Called inside `create_group` and `regenerate_invite` in a bounded retry loop against the `invites_code_key` UNIQUE constraint (already exists — P1 migration).

**Alphabet:** 33 chars — `23456789ABCDEFGHJKMNPQRSTUVWXYZ` — stripped of `0 O 1 I L` per D-02. (UI-SPEC says "8 letters and numbers" → 10 digits minus `0,1` = 8 digits, 26 letters minus `O,I,L` = 23 letters, total 31. Re-check: UI-SPEC's own copy says 33⁸ ≈ 10¹² — implies 33 chars. Keep 33: `2-9` (8), `A-Z` minus `O,I,L` (23)? No: 26 − 3 = 23, 8 + 23 = 31. The planner should confirm the exact character set against D-02; 31 vs. 33 is immaterial to UX but should be locked in the migration comment.)

**Canonical shape:**

```sql
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';  -- 31 chars, ambiguity-stripped per D-02
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- Inside create_group / regenerate_invite:
declare
  attempts int := 0;
  new_code text;
begin
  loop
    new_code := public.generate_invite_code();
    begin
      insert into public.invites (group_id, code, created_by, expires_at)
        values (target_group_id, new_code, caller, now() + interval '7 days');
      exit;  -- success
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 5 then
        raise exception 'invite_code_collision' using errcode = 'P0001';
      end if;
    end;
  end loop;
end;
```

**Why retry works:** With 31⁸ ≈ 8.5×10¹¹ codes and at most 10K groups ever in the MVP, collision probability is ~10⁻⁸. 5 retries is far more than enough.

**Why server-side:** Client-side generation can't hold a transaction boundary against the UNIQUE constraint — client-generated codes force retry logic into RN with a round-trip per attempt. Server-side is simpler and atomic.

### Pattern 3: Deep-link auth detour via expo-secure-store + root-layout replay

**What:** Unauthenticated users tapping `accountibuzz://invite/{code}` land on `app/invite/[code].tsx`, which (a) calls `get_invite_preview` to render the unauth preview, (b) persists `code` to `SecureStore` under key `pending_invite_code` when the user taps "Sign in to join", then (c) the root layout checks that key on every post-auth mount and, if present, `router.replace('/invite/{code}')` to resume.

**When to use:** Any deep-link target that requires auth but has a legitimate unauth-preview phase (invite, email verification, shared link to paid content).

**Example (root layout extension — planner to fold into existing `useProtectedRoute` in `app/_layout.tsx`):**

```typescript
// Extending the existing useProtectedRoute (app/_layout.tsx)
// Source: Phase 1 analog (same file already handles recoveryPending from SecureStore-backed AsyncStorage flag)
import * as SecureStore from 'expo-secure-store';

const PENDING_INVITE_KEY = 'pending_invite_code';

function usePendingInviteReplay(session: Session | null) {
  const router = useRouter();
  useEffect(() => {
    if (!session) return;  // only fires once user has authed
    SecureStore.getItemAsync(PENDING_INVITE_KEY).then((code) => {
      if (!code) return;
      // Do NOT clear the key here — clear only after successful redeem_invite,
      // so a failure can retry. Matches P1 recovery pattern semantics.
      router.replace({ pathname: '/invite/[code]', params: { code } });
    });
  }, [session, router]);
}
```

**Auth-detour write (inside `app/invite/[code].tsx`, unauthed branch):**

```typescript
await SecureStore.setItemAsync(PENDING_INVITE_KEY, code);
router.replace('/(auth)/login');
```

**Clear (inside `useRedeemInvite.onSuccess`):**

```typescript
await SecureStore.deleteItemAsync(PENDING_INVITE_KEY);
```

**Canonical origin:** Phase 1 `AuthProvider.tsx` uses `AsyncStorage` for the `recoveryPending` flag via the same pattern — see `src/features/auth/AuthProvider.tsx` lines 43–75. The SecureStore adapter is already configured (`src/lib/storage-adapter.ts`, `LargeSecureStore`).

### Pattern 4: Timezone picker (hand-rolled against `Intl.supportedValuesOf` with static fallback)

**What:** Full-screen modal with search input + FlatList of `{ iana, label }` rows. At module load, try `Intl.supportedValuesOf('timeZone')` to populate the IANA list; if unavailable, fall back to a static 400-entry list baked into `src/features/groups/timezones.ts`. Labels generated at render time via `Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'long' })`.

**When to use:** Any time zone picker where bundling a full timezone-city database (moment-timezone, react-native-timezone-picker) is overkill.

**Risk flag (A2):** `Intl.supportedValuesOf` was not part of the Hermes spec through SDK 52; availability under SDK 55 Hermes on **iOS** is not universally guaranteed. Android Hermes has had Intl since June 2022 [CITED: github.com/facebook/hermes Issue #23]. A Wave 0 probe in the dev build MUST confirm the function returns a non-empty array before relying on it.

**Fallback snippet:**

```typescript
// src/features/groups/timezones.ts
const STATIC_FALLBACK: string[] = [
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Moscow', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland',
  // ... full list of ~400 common IANA zones committed as a .ts constant
];

export function listTimezones(): string[] {
  try {
    // Typescript: `supportedValuesOf` may not be in @types/intl yet on SDK 55.
    const fn = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    if (typeof fn === 'function') {
      const zones = fn('timeZone');
      if (Array.isArray(zones) && zones.length > 50) return zones;
    }
  } catch { /* fall through */ }
  return STATIC_FALLBACK;
}

export function labelFor(iana: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en', { timeZone: iana, timeZoneName: 'long' });
    const parts = fmt.formatToParts(new Date());
    const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    return name ? `${iana} — ${name}` : iana;
  } catch {
    return iana;
  }
}
```

**Why 400 static zones is fine:** The entire IANA database is ~600 zones, most of which are historical aliases. A curated ~400-row list covers every populated timezone a friend-group user will pick.

### Pattern 5: TanStack Query key scope + invalidation matrix

**What:** Every query key is rooted on a stable domain prefix (`['groups']`) and scoped by ID (`['group', groupId, ...]`), so mutation `onSuccess` can invalidate exactly what changed.

**When to use:** Every read hook in `src/features/groups/`.

**Key shape:**

| Hook | Query key | Notes |
|------|-----------|-------|
| `useGroupsList()` | `['groups']` | Root groups list for current user |
| `useGroup(id)` | `['group', id]` | Single group row (name/goal/submission_type/timezone) |
| `useGroupMembers(id)` | `['group', id, 'members']` | Member list for group detail |
| `useActiveInvite(id)` | `['group', id, 'invite']` | Admin-only; active invites row |

**Invalidation matrix (mutation → keys to invalidate):**

| Mutation | Invalidate |
|----------|------------|
| `create_group` | `['groups']`, set `['group', newId]` + `['group', newId, 'invite']` from RPC return |
| `redeem_invite` | `['groups']`, `['group', joinedId]`, `['group', joinedId, 'members']` |
| `leave_group` | `['groups']`, remove `['group', leftId]` from cache |
| `transfer_admin` | `['group', id]` (admin_user_id changes), `['group', id, 'members']` (roles change) |
| `delete_group` | `['groups']`, remove `['group', deletedId, ...]` entirely (`queryClient.removeQueries`) |
| `regenerate_invite` | `['group', id, 'invite']` |

**v5 API reminder (Shared Pattern 5 in P1):** Use `isPending`, not `isLoading`. Use `mutate` and `mutateAsync` as needed; `isPending` is the in-flight flag for both queries and mutations in v5.

### Anti-Patterns to Avoid

- **Client-side membership cap check as authority** — UI can preview but the RPC is the truth. Otherwise two concurrent redemptions both see "9/10" and both succeed.
- **Skipping `FOR UPDATE` in `redeem_invite`** — pure `SELECT count()` then `INSERT` is TOCTOU-vulnerable. This is Pitfall 5 below and must be actively defended.
- **`create_group` as 3 client-side inserts** — if the second or third fails, you get an orphan group with no admin membership row. Must be a single RPC wrapped in the function's implicit transaction.
- **Edge function for `redeem_invite`** — violates ARCHITECTURE.md anti-pattern #3. RPC + RLS suffice. No external network needed.
- **Deep-link landing that immediately routes to auth without rendering preview** — wastes the one chance to show the "{admin} invited you" hook (UI-SPEC screen contract). Always render preview first, then route on user action.
- **Clearing `pending_invite_code` before successful redeem** — if redemption fails (group full, expired), the user bounces back to login without a way to retry. Clear only in `onSuccess` of the redeem mutation.
- **Using `auth.jwt()->>'email'` or `user_metadata` in policies** — PITFALLS.md §3. P2 adds no new RLS; but when removing the placeholder policy, don't re-add any such policy as a replacement.
- **Realtime subscription to `group_members` in P2** — marked as D-discretion in CONTEXT but the recommendation is DEFER to P4. Adds teardown-leak risk (Pitfall 11) and channel proliferation for a minor UX win.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-table atomic write (group + admin + invite) | Chain of 3 client-side `.insert()` calls | `create_group` RPC | Client chain can't hold a transaction; failure at step 2 leaves orphan data |
| Member cap check under concurrency | `SELECT count()` + `INSERT` in app code | `redeem_invite` RPC with `FOR UPDATE` | TOCTOU race — two 10th-slot redemptions both succeed without row lock |
| Unique invite code generation | Client-side `nanoid()` + "if conflict, retry from client" | `generate_invite_code()` plpgsql helper inside a retry-on-unique-violation loop | Same-round-trip retry vs. client→server→client→server |
| IANA timezone list | Maintain your own static list exclusively | `Intl.supportedValuesOf('timeZone')` with a static fallback | Platform API provides up-to-date list on capable runtimes |
| Native share sheet | Call iOS/Android platform APIs yourself | `Share.share({ message })` from react-native | Platform-native, bundled, stable since RN 0.1 |
| Haptic feedback on copy | Manual vibrate calls | `expo-haptics.notificationAsync(Success)` | First-party Expo, works cross-platform |
| Clipboard write | Legacy RN Clipboard (removed) | `expo-clipboard.setStringAsync` | Current SDK 55 way [CITED: docs.expo.dev/versions/latest/sdk/clipboard] |
| Code format validation (`ABCD-EF12`) | Regex scattered across screens | A `formatInviteCode.ts` utility (normalize / display / validate) | One place for alphabet + dash rules |
| Deep-link auth-detour storage | AsyncStorage in plaintext | `expo-secure-store` via the existing `LargeSecureStore` adapter | Same encryption pattern as P1 session storage |

**Key insight:** The database owns authorization and atomicity; the client owns navigation and form state. Anything straddling the line (code generation, cap enforcement) belongs server-side.

## Runtime State Inventory

> Phase 2 is a **forward-adding** phase, not a rename or migration. No stored names, services, or tasks are being changed — the inventory below is therefore short by design. The one item flagged is a P1-shipped placeholder policy that P2 must retire (CONTEXT.md §D-11).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None. No rows exist in `groups`/`group_members`/`invites` yet (Phase 2 is when those tables start being populated). | None. |
| **Live service config** | None. | None. |
| **OS-registered state** | None. `accountibuzz://` scheme was already registered in `app.config.ts` during P1. Dev builds from P1 already recognize it. | None. Rebuild dev build only if plugin list changes (adding `expo-clipboard`/`expo-haptics` is a plugin-less config plugin — check `npx expo-doctor` after install). |
| **Secrets / env vars** | None new. Existing `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` continue to be the only client-visible env vars. | None. |
| **Build artifacts / installed packages** | P1 `invites_mark_used_as_self` policy (from `0002_phase1_review_fixes.sql` lines 132-139) permits any authed user to mark an invite used. It was explicitly labeled "P2 must harden" in the migration comment. | **Action:** `drop policy "invites_mark_used_as_self" on public.invites;` in `0004_phase2_groups_invites.sql`. Redemption moves to RPC-only; direct UPDATE is no longer a legitimate path. |

**Canonical question (post-rename/refactor): After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?** — N/A for P2 (no renames). The schema drift worth knowing about is documented in §Open Questions #1.

## Common Pitfalls

### Pitfall 1: Schema names in CONTEXT don't match the shipped migration (documentation drift)

**What goes wrong:** CONTEXT.md references `goal_description` (line 58), `admin_id` (in the ARCHITECTURE.md carry-over), and an `invite_code` column on `groups` (CONTEXT.md line 27 — "supersedes the single rotatable code on groups sketch"). None of these exist in the actual migration `0001_foundation.sql`:
- The column is **`goal`** (line 69), not `goal_description`.
- The column is **`admin_user_id`** (line 72), not `admin_id`.
- There is **no `invite_code` column on `groups`** (never shipped; CONTEXT's "may drop" comment is therefore moot — there's nothing to drop).

**Why it happens:** Research drafted before schema was final; CONTEXT didn't re-verify against the migration file.

**How to avoid:**
- Planner MUST treat `supabase/migrations/0001_foundation.sql` as the single source of truth for column names.
- When drafting `0004_phase2_groups_invites.sql`, use `goal`, `admin_user_id`. The CHECK constraint for D-17 is `check (length(goal) between 5 and 140)`.
- `0004_*` migration MUST NOT try to drop a nonexistent `invite_code` column; any such `alter table groups drop column invite_code` statement will fail.
- Type generation (`pnpm types:gen`) after the migration will produce `Database.public.Tables.groups.Row.goal` (not `goal_description`). Client code must match.

**Warning signs:** TypeScript compile errors after `types:gen`; 42703 ("column does not exist") errors from Postgres during migration apply.

### Pitfall 2: "Admin cannot leave" enforced only in UI

**What goes wrong:** UI hides the bare "Leave group" button for admins (UI-SPEC § Group detail — Bottom destructive zone), but a user who can craft a supabase-js call could still invoke `leave_group(group_id)` for a group they admin. If the RPC doesn't explicitly reject admins, the admin row is deleted and the group is orphaned (FK to admin_user_id has `on delete restrict` — actually, looking at `0001` line 72: `admin_user_id uuid not null references public.profiles(id) on delete restrict`, so the **profile** FK blocks the row from deleting, but an admin leaving their own group_members row is NOT blocked by that FK). Net result: admin still owns the group but is no longer a member, detail screen breaks.

**Why it happens:** Optimistic UI design; forgetting server-side invariant duplication.

**How to avoid:**
- `leave_group(group_id uuid)` RPC must begin with: `if auth.uid() = (select admin_user_id from groups where id = group_id) then raise exception 'admin_cannot_leave' using errcode = 'P0001'; end if;`
- pgTAP test `supabase/tests/leave_group.sql` must exercise the admin-attempts-leave case and assert the exception.

**Warning signs:** Group detail shows `admin_user_id` pointing to a user who has no row in `group_members` for that group.

### Pitfall 3: `get_invite_preview` leaks more than the three documented fields

**What goes wrong:** Drafting `get_invite_preview` as `returns groups` or `returns json` with a `select *` makes it trivial to accidentally leak columns that were never meant to be public (e.g., `admin_user_id`, `created_at`, or any column a v1.1 schema adds). Unauthenticated callers can hit this function; any new column becomes public by default.

**Why it happens:** Convenience overrides intent when writing SECURITY DEFINER functions.

**How to avoid:**
- Declare a dedicated, locked return type:
  ```sql
  create type public.invite_preview as (
    group_name text,
    member_count int,
    admin_display_name text
  );
  ```
  or use explicit `out` parameters. Never `returns groups` / `returns setof groups`.
- `revoke execute on function public.get_invite_preview(text) from authenticated;` then `grant execute ... to anon, authenticated;` so it is reachable without session.
- pgTAP test asserts the tuple shape AND that looking up a valid-but-expired code still returns the three-field tuple (expired status is not leaked in preview — UI-SPEC says the expiry error surfaces only on redeem).

**Warning signs:** PostgREST OpenAPI spec at `/rest/v1/` lists `get_invite_preview` with more than three output fields.

### Pitfall 4: Timezone picker ships and `Intl.supportedValuesOf` is undefined on iOS

**What goes wrong:** `listTimezones()` returns `undefined`, FlatList receives `undefined` as data, picker renders blank on iOS dev build. User can't pick a timezone; create-group flow dead-ends.

**Why it happens:** Hermes Intl spec compliance has historically lagged on iOS vs. Android (Issue #1172, #29141 in facebook/hermes + react-native). SDK 55 ships Hermes v1, which improves Intl but does not universally guarantee `supportedValuesOf`.

**How to avoid:**
- Wave 0 plan 01 (or wherever the timezone picker lands) includes a dev-build probe: `console.log(typeof Intl.supportedValuesOf)` on both iOS and Android, documented in plan notes.
- `listTimezones()` implementation (§Pattern 4) falls back to a 400-entry static list on any failure. The fallback is not the "temporary" path — it's the permanent defensive posture.
- Static fallback lives in `src/features/groups/timezones.ts` and is shipped from day 1.
- Unit test: mock `Intl.supportedValuesOf` to `undefined` and assert `listTimezones()` returns the static array (not empty, not throw).

**Warning signs:** Picker renders zero rows on a specific device/OS combo; console error "Intl.supportedValuesOf is not a function".

### Pitfall 5: Concurrent `redeem_invite` for the 10th slot both succeed

**What goes wrong:** User A and User B both tap "Join group" on a group with 9 members at the same moment. Both connections execute `select count(*) from group_members` (both see 9), both proceed to insert, group ends at 11 members. D-08 violated silently.

**Why it happens:** Without a lock, `count()` is a read-committed snapshot; two transactions at the same moment see identical pre-insert counts. The `group_members` PK `(group_id, user_id)` prevents the same user from inserting twice but does not prevent two different users from squeezing through.

**How to avoid:**
- `redeem_invite` does `perform 1 from public.groups where id = inv.group_id for update;` BEFORE the count query (§Pattern 1). This serializes all redemptions against that group on the `groups` row lock.
- Alternative (works but uglier): `pg_advisory_xact_lock(hashtext(group_id::text))` before the count. Row-lock on `groups` is cleaner because the group row is what you're logically counting against.
- pgTAP test `redeem_invite.sql` seeds a group with 9 members and 2 valid codes, then fires two parallel redemptions via `pg_background` or issues them in separate transactions that share a serialization barrier (approximation — full concurrency testing is integration-level; unit pgTAP asserts the code path with the lock is present).

**Warning signs:** Groups over 10 members discovered post-hoc; UI shows "10 of 10" when there are 11 rows.

### Pitfall 6: Deep-link arrives but app state is mid-auth

**What goes wrong:** User taps the invite link while the app is cold-starting. Expo-router matches `/invite/[code]`, but the root layout's `useProtectedRoute` races the paint: if `session === null` but `loading === true`, the gate does nothing, and `app/invite/[code].tsx` renders briefly against `session === null` (unauthed branch) even though the user is actually authed. The unauth preview shows, then a split-second later the gate redirects. Jank.

**Why it happens:** P1 already accounts for this with the `loading` flag (AuthProvider.tsx lines 63-65). The extension must respect it.

**How to avoid:**
- In `app/invite/[code].tsx`, read `useSession()` and gate the rendered branch on both `session` and `loading`. If `loading === true`, render the skeleton per UI-SPEC § Deep-link landing → Loading state.
- The `usePendingInviteReplay` hook (§Pattern 3) must ALSO check `loading === false` before firing, otherwise it could replay a key that's already been consumed on the previous mount.

**Warning signs:** Flash of unauth preview for an instant before auto-redirect; duplicate `router.replace` warnings in dev console.

### Pitfall 7: `regenerate_invite` leaves orphan unused codes

**What goes wrong:** Admin taps "Regenerate" five times in a row. Naive implementation: each call just inserts a new row without closing the previous. Next call to `useActiveInvite` either returns the wrong row or has to guess which one is "active" via `max(created_at)`. D-04 violated.

**Why it happens:** D-04 is a soft, RPC-enforced constraint — there's no DB index preventing multiple active invites.

**How to avoid:**
- `regenerate_invite(group_id)` first sets `used_at = now(), used_by = auth.uid()` on any row where `used_at is null and group_id = target`. This uses the semantic "used by admin as part of rotation" rather than a separate "closed" flag — keeps the schema minimal.
- Then mint the new code per §Pattern 2.
- `useActiveInvite(group_id)` query is `.from('invites').select().eq('group_id', id).is('used_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle()`.

**Warning signs:** Two rows for the same group with `used_at is null`.

### Pitfall 8: `transfer_admin` creates two admins momentarily

**What goes wrong:** A non-atomic implementation does `update groups set admin_user_id = new_id` first, then `update group_members set role = 'admin' where user_id = new_id`, then `update group_members set role = 'member' where user_id = old_id`. Between statements 1 and 3, both rows have `role = 'admin'`, and the old admin is transiently a member whose role doesn't match their `groups.admin_user_id` link. Any RLS check that fires during this window has stale truth.

**Why it happens:** Schema has TWO places that encode admin-ness (`groups.admin_user_id` AND `group_members.role`). P1 review-fixes 0002 (lines 150-155) explicitly noted this: "the new branch matches via groups.admin_user_id. The two agree today ... P2's create-group flow is responsible for keeping them in sync."

**How to avoid:**
- Inside the RPC, wrap all three updates in the implicit function transaction. PL/pgSQL functions run atomically — no external observer sees intermediate state.
- Validate pre-conditions before any write: new_admin_id must already be a `group_members` row in this group; caller must be current admin.
- pgTAP test asserts that after `transfer_admin` returns, exactly one row has `role = 'admin'` for the group, and `groups.admin_user_id` matches that row's `user_id`.

**Warning signs:** `group_members` query shows two admin-role rows for a single group.

### Pitfall 9: `delete_group` cascade misses invites

**What goes wrong:** Schema has `group_members on delete cascade`, `submissions on delete cascade`, but `invites` — let me check... `invites.group_id uuid not null references public.groups(id) on delete cascade` (0001 line 282). OK, cascade is there. So deleting the group row WILL cascade to invites. Confirmed.

**But:** CONTEXT D-10 says "cascade to `group_members`, `submissions`, `invites`; irreversible; confirmation required." Verify this is real by reading each FK's `on delete` clause:

- `group_members.group_id` → groups ON DELETE CASCADE (0001 line 105) ✓
- `submissions.group_id` → groups ON DELETE CASCADE (0001 line 234) ✓
- `invites.group_id` → groups ON DELETE CASCADE (0001 line 282) ✓

**But wait:** `groups.admin_user_id` → profiles ON DELETE RESTRICT (0001 line 72). This means deleting a *profile* is blocked if that profile admins any group. Deleting a *group* is not blocked. That's the direction we care about here. So cascade is correct.

**How to avoid:** Document this in the migration comment so future reviewers don't panic that `delete_group` doesn't manually sweep these tables.

**Warning signs:** Foreign-key errors when running `delete from groups` in tests.

### Pitfall 10: `create_group` seed-user trigger does not fire for the admin

**What goes wrong:** P1's `handle_new_user` trigger creates a `profiles` row on auth.users insert (0001 lines 340-358). `create_group` assumes `profiles.id = auth.uid()` exists. If the caller has no profile (e.g., some integration path bypassed the trigger), the FK `groups.admin_user_id -> profiles(id)` will fail.

**Why it happens:** In practice, every auth flow goes through the trigger, but it's a good invariant to test.

**How to avoid:**
- `create_group` optionally does `insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;` before inserting the group. This is defensive and cheap. (Matches `handle_new_user` idempotency.)
- pgTAP test for `create_group` uses a pre-seeded profile; also consider a negative test where a fresh auth.uid() without profile attempts and the RPC recovers gracefully.

**Warning signs:** 23503 (foreign_key_violation) on `groups_admin_user_id_fkey` during create.

## Code Examples

Representative code shapes for planner to hand to executor. Source citations tag each block.

### Create group (single-RPC, atomic)

```sql
-- Source: Derived from Supabase docs Pattern for multi-table RPC
-- (CITED: Context7 /supabase/supabase — "Validate input with conditional error handling")
-- Returns the new group_id + the initial invite code, so the client can render
-- the post-create banner + InviteCodeChip without a second round-trip.
create or replace function public.create_group(
  p_name text,
  p_goal text,
  p_submission_type text,
  p_timezone text
) returns table (group_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_group_id uuid;
  new_code text;
  attempts int := 0;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Defensive: ensure profile row exists (handle_new_user should cover this;
  -- idempotent safeguard per Pitfall 10 above).
  insert into public.profiles (id) values (caller) on conflict (id) do nothing;

  -- Input validation mirrors D-17 and UI-SPEC:
  if char_length(p_name) = 0 or char_length(p_name) > 60 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if char_length(p_goal) < 5 or char_length(p_goal) > 140 then
    raise exception 'invalid_goal' using errcode = 'P0001';
  end if;
  if p_submission_type not in ('photo','video') then
    raise exception 'invalid_submission_type' using errcode = 'P0001';
  end if;
  if p_timezone is null or length(p_timezone) = 0 then
    raise exception 'invalid_timezone' using errcode = 'P0001';
  end if;

  -- 1. Insert group row
  insert into public.groups (name, goal, submission_type, timezone, admin_user_id)
    values (p_name, p_goal, p_submission_type, p_timezone, caller)
    returning id into new_group_id;

  -- 2. Insert admin membership row
  insert into public.group_members (group_id, user_id, role)
    values (new_group_id, caller, 'admin');

  -- 3. Mint initial invite (Pattern 2 — retry on unique_violation)
  loop
    new_code := public.generate_invite_code();
    begin
      insert into public.invites (group_id, code, created_by, expires_at)
        values (new_group_id, new_code, caller, now() + interval '7 days');
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 5 then
        raise exception 'invite_code_collision' using errcode = 'P0001';
      end if;
    end;
  end loop;

  return query select new_group_id, new_code;
end;
$$;

revoke execute on function public.create_group(text, text, text, text) from public;
grant  execute on function public.create_group(text, text, text, text) to authenticated;
```

### Groups-list read hook (TanStack v5)

```typescript
// src/features/groups/useGroupsList.ts
// Source: P1 pattern from src/features/profile/useProfile.ts (same TanStack v5 shape).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';

type GroupsListRow = {
  id: string;
  name: string;
  goal: string;
  submission_type: 'photo' | 'video';
  timezone: string;
  member_count: number;  // computed below via RLS-safe JOIN or separate count
};

export function useGroupsList() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async (): Promise<GroupsListRow[]> => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, goal, submission_type, timezone, group_members!inner(count)')
        .order('name');
      if (error) throw error;
      // Map the aggregate count into member_count per row.
      return (data ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        goal: g.goal,
        submission_type: g.submission_type as 'photo' | 'video',
        timezone: g.timezone,
        member_count: (g.group_members?.[0] as { count?: number })?.count ?? 0,
      }));
    },
    staleTime: 30_000,
  });
}
```

### Share message (D-19 composition)

```typescript
// src/features/groups/shareInvite.ts
import { Share } from 'react-native';
import { formatInviteCode } from './formatInviteCode';

export async function shareInvite(groupName: string, rawCode: string) {
  // D-19 pre-formatted message. Store link is a literal placeholder for P2.
  const message =
    `Join my Accountibuzz group ${groupName}: code ${formatInviteCode(rawCode)}\n` +
    `Or open: accountibuzz://invite/${rawCode}\n` +
    `(Get the app: <store link placeholder>)`;
  await Share.share({ message });
  // Source: reactnative.dev/docs/share — Share.share returns action + activityType;
  // MVP does not branch on result (UI-SPEC: "no result handling — native sheet dismisses itself").
}
```

### Pending-invite replay in root layout

```typescript
// app/_layout.tsx (additions — fold into existing RootGate / useProtectedRoute)
// Source: Phase 1 AuthProvider.tsx RECOVERY_PENDING_KEY pattern.
import * as SecureStore from 'expo-secure-store';

const PENDING_INVITE_KEY = 'accountibuzz.pendingInviteCode';

function usePendingInviteReplay() {
  const { session, loading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (loading || !session) return;
    SecureStore.getItemAsync(PENDING_INVITE_KEY).then((code) => {
      if (!code) return;
      // Do NOT clear here — clear only in useRedeemInvite onSuccess.
      router.replace({ pathname: '/invite/[code]', params: { code } });
    });
  }, [session, loading, router]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single rotatable `invite_code` on `groups` (old ARCHITECTURE.md) | Separate `invites` table with per-row expiry/used | Phase 1 foundation (0001 migration) | All P2 RPCs target `invites` table; CONTEXT D-01 makes this the source of truth |
| Edge function `invite-redeem` (ARCHITECTURE.md lines 43-44) | Postgres SECURITY DEFINER RPC | Phase 2 (this phase) | No network hop, no cold start, pure SQL transaction |
| `Clipboard` API from `react-native` core | `expo-clipboard` module | RN 0.69+ / SDK 46+ | Use `expo-clipboard.setStringAsync` [CITED: docs.expo.dev/versions/latest/sdk/clipboard] |
| TanStack Query v4 `isLoading` | TanStack Query v5 `isPending` | Q2 2024 | Already established in P1; reuse |
| Universal Links + AASA (first choice for invites) | Custom scheme `accountibuzz://` for P2, defer UL to P6 | P2 CONTEXT D-05 | No domain registered; UL adds external lead time |
| P1 `invites_mark_used_as_self` policy | Drop policy; RPC-only redemption | P2 (this migration) | Closes the direct-UPDATE attack surface noted in 0002's comment |

**Deprecated/outdated in source research:**

- `.planning/research/ARCHITECTURE.md` §"Deep-Link Invite Flow" still uses `redeem_invite` against a `groups.invite_code` column — schema reality overrides this (no such column exists).
- `.planning/research/ARCHITECTURE.md` data-model sketch uses `goal_description` and `admin_id` — actual migration uses `goal` and `admin_user_id`.
- `.planning/research/FEATURES.md` (if referenced) mentions admin "kick" — explicitly deferred in CONTEXT.

## Assumptions Log

> List of claims tagged `[ASSUMED]` above that require user confirmation or Wave 0 verification.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Invite alphabet is 31 chars (`2-9A-Z` minus `O,I,L`), 8 chars long → ~10¹² space | §Pattern 2 | UI-SPEC cites "33⁸ ≈ 10¹²" — off-by-two char set. Either is safe; pick ONE explicitly in the migration comment and the formatInviteCode utility. Assumed alphabet size needs final confirmation when writing the migration. |
| A2 | `Intl.supportedValuesOf('timeZone')` MAY or MAY NOT be available on Hermes iOS under SDK 55 | §Standard Stack, §Pitfall 4 | If missing, picker is blank on iOS; fallback path must ship from day 1. Wave 0 dev-build probe must confirm behavior on both iOS and Android. |
| A3 | No business need for edge functions in P2 (pure RPC + client suffices) | §Anti-patterns | If a future admin action requires external HTTP (e.g., audit-log to Slack), an edge function lands in a later phase; not P2. |
| A4 | `Share.share({ message })` alone works on both iOS and Android with the D-19 message including a URL | §Don't Hand-Roll, §Code Examples | Confirmed by reactnative.dev docs — `message` is cross-platform; `url` is iOS-only (would duplicate content in the message). One field is correct. |
| A5 | SDK 55 dev build will not need a fresh rebuild when adding `expo-clipboard` + `expo-haptics` (no new native modules with custom plugins) | §Runtime State Inventory | If `npx expo install` pulls a version requiring prebuild, Wave 0 plan should call it out so the executor runs `npx expo run:ios` before coding further. |
| A6 | No pgTAP tests from P1 covered the RPCs P2 adds (because they didn't exist yet) | §Validation Architecture | Confirmed — `supabase/tests/` currently contains `profiles_trigger.sql`, `profiles_rls.sql`, `rls_helpers.sql`. P2 adds 7 new pgTAP files. |
| A7 | `FOR UPDATE` row-lock on `groups` inside `redeem_invite` serializes concurrent redemptions correctly in Supabase's default isolation level (READ COMMITTED) | §Pattern 1, §Pitfall 5 | Postgres semantics confirm this; Supabase hosted Postgres ships default READ COMMITTED which is sufficient for `FOR UPDATE` serialization at row level. Worth noting in pgTAP test comments. |

## Open Questions

1. **Invite alphabet exact size: 31 vs. 33 chars?** The UI-SPEC's math (33⁸) implies 33 chars; ambiguity-strip on 10 digits + 26 letters minus `0,1,O,I,L` = 8 + 23 = 31. Planner should resolve by picking one and comment the migration accordingly. Functional impact: zero (both are cryptographically ample). Audit/docs impact: the `formatInviteCode` validator must match the exact alphabet.
2. **`redeem_invite` return shape: `uuid` vs. full group row?** D-discretion. Recommendation: return just `group_id uuid`. The client's `onSuccess` invalidates `['group', id]` and navigates to `/groups/{id}` which triggers a fresh fetch. Returning the full row doubles the wire payload and couples server-side schema to client-side types. This is also simpler for the RPC signature.
3. **`transfer_admin` target must be a current member — enforce via FK check or by user-id arg?** Recommendation: RPC takes `new_admin_user_id uuid` and verifies via `exists (select 1 from group_members where group_id = ? and user_id = ?)`. UI (transfer-admin picker modal) guarantees the arg is valid; server is defense-in-depth.
4. **Should `get_invite_preview` reveal "this invite is expired/used" or uniformly say "not found"?** Security vs. UX. UI-SPEC (§Deep-link preview paths) implies it renders the preview even for expired invites (redemption fails; the error surfaces there). Confirm — recommendation: `get_invite_preview` succeeds for any `code` matching an `invites` row (regardless of expiry/used), returning the three fields. It does NOT surface used/expired state. `redeem_invite` is the only place that discriminates. Prevents enumeration by making expired/unused codes indistinguishable at preview.
5. **Realtime for group-detail member list — ship or defer?** Recommendation: **DEFER to P4.** Reasons: (a) pull-to-refresh satisfies the UX spec; (b) adds a channel-teardown failure mode (Pitfall 11 from PITFALLS.md); (c) P4 is where Realtime infrastructure earns its keep (leaderboard is the load-bearing use case). CONTEXT marks this as D-discretion; explicit defer keeps P2 scope tight.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Migrations, types:gen, pgTAP | ✓ | 2.90.0 | — |
| Node.js | Jest, TypeScript, types:gen | ✓ | 22.17.1 | — |
| `supabase/migrations/0001_foundation.sql` applied | All RPCs target existing schema | ✓ (P1 complete) | — | — |
| `supabase/migrations/0002_phase1_review_fixes.sql` applied | `invites_mark_used_as_self` policy to drop | ✓ (P1 complete) | — | — |
| iOS dev build | Deep-link testing, Intl feature probe, Share.share | Required per CLAUDE.md | — | none (Expo Go cannot host custom-scheme deep links + lacks native modules) |
| Android dev build | Parity testing | Deferred per STATE.md (no Android env) | — | none for full verification; iOS-only UAT acceptable per P1 precedent |
| `expo-clipboard` | InviteCodeChip copy | ✗ (not yet installed) | — | Install via `npx expo install expo-clipboard` in Wave 0 |
| `expo-haptics` | Copy-success haptic | ✗ (not yet installed) | — | Install via `npx expo install expo-haptics` in Wave 0; feature-degrade to no-haptic is acceptable |
| `expo-localization` | Tz label fallback (optional) | ✗ (not yet installed) | — | Only install if Intl-based label resolution proves flaky in Wave 0 |
| Brave / Exa / Firecrawl search | Research enrichment | ✗ | — | Built-in WebSearch used |
| Context7 MCP | Library docs | ✓ (via `ctx7` CLI fallback) | — | — |

**Missing dependencies with no fallback:** None. Everything needed for P2 is either installable via `npx expo install` or already shipped.

**Missing dependencies with fallback:** `expo-clipboard`, `expo-haptics` — both trivial installs. Haptic feature can gracefully degrade.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` → this section is REQUIRED.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (`jest-expo` preset) for RN/TS + pgTAP for SQL — both already wired in P1 |
| Config file | `jest.config.js` + `jest.setup.ts` (RN), `supabase test db` for pgTAP |
| Quick run command | `pnpm test` (Jest only) |
| Full suite command | `pnpm test:all` (= `jest && supabase test db`) |

### Phase Requirements → Test Map

Covers all 8 Nyquist dimensions for each requirement (unit, integration, RLS-policy, E2E smoke, plus the phase-specific concurrency/error-shape/deep-link dimensions).

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRP-01 | `create_group` RPC inserts group + admin row + first invite atomically | pgTAP | `supabase test db` → `create_group.sql` | ❌ Wave 0 |
| GRP-01 | Create-group form validates name/goal/type/tz via Zod | unit (Jest) | `pnpm test -- groups/schemas.test.ts` | ❌ Wave 0 |
| GRP-01 | Create-group screen submits via RPC and routes to detail | integration (RN Testing Library) | `pnpm test -- groups/new.test.tsx` | ❌ Wave 0 |
| GRP-02 | Creator becomes admin (`admin_user_id` matches auth.uid, `group_members.role` = 'admin') | pgTAP | `create_group.sql` | ❌ Wave 0 |
| GRP-03 | `useGroupsList()` returns only groups the user is a member of (RLS-verified) | pgTAP (RLS policy) + Jest (hook) | `groups_list_rls.sql` + `useGroupsList.test.ts` | ❌ Wave 0 |
| GRP-04 | Group detail renders header/members/admin-panel; non-member denied by RLS | pgTAP (existing `groups_select_member` + `group_members_select_own_or_same_group`) + Jest integration | existing P1 pgTAP covers RLS; new `groups/detail.test.tsx` | ❌ Wave 0 (client test) |
| GRP-05 | `leave_group` RPC: member path succeeds + DELETEs their row | pgTAP | `leave_group.sql` | ❌ Wave 0 |
| GRP-05 | `leave_group` RPC rejects admin with `admin_cannot_leave` | pgTAP | `leave_group.sql` | ❌ Wave 0 |
| INV-01 | `regenerate_invite` closes prior active row + inserts new code | pgTAP | `regenerate_invite.sql` | ❌ Wave 0 |
| INV-01 | `generate_invite_code()` returns 8-char ambiguity-stripped string | pgTAP | `generate_invite_code.sql` (or inline in `create_group.sql`) | ❌ Wave 0 |
| INV-02 | `redeem_invite` succeeds for valid code, inserts member, marks invite used | pgTAP | `redeem_invite.sql` | ❌ Wave 0 |
| INV-02 | `redeem_invite` raises `invite_expired`, `invite_already_used`, `invite_not_found`, `already_member` | pgTAP | `redeem_invite.sql` | ❌ Wave 0 |
| INV-02 | `get_invite_preview` works without session (anon role) | pgTAP | `get_invite_preview.sql` | ❌ Wave 0 |
| INV-02 | Deep-link auth detour: SecureStore round-trip + replay routes to `/invite/{code}` | Jest (RN Testing Library with SecureStore mock) | `pendingInviteReplay.test.tsx` | ❌ Wave 0 |
| INV-02 | Code-entry form normalizes (strips non-alphanum, uppercases, 4-char dash insert) | unit (Jest) | `formatInviteCode.test.ts` | ❌ Wave 0 |
| INV-03 | `redeem_invite` rejects with `group_full` when member_count = 10 | pgTAP | `redeem_invite.sql` | ❌ Wave 0 |
| INV-03 | Concurrency: 11th-slot race doesn't slip through (FOR UPDATE lock present) | pgTAP (lock assertion — structural) | `redeem_invite.sql` asserts `FOR UPDATE` in the function body | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test -- <related-file>` (Jest, < 10s)
- **Per wave merge:** `pnpm test:all` (Jest + pgTAP, < 60s)
- **Phase gate:** `pnpm test:all` green + `pnpm typecheck` green + manual iOS walkthrough per P1 precedent (Android deferred).

### Wave 0 Gaps

- [ ] `supabase/tests/create_group.sql` — pgTAP for GRP-01 + GRP-02 + code-gen collision path
- [ ] `supabase/tests/redeem_invite.sql` — INV-02 + INV-03 (expired/used/not-found/already-member/group-full + lock assertion)
- [ ] `supabase/tests/get_invite_preview.sql` — INV-02 (unauth path)
- [ ] `supabase/tests/leave_group.sql` — GRP-05 (member ok, admin rejected)
- [ ] `supabase/tests/transfer_admin.sql` — invariant: exactly one admin after success
- [ ] `supabase/tests/delete_group.sql` — cascade behavior
- [ ] `supabase/tests/regenerate_invite.sql` — INV-01
- [ ] `tests/groups/schemas.test.ts` — Zod schema unit tests (create-group + join-code)
- [ ] `tests/groups/formatInviteCode.test.ts` — code-format utility tests
- [ ] `tests/groups/new.test.tsx` — create-group screen integration (RN Testing Library)
- [ ] `tests/groups/detail.test.tsx` — group-detail screen integration
- [ ] `tests/groups/pendingInviteReplay.test.tsx` — SecureStore detour flow
- [ ] `tests/groups/useGroupsList.test.ts` — hook unit test
- [ ] `tests/groups/timezonePicker.test.tsx` — picker fallback + search
- [ ] `jest.setup.ts` mock additions: `expo-clipboard`, `expo-haptics`, and conditional mock for `Intl.supportedValuesOf`
- [ ] `npx expo install expo-clipboard expo-haptics` (+ optional `expo-localization`)
- [ ] Run `pnpm types:gen` after 0004 migration applies, commit updated `src/types/database.ts`

**Existing test infrastructure that covers P2 without addition:**

- `jest.config.js` + `jest-expo` preset — ready for new test files
- `jest.setup.ts` mocks for `expo-secure-store`, `@react-native-async-storage/async-storage`, `expo-image-picker`, `expo-image-manipulator`, `expo-file-system` — reused
- `.github/workflows/rls-check.yml` — auto-covers any new table (none in P2, but CI still runs)
- `supabase test db` infrastructure — new `.sql` files drop in

## Security Domain

> `security_enforcement` is absent in `.planning/config.json` → treat as enabled. Relevant for this phase because RPC + RLS boundaries are the entire authorization story.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase GoTrue (P1-established); `auth.uid()` in every RPC guard |
| V3 Session Management | yes | P1 `LargeSecureStore` adapter; no P2 additions; pending-invite key is non-secret (public code) but encrypted in transit via SecureStore anyway |
| V4 Access Control | yes | RLS on all tables + SECURITY DEFINER RPCs for cross-row authorization; `get_invite_preview` is explicitly unauth-callable (justified; leaks only 3 fields by design) |
| V5 Input Validation | yes | Zod on client (RHF resolver), plpgsql guards (name length, goal length, enum check on submission_type, non-null timezone) server-side — defense in depth |
| V6 Cryptography | minimal | No new cryptography in P2. Invite codes are low-entropy-by-design (human-type-able); they are 31⁸ ≈ 10¹² which is NOT secret-key strength — safe because they are single-use, 7-day expiry, and rate-limited by app UX. Never treat them as auth tokens. |
| V7 Error Handling / Logging | yes | `raise exception 'code'` surfaces typed errors; no internal PII in exception strings (e.g., never include email or auth.uid() in error text) |
| V10 Malicious Code | n/a | No user-uploaded code; no eval paths |
| V13 API | yes | PostgREST auto-generates API; SECURITY DEFINER RPCs are the only mutation surface; `get_invite_preview` is the only `grant execute ... to anon` in P2 |

### Known Threat Patterns for Supabase + Expo RN Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Invite code enumeration (attacker guesses codes) | Information Disclosure | 31⁸ space + per-IP rate limiting via Supabase Auth rate limits on RPC; optional: exponential backoff if > N `invite_not_found` errors per session (defer unless abuse observed) |
| Concurrent 10th-slot redeem (race) | Tampering (integrity of cap) | `FOR UPDATE` row-lock in `redeem_invite` — §Pitfall 5, §Pattern 1 |
| Non-member redeems for a group they shouldn't see | Elevation of Privilege | RPC-only redemption; SECURITY DEFINER enforces every precondition; RLS on `invites` table (existing `invites_select_admin`) blocks direct `SELECT` from non-admins |
| Admin leaves by direct RPC call bypass | Tampering | `leave_group` begins with admin-check guard (§Pitfall 2) |
| `get_invite_preview` over-shares fields | Information Disclosure | Dedicated return type (not `returns groups`) — §Pitfall 3 |
| `transfer_admin` produces two admins | Tampering | Atomic transaction inside RPC — §Pitfall 8 |
| Deep-link replay attack (forged `accountibuzz://invite/AAAA`) | N/A — not a security issue | Worst case: `invite_not_found`; user sees friendly error. Any code the attacker can guess, a legitimate user could also guess — use the same rate-limit mitigation as above if abuse observed. |
| SecureStore pending-invite leak | Information Disclosure | `pending_invite_code` is not secret (invite codes are public by design); nonetheless stored encrypted via the LargeSecureStore adapter P1 uses for everything |
| Invite code in share message is intercepted | N/A — public by design | Invite codes are meant to be shared over SMS/email/chat. Security model is single-use + expiry, not secrecy. |
| `service_role` key leaking into client | Elevation of Privilege (critical) | PITFALLS.md §3 enforcement: ESLint rule + manual review; no new client env vars in P2 |

## Sources

### Primary (HIGH confidence)

- Context7 `/supabase/supabase` — topics: "SECURITY DEFINER RPC custom error code raise exception" (CITED: docs.supabase.com function docs)
- `supabase/migrations/0001_foundation.sql` — schema ground truth (VERIFIED: direct inspection)
- `supabase/migrations/0002_phase1_review_fixes.sql` — review-fix patterns + placeholder policy to remove (VERIFIED: direct inspection)
- `supabase/migrations/0003_phase1_review_fixes_2.sql` — review-fix idiom continuity (VERIFIED: direct inspection)
- `package.json` — dependency versions (VERIFIED: direct read)
- `src/features/auth/AuthProvider.tsx` — pending-flag + replay pattern analog (VERIFIED: direct read)
- `src/lib/supabase.ts`, `src/lib/storage-adapter.ts` — singleton + LargeSecureStore (VERIFIED: direct read)
- `.planning/phases/02-groups-invites/02-CONTEXT.md` — all decisions D-01..D-20 (VERIFIED: direct read)
- `.planning/phases/02-groups-invites/02-UI-SPEC.md` — screen inventory, copy, component contract (VERIFIED: direct read)
- `.planning/phases/01-foundation/01-PATTERNS.md` — Shared Patterns 1-6 (VERIFIED: direct read)
- `.planning/research/PITFALLS.md` §3 (RLS), §8 (storage), §11 (Realtime) — P2-relevant subset (VERIFIED: direct read)
- [Supabase Database Functions Docs — raise exception + security definer](https://supabase.com/docs/guides/database/functions) — CITED via Context7
- [Supabase Securing your API (SECURITY DEFINER examples)](https://supabase.com/docs/guides/api/securing-your-api) — CITED via Context7
- [PostgreSQL SELECT FOR UPDATE semantics](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) — CITED

### Secondary (MEDIUM confidence)

- [Expo Clipboard docs — expo-clipboard 55.0.13](https://www.npmjs.com/package/expo-clipboard) — CITED
- [Expo Haptics docs — expo-haptics 55.0.14](https://www.npmjs.com/package/expo-haptics) — CITED
- [React Native Share API docs](https://reactnative.dev/docs/share) — CITED for cross-platform `message` field behavior
- [Hermes React Native docs — Intl support history](https://reactnative.dev/docs/hermes) — CITED for A2 risk flag
- [Hermes Intl iOS support discussion (Medium)](https://medium.com/@iROOMitEng/hermes-intl-support-in-react-native-on-ios-134b487bcce7) — CITED

### Tertiary (LOW confidence — flag for validation)

- [facebook/hermes Issue #1172 — Intl.DateTimeFormat iOS device bugs](https://github.com/facebook/hermes/issues/1172) — CITED as evidence that Hermes iOS Intl has historical unreliability
- [facebook/react-native Issue #29141 — Hermes blocks Intl on Android (old)](https://github.com/facebook/react-native/issues/29141) — CITED as historical context; resolved June 2022

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all core libraries already shipped and validated in P1; 2-3 tiny first-party Expo adds
- RPC patterns: HIGH — schema directly inspected + Supabase docs cited via Context7
- Deep-link flow: HIGH — P1's `AuthProvider.recoveryPending` is a working analog
- Timezone picker: MEDIUM — `Intl.supportedValuesOf` availability flagged as A2; fallback plan shipped
- Common pitfalls: HIGH — 10 pitfalls identified, each with migration-file-level diagnosis
- Validation architecture: HIGH — test infrastructure inherited from P1, 17 new test files mapped
- Security domain: HIGH — no novel crypto; model is RPC + RLS + input validation, all established

**Research date:** 2026-04-24
**Valid until:** 2026-05-08 (14 days; extended from default 7 because the stack is locked and move fast). Re-validate A2 (Intl support) during Wave 0 on actual dev build before relying on it.

---

## RESEARCH COMPLETE
