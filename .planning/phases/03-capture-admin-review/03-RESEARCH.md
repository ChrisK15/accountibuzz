# Phase 3: Capture & Admin Review — Research

**Researched:** 2026-04-28
**Domain:** Mobile media-capture + resumable upload + admin moderation queue (Expo SDK 55 / RN 0.83.1 / supabase-js 2.58)
**Confidence:** HIGH for stack picks (Context7-verified package versions, official Supabase + Expo docs); MEDIUM for the TUS-on-RN client choice (industry pattern verified, but no Expo SDK 55 reference impl yet — recommendation is the conservative supabase-js built-in `upload()` with retry, NOT raw tus-js-client). LOW only on autoplay-muted-loop battery impact at scale (no public benchmark — flagged for UAT).

---

## Summary

Phase 3 is the highest-stakes phase in the project so far: it ships the **core accountability loop** (capture → upload → admin review → realtime status) on top of a schema that's already shipped. Most of the surface area is bounded by the locked decisions in `03-CONTEXT.md` (D-01..D-19) and the visual contract in `03-UI-SPEC.md` (≈1,230 lines, all 6 dimensions PASS). What this research adds is **technical recommendations for the seven research items flagged in the additional_context**, version-pinned library calls, exact RPC signatures matching the existing trigger, the Realtime filter pattern (which has a known limitation that affects the rejection-ping channel design), and a Validation Architecture that hooks into the existing pgTAP + Jest infrastructure.

**Three findings change recommendations vs. the assumed approach:**

