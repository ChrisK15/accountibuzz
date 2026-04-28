# Phase 3: Capture & Admin Review - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

The core accountability loop. Phase 3 delivers:

- Member capture flow per group's submission type (photo OR ≤10s single-take video, no trim)
- Two-phase commit: media uploaded to Supabase Storage first, then `submissions` row inserted (server-derives `local_date`)
- TUS resumable upload + offline queue with explicit "pending upload" UI; never silent success
- Server-side enforcement: one submission per `(group_id, user_id, local_date)` (UNIQUE already shipped in P1); cutoff is server-authoritative
- Member sees own submission status (— / pending / approved / rejected) on a per-group card on the new "Today" tab; status updates live via Realtime subscription
- Admin sees a Tinder-style swipe queue of pending submissions for groups they admin (approve / reject with optional one-line reason); RLS prevents non-admins from reviewing
- Rejection is **terminal for that local day** — member misses today, streak resets at next group-local midnight (no resubmit). Rejection notification is in-app only in P3 (push lands in P5)
- App shell evolves from P2's stack-only to bottom tabs: **Today / Groups / Profile**; admin review queue lives inside group-detail (a "Pending review (N)" entry visible only to admins)

Out of scope for Phase 3 (other phases own these): points/streak counter trigger bodies and leaderboard (P4), today-feed-of-everyone-else's-submissions (P4), missed-day tombstones (P4), push notifications (P5), `pg_cron` daily rollover that actually resets the streak (P5), re-engagement / group-health (P6), Universal Links (P6).

</domain>

<decisions>
## Implementation Decisions

### Submission Scope (D-01..D-04)
- **D-01: Photo + short video, both first-class.** The schema's `submission_type` group setting (`photo` | `video`) is honored at runtime. Mixed-mode at MVP — group admin's create-time choice from P2 stands.
- **D-02: Video is hard-capped at 10s, single-take, no trim/edit UI.** Capture stops automatically at 10s. No in-app preview-and-trim. Single-take only — if the user dislikes the take they can re-record from scratch (which discards the previous take). Cheapest video path that still respects the schema flag.
- **D-03: Camera-roll uploads remain out of scope** (per PROJECT.md: "credibility of proof depends on in-moment capture"). Capture is `expo-camera` only, no `expo-image-picker` for submissions. (Avatar pipeline keeps using `expo-image-picker` — different surface.)
- **D-04: Caption is optional, single-line, ≤140 chars.** Entered post-capture on the same screen as the "Submit" CTA. Mirrors P2's char-counter pattern from create-group's `goal_description`.

### Upload Pipeline (D-05..D-09)
- **D-05: ~~TUS resumable upload~~ → `supabase.storage.upload()` + AsyncStorage queue + retry layer.** Research (2026-04-28, see `03-RESEARCH.md`) found no production TUS reference impl on Expo SDK 55 + RN 0.83.1 + Hermes v1; the saimon24 reference repo is stuck on SDK 49 (2023). The 1–10 MB media envelope doesn't justify the integration cost of chunked-resume vs. plain retry-resume. **Locked decision (revised 2026-04-28):** unified `supabase.storage.upload()` pipeline + AsyncStorage queue + custom retry layer + explicit progress UI + offline awareness via `@react-native-community/netinfo`. Same UX as the original D-05 (offline queue, progress bar, "never silent success"); no mid-upload chunked-resume — failed uploads restart from byte 0 on retry. Acceptable given the file-size envelope. The original TUS-bound STATE.md research flag is now resolved.
- **D-06: Two-phase commit with retry-safe ordering.** (1) Upload media to `submissions/{group_id}/{user_id}/{client_uuid}.{ext}` via TUS; on success, (2) call SECURITY DEFINER RPC `submit_today(group_id, media_path, media_type, caption)`. The RPC derives `local_date` server-side via `now() AT TIME ZONE groups.timezone` and inserts the `submissions` row. Storage path uses a `client_uuid` (not `local_date`) so a queued retry doesn't depend on the client knowing the server's date.
- **D-07: Offline queue persisted in AsyncStorage** as `{client_uuid, group_id, media_local_uri, media_type, caption, created_at_iso}` entries. Auto-flush triggers: app foreground, network-online event, manual "retry" tap. Queue UI surface = badge on the per-group Today card ("Upload pending — N MB queued"). User can tap to see/cancel each pending entry.
- **D-08: Stale-queue cutoff handling = server-authoritative.** On flush, the RPC attempts the insert. If `local_date` (server-derived) doesn't match what the user expected (e.g., upload completed past midnight, queued from yesterday), the server simply applies whatever `local_date` is correct. If a row already exists for that `(group_id, user_id, local_date)` — typed error → client drops the queue entry, surfaces "Yesterday's submission didn't make it before midnight — streak reset." No client-side TTL; no fake backdating.
- **D-09: Orphan media cleanup is deferred,** not built in P3. Failed flushes that succeeded at storage but failed at RPC will leave an orphaned object. Acceptable for MVP — track in deferred items; a scheduled `pg_cron` cleanup job can land in P5/P6.

