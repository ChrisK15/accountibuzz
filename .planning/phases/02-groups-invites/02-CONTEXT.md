# Phase 2: Groups & Invites - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can form the container for accountability — a group — and bring people in. Phase 2 delivers:

- Create a group (name, goal description, submission type photo|video, IANA timezone) — creator becomes admin
- View list of groups the user belongs to (signed-in home)
- Drill into a group: see members, rules, and group-detail actions
- Generate and share an invite code (8-char chunked, single-use, 7-day expiry)
- Join a group by entering a code or tapping a deep link (custom scheme)
- Cap membership at 10, enforced server-side
- Leave a group (member); admin must transfer or delete-group instead

Out of scope for Phase 2 (later phases own these): submissions / camera capture (P3), admin review (P3), points/streaks/leaderboard/feed (P4), push notifications (P5), Universal Links + AASA/assetlinks (P6), admin remove-member action (deferred unless requested).

</domain>

<decisions>
## Implementation Decisions

### Invite Model
- **D-01:** **Single-use per row.** The `invites` table shipped in P1 (`code`, `expires_at`, `used_at`, `used_by`) is the source of truth. Each invite is one row; once `used_at` is set it's dead. Admin can mint additional invites at any time. This supersedes the "single rotatable code on `groups`" sketch in `research/ARCHITECTURE.md` — schema reality wins.
- **D-02:** **Code format = 8-char uppercase alphanumeric, ambiguity-stripped** (no `0/O/1/I/L`). Display chunked as `ABCD-EF12`. ~33⁸ ≈ 10¹² combinations — overkill for friend-group scale, but trivial to enter by hand if a link breaks.
- **D-03:** **Default expiry = 7 days** (`expires_at = now() + interval '7 days'` on insert). Admin can regenerate on demand from the group-detail screen — regenerate stamps `used_at` on the previous active row and creates a new one. No automatic rotation.
- **D-04:** **One active invite at a time per group** (soft constraint at the RPC level — if admin creates a new one, the previous active row is closed). Keeps the "share the code" UX unambiguous.

### Deep Linking
- **D-05:** **Custom scheme only in P2.** `accountibuzz://invite/{code}` registered via `app.config.ts`. **Universal Links + AASA/assetlinks are deferred to Phase 6** (Pre-Rollout Hardening) because no domain is registered yet. P2 ships with the link working for already-installed users; the canonical share path uses code-entry + share-sheet copy.
- **D-06:** **Code-entry screen is the load-bearing path,** not the deep link. Phase 1's auth pivot (OTP over deep-link reset) showed mail clients eat custom-scheme links — same risk applies here. The share message includes both the code and the custom-scheme link; recipients can tap or type.
- **D-07:** **Pre-auth invite preview via `get_invite_preview(code text)` SECURITY DEFINER RPC.** Returns `{ group_name, member_count, admin_display_name }` only — never member lists or submissions. Unauthenticated callers can hit it. Invite code held in `expo-secure-store` across the auth detour and replayed after login.

### Membership & Lifecycle
- **D-08:** **Hard member cap = 10**, enforced inside `redeem_invite` RPC. Reject with a typed error (`'group_full'`) when a join would push count above 10. No admin override at MVP.
- **D-09:** **Member leave = hard DELETE on `group_members` row.** Their `submissions` rows stay (for future feed history + admin audit in P3+). Their leaderboard line vanishes. They lose RLS read on the group entirely.
- **D-10:** **Admin cannot leave.** Attempting "Leave group" as the admin surfaces a modal with two paths: **Transfer admin** (single-tap pick a current member) or **Delete group** (cascade to `group_members`, `submissions`, `invites`; irreversible; confirmation required).
- **D-11:** **All write paths go through SECURITY DEFINER RPCs** — `redeem_invite(code)`, `leave_group(group_id)`, `transfer_admin(group_id, new_admin_id)`, `delete_group(group_id)`, `regenerate_invite(group_id)`. The placeholder `invites_update_authenticated` policy from P1 gets removed; redemption is RPC-only. Direct table policies stay restrictive and uniform.

