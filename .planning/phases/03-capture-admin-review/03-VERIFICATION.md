---
phase: 03-capture-admin-review
status: passed
verified_at: 2026-05-06
requirements:
  - SUB-01
  - SUB-02
  - SUB-03
  - SUB-04
  - SUB-05
  - SUB-06
  - ADM-01
  - ADM-02
  - ADM-03
  - ADM-04
  - PLAT-03
hard_gates_passed: 4 / 4
soft_deferrals: 2 (CK-3 Slow-3G, CK-4 JWT refresh mid-upload)
rescopes: 2 (CK-7 admin swipe gestures, CK-9 reduce-motion gesture animations)
verifier: chris (UAT operator) + Claude (executor closing the gate)
---

# Phase 3: Capture & Admin Review — Verification Report

**Phase Goal:** The core accountability loop works — members submit daily proof, admin verifies, one submission per local day is enforced server-side.
**Verified:** 2026-05-06
**Status:** PASSED
**Source plans:** 03-01 (infra) → 03-02 (migration) → 03-03 (data layer) → 03-04 (primitives) → 03-05 (hooks) → 03-06 (app shell + Today + PendingReviewRow) → 03-07 (capture screen + admin review screen) → 03-08 (this — full verification gate)

## Summary

Phase 3 ships the daily-capture / admin-review core loop end-to-end on iOS dev client. All four hard-gate UAT checkpoints (CK-2 airplane-mode resilience, CK-5 cross-device Realtime cross-fade, CK-6 camera permission deny+grant, CK-10 D-12 terminal-rejection invariant) cleared on physical device. Seven of eleven UAT checkpoints PASSED outright; two were DEFERRED for tooling/priority reasons (CK-3 Slow-3G, CK-4 JWT mid-upload), and two were RESCOPED out of Phase 3 with explicit code changes (CK-7 swipe gestures removed; CK-9 moot after CK-7). Nine inline-fix commits during the walkthrough resolved bugs surfaced by real-device usage without changing the requirements contract. All eleven Phase 3 requirement IDs (SUB-01..06, ADM-01..04, PLAT-03) are validated. Phase ready for close.

## Automated Verification

Captured at the start of Plan 03-08 (Task 1) and re-asserted across every UAT checkpoint that touched code. Suite state below is the locked baseline against which UAT was run; subsequent inline fixes preserved the green state.

| Suite | Result | Notes |
|-------|--------|-------|
| Jest (`pnpm test`) | **240 / 240 tests** in our codebase across 40 / 41 suites green | The single non-passing suite is the pre-existing `design_refs/` vitest-import noise tracked in `01-foundation/deferred-items.md`. Not a P3 regression. |
| pgTAP (`supabase test db`) | **107 / 107 assertions** in 17 / 17 files | Runs against migration `20260429173246_phase3_capture_review` + `0007` realtime publication on the live remote. Includes 4 new P3 test files: `submit_today.sql`, `review_submission.sql`, `get_pending_review_count.sql`, `get_pending_review_queue.sql`, plus the `submissions_admin_immutable.sql` 0003-trigger backfill. |
| TypeScript (`pnpm typecheck`) | **0 errors outside `design_refs/`** | The 188 errors inside `design_refs/` are pre-existing tooling-config noise (Lovable web-stack imports — `lucide-react`, `react-router-dom`, `vitest`, etc.) tracked in `01-foundation/deferred-items.md`. |
| Expo Doctor (`npx expo-doctor`) | **17 / 18 checks** | The single failing check is the pre-existing `expo` patch-level mismatch from Plan 03-01 — tracked in `01-foundation/deferred-items.md`, not a P3 regression. |

## Manual UAT Verification

Eleven-checkpoint walkthrough on iOS physical device (iPhone with dev client built post-Plan 03-07). Receipts in `03-UAT.md`; verbatim outcomes here.