### Admin Review UX (D-10..D-13)
- **D-10: Tinder-style swipe stack.** Single screen per group (entered from group-detail "Pending review (N)" entry, admin-only). Largest pending submission card on top: media (photo or autoplay-muted video), submitter avatar + name, caption, "submitted Nm ago." Swipe-right = approve, swipe-left = reject. Buttons as fallback. Caption visible without taps.
- **D-11: Reject reason = optional, single-line, ~140 chars.** Inline input appears on left-swipe before the reject is committed (admin can swipe back to cancel, or tap "Reject" to commit). Stored in `submissions.rejection_reason` (column already exists per P1 schema).
- **D-12: Rejection is TERMINAL for that local day.** No resubmit. The day is missed; streak resets at next group-local midnight (P5 owns the actual rollover trigger body). This **rescopes ADM-04** — see Open Items below.
- **D-13: Realtime status push to submitter (revised 2026-04-28).** Research (`03-RESEARCH.md`) found Supabase Realtime `postgres_changes` only supports a **single-column filter** (verified via supabase docs + GitHub `realtime-js#97`). The originally-described `(group_id, user_id, local_date=today)` triple filter is impossible at the channel level. **Revised decision:** When the Today screen is mounted, open ONE channel filtered server-side on `user_id=eq.{auth.uid()}` (the only column the channel API can filter). Client-side, narrow the events: drop UPDATEs whose `group_id` is not in the active screen's group set OR whose `local_date != today`. On surviving events, patch the TanStack cache via `setQueryData` + cross-fade the StatusPill per UI-SPEC. **Channel teardown on screen blur via `useFocusEffect`** (NOT plain `useEffect` — Pitfall #11). Push notification (P5) layers on top later — the in-app surface remains the durable truth in P3.

### App Shell (D-14..D-16)
- **D-14: Introduce bottom tabs.** Three tabs: **Today** (new) / **Groups** (current P2 list) / **Profile** (current avatar tap target). `app/(app)/_layout.tsx` becomes a Tabs layout. `app/(app)/index.tsx` becomes Today. P2's current groups index moves to `app/(app)/groups/index.tsx`. Profile route stays at `app/(app)/profile.tsx`.
- **D-15: Today screen lists each of the user's groups as a card.** Each card: group name, submission-type icon (photo/video), today's status badge (`—` not yet / `pending` / `approved` / `rejected`), and a primary CTA (`Submit` if not yet submitted, `Submitted` disabled state otherwise). Tapping the Submit CTA opens the capture flow scoped to that group. Multi-group friendly from day one; single-group users see one card.
- **D-16: Admin review queue is per-group, inside group-detail.** Not a tab. From `app/(app)/groups/[id]/index.tsx`, an admin-only entry "Pending review (N)" routes to `app/(app)/groups/[id]/review.tsx` (the swipe queue). Keeps admin function adjacent to the group it concerns; no cross-group review surface needed at MVP.