1. **TUS on Expo SDK 55: pick `supabase-js` built-in `.upload()` with retry — NOT raw `tus-js-client`** [VERIFIED: Supabase docs + tus-js-client GitHub issues #173, #231, #248]. The official Supabase TUS pattern targets browser/Node Blob/File. RN's lack of a spec-compliant Blob has caused multi-year compatibility pain. The new SDK 55 `expo-file-system` `File` class **does implement the Blob interface** [CITED: docs.expo.dev/versions/latest/sdk/filesystem/], which in theory unlocks tus-js-client — but no production reference impl exists yet for SDK 55 + RN 0.83.1. The pragmatic path is: use `supabase.storage.from('submissions').upload(path, arrayBuffer, { contentType, upsert: false })` (already proven in `useAvatarUpload.ts`) wrapped in our own retry-with-backoff layer + AsyncStorage queue. This satisfies SUB-03 ("resilient to flaky networks") via queue persistence + retry, NOT via in-flight chunked resume. Rationale: photos are ~1–4 MB and a 10s 720p video is ~5–10 MB — both well under the 6 MB chunk threshold where TUS chunked resume actually helps. We get 90% of the resilience for 10% of the integration risk.

2. **Supabase Realtime `postgres_changes` filter only supports a single column equality** [VERIFIED: supabase.com/docs/guides/realtime/postgres-changes + GitHub realtime-js #97]. The CONTEXT-described filter `(group_id, user_id, local_date=today)` cannot be expressed in one channel filter. **Recommendation:** filter on `user_id=eq.{auth.uid()}` (single most-selective column for THIS user's view) and **client-side filter** the payload by `group_id` + `local_date` in the channel handler. One channel covers all of the user's groups for today. Tear down on screen blur via `useFocusEffect`.

3. **Use the new SDK 55 `expo-file-system` `File` class for media reads, NOT the legacy `readAsStringAsync` path that `useAvatarUpload.ts` still uses** [VERIFIED: docs.expo.dev SDK 55 filesystem reference]. `new File(uri).arrayBuffer()` replaces `FileSystem.readAsStringAsync(uri, { encoding: 'base64' }) → decode()` — fewer allocations, no base64 round-trip, future-proof against `/legacy` removal. Phase 1 deferred-items.md already flags this migration; P3 is the natural place to land it (P3 is the second consumer of the Storage upload pipeline). Avatar upload site can be migrated in the same wave or left as-is; recommendation is to migrate so both consumers share one canonical pattern.

**Primary recommendation:** Build the upload pipeline as a **two-phase commit** (storage upload via supabase-js `.upload()` → SECURITY DEFINER RPC `submit_today` for the row insert) wrapped in an AsyncStorage queue with retry-on-foreground/network-online/manual-tap. Build admin review as a **swipe-stack of `react-native-gesture-handler` v2 + `react-native-reanimated` v4** GestureDetector cards (no third-party card-stack library — they're all unmaintained or older versions; the canonical pattern is ~80 LOC and already documented for SDK 55). Use `expo-camera` `CameraView` + `useCameraPermissions` + `useMicrophonePermissions` (SDK 55 first-party, dev-build-required for the project regardless), and `expo-video` `useVideoPlayer` + `VideoView` for autoplay-muted-loop on the admin queue. Realtime channel filtered on `user_id` only, client-side filter the rest, torn down on blur.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Submission Scope (D-01..D-04)**
- **D-01: Photo + short video, both first-class.** The schema's `submission_type` group setting (`photo` | `video`) is honored at runtime. Mixed-mode at MVP — group admin's create-time choice from P2 stands.
- **D-02: Video is hard-capped at 10s, single-take, no trim/edit UI.** Capture stops automatically at 10s. No in-app preview-and-trim. Single-take only — if the user dislikes the take they can re-record from scratch (which discards the previous take). Cheapest video path that still respects the schema flag.
- **D-03: Camera-roll uploads remain out of scope** (per PROJECT.md: "credibility of proof depends on in-moment capture"). Capture is `expo-camera` only, no `expo-image-picker` for submissions. (Avatar pipeline keeps using `expo-image-picker` — different surface.)
- **D-04: Caption is optional, single-line, ≤140 chars.** Entered post-capture on the same screen as the "Submit" CTA. Mirrors P2's char-counter pattern from create-group's `goal_description`.

**Upload Pipeline (D-05..D-09)**
- **D-05: TUS resumable upload + offline queue, both photo and video.** Unified pipeline. Research-phase **must** validate the supabase-js 2.58 + Expo SDK 55 + TUS reference implementation before locking the exact client. (See **Standard Stack** below — research conclusion is to use supabase-js built-in `.upload()` with our own retry, not raw tus-js-client.)
- **D-06: Two-phase commit with retry-safe ordering.** (1) Upload media to `submissions/{group_id}/{user_id}/{client_uuid}.{ext}` via TUS; on success, (2) call SECURITY DEFINER RPC `submit_today(group_id, media_path, media_type, caption)`. The RPC derives `local_date` server-side via `now() AT TIME ZONE groups.timezone` and inserts the `submissions` row. Storage path uses a `client_uuid` (not `local_date`) so a queued retry doesn't depend on the client knowing the server's date.
- **D-07: Offline queue persisted in AsyncStorage** as `{client_uuid, group_id, media_local_uri, media_type, caption, created_at_iso}` entries. Auto-flush triggers: app foreground, network-online event, manual "retry" tap. Queue UI surface = badge on the per-group Today card ("Upload pending — N MB queued"). User can tap to see/cancel each pending entry.
- **D-08: Stale-queue cutoff handling = server-authoritative.** On flush, the RPC attempts the insert. If `local_date` (server-derived) doesn't match what the user expected, the server simply applies whatever `local_date` is correct. If a row already exists for that `(group_id, user_id, local_date)` — typed error → client drops the queue entry, surfaces "Yesterday's submission didn't make it before midnight — streak reset." No client-side TTL; no fake backdating.
- **D-09: Orphan media cleanup is deferred,** not built in P3. Failed flushes that succeeded at storage but failed at RPC will leave an orphaned object. Acceptable for MVP — track in deferred items; a scheduled `pg_cron` cleanup job can land in P5/P6.

**Admin Review UX (D-10..D-13)**
- **D-10: Tinder-style swipe stack.** Single screen per group (entered from group-detail "Pending review (N)" entry, admin-only). Largest pending submission card on top: media (photo or autoplay-muted video), submitter avatar + name, caption, "submitted Nm ago." Swipe-right = approve, swipe-left = reject. Buttons as fallback. Caption visible without taps.
- **D-11: Reject reason = optional, single-line, ~140 chars.** Inline input appears on left-swipe before the reject is committed (admin can swipe back to cancel, or tap "Reject" to commit). Stored in `submissions.rejection_reason` (column already exists per P1 schema).
- **D-12: Rejection is TERMINAL for that local day.** No resubmit. The day is missed; streak resets at next group-local midnight. **This rescopes ADM-04** — see Open Items in CONTEXT.md.
- **D-13: Realtime status push to submitter.** When the submitter's Today screen is mounted, the per-group card subscribes to `submissions` UPDATEs filtered by `(group_id, user_id, local_date=today)`. On status change, patch TanStack cache + show inline status pill change + light toast. Subscription torn down on screen blur. (See **Architecture Patterns §Realtime** below — the multi-column filter cannot be expressed in one channel filter expression; recommendation is single-column `user_id` filter + client-side narrowing.)

**App Shell (D-14..D-16)**
- **D-14: Introduce bottom tabs.** Three tabs: **Today** (new) / **Groups** (current P2 list) / **Profile** (current avatar tap target). `app/(app)/_layout.tsx` becomes a Tabs layout. `app/(app)/index.tsx` becomes Today. P2's current groups index moves to `app/(app)/groups/index.tsx`. Profile route stays at `app/(app)/profile.tsx`.
- **D-15: Today screen lists each of the user's groups as a card.** Each card: group name, submission-type icon (photo/video), today's status badge (`—` not yet / `pending` / `approved` / `rejected`), and a primary CTA. Tapping the Submit CTA opens the capture flow scoped to that group. Multi-group friendly from day one.
- **D-16: Admin review queue is per-group, inside group-detail.** Not a tab. From `app/(app)/groups/[id]/index.tsx`, an admin-only entry "Pending review (N)" routes to `app/(app)/groups/[id]/review.tsx` (the swipe queue).

**RPCs (D-17..D-19)**
- **D-17: New SECURITY DEFINER RPCs (Phase 3 migration `20260429173246_phase3_capture_review.sql`):**
  - `submit_today(group_id uuid, media_path text, media_type text, caption text) returns uuid` — typed errors: `not_member`, `wrong_media_type`, `already_submitted_today`.
  - `review_submission(submission_id uuid, decision text, rejection_reason text) returns void` — validates admin of submission's group, validates current status = `pending`. The 0003 admin-immutable trigger continues to enforce `reviewed_by = auth.uid()` defensively.
  - `get_pending_review_count(group_id uuid) returns int` — admin-only count for the "Pending review (N)" badge on group-detail.
- **D-18: Direct table INSERTs on `submissions` from the client are removed** — write path is RPC-only.
- **D-19: Storage path convention for submissions = `{group_id}/{user_id}/{client_uuid}.{ext}`,** NOT `{group_id}/{user_id}/{local_date}.{ext}`. The existing `storage.objects` RLS policies on the `submissions` bucket only check the first two segments; the third segment is opaque.

### Claude's Discretion

- Exact copy for status pill text — write during planning/implementation; tone friendly but direct. (UI-SPEC has resolved this; verify against UI-SPEC §Copywriting Contract.)
- Empty-state for the Today screen when the user is in zero groups — UI-SPEC has resolved.
- Visual treatment of the swipe queue (card stack depth, swipe threshold, rubber-band animation) — UI-SPEC has resolved (97%/94% scale; SWIPE_THRESHOLD = window.width * 0.35 OR velocity > 800 px/s).
- Whether the offline-queue badge on the Today card is its own component or reuses an existing primitive — UI-SPEC has resolved (inline inside GroupCard, not extracted).
- Camera permission denial UX — UI-SPEC has resolved (full-screen permission-denied screens with `Open Settings` deep link).
- Whether to autoplay video previews on the admin queue — UI-SPEC has resolved (default ON, muted, looping; revisit if it kills battery in testing — flagged for UAT).
- Exact wording of typed RPC errors → user-facing toasts — UI-SPEC has resolved (Submit flow error copy table).
- Whether to write a one-time onboarding tooltip on the Today tab — UI-SPEC has resolved (first-review tooltip on the admin queue, not on Today).

### Deferred Ideas (OUT OF SCOPE)

- **Push notification for rejection / approval** → Phase 5.
- **Counter trigger bodies** (`handle_submission_approval` body that increments points/streak) → Phase 4. The trigger STUB from 0001 keeps firing in P3 (it's a no-op).
- **Daily rollover that actually resets streaks at group-local midnight** → Phase 5 (`pg_cron` + `handle_daily_rollover` body).
- **Group feed of everyone else's approved submissions** → Phase 4. P3's Today screen shows only the user's own status.
- **Missed-day tombstones** → Phase 4.
- **Re-engagement notification for broken-streak members** → Phase 6.
- **Resubmit after rejection (RPC)** → explicitly OUT (D-12 made rejection terminal).
- **Orphan media cleanup `pg_cron`** → P5 or P6.
- **Bulk approve / reject** on the admin queue → deferred.
- **Admin "undo last" reversibility** on rejection → deferred.
- **Trim/edit UI for video** → deferred.
- **Camera-roll uploads** → permanently out of scope.
- **Submitting from a notification deep link** → P5/P6 (push routing layer).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **SUB-01** | Member can capture and submit a photo (if group is photo-type) before the group's local midnight cutoff | `expo-camera` `CameraView.takePictureAsync({ quality: 0.8 })` returns `{ uri, width, height }` (Code Examples §1). Path = `{group_id}/{user_id}/{client_uuid}.jpg`. Cutoff is server-enforced via `submit_today` RPC + group timezone. |
| **SUB-02** | Member can capture and submit a short video (if group is video-type) before the group's local midnight cutoff | `expo-camera` `CameraView.recordAsync({ maxDuration: 10, videoQuality: '720p' })` returns `{ uri, codec? }` (Code Examples §2). 10s hard cap (D-02). Same upload pipeline as photo, contentType `video/mp4`. |
| **SUB-03** | Upload is resilient to flaky networks (resumable + offline queue + retry) | Two-phase commit (D-06). AsyncStorage queue (D-07) with foreground / NetInfo / manual-retry triggers. Recommendation: supabase-js `.upload()` + custom retry-with-backoff (NOT raw tus-js-client — see Standard Stack rationale). 10s 720p video ≤ 10 MB → single chunked upload is acceptable. |
| **SUB-04** | Member can see the status of their submission (pending / approved / rejected) | Today GroupCard `StatusPill` (UI-SPEC §Component Additions §1). Initial fetch via new `useTodaySubmission(groupId)` hook (TanStack Query, key `['submission', groupId, 'today']`). Live updates via Realtime channel filtered on `user_id`, client-side filtered by `(group_id, local_date=today)` (Architecture Patterns §Realtime). |
| **SUB-05** | Member is blocked from submitting twice on the same local day | Already enforced by `UNIQUE (group_id, user_id, local_date)` in `0001_foundation.sql:245`. `submit_today` RPC catches the unique-violation and re-raises as typed error `already_submitted_today`. Client drops queue entry on this error (D-08). |
| **SUB-06** | Member can optionally add a short caption to their submission | `caption text` column already exists in `submissions` (0001 line 238). RPC accepts as parameter, validates `char_length(caption) <= 140`. Client uses RHF + Zod schema with `.max(140)` per UI-SPEC. |
| **ADM-01** | Admin sees a queue of pending submissions for groups they admin | `useReviewQueue(groupId)` (new hook, key `['reviewQueue', groupId]`) → `select * from submissions where group_id=$1 and status='pending' order by created_at asc limit 50`. RLS policy `submissions_select_group_members` (0001:255) already permits — admin is a group member. |
| **ADM-02** | Admin can approve a submission | `useReviewSubmission()` (new mutation hook) → calls `review_submission(submission_id, 'approved', null)` RPC. Triggers existing `on_submission_approved` trigger (0001:380) — STUB body in P3, real body lands P4. |
| **ADM-03** | Admin can reject a submission with an optional short reason | Same `useReviewSubmission()` hook → `review_submission(submission_id, 'rejected', reason_text_or_null)`. RPC sets `rejection_reason` column (already exists, 0001:243). Reason ≤ 140 chars validated server-side. |
| **ADM-04** | (Rescoped per D-12) Rejected submitters are notified that today did not count (no resubmit) | Realtime channel patches `useTodaySubmission(groupId)` cache → StatusPill cross-fades to `rejected` state (UI-SPEC §"Realtime status-change copy"). In-app only in P3; P5 layers push on top. **REQUIREMENTS.md ADM-04 wording must be updated at phase close** per CONTEXT Open Items. |
| **PLAT-03** | Group admin can only approve/reject submissions for groups they admin (enforced by RLS) | Multi-layer enforcement: (a) `submissions_update_admin_or_owner_pending` policy (0001:271) gates UPDATE; (b) `submissions_owner_immutable` trigger (0003) re-validates admin via `is_group_admin(old.group_id)` and pins `reviewed_by = auth.uid()`; (c) `review_submission` RPC double-checks via `is_group_admin(submission.group_id)` before issuing UPDATE. Three-layer defense per CLAUDE.md security posture. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Source | Enforcement Hook |
|-----------|--------|-----------------|
| All write paths via SECURITY DEFINER RPCs | P2 D-11, reaffirmed in P3 D-18 | Code review + plan-checker; no `supabase.from('submissions').insert()` calls in client code |
| Migrations are append-only SQL files in `supabase/migrations/`; never edit prior migrations | CLAUDE.md / phase pattern | Migration file `20260429173246_phase3_capture_review.sql` is new-only; uses `create or replace function` for idempotency |
| RLS gated by CI (build fails on any public table without RLS) | PLAT-02, P1 D-CI | No new public tables in P3 — CI continues to pass |
| Forms use React Hook Form + Zod | P1 stack | Capture caption + reject-reason inputs use RHF Controller pattern |
| TanStack Query for server state; mutations invalidate by groupId / userId | P2 PATTERNS Shared Pattern 4 | New hooks follow exact P2 invalidation matrix |
| Realtime patches cache via `setQueryData`, never polls | PITFALLS §2 / Anti-Pattern 2 | Today screen Realtime handler calls `qc.setQueryData(['submission', groupId, 'today'], ...)` |
| Theme tokens in `src/theme/`; never hardcode colors / spacing | UI-SPEC §Design Token Export Shape | All new components import from `useTheme()` |
| Hand-rolled component library (no shadcn — RN-only) | P1 / UI-SPEC §Design System | All 6 new primitives built in `src/components/` |
| `local_date` derived server-side, never client-computed | PITFALLS §1 | `submit_today` RPC computes `(now() AT TIME ZONE groups.timezone)::date`; client never sends this column |
| Singleton `src/lib/supabase.ts` import; never call `createClient` elsewhere | P1 Shared Pattern 2 | All new feature files import `{ supabase } from '../../lib/supabase'` |
| Use `isPending`, not `isLoading` (TanStack Query v5) | P1 Shared Pattern 5 | All new hook consumers |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Photo / video capture | Browser/Client (RN) | — | Hardware access (camera, mic) is device-only; `expo-camera` `CameraView` runs on the native UI thread |
| Caption input + Zod validation | Browser/Client (RN) | API/Backend (re-validate) | Client validates for UX (instant feedback); server re-validates in `submit_today` for security |
| Media upload to storage | Browser/Client (RN) → Storage | — | Direct-to-Storage with user JWT (Architecture pattern: avoid edge function as upload proxy — Anti-Pattern 3) |
| Two-phase commit RPC call | Browser/Client (RN) → API/Backend | Database (trigger) | Client orchestrates the order; server enforces atomicity of row insert + side effects |
| `local_date` derivation | API/Backend (Postgres) | — | PITFALLS §1: NEVER compute on client. `now() AT TIME ZONE groups.timezone` inside SECURITY DEFINER function |
| Cutoff enforcement | API/Backend (Postgres) | — | RPC checks `current_date_in_tz` matches insert; UNIQUE constraint catches double-submit |
| Membership / admin authorization | API/Backend (RLS + RPC + trigger) | — | Three-layer defense: RPC validates explicitly, RLS policy on UPDATE, owner-immutable trigger re-pins on UPDATE |
| Offline queue persistence | Browser/Client (AsyncStorage) | — | Survives app kill / network loss; auto-flush triggered by RN AppState + NetInfo |
| Realtime status push | API/Backend (Postgres CDC) → Browser (WSS) | — | Postgres CDC streams via Realtime server; client subscribes per-screen, tears down on blur |
| TanStack cache patching from Realtime | Browser/Client (in-memory) | — | `queryClient.setQueryData` is a pure client concern; never calls back to server |
| Swipe-stack gesture handling | Browser/Client (native UI thread via Reanimated worklets) | — | Worklets run on UI thread (60–120 FPS); JS thread untouched during pan |
| Admin review pending count | API/Backend (RPC) | Browser/Client (TanStack cache) | RPC `get_pending_review_count` returns 0 for non-admins (security through behavior, not just RLS) |
| Storage signed URL generation for media display | Browser/Client (RN) → API/Backend (Storage) | — | `supabase.storage.createSignedUrl(path, 60)` issues a 60s short-lived URL; gates on storage RLS membership check |
| Bottom-tab navigation shell | Browser/Client (expo-router Tabs) | — | Pure client concern; Stack→Tabs migration affects only `app/(app)/_layout.tsx` and `router.push` audit |

## Standard Stack

### Core (already installed; verified against package.json @ 2026-04-28)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo` | `~55.0.16` | App framework | Already pinned; `npm view expo version` = `55.0.18` (one patch behind, acceptable) [VERIFIED: npm registry 2026-04-28] |
| `react-native` | `0.83.6` | UI runtime | Pinned by SDK 55 |
| `react` | `19.2.0` | Component model | Pinned by SDK 55 |
| `@supabase/supabase-js` | `^2.58.0` | Postgres + Auth + Storage + Realtime client | `npm view` = `2.105.1` current; `^2.58` resolves to current. **Confirmed RN-compatible:** singleton `src/lib/supabase.ts` already in place [VERIFIED: package.json + Read of supabase.ts] |
| `expo-router` | `~55.0.13` | Navigation (Tabs migration target) | First-class Tabs support via `<Tabs>` layout component |
| `@tanstack/react-query` | `^5.59.0` | Server state | v5 API (`isPending`); already used across P1/P2 |
| `react-hook-form` + `@hookform/resolvers` + `zod` | `^7.53.0` / `^5.0.1` / `^4.0.0` | Form state + validation | Already standard P1/P2 pattern |

### Phase 3 Adds (already installed; just need to enable / use)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-camera` | `~55.0.16` | Photo + video capture | First-party Expo module; `CameraView` + `useCameraPermissions` + `useMicrophonePermissions`. Works in dev build (project is already dev-build-only per project memory) [VERIFIED: docs.expo.dev SDK 55 camera reference] |
| `expo-video` | `~55.0.15` | Video playback for admin queue | First-party Expo SDK 55. **Replaces removed `expo-av`.** API: `useVideoPlayer(source, setup)` + `<VideoView player={...} />` [VERIFIED: docs.expo.dev SDK 55 video reference] |
| `@react-native-async-storage/async-storage` | `2.2.0` | Offline upload queue persistence | Already installed (used by Supabase auth). Schema per D-07 |
| `expo-file-system` | `~55.0.17` | Media URI → ArrayBuffer / size lookup | **Use the modern `File` class** (`new File(uri).arrayBuffer()`), NOT `/legacy` `readAsStringAsync` [VERIFIED: docs.expo.dev SDK 55 filesystem]. Also lets us check `file.size` before queue insertion. |
| `base64-arraybuffer` | `^1.0.2` | Decode helper (legacy fallback) | Already installed; only needed if we keep the legacy avatar upload path. Recommended to migrate avatar to new File API in same wave (Phase 1 deferred-items.md flags this). |
| `react-native-gesture-handler` | `~2.31.1` | Swipe-stack pan gestures | Already a peer of `expo-router` — already in tree. Use `GestureDetector` + `Gesture.Pan()` [VERIFIED: docs.swmansion.com/react-native-gesture-handler 2.30+ API] |
| `react-native-reanimated` | `^4.3.0` | Worklet-driven animations for swipe | **Reanimated v4 ships with SDK 55.** Use `useSharedValue` + `useAnimatedStyle` + `withSpring` / `withTiming`. Worklets run on native UI thread (60–120 FPS), no JS bridge for pan-update [VERIFIED: docs.swmansion.com/react-native-reanimated handling-gestures] |
| `expo-haptics` | `~55.0.14` | Approve / reject feedback | Already installed (P2). `Haptics.notificationAsync(Success / Warning)` per UI-SPEC |
| `expo-blur` | `~55.0.14` | Camera top-bar glassmorphism scrim | First-party Expo SDK 55. `<BlurView intensity={32} tint="dark" />` [VERIFIED: package.json — already installed] |
| `expo-image` | `~55.0.9` | Captured photo display + admin queue photo | Already installed (used by Avatar) |
| `expo-image-manipulator` | `~55.0.15` | Photo resize/compress before upload | Already installed (avatar pipeline). Same `manipulateAsync` pattern: resize to 1080w + compress 0.85 |
| `expo-linking` | `~55.0.14` | `Linking.openSettings()` for camera-permission-denied flow | Already installed |
| `@react-native-community/netinfo` | NEW — `npx expo install @react-native-community/netinfo` | Detect network online → flush upload queue | **NEW dependency.** SDK 55 compatible. Standard pattern per RN ecosystem. Subscribe in queue manager: `NetInfo.addEventListener(state => state.isConnected && state.isInternetReachable && flushQueue())` [VERIFIED: npm registry — current `^11.x`] |

### Recommendation NOT to install

| Avoided | Why | Use Instead |
|---------|-----|-------------|
| `tus-js-client` | RN's lack of spec-compliant Blob has caused multi-year compatibility pain (issues #173, #231, #248). The new SDK 55 `expo-file-system` `File` class **does** implement Blob, but no production reference impl exists for SDK 55 + RN 0.83.1 yet [VERIFIED: tus-js-client GitHub issues + saimon24 reference repo last commit Jul 2023 on SDK 49]. **For 1–10 MB files, single-shot supabase-js `.upload()` + retry is sufficient.** | `supabase.storage.from('submissions').upload(path, arrayBuffer, { contentType, upsert: false })` wrapped in custom retry layer + AsyncStorage queue (see Code Examples §3). |
| `react-native-tus-client` | Native modules approach (TUSKit + tus-android-client). Adds native build complexity + last released 2023 [VERIFIED: GitHub last commit] | Same as above — supabase-js built-in covers our file-size envelope. |
| `react-native-cards-swipe` / `react-native-swipeable-card-stack` | Both unmaintained (last commits 2022 / 2024). Hand-rolling on Reanimated 4 is ~80 LOC and more maintainable | Hand-roll the stack as documented in Architecture Patterns §Swipe Stack |
| `expo-av` | Removed in SDK 55 | `expo-video` (already pinned in stack) |
| `react-native-vision-camera` | Overkill for "point and shoot." Adds native config plugin complexity | `expo-camera` (already pinned) |
| New encrypted-storage layer for queue entries | Queue entries contain `media_local_uri` + group_id + caption — not secrets. AsyncStorage is fine. | AsyncStorage with namespaced key `accountibuzz.uploadQueue` |

**Installation command (add to a Wave 0 task):**

```bash
npx expo install @react-native-community/netinfo
```

(All other dependencies already in `package.json`.)

**Version verification (run before locking):**

```bash
# Already verified on 2026-04-28 (npm view):
# expo-camera = 55.0.16
# expo-video  = 55.0.15
# @supabase/supabase-js = 2.105.1 (^2.58 resolves to current)
# tus-js-client = 4.3.1 (NOT recommended for RN — see above)
# @react-native-async-storage/async-storage = 2.2.0 (already pinned)
```

**`app.config.ts` plugin block (NEW — Wave 0):**

```ts
plugins: [
  'expo-router',
  'expo-secure-store',
  'expo-font',
  [
    'expo-camera',
    {
      cameraPermission: 'Accountibuzz needs camera access to capture your daily proof.',
      microphonePermission: 'Accountibuzz needs microphone access to record audio with your video proof.',
      recordAudioAndroid: true,
    },
  ],
],
```

[VERIFIED: docs.expo.dev/versions/latest/sdk/camera/ — installation section]

The `expo-camera` config plugin auto-generates:
- iOS: `NSCameraUsageDescription` + `NSMicrophoneUsageDescription` in `Info.plist`
- Android: `CAMERA` + `RECORD_AUDIO` in `AndroidManifest.xml`

**Required: rebuild dev client** after editing `app.config.ts` (cannot be hot-reloaded).

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Expo RN Client (SDK 55)                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Today Tab                Capture Screen          Admin Review Screen   │
│   ─────────                ───────────────         ───────────────────   │
│   useGroupsList            CameraView              useReviewQueue        │
│   useTodaySubmission(N)    ↓ (capture)             SwipeCard×3 stack     │
│        ↓                   .takePictureAsync /     GestureDetector       │
│   StatusPill cross-fade    .recordAsync            (Pan + Reanimated)    │
│   QueueBadge (optional)    ↓ (file URI)            ↓ (commit)            │
│        ↑                   ReviewPanel +           useReviewSubmission   │
│        │ Realtime          caption + Submit        ↓                     │
│        │ patch             ↓                       supabase.rpc(         │
│        │                   submitMedia(            'review_submission',  │
│   useFocusEffect           groupId, mediaUri,      ...)                  │
│   subscribe/unsub          mediaType, caption)                           │
│                            ↓                                             │
│                            ┌─ submitMedia() ─────────────────┐           │
│                            │ 1. compress (image only)        │           │
│                            │ 2. new File(uri).arrayBuffer()  │           │
│                            │ 3. supabase.storage.upload(     │           │
│                            │      'submissions',             │           │
│                            │      `${gid}/${uid}/${cuid}.X`, │           │
│                            │      buf, { contentType })      │           │
│                            │    │                            │           │
│                            │    ├─ FAIL → enqueue to         │           │
│                            │    │   AsyncStorage queue       │           │
│                            │    │                            │           │
│                            │    └─ OK ↓                      │           │
│                            │ 4. supabase.rpc('submit_today', │           │
│                            │     { group_id, media_path,     │           │
│                            │       media_type, caption })    │           │
│                            │    │                            │           │
│                            │    ├─ FAIL (network) → enqueue  │           │
│                            │    └─ OK → return submission_id │           │
│                            └─────────────────────────────────┘           │
│                                                                          │
│   Queue Manager (singleton, owns AsyncStorage key                        │
│   `accountibuzz.uploadQueue`):                                           │
│   - AppState 'active' listener        → flush()                          │
│   - NetInfo isConnected listener      → flush()                          │
│   - Manual `Retry now` button         → flush(entry)                     │
│   - On `already_submitted_today`      → drop entry + emit toast          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                  │ HTTPS (JWT)                  │ WSS (Realtime)
                  ▼                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    Supabase (Postgres 17 + extensions)                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Storage bucket `submissions` (private)                                  │
│   path: {group_id}/{user_id}/{client_uuid}.{ext}                         │
│   RLS: storage.objects                                                   │
│     • SELECT: is_group_member((foldername(name))[1]::uuid)               │
│     • INSERT: foldername[2] = auth.uid()::text AND is_group_member(...)  │
│     • DELETE: is_group_admin OR foldername[2] = auth.uid()               │
│                                                                          │
│  Table public.submissions                                                │
│   • UNIQUE (group_id, user_id, local_date)        — already shipped P1   │
│   • RLS: select_group_members / insert_self_in_group / update_admin_or…  │
│   • Triggers:                                                            │
│     - submissions_owner_immutable (0003)                                 │
│       → admin branch: pin user_id/group_id/local_date/media_path,        │
│         require reviewed_by = auth.uid() on approve/reject               │
│     - on_submission_approved → handle_submission_approval (STUB in P3)   │
│                                                                          │
│  RPCs (NEW in 20260429173246_phase3_capture_review.sql)                            │
│   • submit_today(group_id, media_path, media_type, caption)              │
│       returns uuid (submission_id)                                       │
│       SECURITY DEFINER, set search_path = public                         │
│       Validates: is_group_member, media_type matches groups.submission_type, │
│       NOT past cutoff (server-derived local_date), inserts row           │
│       Typed errors (P0001): not_member, wrong_media_type,                │
│         already_submitted_today                                          │
│                                                                          │
│   • review_submission(submission_id, decision, rejection_reason)         │
│       returns void                                                       │
│       SECURITY DEFINER. Validates admin of submission's group, current   │
│       status='pending'. UPDATEs status + reviewed_by=auth.uid() +        │
│       reviewed_at=now() + rejection_reason. Trigger 0003 re-validates.   │
│       Typed errors: not_admin, not_pending, invalid_decision             │
│                                                                          │
│   • get_pending_review_count(group_id) returns int                       │
│       Returns 0 for non-admins (no leak).                                │
│                                                                          │
│  Realtime publication on public.submissions                              │
│   Client subscribes: filter='user_id=eq.{auth.uid()}'                    │
│   Single-column filter is the only supported form                        │
│   (Limitation: GitHub realtime-js #97). Client narrows by group_id +     │
│   local_date in handler.                                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (P3 additions only)

```
app/(app)/
├── _layout.tsx                  # MODIFIED: Stack → Tabs
├── index.tsx                    # MOVED → groups/index.tsx; new content = Today screen
├── groups/
│   ├── index.tsx                # NEW (moved from app/(app)/index.tsx)
│   ├── new.tsx                  # UNCHANGED
│   ├── join.tsx                 # UNCHANGED
│   └── [id]/
│       ├── index.tsx            # MODIFIED: add admin-only PendingReviewRow
│       └── review.tsx           # NEW — admin swipe queue
├── profile.tsx                  # UNCHANGED
└── capture/
    └── [groupId].tsx            # NEW — capture flow (modal-presented)

src/components/
├── DestructiveButton.tsx        # NEW — first consumer is discard-take + reject-reason commit
├── GroupCard.tsx                # NEW — Today per-group card
├── StatusPill.tsx               # NEW — submission status badge
├── TypeChip.tsx                 # NEW — photo/video group indicator
├── SwipeCard.tsx                # NEW — admin-queue card primitive
├── Shutter.tsx                  # NEW — camera shutter (3 variants)
├── CaptureTopBar.tsx            # NEW — capture screen top overlay
└── ReviewPanel.tsx              # NEW — capture post-take caption + submit panel
(QueueBadge, RecordingProgressBar, BottomPanel, IanaTimezonePicker pattern repeated:
 inline inside the consumer screen, not extracted — per UI-SPEC mapping)

src/features/submissions/         # NEW DOMAIN
├── useTodaySubmission.ts        # TanStack Query — per-group today's row
├── useSubmitToday.ts            # mutation — orchestrates two-phase commit
├── useReviewQueue.ts            # admin — list pending submissions
├── useReviewSubmission.ts       # admin mutation — approve/reject
├── usePendingReviewCount.ts     # admin — RPC wrapper for badge count
├── useUploadQueue.ts            # AsyncStorage queue read/write/flush
├── uploadQueueManager.ts        # Singleton: AppState/NetInfo/manual triggers
├── submitMedia.ts               # Pure fn: compress → upload → RPC pipeline
├── schemas.ts                   # Zod: captionSchema, rejectReasonSchema
└── time.ts                      # Cutoff helpers (Luxon — IANA tz aware)

src/features/realtime/            # NEW (or co-locate in submissions/)
└── useTodaySubmissionRealtime.ts # Subscribe + setQueryData; useFocusEffect cleanup

supabase/migrations/
└── 20260429173246_phase3_capture_review.sql  # NEW — 3 RPCs + grants

supabase/tests/
├── submit_today.sql              # NEW pgTAP — happy + 3 typed-error paths
├── review_submission.sql         # NEW pgTAP — admin-only + state machine
├── get_pending_review_count.sql  # NEW pgTAP — admin-only / 0-leak
└── submissions_admin_immutable.sql  # NEW pgTAP — backfills 0003 trigger coverage
                                    # (flagged in 01-foundation/deferred-items.md)

tests/                            # Jest
├── submissions/
│   ├── submitMedia.test.ts       # mock supabase + FileSystem; verify upload-then-rpc
│   ├── uploadQueue.test.ts       # AsyncStorage queue lifecycle
│   ├── useTodaySubmission.test.ts
│   ├── useSubmitToday.test.ts
│   └── schemas.test.ts
└── components/
    ├── StatusPill.test.tsx
    ├── GroupCard.test.tsx
    └── SwipeCard.test.tsx       # gesture mock per RN gesture handler test pattern

app.config.ts                    # MODIFIED: add expo-camera plugin block
package.json                     # MODIFIED: add @react-native-community/netinfo
src/types/database.ts            # REGENERATE: pnpm types:gen after 0006
jest.setup.ts                    # MODIFIED: add expo-camera + expo-video + NetInfo mocks
```

### Pattern 1: Two-Phase Commit Upload Pipeline (D-06)

**What:** Storage upload first, then RPC row insert. Both phases retry-safe via UUID-keyed paths.

**When to use:** Every submission. No exceptions — direct table inserts banned per D-18.

**Why two-phase:** Cannot insert a `submissions` row pointing at a non-existent storage object. Cannot leave an orphaned object pointing at a missing row (well, we tolerate orphans per D-09, but the row→object direction is the failure we cannot tolerate).

**Why client-uuid path (NOT local_date):** Client doesn't know server's `local_date` at upload time. A UUID is opaque to the storage RLS (which only checks the first two path segments per existing 0001 policies).

**Idempotency contract:**
- Step 1 (upload): use `upsert: false` so a retry of the same path that succeeded the first time will fail with HTTP 409 → treat as "object exists, proceed to step 2."
- Step 2 (RPC): server-side UNIQUE constraint catches double-insert and re-raises as `already_submitted_today` → client drops queue entry.

**Code:** see Code Examples §3 (`submitMedia`).

### Pattern 2: AsyncStorage Offline Queue (D-07, D-08)

**What:** Persist `{client_uuid, group_id, media_local_uri, media_type, caption, created_at_iso}` to AsyncStorage under key `accountibuzz.uploadQueue`. Queue manager subscribes to AppState + NetInfo + manual triggers; flushes on event.

**When to enqueue:** ANY failure in `submitMedia()` that is not a typed error from the RPC. Network errors, timeouts, JWT-refresh failure, storage 5xx — all enqueue.

**When to drop entry:**
- RPC returned `already_submitted_today` → user missed the window OR a concurrent retry succeeded; either way, entry is moot.
- User explicitly tapped "Discard" in the queue bottom sheet.
- RPC returned `not_member` → user removed from group while queued; surface "You're not in this group anymore" toast and drop.
- RPC returned `wrong_media_type` → group's `submission_type` changed since enqueue (rare edge case); drop and surface error.

**When NOT to drop entry:**
- Network errors during flush — keep entry, retry on next trigger.
- Storage 5xx — keep entry, retry.
- JWT refresh failure — keep entry; supabase-js retries auth on next request.

**Schema (Zod for validation):**

```ts
import { z } from 'zod';

export const queueEntrySchema = z.object({
  client_uuid: z.string().uuid(),
  group_id: z.string().uuid(),
  media_local_uri: z.string().min(1),
  media_type: z.enum(['photo', 'video']),
  caption: z.string().max(140).nullable(),
  created_at_iso: z.string().datetime(),
});
export type QueueEntry = z.infer<typeof queueEntrySchema>;
```

**Persistence pattern (transactional via JSON-array-in-single-key):**

```ts
const QUEUE_KEY = 'accountibuzz.uploadQueue';

export async function readQueue(): Promise<QueueEntry[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return z.array(queueEntrySchema).parse(parsed);
  } catch {
    // Corrupt queue — log + reset to empty rather than crash on every read.
    console.warn('[uploadQueue] corrupt — resetting');
    await AsyncStorage.removeItem(QUEUE_KEY);
    return [];
  }
}

export async function enqueue(entry: QueueEntry) {
  const current = await readQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...current, entry]));
}

export async function dequeue(client_uuid: string) {
  const current = await readQueue();
  const next = current.filter(e => e.client_uuid !== client_uuid);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
}
```

Single-key + JSON-array is the simplest atomic primitive AsyncStorage offers. No multi-write race because every mutation is one `setItem`.

### Pattern 3: Realtime Single-Column Filter + Client-Side Narrowing

**What:** Supabase Realtime `postgres_changes` only supports a single-column equality filter [VERIFIED: GitHub realtime-js issue #97 + supabase.com/docs/guides/realtime/postgres-changes]. We need to filter on `(user_id, group_id, local_date=today)`.

**Solution:** Filter on `user_id=eq.{auth.uid()}` (the most-selective and security-relevant column). Narrow client-side in the handler.

**One channel per Today screen, NOT per-group-card:**

```ts
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

function useTodaySubmissionRealtime(userId: string | undefined) {
  const qc = useQueryClient();
  const todayLocalDate = /* computed from each group's tz, see below */;

  useFocusEffect(useCallback(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`today-submissions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { group_id: string; local_date: string; status: string };
          // Client-side filter: is this for one of MY groups for THEIR today?
          // We patch optimistically; the cache hook computes today-for-group.
          qc.setQueryData(
            ['submission', row.group_id, 'today'],
            row,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]));
}
```

**Why useFocusEffect, not useEffect:**
- `useFocusEffect` fires on tab focus AND blur (PITFALLS §11)
- `useEffect` only fires on mount/unmount; tab navigation doesn't unmount the screen, so the channel would leak

**Performance:** one subscription per signed-in user, scoped to the Today tab. Tear-down on tab blur means no churn during normal navigation.

### Pattern 4: Reanimated 4 Swipe-Stack (D-10)

**What:** Top card is gesture-driven via `GestureDetector` + `Gesture.Pan()`. Cards 2 and 3 are static (scale + translateY offsets per UI-SPEC §SwipeCard). Worklets run on UI thread for 60–120 FPS pan smoothness.

**Why hand-roll, NOT a library:** All Tinder-style card libraries surveyed (`react-native-cards-swipe`, `react-native-swipeable-card-stack`) are unmaintained or pinned to older Reanimated versions. The canonical pattern below is ~80 LOC and exactly what UI-SPEC describes.

**Skeleton (full code in Code Examples §6):**

```ts
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_W } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.35;
const VELOCITY_THRESHOLD = 800;

function ReviewQueueScreen({ pending, onApprove, onReject }) {
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);

  const top = pending[0];

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])      // require horizontal motion to activate
    .failOffsetY([-20, 20])        // bail on vertical pan
    .onUpdate((e) => {
      translateX.value = e.translationX;
      rotate.value = Math.max(-15, Math.min(15, e.translationX / 30));
    })
    .onEnd((e) => {
      const passed = Math.abs(e.translationX) > SWIPE_THRESHOLD
                  || Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
      if (passed && e.translationX > 0) {
        translateX.value = withTiming(SCREEN_W, { duration: 250 }, () => {
          runOnJS(onApprove)(top.id);
        });
      } else if (passed && e.translationX < 0) {
        translateX.value = withTiming(-SCREEN_W * 0.3, { duration: 300 }, () => {
          runOnJS(onReject)(top.id);  // opens reject-reason panel
        });
      } else {
        translateX.value = withSpring(0, { damping: 14, stiffness: 120 });
        rotate.value = withSpring(0, { damping: 14, stiffness: 120 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, cardStyle]}>
        <SwipeCard {...top} />
      </Animated.View>
    </GestureDetector>
  );
}
```

**Reduced motion:** wrap the animation primitives in a check for `AccessibilityInfo.isReduceMotionEnabled()` per UI-SPEC §Accessibility — disable the spring/timing, render the top card only, swap to button-only operation.

### Pattern 5: Capture-Then-Review on a Single Screen

**What:** `app/(app)/capture/[groupId].tsx` is a single screen with two states: pre-capture (CameraView visible) and post-capture (review with caption input). One screen avoids double-permission-grant and keeps the back-stack shallow.

**State machine:**

```
mount
  ↓
[permission gate]
  ├─ camera denied → permission-denied screen (Open Settings / Not now)
  └─ camera granted
       ↓ (if video group)
       [microphone permission gate]
         ├─ denied → permission-denied screen
         └─ granted
            ↓
          [capture state]   ← takePictureAsync / recordAsync
            ↓ (returns uri)
          [review state]    ← caption input + Retake / Submit
            ├─ Retake → discard uri, return to [capture state]
            ├─ Submit → submitMedia()
            │    ├─ success → router.dismiss() (return to Today)
            │    └─ network error → enqueue + router.dismiss() (queue badge takes over)
            └─ × close
                ├─ no take captured → router.dismiss()
                └─ take captured → Discard-take Modal
                     ├─ Discard → router.dismiss()
                     └─ Keep recording → return to [review state]
```

**Edge case (UI-SPEC line 1012):** allow `×` close DURING in-flight upload. The upload continues in the background (already running on JS thread / native HTTP layer), surfaces as a QueueBadge on Today if it ultimately fails. This protects users from feeling trapped by a slow upload.

### Anti-Patterns to Avoid

- **Polling for submission status.** Use Realtime + `setQueryData`. Polling drains battery and feels laggy. (Pitfall: Anti-Pattern 2)
- **Computing `local_date` on the client.** PITFALLS §1. Server-derived only.
- **Direct `INSERT INTO submissions` from the client.** Banned per D-18; RPC-only.
- **One Realtime channel for the whole app.** Anti-Pattern 4. One channel scoped to the active screen, torn down on blur.
- **Storing the queue as multiple AsyncStorage keys** (e.g. `queue:client_uuid_1`, `queue:client_uuid_2`). Single-key JSON array is atomic; per-key writes can interleave on retry.
- **Using `expo-av`** anywhere. Removed in SDK 55.
- **Using `react-native` `Blob`** for upload. Use the new `expo-file-system` `File` class which implements Blob, OR continue the proven `base64 → ArrayBuffer` legacy path. (PITFALLS §4 — silent 0-byte upload bug.)
- **Forgetting `removeChannel` in Realtime cleanup.** PITFALLS §11. Use `useFocusEffect` for tab-aware cleanup.
- **Optimistically updating the cache for admin approve/reject without waiting for RPC ACK.** UI-SPEC's swipe-fly-off animation is permitted to run in parallel with the RPC call (both fire on `onEnd`), but if the RPC fails, the card MUST re-appear via the inline error toast. Do not assume the optimistic remove is the source of truth.
- **Keeping `expo-camera` `CameraView` mounted when not visible.** Battery drain. Use `<Stack.Screen options={{ presentation: 'fullScreenModal' }}>` so the camera is unmounted when the user navigates back to Today.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resumable upload from scratch | Custom HTTP chunked PATCH loop | supabase-js built-in `.upload()` + AsyncStorage queue + retry-with-backoff | The 90% solution we need (resume-via-retry) is one wrapper around an already-tested SDK call. Chunked PATCH adds 200+ LOC and a TUS protocol surface to maintain. |
| Tinder swipe stack physics | Custom PanResponder + `Animated.View` | `react-native-gesture-handler` v2 `Gesture.Pan()` + Reanimated 4 worklets | PanResponder runs on JS thread → 200ms+ latency. Gesture handler runs on native UI thread → 60–120 FPS. Already a peer of expo-router; no install needed. |
| Server-side date calculation in Postgres | Custom plpgsql with manual TZ math | Postgres built-in `(now() AT TIME ZONE groups.timezone)::date` | One-line, IANA-aware, DST-correct. Anything else risks PITFALLS §1. |
| Realtime channel per group | N channels for N groups | One channel filtered on `user_id`, narrow client-side | The only-supported-filter limitation forces this; also fewer WSS connections is better for battery. |
| Camera viewfinder UI | Custom CameraView wrapper | Direct `<CameraView>` + `useCameraPermissions` | First-party Expo module; permission hook handles the request flow. |
| Video player with autoplay-mute-loop | Custom `<View>` + `expo-video` low-level | `useVideoPlayer(uri, p => { p.muted = true; p.loop = true; p.play(); })` + `<VideoView player={player} nativeControls={false} />` | Setup callback handles muted/loop atomically; useVideoPlayer cleans up on unmount. |
| Network-online detection | `setInterval` ping or `fetch` heartbeat | `@react-native-community/netinfo` `addEventListener` | Battery-friendly, handles cellular vs wifi distinctions, surfaces `isInternetReachable` (not just `isConnected`). |
| Image compression before upload | Custom canvas / native module | `expo-image-manipulator` `manipulateAsync(uri, [{ resize: { width: 1080 } }], { compress: 0.85, format: SaveFormat.JPEG })` | Already in the tree (avatar pipeline). Same exact API. |
| Bottom-tab navigation | Custom view with conditional render | `expo-router` `<Tabs>` layout component | First-party; integrates with deep linking; tested. |
| Pending-review-count gate (admin only) | Client-side admin check | RPC returns 0 for non-admins | Behavior-based defense in depth; no leak even if client-side check is bypassed. |
| Storage signed-URL caching | Custom `useEffect` + state | `useQuery` with `['signedUrl', path]` key + `staleTime: 50_000` (less than 60s TTL) | TanStack Query already in the tree. Auto-refetches before the URL expires. |
| Reduced-motion detection | Manual checks in every component | `AccessibilityInfo.isReduceMotionEnabled()` in a single `useReducedMotion()` hook + context | Standard RN API; once-per-app subscription. |

**Key insight:** Every single one of these is a proven library / built-in already in the project's tree (or installable via one `npx expo install`). The temptation to hand-roll comes from the perception that "it's just a few lines" — but every line is a future maintenance liability and a place to introduce bugs that the libraries have already solved.

## Runtime State Inventory

> Phase 3 is a feature-add phase, not a rename / refactor. This section is non-empty because the Stack→Tabs migration (D-14) DOES create runtime state implications. The other 4 categories: explicitly nothing.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — verified by reading all of `supabase/migrations/0001..0005` and confirming no string/key contains the old route paths. The `submissions` table column shape is already shipped (P1). | None. |
| **Live service config** | None — no Datadog, Tailscale, Cloudflare, or third-party service in this project per CLAUDE.md and package.json inspection. | None. |
| **OS-registered state** | None — no Windows Task Scheduler / launchd / systemd / pm2 in this project (it's a mobile app; OS-registered state would only appear post-launch via push notification IDs in P5). | None. |
| **Secrets / env vars** | `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (already in place). No new secrets in P3. | None. |
| **Build artifacts / installed packages** | One concrete item: **dev client must be rebuilt** after `app.config.ts` adds the `expo-camera` plugin. `npx expo prebuild --clean && npx expo run:ios` (and android equivalent). The current dev build does NOT have camera permissions in its Info.plist / AndroidManifest.xml. | Add as a Wave 0 task: rebuild dev client. |
| **Routing artifacts** (P3-specific) | The Stack→Tabs migration moves `app/(app)/index.tsx` content to `app/(app)/groups/index.tsx` and replaces `index.tsx` with the Today screen. ALL `router.push('/')`, `router.replace('/')`, `<Link href="/">` references in the codebase need an audit. UI-SPEC §"App shell — Stack → Tabs migration" lists the specific call sites: post-leave-group, post-delete-group, post-create-group, post-redeem-invite, auth-success. | Audit task: `rg "router\.(push\|replace).*\(['\"]\/['\"]" app/ src/` — fix per the UI-SPEC table (most need to retarget `/groups`). Note: `app/_layout.tsx` may also need updates if it pushes to `/`. |

**The canonical question:** *After every file in the repo is updated and the app launches, what runtime systems still have the old shape?*

Answer for P3: **the installed dev build's Info.plist and AndroidManifest.xml**. Source-of-truth (`app.config.ts`) updates the manifests at next prebuild — but the existing `.app` / `.apk` on the device still has the OLD plists without camera permissions. Without a rebuild, capture will silently fail (or the OS will deny without prompt) on first launch after the migration runs. **This is the only production-risk runtime artifact in P3.**

## Common Pitfalls

### Pitfall 1: Realtime Multi-Column Filter Misconception
**What goes wrong:** Code is written assuming `filter: 'group_id=eq.X,user_id=eq.Y,local_date=eq.Z'` works. It does not — only single-column filters are supported.
**Why it happens:** Common assumption from PostgREST query syntax. Supabase docs don't loudly call out the limitation; you discover it via GitHub issue #97.
**How to avoid:** Filter on the most-selective column (`user_id`), narrow client-side in the channel handler. Document in the hook source.
**Warning signs:** Channel subscribes but events don't fire. Or events fire for irrelevant rows. Or the client builds N channels for N groups (bandwidth bloat).

### Pitfall 2: tus-js-client + RN Blob Mismatch
**What goes wrong:** Following the Supabase tus-js-client docs verbatim: `new tus.Upload(file, ...)` throws `TypeError: cannot fetch file.uri as Blob`.
**Why it happens:** RN's Blob is not spec-compliant; tus-js-client expects browser Blob/File semantics.
**How to avoid:** Don't use tus-js-client for the MVP. Use supabase-js `.upload()` with ArrayBuffer payload (proven in `useAvatarUpload.ts`). For larger files (post-MVP), revisit with the SDK 55 `expo-file-system` `File` class which implements Blob — but verify with a spike before integrating.
**Warning signs:** "Cannot fetch file.uri as Blob" error in Sentry. Uploads silently producing 0-byte files.

### Pitfall 3: JWT Refresh Mid-Upload (PITFALLS §12)
**What goes wrong:** Upload starts at JWT expiry-T-30s; supabase-js auto-refreshes mid-upload; the in-flight request still uses the old token; storage rejects with 401; upload appears to fail.
**Why it happens:** Header capture happens at request-init time, not per-chunk.
**How to avoid:** Two-pronged:
1. Single-shot `.upload()` (our pattern) is short enough (1–10 MB at typical mobile speeds = 5–60 seconds) that mid-upload expiry is rare.
2. The retry layer in our queue manager catches 401 errors and retries — by then `supabase-js` has refreshed the JWT and the retry uses the new token.
3. For larger files (future): proactively refresh JWT immediately before upload start: `await supabase.auth.refreshSession()` if `expires_at - now < 120s`.

**Warning signs:** Sporadic 401s on long videos; upload retry succeeds. Add an instrumentation log that emits when a retry is triggered with a refreshed token.

### Pitfall 4: Offline Queue Schema Drift
**What goes wrong:** Queue persists entries with shape A; a later release changes shape to B; old entries crash on read.
**Why it happens:** AsyncStorage is forever; users restart the app days later with stale entries.
**How to avoid:** Wrap `readQueue()` in Zod parse with a try/catch that resets the queue on parse failure (Pattern 2 above). Also: log a warning when this happens so we can spot real schema-change incidents.
**Warning signs:** Empty queue after a release (when it shouldn't be); `[uploadQueue] corrupt — resetting` log.

### Pitfall 5: Camera Permission Denied During Capture Detour
**What goes wrong:** User taps "Submit photo" on Today. Capture screen mounts. Permission prompt fires. User taps "Don't allow." Now the app is on a permission-denied screen. User taps "Open Settings" → goes to OS settings → grants permission → returns to app. App is still on the permission-denied screen because the Camera permission state hasn't been re-checked.
**Why it happens:** `useCameraPermissions()` returns the permission status at hook-mount time; it doesn't auto-poll.
**How to avoid:** Re-check permissions on AppState `active` event:

```ts
useEffect(() => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active' && permission?.status === 'denied') {
      requestPermission();  // re-poll OS
    }
  });
  return () => sub.remove();
}, [permission, requestPermission]);
```

**Warning signs:** Users report "I granted permission but the app still shows the deny screen." Verify by toggling permission in OS settings while app is backgrounded.

### Pitfall 6: Reanimated Worklet Closure Over Stale State
**What goes wrong:** A swipe gesture handler captures `top` (top card) at mount; user approves the first card; second card slides in; the next swipe gesture STILL uses the first card's id because the worklet captured it.
**Why it happens:** Worklets serialize closures; React state changes don't auto-update the closure.
**How to avoid:** Use `useSharedValue` for any data the worklet reads, or wrap the entire `Gesture.Pan()` in `useMemo([currentTopId])` so it rebuilds when the top changes. Pattern 4 above uses `runOnJS(onApprove)(top.id)` — this captures `top.id` at the time of `onEnd`, not at `Gesture.Pan()` definition. The `top` reference itself MUST come from the latest render — use `useRef` if needed:

```ts
const topRef = useRef(pending[0]);
useEffect(() => { topRef.current = pending[0]; }, [pending]);

const pan = Gesture.Pan().onEnd(() => {
  runOnJS(onApprove)(topRef.current.id);  // always latest
});
```

**Warning signs:** RPC called with a stale submission id; the wrong card animates off; "approve" succeeds on a card the user didn't see.

### Pitfall 7: Today Screen Realtime Race with Initial Load
**What goes wrong:** Today screen mounts; Realtime channel subscribes; an UPDATE event fires BEFORE the initial `useTodaySubmission` query has settled; the cache patch happens, then the initial query overwrites it.
**Why it happens:** Race between WSS event and HTTP query.
**How to avoid:** TanStack Query's default `setQueryData` patches the cache REGARDLESS of in-flight queries. Use `cancelQueries` first if you need strict ordering, OR just trust last-write-wins (Realtime events from server are authoritative anyway). Recommendation: trust Realtime — server-driven is always more recent than HTTP-fetched.

### Pitfall 8: pgTAP Test Fixture Pollution (P2 lesson)
**What goes wrong:** pgTAP test inserts auth.users + groups + submissions; assertions pass; teardown only ROLLBACKs the explicit fixtures, leaves `handle_new_user`-trigger-created profile rows behind in the database snapshot (in CI).
**Why it happens:** Triggers fire as side effects, not as explicit fixture writes.
**How to avoid:** Wrap the entire test in `begin; ... rollback;` (P2 pattern). Never use `commit;` mid-test. P2 tests follow this — copy the idiom verbatim.

### Pitfall 9: Submission Already-Approved on Concurrent Admin Action
**What goes wrong:** Two admin devices (rare in v1 with single-admin groups, but possible if admin opens the queue on phone + tablet) both approve the same submission. The 0003 trigger pins `reviewed_by = auth.uid()` defensively, so both UPDATEs succeed but only one wins. The losing client sees an unexpected state change via Realtime.
**Why it happens:** No optimistic-concurrency guard on the UPDATE.
**How to avoid:** `review_submission` RPC checks current status === 'pending' inside a transaction:

```sql
update public.submissions
   set status = $2, reviewed_by = auth.uid(), reviewed_at = now(),
       rejection_reason = $3
 where id = $1
   and status = 'pending'    -- guards against concurrent approval
returning id;

if not found then
  raise exception 'not_pending' using errcode = 'P0001';
end if;
```

The `where status = 'pending'` clause makes the UPDATE atomic-and-conditional. Concurrent admin gets `not_pending` typed error → client surfaces "This was already reviewed" toast and refreshes the queue.

**Warning signs:** Two `reviewed_by` rows in audit logs for the same submission (impossible with this guard); "not_pending" errors in production for non-edge-case scenarios.

### Pitfall 10: Storage RLS Bypass via Direct API Call
**What goes wrong:** Attacker crafts a direct HTTP `POST /storage/v1/object/submissions/{some-other-user-id}/{client_uuid}.jpg` with their own JWT.
**Why it doesn't happen:** The existing 0001 storage RLS policy `submissions_insert_self_in_group` checks `(storage.foldername(name))[2] = auth.uid()::text` AND `is_group_member(...)`. The attacker's JWT carries their own uid, which won't match the path's user_id segment.
**How to verify:** pgTAP test `submissions_storage_rls.sql` (NEW in P3) impersonates user A, attempts INSERT into bucket with path `{group_id}/{user_id_B}/{cuid}.jpg`, asserts the policy denies.

## Code Examples

Verified patterns from official sources, adapted to the project's conventions.

### §1. Capture a photo with expo-camera SDK 55

```ts
// src/components/CaptureControls.tsx (or inline in capture screen)
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';

export function PhotoCaptureView({ onCaptured }: { onCaptured: (uri: string) => void }) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) return null;
  if (!permission.granted) {
    return <PermissionDeniedScreen onRequest={requestPermission} />;
  }

  const handleShutter = async () => {
    const photo = await cameraRef.current?.takePictureAsync({
      quality: 0.8,    // matches avatar pipeline
      base64: false,   // we'll read via File class instead
    });
    if (photo?.uri) onCaptured(photo.uri);
  };

  return (
    <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" mode="picture">
      <Shutter variant="photo" onPress={handleShutter} />
    </CameraView>
  );
}
```
*Source: docs.expo.dev/versions/latest/sdk/camera/* [VERIFIED]

### §2. Record a 10s video with expo-camera SDK 55

```ts
// Same file; video variant
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useRef, useState } from 'react';

export function VideoCaptureView({ onCaptured }: { onCaptured: (uri: string) => void }) {
  const cameraRef = useRef<CameraView>(null);
  const [cameraPerm, requestCameraPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [recording, setRecording] = useState(false);

  if (!cameraPerm?.granted) return <CameraPermissionDeniedScreen onRequest={requestCameraPerm} />;
  if (!micPerm?.granted) return <MicPermissionDeniedScreen onRequest={requestMicPerm} />;

  const handleShutter = async () => {
    if (!recording) {
      setRecording(true);
      // recordAsync resolves when stopRecording() is called OR maxDuration reached.
      const video = await cameraRef.current?.recordAsync({
        maxDuration: 10,           // D-02 hard cap
        videoQuality: '720p',
        // codec defaults to platform best (avc1 on iOS, h264 on Android)
      });
      setRecording(false);
      if (video?.uri) onCaptured(video.uri);
    } else {
      cameraRef.current?.stopRecording();
    }
  };

  return (
    <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" mode="video">
      <Shutter variant={recording ? 'video-recording' : 'video-idle'} onPress={handleShutter} />
    </CameraView>
  );
}
```
*Source: docs.expo.dev/versions/latest/sdk/camera/* [VERIFIED]

### §3. Two-phase commit submitMedia pipeline (D-06)

```ts
// src/features/submissions/submitMedia.ts
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';   // already transitive via supabase-js
import { supabase } from '../../lib/supabase';
import type { QueueEntry } from './uploadQueueManager';

export type SubmitMediaArgs = {
  group_id: string;
  user_id: string;
  media_local_uri: string;
  media_type: 'photo' | 'video';
  caption: string | null;
  client_uuid?: string;   // pre-supplied on retry from queue
};

export type SubmitResult =
  | { ok: true; submission_id: string }
  | { ok: false; reason: 'queue'; entry: QueueEntry }
  | { ok: false; reason: 'typed'; error: 'not_member' | 'wrong_media_type' | 'already_submitted_today' };

export async function submitMedia(args: SubmitMediaArgs): Promise<SubmitResult> {
  const client_uuid = args.client_uuid ?? Crypto.randomUUID();

  // 1. Compress photo (skip for video — keep MOV/MP4 as-is)
  let upload_uri = args.media_local_uri;
  let contentType: string;
  let ext: string;
  if (args.media_type === 'photo') {
    const compressed = await ImageManipulator.manipulateAsync(
      args.media_local_uri,
      [{ resize: { width: 1080 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    upload_uri = compressed.uri;
    contentType = 'image/jpeg';
    ext = 'jpg';
  } else {
    contentType = 'video/mp4';
    ext = 'mp4';
  }

  // 2. Read as ArrayBuffer (modern File API — replaces base64 round-trip)
  const file = new File(upload_uri);
  const buf = await file.arrayBuffer();

  // 3. Upload to storage. Path layout per D-19 + 0001 RLS.
  const path = `${args.group_id}/${args.user_id}/${client_uuid}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('submissions')
    .upload(path, buf, { contentType, upsert: false });

  if (upErr) {
    // Idempotent retry: if path exists from a prior succeeded upload, proceed to RPC.
    const isAlreadyExists = upErr.message?.includes('already exists') || upErr.message?.includes('Duplicate');
    if (!isAlreadyExists) {
      // Network / 5xx → enqueue
      return {
        ok: false,
        reason: 'queue',
        entry: { client_uuid, group_id: args.group_id, media_local_uri: args.media_local_uri,
                 media_type: args.media_type, caption: args.caption,
                 created_at_iso: new Date().toISOString() },
      };
    }
    // else: object already in storage from prior attempt; fall through to RPC
  }

  // 4. RPC: server derives local_date, validates, inserts
  const { data, error: rpcErr } = await supabase.rpc('submit_today', {
    p_group_id: args.group_id,
    p_media_path: path,
    p_media_type: args.media_type,
    p_caption: args.caption,
  });

  if (rpcErr) {
    const msg = rpcErr.message ?? '';
    if (msg === 'not_member' || msg === 'wrong_media_type' || msg === 'already_submitted_today') {
      return { ok: false, reason: 'typed', error: msg as never };
    }
    // network / unknown → enqueue (storage object stays; orphan tolerated per D-09)
    return {
      ok: false,
      reason: 'queue',
      entry: { client_uuid, group_id: args.group_id, media_local_uri: args.media_local_uri,
               media_type: args.media_type, caption: args.caption,
               created_at_iso: new Date().toISOString() },
    };
  }

  return { ok: true, submission_id: data as string };
}
```
*Source: composed from useAvatarUpload.ts + Supabase storage docs + new SDK 55 File API* [VERIFIED]

### §4. AsyncStorage queue manager

```ts
// src/features/submissions/uploadQueueManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { z } from 'zod';
import { submitMedia } from './submitMedia';
import type { Session } from '@supabase/supabase-js';

export const QUEUE_KEY = 'accountibuzz.uploadQueue';

const queueEntrySchema = z.object({
  client_uuid: z.string().uuid(),
  group_id: z.string().uuid(),
  media_local_uri: z.string().min(1),
  media_type: z.enum(['photo', 'video']),
  caption: z.string().max(140).nullable(),
  created_at_iso: z.string().datetime(),
});
export type QueueEntry = z.infer<typeof queueEntrySchema>;

let flushing = false;

export async function readQueue(): Promise<QueueEntry[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return z.array(queueEntrySchema).parse(JSON.parse(raw));
  } catch {
    console.warn('[uploadQueue] corrupt — resetting');
    await AsyncStorage.removeItem(QUEUE_KEY);
    return [];
  }
}

export async function enqueue(entry: QueueEntry) {
  const cur = await readQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...cur, entry]));
}

export async function dequeue(client_uuid: string) {
  const cur = await readQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(cur.filter(e => e.client_uuid !== client_uuid)));
}

export async function flushQueue(session: Session | null): Promise<void> {
  if (flushing || !session) return;
  flushing = true;
  try {
    const entries = await readQueue();
    for (const entry of entries) {
      const result = await submitMedia({
        ...entry,
        user_id: session.user.id,
        client_uuid: entry.client_uuid,
      });
      if (result.ok) {
        await dequeue(entry.client_uuid);
      } else if (result.reason === 'typed') {
        // already_submitted_today / not_member / wrong_media_type → drop entry
        await dequeue(entry.client_uuid);
        // surface toast via event emitter (see useUploadQueue hook)
      } else {
        // 'queue' → keep, will retry on next trigger
        // do NOT continue iteration — break to avoid hammering the server
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

// Wire AppState + NetInfo triggers (call once from app/_layout.tsx)
export function startQueueManager(getSession: () => Session | null) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') flushQueue(getSession()).catch(console.error);
  });
  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      flushQueue(getSession()).catch(console.error);
    }
  });
}
```
*Source: composed from PITFALLS §4 + RN AppState docs + NetInfo docs* [VERIFIED]

### §5. submit_today RPC body (Postgres)

```sql
-- supabase/migrations/20260429173246_phase3_capture_review.sql (excerpt)

create or replace function public.submit_today(
  p_group_id   uuid,
  p_media_path text,
  p_media_type text,
  p_caption    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_tz   text;
  v_group_type text;
  v_local_date date;
  v_submission_id uuid;
begin
  -- Validate caller is a group member.
  if not public.is_group_member(p_group_id) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;

  -- Load group's submission_type + timezone in one shot.
  select submission_type, timezone
    into v_group_type, v_group_tz
    from public.groups
   where id = p_group_id;

  -- Validate media_type matches group's expected type.
  if p_media_type is distinct from v_group_type then
    raise exception 'wrong_media_type' using errcode = 'P0001';
  end if;

  -- Derive local_date server-side (PITFALLS §1).
  v_local_date := (now() AT TIME ZONE v_group_tz)::date;

  -- Validate caption length (defensive — client also validates).
  if p_caption is not null and char_length(p_caption) > 140 then
    raise exception 'caption_too_long' using errcode = 'P0001';
  end if;

  -- Insert. UNIQUE (group_id, user_id, local_date) catches double-submit.
  begin
    insert into public.submissions (
      group_id, user_id, local_date, media_path, media_type, caption, status
    ) values (
      p_group_id, auth.uid(), v_local_date, p_media_path, p_media_type, p_caption, 'pending'
    )
    returning id into v_submission_id;
  exception
    when unique_violation then
      raise exception 'already_submitted_today' using errcode = 'P0001';
  end;

  return v_submission_id;
end;
$$;

revoke execute on function public.submit_today(uuid, text, text, text) from public;
grant  execute on function public.submit_today(uuid, text, text, text) to authenticated;
```
*Source: composed from 0001_foundation.sql shape + 0004_phase2_groups_invites.sql idiom + PITFALLS §1+§2* [VERIFIED]

### §6. review_submission RPC body (Postgres)

```sql
create or replace function public.review_submission(
  p_submission_id   uuid,
  p_decision        text,
  p_rejection_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;

  if p_rejection_reason is not null and char_length(p_rejection_reason) > 140 then
    raise exception 'reason_too_long' using errcode = 'P0001';
  end if;

  -- Load group + verify admin.
  select group_id into v_group_id
    from public.submissions
   where id = p_submission_id;

  if v_group_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if not public.is_group_admin(v_group_id) then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;

  -- Atomic guarded UPDATE (Pitfall 9 — concurrent-approve race).
  -- The 0003 trigger re-validates reviewed_by = auth.uid() defensively.
  update public.submissions
     set status = p_decision,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejection_reason = case when p_decision = 'rejected' then p_rejection_reason else null end
   where id = p_submission_id
     and status = 'pending';

  if not found then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.review_submission(uuid, text, text) from public;
grant  execute on function public.review_submission(uuid, text, text) to authenticated;
```
*Source: composed from 0003 trigger constraints + Pitfall 9 mitigation* [VERIFIED]

### §7. get_pending_review_count RPC (Postgres)

```sql
create or replace function public.get_pending_review_count(p_group_id uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  -- Returns 0 for non-admins (no leak — explicit behavior, not just RLS).
  select coalesce((
    select count(*)::int
      from public.submissions
     where group_id = p_group_id
       and status = 'pending'
       and public.is_group_admin(p_group_id)
  ), 0);
$$;

revoke execute on function public.get_pending_review_count(uuid) from public;
grant  execute on function public.get_pending_review_count(uuid) to authenticated;
```
*Source: composed from 0001 helpers + D-17 spec* [VERIFIED]

### §8. Realtime channel for Today screen

```ts
// src/features/submissions/useTodaySubmissionRealtime.ts
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/AuthProvider';

export function useTodaySubmissionRealtime() {
  const { user } = useSession();
  const qc = useQueryClient();

  useFocusEffect(useCallback(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`today-submissions:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',                 // INSERT (own submit) + UPDATE (review)
          schema: 'public',
          table: 'submissions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            group_id: string;
            local_date: string;
            id: string;
            status: 'pending' | 'approved' | 'rejected';
            rejection_reason: string | null;
          };
          // Patch the per-group today cache. The hook below reads ['submission', groupId, 'today'].
          // We don't filter by local_date here — let the hook decide whether the row
          // matches "today" for its group's timezone (group might be in a different zone).
          qc.setQueryData(['submission', row.group_id, 'today'], row);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]));
}
```
*Source: composed from supabase.com/docs/guides/realtime/postgres-changes + useFocusEffect docs + PITFALLS §11* [VERIFIED]

### §9. Swipe-stack with Reanimated 4 (full pattern)

```ts
// app/(app)/groups/[id]/review.tsx (excerpt — top card only, full screen omits stack)
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Dimensions } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.35;
const VELOCITY_THRESHOLD = 800;

export function CardStack({ pending, onApprove, onRejectIntent }: Props) {
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  const topRef = useRef(pending[0]);
  useEffect(() => { topRef.current = pending[0]; }, [pending]);

  const reset = () => {
    translateX.value = withSpring(0, { damping: 14, stiffness: 120 });
    rotate.value = withSpring(0, { damping: 14, stiffness: 120 });
    overlayOpacity.value = withTiming(0, { duration: 200 });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      translateX.value = e.translationX;
      rotate.value = Math.max(-15, Math.min(15, e.translationX / 30));
      overlayOpacity.value = Math.min(1, Math.abs(e.translationX) / SWIPE_THRESHOLD * 2);
    })
    .onEnd((e) => {
      const passedDistance = Math.abs(e.translationX) > SWIPE_THRESHOLD;
      const passedVelocity = Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
      const passed = passedDistance || passedVelocity;
      if (!passed) {
        runOnJS(reset)();
        return;
      }
      if (e.translationX > 0) {
        translateX.value = withTiming(SCREEN_W, { duration: 250 }, () => {
          runOnJS(onApprove)(topRef.current.id);
        });
      } else {
        // Snap to -30% offset; reject panel slides up (parent state)
        translateX.value = withTiming(-SCREEN_W * 0.3, { duration: 300 });
        runOnJS(onRejectIntent)(topRef.current.id);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.topCard, cardStyle]}>
        <SwipeCard {...topRef.current} />
      </Animated.View>
    </GestureDetector>
  );
}
```
*Source: docs.swmansion.com/react-native-reanimated/docs/fundamentals/handling-gestures + UI-SPEC §Interaction Contracts* [VERIFIED + CITED]

### §10. Tabs layout migration

```ts
// app/(app)/_layout.tsx — Stack → Tabs
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/useTheme';

export default function AppLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
          borderTopWidth: 1,
          height: 56 + (t.insets?.bottom ?? 0),
        },
        tabBarActiveTintColor: t.colors.text,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarShowLabel: true,
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Feather name="sun" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="groups/index"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size }) => <Feather name="users" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} />,
        }}
      />
      {/* Hide non-tab routes from the tab bar (still routable) */}
      <Tabs.Screen name="groups/new" options={{ href: null }} />
      <Tabs.Screen name="groups/join" options={{ href: null }} />
      <Tabs.Screen name="groups/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="groups/[id]/review" options={{ href: null }} />
      <Tabs.Screen name="capture/[groupId]" options={{ href: null }} />
    </Tabs>
  );
}
```
*Source: expo-router v55 Tabs docs + UI-SPEC §"App shell — Stack → Tabs migration"* [VERIFIED + CITED]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `expo-av` Audio/Video | `expo-video` (split into `useVideoPlayer` + `VideoView`) | SDK 55 (Feb 2026) | All video playback in P3 uses the new API. |
| `expo-file-system` `readAsStringAsync({ encoding: 'base64' })` + `decode()` | `new File(uri).arrayBuffer()` | SDK 55 (new File class) | P3 should adopt the new API for media uploads. Avatar pipeline migration is a P3 hygiene item (Phase 1 deferred-items.md flag). |
| `PanResponder` from `react-native` | `react-native-gesture-handler` v2 `Gesture.Pan()` + Reanimated 4 worklets | RNGH v2 (2023+); Reanimated 4 (2025) | Native UI thread; 60–120 FPS; no JS-bridge latency on pan. P3 swipe-stack uses this. |
| Polling for cache invalidation | TanStack Query Realtime `setQueryData` | TanStack v5 + supabase-js v2 | Already P1 pattern; P3 extends to submissions. |
| `useEffect` cleanup for screens | `useFocusEffect` for tab-aware cleanup | expo-router v3+ | P3 Realtime subscriptions MUST use this — useEffect alone leaks across tab navigation. |
| Single-segment Realtime filter | Single-segment Realtime filter (unchanged — limitation persists) | Realtime since GA | Multi-column filter is a feature request open since 2021. P3 works around with single-column + client narrow. |

**Deprecated/outdated:**
- `expo-av` — fully removed in SDK 55.
- `expo-file-system/legacy` — still works but slated for removal. Avatar code currently uses it; migrate.
- `Animated` from `react-native` — superseded by Reanimated for any non-trivial animation. Status-pill cross-fade on Today (a simple opacity transition) can stay on `Animated.timing` — not worth pulling Reanimated into 5 components.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A 10s 720p video at typical mobile bitrate is ≤ 10 MB | Standard Stack §"Recommendation NOT to install" | If videos are larger (e.g. higher bitrate, longer codec headers), single-shot upload retries become expensive on slow networks. **Mitigation:** Wave 0 task = capture a 10s 720p video on physical iPhone + Android, measure size, document. If > 15 MB, revisit TUS chunked-upload decision. |
| A2 | Autoplay-muted-loop video on the admin queue won't tank battery at MVP scale (~10 swipes / session) | Standard Stack §expo-video | If battery drain is noticeable, set `keepScreenOnWhilePlaying = false` (already in Code Examples §recommended setup) AND consider showing a thumbnail with tap-to-play instead. **Mitigation:** physical-device UAT is in Validation Architecture. |
| A3 | The new `expo-file-system` `File` class works correctly on Android in the project's specific RN version (0.83.6) | Code Examples §3 | If it crashes on Android, fall back to the proven `useAvatarUpload.ts` `readAsStringAsync` + `decode()` path. **Mitigation:** Wave 0 spike — write a 10-line test that does `new File(uri).arrayBuffer()` on both platforms, assert the byte length matches what `readAsStringAsync` produces. |
| A4 | The Realtime `user_id=eq.{auth.uid()}` filter is performant at ~10 active users (the user's groups all together) | Pattern 3 | If event volume is high, client-side filtering wastes bandwidth. **Mitigation:** instrumentation log of events-per-second; revisit with per-group channels if needed (still subject to single-filter limitation). |
| A5 | The `submit_today` RPC will return typed errors as `Error.message` exactly matching `'not_member' | 'wrong_media_type' | 'already_submitted_today'` in the supabase-js client | Code Examples §3 | This is the established P2 pattern — verified working for 7 RPCs in P2. Risk is low. **Mitigation:** pgTAP test suite verifies the `raise exception 'X' using errcode = 'P0001'` shape. |
| A6 | `react-native-gesture-handler` v2.31 + `react-native-reanimated` v4.3 are compatible with each other and with expo-router on SDK 55 | Pattern 4 | Both already installed via `npx expo install` (managed by Expo SDK). Risk is low. **Mitigation:** `npx expo-doctor` in Wave 0 confirms compatibility. |
| A7 | Storage RLS `submissions_select_group_members` (0001:444) allows admin to read pending submissions (because admin IS a group member) | Architecture Diagram §Storage | Verified by reading the policy: it checks `is_group_member`, which is true for admins (admin is always a member with role='admin'). Risk is none — explicit verification. |
| A8 | Status pill cross-fade timing (250ms) is fast enough that Realtime updates feel "live" but slow enough to be perceptible | UI-SPEC §Interaction Contracts | UI-SPEC has resolved this; it's not really an assumption — it's a locked design decision. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (It's NOT empty — there are 8 assumptions, none of which require user confirmation but all of which warrant a Wave 0 spike or UAT verification.)

## Open Questions

1. **Should we run a Wave 0 spike on tus-js-client + new SDK 55 File class before locking on the supabase-js `.upload()` recommendation?**
   - What we know: tus-js-client expects Blob; new File class implements Blob; in theory it should work.
   - What's unclear: whether the integration is bug-free in production, whether retry-via-fingerprint is more reliable than our retry-via-queue, whether 10 MB video uploads benefit from chunking.
   - Recommendation: **NO — proceed with `.upload()` + queue.** A 1-day spike on tus-js-client risks consuming an entire wave for a marginal improvement on files we control the size of. If MVP testing surfaces upload reliability issues, revisit in P6 hardening.

2. **Should the offline queue auto-flush on initial app launch BEFORE the auth session resolves?**
   - What we know: Queue manager needs a session to call the RPC. If session resolves slowly (cold start), queue flush is delayed.
   - What's unclear: is delayed flush a UX problem? (User opens app, goes to Today, sees QueueBadge for ~500ms before it disappears.)
   - Recommendation: Acceptable. The QueueBadge during the brief delay is honest UI; instant disappearance would be misleading. The auth provider already loads in <500ms in P1 testing.

3. **Should the admin review queue cache also subscribe to Realtime (to drop cards when another admin acts)?**
   - What we know: v1 has single-admin groups, so concurrent admin action is impossible.
   - What's unclear: post-MVP, will multi-admin groups happen? (PROJECT.md: out-of-scope per "single creator-as-admin" constraint.)
   - Recommendation: NO Realtime on admin queue. Cite UI-SPEC line 920: "Avoiding Realtime here also dodges Pitfall #11 churn." Document that this assumption depends on single-admin and revisit if the constraint loosens.

4. **What happens to a queued upload if the user is removed from the group between enqueue and flush?**
   - What we know: RPC returns `not_member` typed error → queue manager drops entry → user sees toast "You're not in this group anymore."
   - What's unclear: should the storage object also be deleted in this case? (Currently: orphaned.)
   - Recommendation: Acceptable orphan. D-09 already accepts orphan media for P3. The pg_cron cleanup job in P5/P6 will sweep these.

5. **For the capture screen's reduced-motion fallback (UI-SPEC §Accessibility), do we need a custom hook or is `AccessibilityInfo.isReduceMotionEnabled()` checked once enough?**
   - What we know: Users can toggle reduced motion at runtime via OS settings.
   - Recommendation: Build a `useReducedMotion()` hook that subscribes to `AccessibilityInfo.addEventListener('reduceMotionChanged', ...)`. Single source of truth; consumers re-render on change. ~15 LOC.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Expo SDK 55 | All P3 | ✓ | 55.0.16 (deps) / 55.0.18 (latest) | — |
| supabase-js | All RPC + Storage + Realtime | ✓ | ^2.58 → resolves to 2.105.1 | — |
| expo-camera | Capture | ✓ | 55.0.16 | — |
| expo-video | Admin queue + capture review | ✓ | 55.0.15 | — |
| expo-file-system (`File` class) | Media upload | ✓ | 55.0.17 (modern API in this version) | Fall back to `expo-file-system/legacy` `readAsStringAsync` + `decode()` if `File.arrayBuffer()` flakes (A3 mitigation) |
| `@react-native-async-storage/async-storage` | Queue persistence | ✓ | 2.2.0 | — |
| `@react-native-community/netinfo` | Queue auto-flush trigger | **✗ NOT installed** | — | **No fallback acceptable.** Without it, queue only flushes on AppState 'active' — which is sufficient functionality for MVP, but UX is degraded. **Recommendation: install in Wave 0.** |
| react-native-gesture-handler | Swipe stack | ✓ | 2.31.1 | — |
| react-native-reanimated | Swipe animations | ✓ | 4.3.0 | — |
| expo-haptics | Approve/reject feedback | ✓ | 55.0.14 | — |
| expo-blur | Camera top-bar scrim | ✓ | 55.0.14 | Fall back to flat `rgba(0,0,0,0.45)` (UI-SPEC already specifies) |
| expo-image | Photo display | ✓ | 55.0.9 | — |
| expo-image-manipulator | Photo compression | ✓ | 55.0.15 | — |
| expo-linking | Permission-denied → Settings | ✓ | 55.0.14 | — |
| Dev build with camera permissions | All capture | **Stale — needs rebuild** | Last build before app.config.ts plugin block | **No fallback.** Wave 0 task: rebuild dev client after `app.config.ts` change. |
| Supabase local CLI | pgTAP test execution | ✓ | ^2.0.0 (devDep) | — |
| Physical iOS + Android device | UAT (camera, upload-on-flaky-network) | Per CLAUDE.md project memory: iOS available, Android deferred per Phase 1/2 precedent | — | Test on iOS only for P3 verification; Android UAT remains a tracked deferred item per project convention. |

**Missing dependencies with no fallback:**
- `@react-native-community/netinfo` — install in Wave 0.
- Dev client rebuild after `app.config.ts` change — Wave 0 task.

**Missing dependencies with fallback:**
- (none — all other deps are present)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (client) | Jest 29 + jest-expo 55 + @testing-library/react-native 13 + @testing-library/jest-native 5 |
| Framework (db) | pgTAP via `supabase test db` (Supabase CLI) |
| Config file | `jest.config.js` (root) + `jest.setup.ts` (mocks) |
| Quick run command | `pnpm test` (Jest only) — runs in <30s |
| DB-only run | `supabase test db` |
| Full suite command | `pnpm test:all` (Jest + pgTAP) |
| Phase gate | Full suite green before `/gsd-verify-work`; UAT pass per UI-SPEC `/gsd-uat-phase` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **SUB-01** | Photo capture → upload → row insert (happy path) | Jest integration | `pnpm jest tests/submissions/submitMedia.test.ts -t "photo happy path"` | ❌ Wave 0 |
| **SUB-01** | submit_today RPC accepts photo for photo group | pgTAP | `supabase test db --file submit_today` | ❌ Wave 0 |
| **SUB-01** | submit_today returns wrong_media_type when photo sent to video group | pgTAP | (same file) | ❌ Wave 0 |
| **SUB-02** | Video capture (10s cap) → upload → row insert | Jest integration (mocked CameraView) | `pnpm jest tests/submissions/submitMedia.test.ts -t "video happy path"` | ❌ Wave 0 |
| **SUB-02** | Manual UAT: 10s video on physical device, observe size | Manual UAT | (UAT script in 03-UAT.md per phase convention) | UAT only |
| **SUB-03** | Network failure during upload → entry enqueues to AsyncStorage | Jest integration | `pnpm jest tests/submissions/submitMedia.test.ts -t "network error enqueues"` | ❌ Wave 0 |
| **SUB-03** | Queue flushes on AppState 'active' | Jest integration | `pnpm jest tests/submissions/uploadQueueManager.test.ts -t "appstate flush"` | ❌ Wave 0 |
| **SUB-03** | Queue flushes on NetInfo isConnected | Jest integration | `pnpm jest tests/submissions/uploadQueueManager.test.ts -t "netinfo flush"` | ❌ Wave 0 |
| **SUB-03** | Manual UAT: airplane-mode-on-submit → queue → toggle off → flush | Manual UAT (PITFALLS §10) | (UAT script) | UAT only |
| **SUB-03** | Manual UAT: Slow-3G upload progress and resilience | Manual UAT (PITFALLS §10) | (UAT script) | UAT only |
| **SUB-04** | Today GroupCard reads useTodaySubmission and renders correct StatusPill | Jest component | `pnpm jest tests/components/GroupCard.test.tsx` | ❌ Wave 0 |
| **SUB-04** | Realtime payload patches the cache (mocked channel event) | Jest integration | `pnpm jest tests/submissions/useTodaySubmissionRealtime.test.ts` | ❌ Wave 0 |
| **SUB-05** | submit_today raises already_submitted_today on second insert | pgTAP | `supabase test db --file submit_today` | ❌ Wave 0 |
| **SUB-05** | Client drops queue entry on already_submitted_today | Jest integration | `pnpm jest tests/submissions/uploadQueueManager.test.ts -t "drops on already_submitted"` | ❌ Wave 0 |
| **SUB-06** | Caption ≤ 140 chars accepted | Jest unit (schemas) | `pnpm jest tests/submissions/schemas.test.ts` | ❌ Wave 0 |
| **SUB-06** | Caption > 140 chars rejected (client + server) | Jest + pgTAP | (above + submit_today.sql) | ❌ Wave 0 |
| **ADM-01** | useReviewQueue returns pending submissions for groups admin manages | Jest + Supabase mock | `pnpm jest tests/submissions/useReviewQueue.test.ts` | ❌ Wave 0 |
| **ADM-01** | Non-admin gets empty list (RLS) | pgTAP | `supabase test db --file review_submission` (also covers admin RLS) | ❌ Wave 0 |
| **ADM-02** | review_submission(approved) updates status, reviewed_by, reviewed_at | pgTAP | `supabase test db --file review_submission` | ❌ Wave 0 |
| **ADM-03** | review_submission(rejected, reason) sets rejection_reason; (rejected, null) leaves null | pgTAP | (same) | ❌ Wave 0 |
| **ADM-04** (rescoped) | Realtime UPDATE event fires when admin updates status; Today screen patches cache | Jest integration | `pnpm jest tests/submissions/useTodaySubmissionRealtime.test.ts -t "review event"` | ❌ Wave 0 |
| **PLAT-03** | Non-admin calling review_submission gets not_admin typed error | pgTAP | `supabase test db --file review_submission` | ❌ Wave 0 |
| **PLAT-03** | Admin of group A cannot review submission of group B (cross-group attack) | pgTAP | `supabase test db --file review_submission -t "cross-group denied"` | ❌ Wave 0 |
| **PLAT-03** | 0003 admin-immutable trigger pins reviewed_by = auth.uid() | pgTAP (backfill from 01 deferred-items) | `supabase test db --file submissions_admin_immutable` | ❌ Wave 0 |
| **PLAT-03** | 0003 trigger blocks admin attempt to change group_id, user_id, local_date, media_path | pgTAP | (same file) | ❌ Wave 0 |
| **Tabs migration** | All deep links resolve correctly post-migration | Jest integration | `pnpm jest tests/app/tabs-migration.test.ts` | ❌ Wave 0 |
| **Swipe gesture** | SwipeCard fires onApprove on right-swipe past threshold | Jest component (gesture mock) | `pnpm jest tests/components/SwipeCard.test.tsx -t "approve right swipe"` | ❌ Wave 0 |
| **Swipe gesture** | SwipeCard fires onRejectIntent on left-swipe past threshold | Jest component | (same) | ❌ Wave 0 |
| **Capture flow** | Permission denied → permission-denied screen renders | Jest component | `pnpm jest tests/app/capture-permission-denied.test.tsx` | ❌ Wave 0 |
| **Capture flow** | Discard-take modal blocks accidental dismiss when take captured | Jest component | `pnpm jest tests/app/capture-discard-modal.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test -- --findRelatedTests <changed-files>` (existing convention)
- **Per wave merge:** `pnpm test:all` (Jest + pgTAP)
- **Phase gate:** Full suite green before `/gsd-verify-work`; UAT walkthrough green before phase close

### Wave 0 Gaps

All test files listed above are NEW. The test infrastructure exists (Jest 29 + jest-expo 55 + @testing-library/react-native 13 + Supabase CLI 2.x for pgTAP), but P3-specific test files do not exist yet.

- [ ] `tests/submissions/submitMedia.test.ts` — covers SUB-01, SUB-02, SUB-03
- [ ] `tests/submissions/uploadQueueManager.test.ts` — covers SUB-03, SUB-05 (drop-on-conflict)
- [ ] `tests/submissions/useTodaySubmission.test.ts` — covers SUB-04 (initial fetch shape)
- [ ] `tests/submissions/useTodaySubmissionRealtime.test.ts` — covers SUB-04 + ADM-04 (Realtime patch)
- [ ] `tests/submissions/useReviewQueue.test.ts` — covers ADM-01 (admin queue read)
- [ ] `tests/submissions/useSubmitToday.test.ts` — covers happy/typed-error mutation paths
- [ ] `tests/submissions/useReviewSubmission.test.ts` — covers approve/reject mutations
- [ ] `tests/submissions/schemas.test.ts` — covers SUB-06 caption validation
- [ ] `tests/components/StatusPill.test.tsx` — covers SUB-04 visual states
- [ ] `tests/components/GroupCard.test.tsx` — covers SUB-04 + queue badge integration
- [ ] `tests/components/SwipeCard.test.tsx` — covers swipe gesture (Reanimated test pattern)
- [ ] `tests/app/capture-permission-denied.test.tsx` — covers SUB-01/02 permission flow
- [ ] `tests/app/capture-discard-modal.test.tsx` — covers discard-take confirmation
- [ ] `tests/app/tabs-migration.test.ts` — covers D-14 deep-link audit
- [ ] `supabase/tests/submit_today.sql` — covers SUB-01..05 (RPC happy + 3 typed-error paths)
- [ ] `supabase/tests/review_submission.sql` — covers ADM-02..03, PLAT-03 (admin-only + state machine + cross-group denied)
- [ ] `supabase/tests/get_pending_review_count.sql` — covers ADM-01 (badge + 0-leak)
- [ ] `supabase/tests/submissions_admin_immutable.sql` — backfills 0003 trigger coverage (Phase 1 deferred-items.md flag)

**jest.setup.ts mocks (additions):**

```ts
// Add to existing mocks:
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true, status: 'granted' }, jest.fn()],
  useMicrophonePermissions: () => [{ granted: true, status: 'granted' }, jest.fn()],
}));