| # | Checkpoint | Requirement coverage | Status | Receipt commit |
|---|------------|----------------------|--------|----------------|
| 1 | 10s video capture on physical device | SUB-02 | **PASS** | `5b4e832` |
| 2 | Airplane-mode upload resilience **(HARD GATE)** | SUB-03 | **PASS** | `1f10f33` |
| 3 | Slow-3G upload progress (soft) | SUB-03 supplementary | DEFERRED — Network Link Conditioner not configured; failure mode (silent-success upload) already covered by CK-2 airplane-mode flow. Roll into Phase 3.1 only on real-world bug report. | `fe46e0a` |
| 4 | JWT refresh during long upload (soft) | SUB-03 robustness | DEFERRED — depends on CK-3 setup + device-clock manipulation; supabase-js auto-refresh is the canonical path and has been validated by upstream extensively. Roll into Phase 3.1 only on real-world session-expiry report. | `e84dfa1` |
| 5 | Cross-device Realtime cross-fade **(HARD GATE)** | SUB-04, ADM-04 | **PASS** | `4e1e1fd` |
| 6 | Camera permission deny + Settings deep-link **(HARD GATE)** | SUB-01, SUB-02 | **PASS** | `958c59a` |
| 7 | Tinder-stack swipe gestures | ADM-02, ADM-03 | **RESCOPED** — swipe removed from Phase 3 scope; Approve/Reject buttons are the only commit path. Code change in `bae505a` (rip out `GestureDetector` + `Gesture.Pan()` + Reanimated SharedValues + `topRef` worklet-stale-closure mitigation). SwipeCard component preserved as visual stack with no gesture wrapper. | `bae505a` |
| 8 | Discard-take modal during recording | SUB-02 | **PASS** | `aeeaa76` |
| 9 | Reduce-Motion gesture animations | a11y (UI-SPEC line 1070) | **RESCOPED** — moot after CK-7 swipe removal; the gesture-driven animations the checkpoint tested no longer exist. Approve/Reject buttons commit instantly with no animation regardless of OS setting; StatusPill cross-fade goes through Realtime → React re-render with no explicit animation timeline. | `fb77294` |
| 10 | Terminal-rejection invariant (D-12) **(HARD GATE)** | ADM-04, SUB-05 | **PASS** | `013e3d5` |
| 11 | Full E2E loop (sign up → join → submit → review → approve cross-device) | All P3 IDs | **PASS** | `916b3f2` |

**Walkthrough totals:** 11 / 11 receipts filled · 7 PASS · 2 DEFERRED · 2 RESCOPED · 0 FAIL · 4 / 4 hard gates cleared.

## Requirements Traceability

Every Phase 3 requirement traces to at least one automated test AND/OR one UAT checkpoint with a PASS receipt or accepted rescope.