### RPCs (D-17..D-19)
- **D-17: New SECURITY DEFINER RPCs (Phase 3 migration `0006_phase3_capture_review.sql`):**
  - `submit_today(group_id uuid, media_path text, media_type text, caption text) returns uuid` — derives `local_date`, validates `media_type = group.submission_type`, validates membership, inserts `submissions` row. Returns the new submission id. Typed errors: `not_member`, `wrong_media_type`, `already_submitted_today`.
  - `review_submission(submission_id uuid, decision text /* approved|rejected */, rejection_reason text) returns void` — validates admin of submission's group, validates current status = `pending`, applies status + `reviewed_by = auth.uid()` + `reviewed_at = now()`. The 0003 admin-immutable trigger continues to enforce `reviewed_by = auth.uid()` defensively.
  - `get_pending_review_count(group_id uuid) returns int` — admin-only count for the "Pending review (N)" badge on group-detail.
- **D-18: Direct table INSERTs on `submissions` from the client are removed** — write path is RPC-only. The `submissions_insert_self_in_group` policy from 0001 stays restrictive (kept for defense-in-depth, but the RPC is the only path the client uses). Mirrors P2's "all writes via RPC" pattern (D-11 in 02-CONTEXT.md).
- **D-19: Storage path convention for submissions = `{group_id}/{user_id}/{client_uuid}.{ext}`,** NOT the schema's research-doc suggestion of `{group_id}/{user_id}/{local_date}.{ext}`. Reason: client doesn't know the server's `local_date` at upload time (D-06). The existing `storage.objects` RLS policies on the `submissions` bucket (`(storage.foldername(name))[1]` = group_id, `[2]` = user_id) are unaffected — they only check the first two segments. The third segment is opaque.