### App Shell & Navigation
- **D-12:** **Stack-based shell with Groups list as the signed-in home.** Route layout:
  - `app/(app)/index.tsx` — groups list (replaces today's profile-only home)
  - `app/(app)/groups/new.tsx` — create-group form
  - `app/(app)/groups/[id]/index.tsx` — group detail (header + members + admin actions)
  - `app/(app)/groups/join.tsx` — code-entry screen
  - `app/(app)/profile.tsx` — already exists; reachable via header avatar tap
  - `app/invite/[code].tsx` — deep-link target (resolves preview RPC, routes to auth or join)
  - **No tab bar yet** — introduce in P3 when "Today / Submit" surface arrives and competes for top-level attention.
- **D-13:** **Groups list empty state shows two equal-weight CTAs**: "Create a group" + "Join with code". Once the user has at least one group, the list shows a `+` icon in the header (create) and a kebab menu with "Join with code" (less prominent).
- **D-14:** **Group detail screen content (P2 scope)**: header with name/goal/submission-type/timezone; members list (avatar + display name + admin badge); admin-only "Show invite code" panel (chunked code + copy + native share sheet + "Regenerate code"); "Leave group" / "Transfer admin" / "Delete group" actions positioned destructively at the bottom.

### Create-Group UX
- **D-15:** **Single screen, all fields visible.** Reuses Phase 1 form patterns (`TextInput`, `FormError`, `FormLabel`, `PrimaryButton`). Submit type = segmented control (photo | video). Timezone = read-only display tappable to open a searchable IANA picker.
- **D-16:** **Timezone default = device tz** via `Intl.DateTimeFormat().resolvedOptions().timeZone`, editable. Display the human label (e.g. "Pacific Time") next to the IANA string for legibility.
- **D-17:** **Goal description = required, 5–140 chars.** Multiline input with visible char counter. Empty / sub-5-char goals rejected client-side and at DB (`check (length(goal_description) between 5 and 140)`).
- **D-18:** **Post-create destination = the new group's detail screen** with a one-time banner: "Group created — share the code to invite friends." Code is generated server-side as part of the create transaction (returned by a `create_group` RPC) so the share button is live immediately. Reduces "create → discover invite" to zero taps.

### Share UX
- **D-19:** **Native share sheet via React Native `Share.share`.** Pre-formatted message:
  > Join my Accountibuzz group **{group_name}**: code `ABCD-EF12`
  > Or open: accountibuzz://invite/ABCDEF12
  > (Get the app: <store link placeholder>)
  Store link is a placeholder string for P2 (no listing yet); replaced in P6.
- **D-20:** **No QR code in P2.** Cute but unjustified dep cost; revisit if friend-group testing surfaces in-person invite scenarios.

### Claude's Discretion
- Exact error-state copy ("This code has expired", "This group is full", "You're already in this group") — write during planning/implementation; keep tone friendly but direct.
- Loading skeletons / spinners for the groups list and group detail screens.
- Whether `create_group` is a single RPC or a client-side `insert + insert + insert` chain — RPC is preferred for atomicity (group + admin row + first invite all-or-nothing).
- Whether deep-link landing (`app/invite/[code].tsx`) navigates to auth via `router.replace` or shows an inline "Sign in to join" sheet — pick whatever matches Phase 1's auth navigation patterns.
- IANA picker library choice (or roll our own with a flat list and search) — pick the lightest workable option during planning.
- Whether the `redeem_invite` RPC returns the full group row or just `group_id` (caller refetches) — depends on what the planner finds cleanest with TanStack Query.
- Realtime subscription for the group-detail member list (live updates as people join/leave) — nice-to-have; ship if cheap, defer if it complicates P2.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level
- `.planning/PROJECT.md` — vision, constraints, out-of-scope (no discovery, no chat, no DMs)
- `.planning/REQUIREMENTS.md` — GRP-01..05 + INV-01..03 are the P2 targets
- `.planning/ROADMAP.md` §"Phase 2: Groups & Invites" — goal + success criteria (binding)
- `.planning/STATE.md` — open question on universal-link domain (resolved here: deferred to P6)

### Stack & Architecture
- `.planning/research/ARCHITECTURE.md` §"Deep-Link Invite Flow" — redemption flow shape, store-pending-code-during-auth pattern
- `.planning/research/ARCHITECTURE.md` §"Data Model (Postgres)" — `groups`, `group_members`, `invites`, helper fns `is_group_member` / `is_group_admin`
- `.planning/research/ARCHITECTURE.md` §"RLS Policies" — policy matrix per table; note that the architecture's "invite code on groups" idea is overridden by D-01
- `.planning/research/ARCHITECTURE.md` §"Anti-Patterns" — esp. #3 (don't put business logic in edge functions when triggers/RPCs suffice) and #5 (no public bucket security through obscurity)
- `.planning/research/PITFALLS.md` §3 (RLS-off-by-default) — every new table/RPC must keep the CI check green

### Phase 1 Foundation Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-01..D-12 establish the schema, app-shell, theme, and form patterns this phase builds on
- `.planning/phases/01-foundation/01-UI-SPEC.md` — UI primitives (`PrimaryButton`, `TextInput`, `Avatar`, etc.) Phase 2 reuses
- `.planning/phases/01-foundation/01-PATTERNS.md` — file-organization patterns established in P1

### Migrations (Schema Reality)
- `supabase/migrations/0001_foundation.sql` §`groups` — name, goal_description, submission_type, timezone, admin_id, invite_code (note: P2 may drop the column-level `invite_code` if unused, since `invites` table is canonical)
- `supabase/migrations/0001_foundation.sql` §`group_members` — PK `(group_id, user_id)`, role check, RLS policies (esp. `group_members_delete_own_or_admin`)
- `supabase/migrations/0001_foundation.sql` §`invites` — code, expires_at, used_at, used_by; placeholder `invites_update_authenticated` policy must be REMOVED in P2 in favor of the RPC
- `supabase/migrations/0002_phase1_review_fixes.sql`, `0003_phase1_review_fixes_2.sql` — review-fix patterns; new P2 migration should follow the same numbering style

### External Docs
- Supabase SECURITY DEFINER RPC docs — pattern for `redeem_invite`, `get_invite_preview`, etc.
- Expo Linking / `app.config.ts` `scheme` — registering `accountibuzz://` for invite deep links
- `expo-secure-store` — holding pending invite code across the auth detour
- React Native `Share` API — native share sheet for the invite message

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/PrimaryButton.tsx` / `SecondaryButton.tsx` / `GhostButton.tsx` / `DestructiveTextButton.tsx` — full button vocabulary shipped in P1
- `src/components/TextInput.tsx`, `FormLabel.tsx`, `FormError.tsx` — form primitives reused across auth screens
- `src/components/ScreenContainer.tsx`, `ScreenHeader.tsx` — layout shells used by every signed-in screen
- `src/components/Avatar.tsx` + `AvatarInitials.tsx` — for member-list rendering
- `src/lib/supabase.ts` — singleton client; all RPC calls go through `supabase.rpc('...')`
- `src/features/auth/` — session provider + `useSession` hook; the deep-link auth-detour replay flow extends this

### Established Patterns
- **Migrations are SQL files in `supabase/migrations/`,** numbered (`0001_`, `0002_`, `0003_`); never edit prior migrations, only add new ones
- **RLS is the authorization layer**; CI fails the build on any public-schema table without RLS — keep this green
- **`security definer` helper functions** (`is_group_member`, `is_group_admin`) wrap auth checks for policy reuse
- **Forms use React Hook Form + Zod** (per P1 stack research); validation messages surface via `FormError`
- **TanStack Query for server state**; mutations invalidate keyed by group_id / user_id
- **Theme tokens** in `src/theme/` — never hardcode colors / spacing
- **Auth detour pattern** — Phase 1's OTP flow uses `expo-secure-store` to persist intent across the auth boundary; reuse for the pending-invite case

### Integration Points
- `app/(app)/_layout.tsx` — current signed-in layout; P2 transforms `app/(app)/index.tsx` from a placeholder/profile-redirect into the groups list
- `app/_layout.tsx` — root layout owning auth-aware routing; deep-link `app/invite/[code].tsx` lives outside `(app)` so it can route either way
- `app.config.ts` — register `scheme: "accountibuzz"` (or extend if already set) so the OS routes the link
- `supabase/migrations/0004_phase2_groups_invites.sql` (new) — adds `redeem_invite`, `get_invite_preview`, `leave_group`, `transfer_admin`, `delete_group`, `regenerate_invite`, `create_group` RPCs; goal-description CHECK; member-cap enforcement; removes `invites_update_authenticated` placeholder policy
- `src/types/database.ts` — regenerate via `supabase gen types typescript --local` after the new migration

</code_context>

<specifics>
## Specific Ideas

- The Phase 1 OTP pivot is a load-bearing precedent: **mail clients break custom-scheme links, and link-prefetch consumes single-use tokens**. The "code is the canonical path, link is a convenience" framing in D-06 directly applies that lesson.
- The group-detail screen should feel like a *roster page*, not a feed page — closer to a Discord channel sidebar than an Instagram profile. P3 will add the "Today" surface; P2 deliberately leaves space for it without scaffolding tabs.
- "Show invite code" should feel like the **default admin action** on the detail screen, not a tucked-away button. Activation hinges on the admin actually inviting people within the first session.
- Display names within a group can collide (P1 D-12 explicitly allows duplicates). Consider showing avatar + display name in the member list to disambiguate visually; no need to enforce uniqueness.

</specifics>

<deferred>
## Deferred Ideas

- **Universal Links + AASA/assetlinks hosting** — to Phase 6 (Pre-Rollout Hardening). Requires domain registration. Until then, custom scheme + code-entry covers the share flow.
- **Admin remove-member action** — listed in `research/FEATURES.md` as table stakes but **not in P2 success criteria**. Defer unless friend-group testing surfaces a need; a "kick" button is a quick add later.
- **QR code generation** — defer; revisit only if in-person invite scenarios become real.
- **Realtime member-list updates** on the group-detail screen — Claude's discretion; ship if it falls out cleanly from the existing TanStack/Supabase patterns, otherwise wait for P4.
- **Multiple active invites per group** — single-use rows technically support it, but the UI ships as "one active code at a time, regenerate to rotate". Loosening this is a one-line UI change later if needed.
- **Invite analytics** ("who joined via which code, when") — schema captures it (`used_by`, `used_at`); no UI for it in P2.
- **Group rename / edit goal / change submission-type after creation** — defer; admin-only edit screen is a clean post-MVP add. P2 ships create-only.
- **Per-user "store link" in share message** — P2 uses a placeholder string since there's no app store listing yet; finalize in P6.

</deferred>

---

*Phase: 02-groups-invites*
*Context gathered: 2026-04-23*