| Req | Description | Evidence | Status |
|-----|-------------|----------|--------|
| **SUB-01** | Member can capture and submit a photo before group's local-midnight cutoff | Source: `app/(app)/capture/[groupId].tsx` capture state machine (Plan 03-07). Server: `submit_today` RPC (`supabase/migrations/20260429173246_phase3_capture_review.sql` + pgTAP `supabase/tests/submit_today.sql`). UAT: CK-6 (permission gate) + CK-11 (E2E sign-up→submit→approve). | ✅ PASS |
| **SUB-02** | Member can capture and submit a short video before cutoff | Source: same capture screen with video state branch + `useVideoPlayer` review-state preview. Server: `submit_today` RPC. UAT: CK-1 (10s record on physical device — PASS) + CK-8 (discard-take modal — PASS). | ✅ PASS |
| **SUB-03** | Upload is resilient to flaky networks (resumable + offline queue + retry) | Source: `src/features/submissions/uploadQueueManager.ts` (Plan 03-03) + `src/features/submissions/submitMedia.ts` two-phase commit + `useSubmitToday` enqueue-on-network-error path (Plan 03-05). Test: `tests/submissions/uploadQueueManager.test.ts` covers per-entry corruption isolation per REVIEWS C4. UAT: **CK-2 airplane-mode HARD GATE PASS** (`1f10f33`). CK-3 + CK-4 deferred for tooling — see deferrals below. | ✅ PASS |
| **SUB-04** | Member sees own submission status (pending / approved / rejected) | Source: `useTodaySubmission` + `useTodaySubmissionRealtime` (Plan 03-05). Visual: `StatusPill` 4-state primitive (Plan 03-04) + `GroupCard` (Plan 03-04) on Today screen (Plan 03-06). Test: `tests/submissions/useTodaySubmissionRealtime.test.tsx` covers Realtime client-side date-narrowing per REVIEWS C1. UAT: **CK-5 cross-device Realtime HARD GATE PASS** (`4e1e1fd`) + CK-10 cross-fade to `Today didn't count`. | ✅ PASS |
| **SUB-05** | Member is blocked from submitting twice on the same local day | Server: `UNIQUE(group_id, user_id, local_date)` constraint on `public.submissions` (P1 migration `0001`) + `submit_today` RPC raising `already_submitted_today` typed error. Test: `supabase/tests/submit_today.sql` exercises both happy path + duplicate-rejection assertion. UAT: CK-10 (terminal-reject → re-submit attempt blocked with `already_submitted_today` typed error) + CK-11 implicit (each member submits exactly once before approval). | ✅ PASS |
| **SUB-06** | Member can optionally add a short caption (≤ 140 chars) | Source: `ReviewPanel` primitive (Plan 03-04) wires the `TextInput` + char counter. Schema: `captionSchema` in `src/features/submissions/schemas.ts` (Plan 03-03) — empty-string transforms to `null`. Server: `submit_today` accepts caption param, validates 140-char ceiling. Test: `tests/submissions/schemas.test.ts`. UAT: CK-1 caption `UAT video test` accepted; CK-11 captions accepted on both submissions. | ✅ PASS |
| **ADM-01** | Admin sees queue of pending submissions for groups they admin | Source: `app/(app)/groups/[id]/review.tsx` (Plan 03-07) + `useReviewQueue` hook (Plan 03-05) calling `get_pending_review_queue` SECURITY DEFINER RPC (Plan 03-02). UI gate: `PendingReviewRow` admin-only on group detail screen (Plan 03-06) — `useGroup(id).data.admin_user_id === user.id` check. Test: `tests/submissions/useReviewQueue.test.tsx` + `supabase/tests/get_pending_review_queue.sql`. UAT: CK-11 step 9 — admin sees `Pending review (1)` row, member never sees it. | ✅ PASS |
| **ADM-02** | Admin can approve a submission | Source: `app/(app)/groups/[id]/review.tsx` Approve button (post-CK-7 rescope). Hook: `useReviewSubmission` calling `review_submission(decision='approved')` RPC. Server: `supabase/migrations/20260429173246_phase3_capture_review.sql` + `supabase/tests/review_submission.sql` covers happy path + Pitfall 9 race guard (`SELECT FOR UPDATE` + post-update `not_pending` raise). Test: `tests/submissions/useReviewSubmission.test.tsx`. UAT: CK-5 + CK-11 step 10 (approve → cross-fade to Approved on member device). | ✅ PASS |
| **ADM-03** | Admin can reject a submission with optional short reason | Source: same review screen — Reject button opens reject-reason panel (140-char `rejectReasonSchema`) → calls `review_submission(decision='rejected', rejection_reason=...)`. Server + tests same as ADM-02. UAT: CK-10 (admin types `UAT terminal-reject test`, submits, member sees `Today didn't count` + tappable reason modal). | ✅ PASS |
| **ADM-04** | Rejected submitters are notified that today did not count (rejection is terminal — no resubmit per D-12) | Source: `useTodaySubmissionRealtime` patches submitter's cache on review event → `StatusPill` cross-fades to `Today didn't count` rejected variant (`src/components/StatusPill.tsx` 4-state primitive). REQUIREMENTS.md ADM-04 + ROADMAP.md SC#5 reworded to terminal-rejection language earlier in this plan (`469ae96`). UAT: CK-10 HARD GATE PASS (`013e3d5`). Phase 5 `pg_cron` owns the new-day unblock side. | ✅ PASS |
| **PLAT-03** | Group admin can only approve/reject submissions for groups they admin | Three-layer defense: (1) **RLS** — `submissions` table policies in `0001_foundation.sql`; (2) **RPC** — `review_submission` SECURITY DEFINER + `is_group_admin(p_group_id)` precheck (Plan 03-02); (3) **Trigger** — `submissions_admin_immutable` (Plan 03-02 backfill) prevents non-admins from `UPDATE`-ing reviewed rows directly. UI gate: `PendingReviewRow` admin-only render on group detail (Plan 03-06). Test: `supabase/tests/submissions_admin_immutable.sql` (9 distinct seed rows, one per assertion) + `supabase/tests/review_submission.sql` cross-group test (admin of group A cannot review submissions of group B). UAT: CK-11 step 9 (member-device PendingReviewRow zero-visibility) + entire admin flow gated through admin gate at screen entry. | ✅ PASS |

## Inline UAT Fixes

These were 1-line / focused fixes applied during the walkthrough to unblock specific checkpoints. None changed the Phase 3 requirements contract. Listed in chronological order.

| Commit | Symptom | Root cause | File(s) | Fix | Receipt |
|--------|---------|-----------|---------|-----|---------|
| `298fe64` | Capture screen crash on open | Tabs.Screen rejects Stack.Screen modal options at runtime (`sceneStyleInterpolator`) | `app/(app)/capture/[groupId].tsx` | Removed Stack.Screen modal opts in Tabs context (modal-presentation deferred to Phase 3.1) | Pre-CK-1 unblocker |
| `dcb12d4` | iOS build failed under Xcode 15 (User Script Sandboxing) | Pods + sandbox interaction | iOS build config + `expo-build-properties` plugin tuple | Custom plugin to disable User Script Sandboxing persistently | Pre-CK-1 unblocker |
| `ad544ed` | 5 distinct UAT bugs surfaced during CK-1 (red square outside ring; video preview showed first frame; X-button POP toast; ReviewPanel error banner solid red with invisible text; Submit Video did nothing visible) | Bundle of independent bugs — Shutter geometry, expo-video setup-only-runs-once, Tabs-no-Stack-history, HSL alpha-suffix concat invalid, error banner masked actual error | `src/components/Shutter.tsx`, `app/(app)/capture/[groupId].tsx`, `src/components/ReviewPanel.tsx` | Shrunk inner square 52→44pt; useEffect re-asserts `videoPlayer.loop = true` + `play()` on mediaUri change; `dismissCapture()` helper using `router.canGoBack() ? back() : replace('/(app)/')`; switched HSL alpha from `${token}26` concat to `hsla(4,78%,56%,0.15)` literal | CK-1 PASS after fix |
| `3dab443` | After ad544ed unmasked the real error, submit failed with `uuid_unavailable` | `crypto.randomUUID` not exposed on Hermes SDK 55 (only `getRandomValues` is, via `react-native-get-random-values` polyfill) | `src/features/submissions/useSubmitToday.ts` | `newClientUuid` falls back to RFC4122-v4 byte construction via `getRandomValues` when `randomUUID` is unavailable. REVIEWS.md C4 invariant preserved (still a true RFC4122 v4). | CK-1 PASS |
| `bc86ff2` | Today screen didn't refresh after a successful submit | `useSubmitToday.onSuccess` invalidated 3-element key `['submission', groupId, 'today']` but actual cache key uses `localDate` ISO string. Realtime should have caught it but events between Today→Capture→Today unmount/remount get dropped. | `src/features/submissions/useSubmitToday.ts` | Invalidate the 2-element prefix `['submission', groupId]` so prefix-matching hits every date under that group | CK-1 PASS |
| `f0e125a` | Admin review screen render error: "GestureDetector must be used as a descendant of GestureHandlerRootView" | Plan 03-07 installed `react-native-gesture-handler` but never wrapped the root layout | `app/_layout.tsx` | Wrapped `RootLayout`'s provider tree in `<GestureHandlerRootView style={{ flex: 1 }}>` | CK-5 unblocker |
| `215984b` | (1) `useTodaySubmissionRealtime` channels subscribed but received zero events, breaking ADM-04 + SUB-04 cross-device. (2) SecureStore.getItemAsync threw on first-review tooltip key. | (1) `supabase_realtime` publication did not include `public.submissions` — silently broken since `0001_foundation.sql`. (2) Colons aren't allowed in SecureStore keys (alphanumeric + `.` `-` `_` only). | New migration `<latest>_phase3_realtime_publication`; `app/(app)/groups/[id]/review.tsx` SecureStore key | (1) Idempotent `ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions`. (2) Replaced `tooltip:admin_review:<user.id>` with `tooltip.admin_review.<user.id>` at both call sites. | CK-5 HARD GATE PASS |
| `bae505a` | Swipe gestures unreliable on physical device | Tinder-stack pattern not load-bearing for canonical mobile admin UX | `app/(app)/groups/[id]/review.tsx` | Removed `GestureDetector` + `Gesture.Pan()` + Reanimated SharedValues + `topRef` worklet-stale-closure mitigation + `SCREEN_W`/`SWIPE_THRESHOLD`/`VELOCITY_THRESHOLD` constants. SwipeCard preserved as visual stack with no gesture wrapper. ADM-02/03 RPCs still exercised via Approve/Reject buttons. | CK-7 RESCOPE; 240/240 still pass |
| `d3260a8` | StatusPill rejected state rendered solid red with invisible text/icon | Same `${destructive_hsl_token}26` HSL alpha-suffix bug as the ReviewPanel error banner | `src/components/StatusPill.tsx` | Replaced with `hsla(4,78%,56%,0.15)` literal bg; text + icon stay destructive-HSL and are now legible | CK-10 HARD GATE PASS |

## Threat-Model Validation

Each P3 plan's `<threat_model>` STRIDE entries are mitigated and validated by either pgTAP or hook-level tests:

| Threat / Pitfall | Mitigation | Validating evidence |
|------------------|-----------|---------------------|
| Pitfall 1 (server-derived `local_date`) | `submit_today` derives `(now() AT TIME ZONE groups.timezone)::date` server-side; clients never compute date | `supabase/tests/submit_today.sql` server-derived assertion |
| Pitfall 4 (queue corruption isolation) | Per-entry `safeParse` + drop-and-log per REVIEWS.md C4 | `tests/submissions/uploadQueueManager.test.ts` malformed-entry drop test |
| Pitfall 9 (concurrent admin race) | `SELECT FOR UPDATE` row lock + post-`UPDATE` `not_pending` raise | `supabase/tests/review_submission.sql` `not_pending` test |
| Pitfall 11 (Realtime channel leak) | `useFocusEffect` lifecycle (NOT `useEffect`) — Tab navigation does not unmount the screen, so a `useEffect` cleanup leaks the channel forever | `tests/submissions/useTodaySubmissionRealtime.test.tsx` `removeChannel` on-unmount assertion |
| PLAT-03 three-layer defense | RLS + SECURITY DEFINER RPC `is_group_admin` precheck + `0003_admin_immutable` trigger | `supabase/tests/submissions_admin_immutable.sql` (9 distinct rows) + `supabase/tests/review_submission.sql` cross-group test + UAT CK-11 PendingReviewRow visibility |
| Threat 7 (cross-group review) | Server looks up `group_id` from DB (NOT from client input) before `is_group_admin` check | `supabase/tests/review_submission.sql` cross-group injection test |
| Threat 8 (Realtime payload leak) | Channel filter is `user_id=eq.{userId}` server-side AND client-side `local_date != today` rejection | `tests/submissions/useTodaySubmissionRealtime.test.tsx` cross-user / cross-date isolation tests |
| D-12 terminal-rejection invariant | `submit_today` raises `already_submitted_today` even after a rejection (no resubmit until next group-local midnight) | `supabase/tests/submit_today.sql` post-rejection submit-attempt assertion + UAT CK-10 HARD GATE PASS |

## Live Remote Schema State

Migrations applied to the live remote (verified during the walkthrough via the Supabase MCP `list_migrations`):

| Migration | Phase | Applied via |
|-----------|-------|-------------|
| `0001_foundation` | P1 | CLI `supabase db push` |
| `0002_storage_policies` | P1 | CLI |
| `0003_submissions_admin_immutable` | P1 | CLI |
| `0004_phase2_groups_invites` | P2 | CLI |
| `0005_profiles_select_co_member` | P2 | CLI (UAT bug #4 fix) |
| `20260429173246_phase3_capture_review` | P3 | MCP `apply_migration` (CLI `db push` ran from main checkout where the worktree-only file did not exist; recovered by applying the same SQL via MCP) |
| `<latest>_phase3_realtime_publication` | P3 | MCP `apply_migration` during CK-5 (publication did not include `public.submissions` — silently broken since `0001`; idempotent fix) |

Schema state is consistent with `src/types/database.ts` (regenerated post-`0006`) and with all 17 pgTAP files passing.

## Phase 3.1 Follow-Up Items

Not regressions — explicitly logged scope deferrals for the next planner.

1. **Modal-presentation for capture flow** — capture/[groupId] currently lives under Tabs (no Stack.Screen modal options can attach). Restore slide-from-bottom + gesture-disabled behavior by moving the route under a nested Stack layout. (Original Plan 03-07 intent.)
2. **Realtime subscription life-cycle hardening** — events between tab unmount/remount can drop. Currently mitigated by aggressive `invalidateQueries` on mutations. Phase 3.1 may reintroduce a presence-aware re-fetch on focus.
3. **Swipe-stack ergonomics for admin review** — explicitly removed in CK-7 rescope. Reintroduce only if real-world admin feedback requests it.
4. **Reduce-Motion accessibility coverage** — currently zero animation surface area on the review screen, so nothing to test. Reintroduce alongside any future swipe reintroduction.
5. **Slow-3G + JWT-mid-upload validation (CK-3 + CK-4)** — deferred for Phase 3.1 only if real-world bug reports surface silent-progress on flaky cellular or session-expiry mid-upload.

## Verdict

**PASSED — phase ready for close.**

All four hard gates cleared. Two soft deferrals + two rescopes documented for Phase 3.1. Eleven Phase 3 requirement IDs validated through automated suite (240 Jest + 107 pgTAP) and / or manual UAT receipts. Inline-fix log captures nine commits applied during the walkthrough; all preserve the requirements contract. Live remote schema state is consistent with generated types and pgTAP. No blockers remain.

---

*Verified: 2026-05-06*
*Verifier: chris (UAT operator) + Claude (executor closing the gate)*