### Claude's Discretion
- Exact copy for status pill text ("Submitted — pending review", "Approved", "Today didn't count — see admin's note", etc.) — write during planning/implementation; tone friendly but direct.
- Empty-state for the Today screen when the user is in zero groups — "Create or join a group to get started" with CTAs to the existing P2 routes.
- Visual treatment of the swipe queue (card stack depth, swipe threshold, rubber-band animation) — pick a workable RN gesture library (`react-native-gesture-handler` is already a peer of `expo-router`); keep it boring.
- Whether the offline-queue badge on the Today card is its own component or reuses an existing primitive — pick during planning.
- Camera permission denial UX — gentle re-prompt with "Open Settings" deep link; standard pattern.
- Whether to autoplay video previews on the admin queue — default ON (muted, looping); revisit if it kills battery in testing.
- Exact wording of typed RPC errors → user-facing toasts.
- Whether to write a one-time onboarding tooltip on the Today tab the first time a member opens it — Claude's discretion; keep cheap.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level
- `.planning/PROJECT.md` — vision, constraints, out-of-scope (no camera-roll for submissions; in-moment capture only)
- `.planning/REQUIREMENTS.md` — SUB-01..06, ADM-01..04, PLAT-03 are the P3 targets. **Note: ADM-04 needs rewording per D-12** (see Open Items)
- `.planning/ROADMAP.md` §"Phase 3: Capture & Admin Review" — goal + success criteria (binding, except SC#5 which depends on ADM-04 rescoping)
- `.planning/STATE.md` — open question on photo-vs-video resolved here (D-01 + D-02); TUS validation flag still active for research-phase

### Stack & Architecture
- `.planning/research/STACK.md` — Expo SDK 55, supabase-js 2.58, `expo-camera`, `base64-arraybuffer`, `expo-video` (NOT `expo-av` — removed in SDK 55)
- `.planning/research/ARCHITECTURE.md` §"Data Model (Postgres)" — `submissions` table shape (already shipped in P1)
- `.planning/research/ARCHITECTURE.md` §"Supabase Storage" — `submissions` bucket private + path-encoded RLS
- `.planning/research/ARCHITECTURE.md` §"RLS Policies" — `submissions` policy matrix; `storage.objects` policies already shipped in P1
- `.planning/research/ARCHITECTURE.md` §"Data Flow: Submit today's proof" — the canonical happy-path flow this phase implements
- `.planning/research/ARCHITECTURE.md` §"Anti-Patterns" — esp. #1 (no business logic in edge functions when triggers/RPCs suffice), #4 (channel per active group, not global), #5 (no public bucket security through obscurity)
- `.planning/research/PITFALLS.md` §1 — server-derived `local_date`, never client-computed
- `.planning/research/PITFALLS.md` §2 — UNIQUE constraint already shipped; no client-side "check then insert"
- `.planning/research/PITFALLS.md` §4 — TUS resumable + two-phase commit + offline queue + explicit progress UI
- `.planning/research/PITFALLS.md` §6 — admin-bottleneck: optimistic pending UI from day one + swipe-review UX
- `.planning/research/PITFALLS.md` §8 — storage RLS must match table RLS (already enforced in P1)
- `.planning/research/PITFALLS.md` §10 — physical-device + airplane-mode + Slow-3G testing during P3 UAT
- `.planning/research/PITFALLS.md` §11 — Realtime channel cleanup on Today screen blur
- `.planning/research/PITFALLS.md` §12 — JWT refresh during long video uploads

### Phase 1 / Phase 2 Foundation Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-01 (full schema upfront, including `submissions`), D-02 (counter trigger STUBS — bodies land in P4/P5, NOT P3), D-03 (`submissions` storage bucket with path-encoded RLS)
- `.planning/phases/01-foundation/01-UI-SPEC.md` — UI primitives Phase 3 reuses
- `.planning/phases/02-groups-invites/02-CONTEXT.md` — D-11 ("All write paths via SECURITY DEFINER RPCs" — P3 follows this), D-12 (no tab bar in P2 — P3 introduces them per D-14 here)
- `.planning/phases/02-groups-invites/02-PATTERNS.md` — file-organization patterns established through P2

### Migrations (Schema Reality)
- `supabase/migrations/0001_foundation.sql` §`submissions` — table shape, indexes, RLS policies (lines 232–276)
- `supabase/migrations/0001_foundation.sql` §`storage.objects` policies for `submissions` bucket (lines 442–472)
- `supabase/migrations/0001_foundation.sql` §`handle_submission_approval` trigger STUB (lines 367–384) — body lands in P4, but the trigger fires on `status → approved` already
- `supabase/migrations/0002_phase1_review_fixes.sql` — owner-immutable trigger
- `supabase/migrations/0003_phase1_review_fixes_2.sql` — admin-review immutable column allowlist; `reviewed_by = auth.uid()` enforcement (lines 23–94). **D-17's `review_submission` RPC must produce UPDATEs that satisfy this trigger.**
- `supabase/migrations/0006_phase3_capture_review.sql` (new, this phase) — `submit_today`, `review_submission`, `get_pending_review_count` RPCs; any allowlist tweaks to the owner-immutable trigger needed for the rejected→terminal semantics (D-12 means owner branch can stay locked — no resubmit transition needed)

### External Docs
- Supabase Storage TUS / resumable uploads — official docs + `react-native-resumable-upload-supabase` reference (MUST be re-validated against supabase-js 2.58 in research)
- Supabase Storage `createSignedUrl` — short-lived URLs for media playback in admin queue + Today card (60s TTL)
- Supabase Realtime `postgres_changes` — channel-per-group filter pattern for the rejection ping
- `expo-camera` SDK 55 docs — capture API, video recording with `maxDuration`, permission handling
- `expo-video` SDK 55 docs — playback for the admin review queue (video player component, autoplay+mute config)
- `expo-image-manipulator` (already installed for avatars) — photo resize/compress before TUS upload
- `react-native-gesture-handler` — swipe gestures for the admin queue (peer of `expo-router`, already in tree)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ScreenContainer.tsx`, `ScreenHeader.tsx` — layout shells used by every signed-in screen (Today, group-detail, review queue)
- `src/components/PrimaryButton.tsx` / `SecondaryButton.tsx` / `GhostButton.tsx` / `DestructiveTextButton.tsx` — full button vocabulary
- `src/components/Modal.tsx` — Today's reject-reason input on the swipe queue can reuse this (or a sheet variant)
- `src/components/SegmentedControl.tsx` — not directly needed in P3 (submission_type is already locked per group), but available
- `src/components/Avatar.tsx` + `AvatarInitials.tsx` — submitter identity on the admin queue card
- `src/components/TextInput.tsx`, `FormLabel.tsx`, `FormError.tsx` — caption input on capture screen, reject-reason input on admin queue
- `src/lib/supabase.ts` — singleton client; all RPC calls go through `supabase.rpc('...')`
- `src/features/profile/useAvatarUpload.ts` — base64-arraybuffer upload precedent. P3's TUS path is different but reuses the broad shape: pick → manipulate → upload → write DB row.
- `src/features/groups/useGroupsList.ts`, `useGroup.ts`, `useGroupMembers.ts` — TanStack Query hooks the Today screen subscribes to (per-group cards need group metadata + submission_type)
- `src/features/groups/usePendingInviteReplay.ts` — secure-store pattern for cross-screen state (capture intent during permission detour can reuse this shape if needed)

### Established Patterns
- **All write paths go through SECURITY DEFINER RPCs** (P2 D-11). P3 adds `submit_today` + `review_submission` + `get_pending_review_count`.
- **Migrations are SQL files in `supabase/migrations/`,** numbered (`0001_`..`0005_`); P3 adds `0006_phase3_capture_review.sql`. Never edit prior migrations.
- **RLS is the authorization layer**; CI fails the build on any public-schema table without RLS — keep this green for any new helper tables (none expected in P3).
- **Forms use React Hook Form + Zod** (P1 stack research); validation messages surface via `FormError`.
- **TanStack Query for server state**; mutations invalidate keyed by `groupId` / `userId`. Realtime subscriptions patch the cache via `queryClient.setQueryData` (Pitfall #2 — no polling).
- **Theme tokens** in `src/theme/` — never hardcode colors / spacing.
- **Auth detour pattern** — `expo-secure-store` to persist intent across boundaries; the capture flow's permission-grant detour can reuse this if it actually needs persistence.
- **Owner-immutable + admin-immutable column allowlist trigger** (0003) is already in place — P3's `review_submission` RPC must produce UPDATEs that pass the trigger.

### Integration Points
- `app/(app)/_layout.tsx` — currently a Stack. P3 transforms this into a Tabs layout (Today / Groups / Profile).
- `app/(app)/index.tsx` — currently the groups list (per P2 D-12). P3 moves the groups-list logic into `app/(app)/groups/index.tsx` and `index.tsx` becomes the new Today screen. **All deep links and `router.push('/')` calls in the codebase need an audit during planning.**
- `app/(app)/groups/[id]/index.tsx` — P3 adds an admin-only "Pending review (N)" entry that routes to a new `app/(app)/groups/[id]/review.tsx`.
- `app/(app)/profile.tsx` — unchanged structurally; just becomes a tab destination.
- `supabase/migrations/0006_phase3_capture_review.sql` (new) — adds the three RPCs + any pgTAP coverage for them; also write the missing pgTAP for the 0003 admin-immutable trigger flagged in `01-foundation/deferred-items.md`.
- `src/types/database.ts` — regenerate via `pnpm types:gen` after the new migration.
- `app.config.ts` — add `expo-camera` plugin block (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription` for video, Android `RECORD_AUDIO` + `CAMERA` permissions). Verify `infoPlist` and `android.permissions` accordingly.