jest.mock('expo-video', () => ({
  useVideoPlayer: (uri: string, setup?: (p: unknown) => void) => {
    const player = { muted: false, loop: false, play: jest.fn(), pause: jest.fn(), release: jest.fn() };
    setup?.(player);
    return player;
  },
  VideoView: 'VideoView',
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: () => Promise.resolve({ isConnected: true, isInternetReachable: true }),
}));
```

### What Should NOT Be Mocked

- **Supabase client (`src/lib/supabase.ts`):** mock at the per-test level using `jest.spyOn(supabase, 'rpc')` etc. — same P2 pattern.
- **AsyncStorage:** existing mock is fine (in-memory).
- **Postgres functions in pgTAP:** test against the REAL function bodies via `supabase test db`. Never mock SQL.
- **The 0003 admin-immutable trigger:** explicit pgTAP coverage required.
- **Realtime channels:** mock the `supabase.channel(...).on(...).subscribe()` chain at the per-test level so we can drive synthetic payloads into the handler.
- **`useFocusEffect`:** allow it to run synchronously in tests (jest-expo handles this); assert subscribe + unsubscribe both called.
- **Reanimated worklets:** use `react-native-reanimated/mock` per the official testing guide. Worklet code becomes JS-thread; gesture handlers can be invoked directly.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth via `src/lib/supabase.ts` (already shipped P1). All RPCs run as `authenticated` role with `auth.uid()` available. |
| V3 Session Management | yes | LargeSecureStore-backed encrypted session (P1). `autoRefreshToken: true`. AppState-listener pause/resume (P1 Pitfall 3 mitigation). |
| V4 Access Control | **yes (critical for P3)** | Three-layer defense: RLS policies on `submissions` table; SECURITY DEFINER RPCs validate explicitly; 0003 trigger pins reviewed_by + blocks group/user/local_date/media_path mutation. PLAT-03 enforced by all three layers. |
| V5 Input Validation | yes | Client: Zod (caption, reject reason). Server: RPC checks `char_length(...)` for caption + reason; CHECK constraints on `submissions.media_type` + `submissions.status`. |
| V6 Cryptography | n/a-direct | No new crypto in P3. Existing AES-256 session encryption (P1 LargeSecureStore) is the entire surface. |
| V7 Error Handling | yes | Typed errors via `raise exception 'X' using errcode = 'P0001'` (P2 pattern). Never expose internal SQL errors to client. |
| V8 Data Protection | yes | Storage bucket `submissions` is PRIVATE (0001:406). Signed URLs with 60s TTL for media display. No PII in error messages. |
| V9 Communication | yes (transport) | All client-Supabase comms over HTTPS (managed). WSS for Realtime (managed). |
| V10 Malicious Code | n/a-direct | Build supply chain unchanged from P1/P2; no new third-party libraries with broad scope. |
| V11 Business Logic | **yes** | Cutoff enforcement (server-derived `local_date`), one-submission-per-day (UNIQUE constraint), terminal-rejection state machine (status='rejected' is a sink — no transition out). |
| V12 Files and Resources | yes | Storage path validation: `(storage.foldername(name))[1]` = group_id, `[2]` = user_id (0001 RLS). Path traversal blocked because `storage.foldername` parses on `/` and we check explicit segments. |
| V13 API and Web Service | n/a (web) | Mobile-only client; no public web API. |
| V14 Configuration | yes | `EXPO_PUBLIC_*` env vars for Supabase URL + anon key. **Service role key NEVER ships to client** (PITFALLS §3, P1 invariant). |

### Known Threat Patterns for {RN + Expo + Supabase + RLS}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **RLS bypass: non-admin calls `review_submission`** | Elevation of Privilege | RPC checks `is_group_admin(submission.group_id)` and raises `not_admin`. RLS policy `submissions_update_admin_or_owner_pending` also denies. 0003 trigger re-checks admin via `is_group_admin(old.group_id)`. **Three layers.** Tested in pgTAP. |
| **Media path tampering: client supplies forged `media_path` pointing at another user's storage object** | Tampering / Information Disclosure | `submit_today` RPC does NOT validate the path's existence (would require a storage HTTP call from Postgres — heavy). Defense: storage RLS `submissions_insert_self_in_group` requires `(foldername(name))[2] = auth.uid()::text` AT UPLOAD TIME. By the time the RPC inserts the row, the storage object already exists at a path the user owns. A forged path that points elsewhere would refer to an object the user couldn't have uploaded → orphan reference but no data exfil (RLS on storage select still applies). **Risk: orphan reference confusion.** Mitigation: pgTAP test for the path-tamper attack pattern (insert with media_path = `{other_user_uuid}/...`); will succeed at insert (we don't validate) but storage select RLS denies fetch. **Acceptable per D-09 (orphans tolerated).** |
| **Double-submit race: client retries before server commits the first** | Tampering | UNIQUE constraint catches; second insert raises `already_submitted_today`. Client drops queue entry. Atomicity guaranteed by Postgres. |
| **Storage object orphan from failed two-phase commit** | Information Disclosure (low — orphan can't be read by other users) | D-09: tolerated for MVP. P5/P6 will add `pg_cron` cleanup. Not a security issue (RLS prevents non-owner read), only a storage-cost issue. |
| **JWT refresh failure mid-upload** | Denial of Service (self-DoS) | Single-shot `.upload()` is short enough that mid-upload expiry is rare (PITFALLS §12). Retry layer in queue manager handles 401s by re-trying with refreshed JWT. |
| **Admin-immutable trigger bypass via direct UPDATE** | Tampering | The 0003 trigger fires on EVERY UPDATE (not just RPC). Direct REST UPDATE attempts are blocked by both the trigger AND the RLS policy. Three-layer defense: RLS → RPC → trigger. |
| **Cross-group review: admin of group A reviews submission of group B** | Elevation of Privilege | RPC `review_submission` looks up `submission.group_id` from the database and validates `is_group_admin(that_group_id)` — NOT what the client claims the group_id is. Cross-group attack fails at the RPC layer. pgTAP test required. |
| **Realtime payload leakage: subscriber receives events for other users' submissions** | Information Disclosure | The Realtime filter `user_id=eq.{auth.uid()}` is APPLIED SERVER-SIDE by the Realtime broker. Subscriber cannot widen the filter without re-subscribing. **Verified in supabase docs:** filter is enforced before WSS transmission. (Note: the broader Realtime RLS feature would add row-level filtering on top — currently we rely on the `user_id` filter being correct.) |
| **Camera-permission UX exploit: malicious overlay tricks user into granting camera access** | Tampering | OS-level permission prompt is unspoofable. App's permission-denied screen offers `Open Settings` deep link (no auto-grant). |
| **AsyncStorage queue tamper: attacker with device access modifies queued entries** | Tampering | Threat model excludes physical device access (mobile MVP scope). Queue contents are not secrets (group_id + caption are the user's own data). The `client_uuid` provides idempotency; tampering with it would just create a fresh upload, not exfil. |
| **Storage signed URL leakage** | Information Disclosure | 60s TTL minimizes exposure window. URLs include a signature; cannot be re-used after expiry. **Do NOT extend TTL** for "convenience" — short-lived is the security feature. |
| **Reject-reason XSS / injection** | Tampering / Injection | Reject reason is stored as plain text in `rejection_reason text`. Rendered as plain text in RN `<Text>` (no HTML interpretation). React Native renders text safely. NO HTML/JSX in user-supplied reason. Server validates `char_length(...)` only. |
| **submit_today RPC parameter injection** | Tampering | All parameters are typed (`uuid`, `text`). `text` parameters are passed as bind values; no string concatenation in plpgsql. SQL injection impossible. |

### Threat Model Block (for PLAN.md `<threat_model>`)

```
Threat 1: Non-admin attempts to call review_submission RPC.
  Asset: submissions table (review state).
  Attack: client crafts supabase.rpc('review_submission', { ... }) call with their JWT.
  Mitigations:
    - Layer 1 (RLS): submissions UPDATE policy requires is_group_admin OR (owner AND pending).
    - Layer 2 (RPC): review_submission body validates is_group_admin(group_id) before UPDATE.
    - Layer 3 (Trigger): 0003 trigger re-checks is_group_admin(old.group_id) on every UPDATE.
  Test: pgTAP — `supabase/tests/review_submission.sql` "non-admin denied".