</code_context>

<specifics>
## Specific Ideas

- The Today screen's per-group card is the canonical "where does the user live in P3" surface. It must always show *something useful* — even at 11:59 PM with no submission yet, the card should tell the user "X minutes until cutoff" so the cutoff feels real (Pitfall #1 lesson: server-side enforcement, but client-side awareness still matters for UX).
- Admin review UX should feel like clearing a notifications tray, not "doing work." The swipe-stack analogy is deliberate: load the next pending card immediately, no loading spinner between decisions, no confirm modals.
- Rejection-as-terminal (D-12) makes admin-side rejection a HIGH-stakes action. Worth a one-time onboarding tooltip on the admin's first review session: "Rejecting means today doesn't count for this member — they can't resubmit." Lowers the chance of impulsive rejects.
- The "upload pending — N MB queued" surface on the Today card should be visually persistent (not a dismissible toast). Pitfall #4: silent failure is the killer; visible state is the cure.
- Realtime channel teardown is the #1 realtime bug (Pitfall #11). Today screen must scope subscription to active groups only and tear down on tab blur.

</specifics>

<deferred>
## Deferred Ideas

- **Push notification for rejection / approval** → Phase 5. P3 ships in-app realtime status only. P5 adds the `notifications_outbox` insert + `push-dispatch` edge function for these events.
- **Counter trigger bodies** (`handle_submission_approval` body that increments points/streak) → Phase 4. The trigger STUB from 0001 keeps firing in P3 (it's a no-op).
- **Daily rollover that actually resets streaks at group-local midnight** → Phase 5 (`pg_cron` + `handle_daily_rollover` body).
- **Group feed of everyone else's approved submissions** → Phase 4. P3's Today screen shows only the user's own status, not others'.
- **Missed-day tombstones** → Phase 4. P3 doesn't render "X missed yesterday" anywhere.
- **Re-engagement notification for broken-streak members** → Phase 6 (Pre-Rollout Hardening, addresses Pitfall #7).
- **Resubmit after rejection (RPC)** → explicitly OUT (D-12 made rejection terminal). If friend-group testing surfaces this as friction, revisit by adding `resubmit_after_rejection` RPC + relaxing the owner-immutable trigger for `rejected → pending` transitions. Estimated 1 day of work to add later.
- **Orphan media cleanup `pg_cron`** → P5 or P6. P3's two-phase commit will leave occasional orphans (RPC fails after storage upload succeeds); acceptable for MVP.
- **Bulk approve / reject** on the admin queue → deferred. Friend-group volume (≤10 members × 1 submission/day) doesn't justify it. Revisit if a group ever has a backlog >20 pending.
- **Admin "undo last" reversibility** on rejection → deferred (option B in the rejection-is-terminal question). If admins frequently mis-reject, add as a single button on the swipe queue.
- **Trim/edit UI for video** → deferred. D-02 locks to single-take, no trim.
- **Camera-roll uploads** → permanently out of scope (PROJECT.md constraint; in-moment capture is the trust signal).
- **Submitting from a notification deep link** → P5/P6 (push routing layer). P3 just opens the app to Today.

## Open Items (require post-phase doc updates)

- **REQUIREMENTS.md ADM-04 rewording** (per D-12): change from "Rejected submissions notify the submitter so they can resubmit before cutoff" to "Rejected submitters are notified that today did not count" (or similar). Update at phase close via `/gsd-extract_learnings` or directly.
- **ROADMAP.md Phase 3 Success Criterion #5 rewording** (same root cause): from "Rejected submitters are notified so they can resubmit before cutoff" to align with the rephrased ADM-04. Update at phase close.

### Reviewed Todos (not folded)
None — `cross_reference_todos` step found no matching todos for Phase 3.

</deferred>

---

*Phase: 03-capture-admin-review*
*Context gathered: 2026-04-28*