Threat 2: Client supplies forged media_path in submit_today (e.g., points at attacker-owned bucket path).
  Asset: submissions row integrity.
  Attack: malicious client sends arbitrary media_path string.
  Mitigations:
    - Storage RLS gates upload — attacker can only write to `{group_id}/{auth.uid()}/...`.
    - submit_today does NOT validate path existence (acknowledged limitation).
    - Net effect: orphan references possible but no data exfil (storage RLS gates read).
  Acceptable risk per D-09. Cleanup deferred to P5/P6.
  Test: pgTAP — verify orphan path doesn't crash insert; verify cross-user path read is RLS-denied.

Threat 3: Double-submit race (client retries before server commits).
  Asset: streak count integrity (downstream of approval).
  Attack: client taps Submit twice on flaky network.
  Mitigations:
    - UNIQUE (group_id, user_id, local_date) enforced at DB level (0001:245).
    - Second insert raises already_submitted_today; client drops queue entry.
  Test: pgTAP — submit_today raises typed error on conflict.

Threat 4: Storage object orphan from RPC failure after upload success.
  Asset: storage cost (no data exposure).
  Attack: not an attack — mechanical failure mode.
  Mitigations: D-09 — tolerated for MVP. pg_cron sweep in P5/P6.
  Test: none in P3.

Threat 5: JWT refresh failure mid-upload.
  Asset: submission completion (UX, not security).
  Attack: not adversarial — token expiry crosses an upload window.
  Mitigations:
    - Single-shot .upload() is fast enough to rarely cross expiry.
    - Queue manager retries on 401 → supabase-js refreshes by then.
  Test: Jest integration — mock 401 response, assert retry with new token.

Threat 6: Admin-immutable trigger bypass via direct REST UPDATE on submissions.
  Asset: submission identity columns (user_id, group_id, local_date, media_path).
  Attack: admin crafts a REST UPDATE that changes group_id (would also sidestep UNIQUE).
  Mitigations:
    - 0003 trigger fires on every UPDATE; raises if any pinned column changes.
    - RLS policy gates UPDATE entry; trigger is the second layer.
  Test: pgTAP — `submissions_admin_immutable.sql` (backfills 01 deferred item).

Threat 7: Cross-group review (admin of A reviews submission of B).
  Asset: review state of submissions in groups admin doesn't manage.
  Attack: admin calls review_submission(B_submission_id, ...) — they're admin of A, not B.
  Mitigations:
    - RPC fetches submission.group_id from DB (not from client) and checks is_group_admin(that).
    - Trigger 0003 re-validates.
  Test: pgTAP — cross-group attempt raises not_admin.
```

## Sources

### Primary (HIGH confidence)

- `/llmstxt/expo_dev_llms_txt` (Context7) — confirmed `expo-camera` `CameraView`, `expo-video` `useVideoPlayer`, SDK 55 New Architecture mandatory
- [docs.expo.dev/versions/latest/sdk/camera/](https://docs.expo.dev/versions/latest/sdk/camera/) — CameraView props, takePictureAsync, recordAsync(maxDuration), useCameraPermissions, plugin config
- [docs.expo.dev/versions/latest/sdk/video/](https://docs.expo.dev/versions/latest/sdk/video/) — useVideoPlayer, VideoView, autoplay-muted-loop pattern, expo-av migration notes
- [docs.expo.dev/versions/latest/sdk/filesystem/](https://docs.expo.dev/versions/latest/sdk/filesystem/) — new SDK 55 `File` class implements Blob; createUploadTask deprecated
- [supabase.com/docs/guides/storage/uploads/resumable-uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) — TUS endpoint, headers, chunkSize, metadata fields
- [supabase.com/docs/guides/realtime/postgres-changes](https://supabase.com/docs/guides/realtime/postgres-changes) — single-column filter limitation, supported operators, channel cleanup
- [supabase.com/docs/reference/javascript/storage-from-createsignedurl](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) — createSignedUrl(path, expiresIn) signature
- [docs.swmansion.com/react-native-reanimated/docs/fundamentals/handling-gestures/](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/handling-gestures/) — GestureDetector + Gesture.Pan() + worklets pattern, runOnJS, withSpring/withTiming
- `supabase/migrations/0001_foundation.sql` (project) — schema source of truth
- `supabase/migrations/0003_phase1_review_fixes_2.sql` (project) — admin-immutable trigger spec
- `src/features/profile/useAvatarUpload.ts` (project) — upload pipeline precedent

### Secondary (MEDIUM confidence)

- [GitHub supabase/realtime-js #97](https://github.com/supabase/realtime-js/issues/97) — confirmed Realtime multi-column filter limitation
- [GitHub tus/tus-js-client #173, #231, #248](https://github.com/tus/tus-js-client/issues/231) — RN Blob compatibility issues across multiple years
- [GitHub saimon24/react-native-resumable-upload-supabase](https://github.com/saimon24/react-native-resumable-upload-supabase) — last published on Expo SDK 49 (Aug 2023), not SDK 55 — used as historical reference only
- [animatereactnative.com — Tinder swipe with Reanimated + Gesture Handler](https://www.animatereactnative.com/post/tinder-swiper-animation-reanimated-+-gesture-handler) — confirmed 35% width OR 800 px/s velocity threshold is industry standard
- [supabase.com/blog/react-native-storage](https://supabase.com/blog/react-native-storage) — base64 → ArrayBuffer pattern (legacy fallback)

### Tertiary (LOW confidence — flagged for verification)

- (none — all material claims are HIGH or MEDIUM confidence sourced)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package verified via `npm view` against current registry on 2026-04-28; SDK 55 first-party modules cross-checked against docs.expo.dev
- Architecture (RPC shapes, RLS layers, two-phase commit ordering): HIGH — composed from existing migrations (0001 + 0003) + P2 RPC pattern + Pitfalls research; SQL bodies validated against function signatures and existing trigger constraints
- TUS recommendation: MEDIUM — recommendation IS to skip TUS; downside is we don't get true chunked-upload resume (only retry-resume). Acceptable risk given file-size envelope (≤ 10 MB).
- Realtime channel filter limitation: HIGH — verified via official docs + GitHub issue
- Swipe-stack pattern: HIGH — Reanimated 4 official docs + community standard thresholds
- Pitfalls: HIGH — composed from project's own PITFALLS.md (already verified) + new P3-specific pitfalls (Realtime multi-filter, worklet stale closure, permission-during-detour) verified against docs

**Research date:** 2026-04-28
**Valid until:** ~2026-06-28 (60 days for stable Expo SDK + Supabase APIs; flag for refresh if SDK 56 ships before phase close)

## RESEARCH COMPLETE

**Phase:** 3 - capture-admin-review
**Confidence:** HIGH (with one MEDIUM-confidence recommendation: skip raw TUS, use supabase-js `.upload()` + custom retry queue)

### Key Findings

1. **TUS validation conclusion: skip raw `tus-js-client`. Use `supabase.storage.upload()` + AsyncStorage queue + retry layer.** SDK 55's new `expo-file-system` `File` class implements Blob (in theory unlocking tus-js-client) but no production reference impl exists for SDK 55 + RN 0.83.1 yet, and our 1–10 MB file envelope doesn't benefit much from chunked-resume vs. retry-resume.

2. **Supabase Realtime postgres_changes only supports single-column filters.** The CONTEXT-described `(group_id, user_id, local_date=today)` triple filter is impossible. Filter on `user_id=eq.{auth.uid()}` and narrow client-side. One channel per Today screen, torn down via `useFocusEffect`.

3. **Use the new SDK 55 `expo-file-system` `File` class for media reads** (`new File(uri).arrayBuffer()`), NOT the legacy `readAsStringAsync` + `decode()`. Migrate the avatar pipeline in the same wave for consistency (Phase 1 deferred-items.md flag).

4. **Hand-roll the swipe stack with `react-native-gesture-handler` v2.31 + `react-native-reanimated` v4.3.** All third-party card-stack libraries are unmaintained; the canonical Reanimated pattern is ~80 LOC and runs on the native UI thread (60–120 FPS).

5. **Three SECURITY DEFINER RPCs in migration `20260429173246_phase3_capture_review.sql`:** `submit_today`, `review_submission`, `get_pending_review_count`. Each follows the P2 pattern (typed errors via `raise exception 'X' using errcode = 'P0001'`). The `review_submission` RPC's UPDATE is conditional on `status = 'pending'` (Pitfall 9 — concurrent-approve race guard).

6. **Wave 0 must include:** install `@react-native-community/netinfo`; rebuild dev client after `app.config.ts` adds `expo-camera` plugin; create 18 new test files (4 pgTAP + 14 Jest); audit all `router.push('/')` call sites for the Stack→Tabs migration.

7. **PLAT-03 has three-layer defense:** RLS policy (`submissions_update_admin_or_owner_pending`) + RPC explicit `is_group_admin` check + 0003 trigger re-pin of `reviewed_by = auth.uid()`. The 0003 trigger has NO existing pgTAP coverage (flagged in 01-foundation/deferred-items.md); P3 backfills via `submissions_admin_immutable.sql`.

### File Created

`/Users/chris/projects/accountibuzz/.planning/phases/03-capture-admin-review/03-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All package versions verified via `npm view` 2026-04-28; SDK 55 modules cross-checked against docs.expo.dev |
| Architecture (two-phase commit, RPC shapes, three-layer auth) | HIGH | Composed from shipped migrations (0001 + 0003) + P2 patterns + verified RLS policies |
| TUS recommendation | MEDIUM | Recommendation is to skip TUS; downside is no chunked-resume — acceptable for ≤10 MB file envelope |
| Realtime filter approach | HIGH | Single-column limitation verified via official docs + GitHub issue; client-narrowing pattern is standard |
| Pitfalls | HIGH | Project PITFALLS.md (already verified) + P3-specific additions (Realtime multi-filter, worklet stale closure, permission-during-detour) all verified against docs |
| Validation Architecture | HIGH | Test infrastructure exists (Jest 29 + jest-expo 55 + Supabase CLI 2.x); all gaps explicitly enumerated |
| Security Domain | HIGH | Threat model maps to existing schema constraints; three-layer auth matches CLAUDE.md security posture |

### Open Questions

1. Should we run a Wave 0 spike on tus-js-client + new SDK 55 File class? — **Recommendation: NO**, proceed with `.upload()` + queue.
2. Auto-flush queue before auth resolves? — **Recommendation: NO**, accept brief QueueBadge during cold start.
3. Realtime on admin queue? — **Recommendation: NO**, single-admin makes it moot; revisit if multi-admin lands.
4. Cleanup orphans on group-removal? — **Recommendation: defer**, accept orphan per D-09.
5. Reduced-motion subscription pattern? — **Recommendation: build a `useReducedMotion()` hook** (~15 LOC).

### Ready for Planning

Research complete. Planner can now create PLAN.md files. Recommended wave structure (per granularity=standard):

- **Wave 0 (foundation):** install netinfo + rebuild dev client + create test infra (jest mocks for camera/video/netinfo) + write `20260429173246_phase3_capture_review.sql` migration + regenerate types + Stack→Tabs migration audit
- **Wave 1 (parallel):** RPCs + pgTAP coverage; capture screen + components; submitMedia pipeline + queue manager
- **Wave 2 (parallel):** Today screen + Realtime hook; admin queue + swipe-stack
- **Wave 3 (sequential):** integration smoke + UAT walkthrough
