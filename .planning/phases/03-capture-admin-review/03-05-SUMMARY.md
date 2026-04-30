---
phase: 03-capture-admin-review
plan: 05
subsystem: client
tags: [client, hooks, tanstack-query, realtime, supabase, submissions-domain]

# Dependency graph
requires:
  - phase: 03-capture-admin-review
    provides: "Plan 03-03 — submitMedia two-phase commit pipeline, uploadQueueManager (enqueue/dequeue/readQueue/flushQueue), submitTodaySchema/reviewSubmissionSchema (Zod), todayLocalDate (IANA-aware date helper)"
  - phase: 03-capture-admin-review
    provides: "Plan 03-02 — 4 SECURITY DEFINER RPCs (submit_today, review_submission, get_pending_review_count, get_pending_review_queue) typed in src/types/database.ts"
  - phase: 02-groups-invites
    provides: "useGroup / useGroupMembers / useTransferAdmin canonical TanStack Query patterns + supabase singleton + AuthProvider session context"
  - phase: 01-foundation
    provides: "QueryClient bootstrap, ThemeProvider, supabase singleton, jest test harness"
provides:
  - "useTodaySubmission read hook with date-aware query key (PER REVIEWS C1) — caches per local-date so app stays open across midnight without stale 'today' status"
  - "usePendingReviewCount read hook calling get_pending_review_count RPC (15s staleTime; trusts server-side D-17 0-leak invariant for non-admins)"
  - "useReviewQueue read hook calling get_pending_review_queue admin RPC (PER REVIEWS C3 — server-side admin gate replaces direct table SELECT, eliminating leak surface)"
  - "useUploadQueue derived-from-storage hook — Map<groupId, {sizeLabel, count}> aggregation with best-effort SDK 55 File.size lookup"
  - "useSubmitToday mutation wrapping submitMedia with offline queue fallback — typed errors propagate; network errors enqueue + throw 'queued' marker; PER REVIEWS C4 newClientUuid throws 'uuid_unavailable' instead of writing a non-RFC4122 fallback string"
  - "useReviewSubmission mutation calling review_submission RPC; invalidates reviewQueue + pendingReviewCount on success; intentionally does NOT invalidate the submitter's submission cache (Realtime owns it cross-device per ADM-04 + D-13)"
  - "useTodaySubmissionRealtime side-effect hook subscribing to postgres_changes filtered server-side on user_id=eq.{userId}; useFocusEffect lifecycle (NOT useEffect — Pitfall 11); PER REVIEWS C1 client-side date-narrowing rejects yesterday/tomorrow events before patching cache"
  - "Per-test channel-chain mock pattern (jest.spyOn supabase.channel + supabase.removeChannel + captured handler) — canonical Realtime testing approach for Phase 4+"
affects: [03-06, 03-07]

# Tech tracking
tech-stack:
  added: []  # No new deps — hooks consume modules already wired in Plan 03-01.
  patterns:
    - "Date-aware query key: ['submission', groupId, localDateString] (NOT the literal 'today'). Pairs with the Realtime handler so cache rotates automatically when local-date changes."
    - "Server-side admin gate via SECURITY DEFINER RPC: useReviewQueue calls get_pending_review_queue rather than .from('submissions').select() — eliminates the leak surface that previously required RLS-only defense."
    - "Two-phase mutation error contract: typed errors (token list) propagate unchanged for screen branching; network errors enqueue + throw Error('queued') marker for screen dismiss; uuid_unavailable typed error from missing platform crypto.randomUUID is also surfaced rather than fallback-stringed."
    - "Realtime hook lifecycle: useFocusEffect from expo-router (NOT useEffect from react). Tab navigation does not unmount the screen, so a useEffect cleanup leaks the channel forever (Pitfall 11). Verified by removeChannel-on-unmount test."
    - "Realtime client-side narrowing: server-side filter is single-column equality only (user_id=eq.{userId}); client narrows further by computing today's local-date for the row's group timezone and rejecting non-today events. Prevents yesterday/admin-reviewing-prior-day events from polluting the today cache."
    - "Per-test channel-chain mock: jest.spyOn(supabase, 'channel').mockImplementation captures the handler closure; tests drive synthetic payloads via the captured handler. Cleanup is via jest.spyOn(supabase, 'removeChannel') + assertion on unmount."
    - "expo-router test mock: synchronous useFocusEffect via React.useEffect bypasses @react-navigation/native transitive load (which needs the full RN runtime that other tests mock to bare AppState)."

key-files:
  created:
    - src/features/submissions/useTodaySubmission.ts
    - src/features/submissions/useSubmitToday.ts
    - src/features/submissions/useReviewQueue.ts
    - src/features/submissions/useReviewSubmission.ts
    - src/features/submissions/usePendingReviewCount.ts
    - src/features/submissions/useUploadQueue.ts
    - src/features/submissions/useTodaySubmissionRealtime.ts
    - tests/submissions/useTodaySubmission.test.tsx
    - tests/submissions/useSubmitToday.test.tsx
    - tests/submissions/useReviewQueue.test.tsx
    - tests/submissions/useReviewSubmission.test.tsx
    - tests/submissions/useTodaySubmissionRealtime.test.tsx
    - .planning/phases/03-capture-admin-review/03-05-SUMMARY.md
  modified: []

key-decisions:
  - "Realtime cache key is date-aware ['submission', groupId, localDate]. Both useTodaySubmission and useTodaySubmissionRealtime use the SAME date-aware shape. The Realtime handler rejects events whose local_date != today (computed on the fly for the row's group tz) BEFORE patching, so a late upload for yesterday or an admin reviewing a previous day never overwrites the today status."
  - "useReviewSubmission does NOT invalidate the submitter's ['submission', ...] cache. The submitter's Today screen receives the UPDATE event via Realtime (cross-device flow). A test invariant locks this contract — invalidating client-side here would race with Realtime on the SAME device and could double-render the StatusPill."
  - "newClientUuid uses globalThis.crypto.randomUUID ONLY — no `${Date.now()}-${Math.random()...}` fallback. If randomUUID is unavailable, throws Error('uuid_unavailable') as a typed error that bypasses the queue-fallback path. Production has react-native-get-random-values polyfill (loaded as first import in src/lib/supabase.ts); tests have jest.setup.ts deterministic-counter stub. The fail-hard prevents the corruption cascade where a non-RFC4122 string would have failed Zod's queueEntrySchema and dropped the entire queue."
  - "Network-error heuristic regex: /network|fetch|timeout|abort|^[5]\\d\\d /i. Typed-error allowlist is checked FIRST so any of the 7 known typed messages (not_member, wrong_media_type, invalid_media_type, already_submitted_today, caption_too_long, not_authenticated, uuid_unavailable) propagate UNCHANGED; only unrecognized errors that match the regex (or have empty message) trigger enqueue. Worst case (a typed error we forgot in the allowlist) leads to the error being re-thrown for the screen to handle generically — the entry is NOT enqueued. Defensive default."
  - "useReviewQueue calls get_pending_review_queue (PER REVIEWS C3 — admin-gate moved server-side via SECURITY DEFINER RPC). Replaces the previous design (direct .from('submissions').select). RLS is still in place underneath; this is defense-in-depth (server-RPC > client-screen-guard > RLS). The hook's error path propagates 'not_admin' so a route guard or error boundary can redirect."
  - "useUploadQueue's File-size lookup is best-effort: SDK 55 File class is documented to expose `.size` synchronously, but if it rejects or returns undefined, the entry's bytes default to 0. The Map's count is always correct; sizeLabel can show '0 B' (count: N) when File.size is unavailable. Plan 03-06 will validate this on real device."
  - "Cache invalidation contract for useUploadQueue: enqueue/dequeue/flush callers in uploadQueueManager.ts MUST invalidate ['uploadQueue'] after mutations — the hook doesn't subscribe to AsyncStorage changes (no native event for that). Plan 03-06 needs to wire either (a) inject a qc.invalidateQueries callback into startQueueManager, OR (b) emit events via a tiny EventEmitter that useUploadQueue listens to."

patterns-established:
  - "Realtime channel mock pattern: capture handler via jest.spyOn(supabase, 'channel').mockImplementation, drive synthetic payloads in-memory, assert removeChannel on unmount. Reusable for any postgres_changes hook."
  - "expo-router useFocusEffect test mock: React.useEffect-based shim bypasses @react-navigation/native transitive load. Required when the test file mocks react-native to bare AppState (which the supabase singleton needs)."
  - "Server-side gate via SECURITY DEFINER RPC pattern: when a list/read needs admin-only access, the RPC enforces is_group_admin(group_id) server-side and raises 'not_admin' for non-admins; the hook propagates as Error.message; the route guard / error boundary handles redirect. Defense-in-depth alongside RLS."
  - "Date-aware TanStack key with paired Realtime handler: both useX(args, dateString) and useXRealtime(...) use the SAME ['x', ...args, dateString] key shape so cross-day rotation Just Works with no manual invalidation."

requirements-completed: [SUB-03, SUB-04, ADM-01, ADM-02, ADM-03, ADM-04]

# Metrics
duration: ~40min
completed: 2026-04-30
---

# Phase 03 Plan 05: Submissions Hooks Summary

**Seven submissions-domain React hooks shipped (3 reads + 2 mutations + 1 derived-from-storage + 1 Realtime side-effect) with five focused Jest test suites covering data shape, typed-error contracts, REVIEWS C1 cross-day cache pollution, REVIEWS C3 admin-gate RPC, REVIEWS C4 uuid fail-hard, and Realtime channel lifecycle — bringing the project test count from 201 → 231 passing.**

## Performance

- **Duration:** ~40 min (Tasks 1-4 + verification + summary)
- **Started:** 2026-04-30T~13:00:00Z
- **Completed:** 2026-04-30T~13:40:00Z
- **Tasks:** 4 of 4 executed (autonomous; no checkpoints)
- **Files created:** 13 (7 hooks + 5 tests + this SUMMARY)
- **Files modified:** 0
- **Tests:** baseline 201 → final 231 (+30 across 5 new submission-hook suites; the 1 pre-existing `design_refs/` vitest suite still failing — out of scope, tracked in Plan 03-01 deferred-items)

## Accomplishments

- All 7 hooks implemented per `<interfaces>` contract: 3 TanStack reads (useTodaySubmission, usePendingReviewCount, useReviewQueue), 2 mutations (useSubmitToday, useReviewSubmission), 1 derived-from-storage hook (useUploadQueue), 1 side-effect Realtime subscription (useTodaySubmissionRealtime).
- REVIEWS C1 (cross-day cache pollution) fully closed: useTodaySubmission's query key includes the local-date string; useTodaySubmissionRealtime's handler rejects events whose `local_date !== today` BEFORE patching cache. Two narrowing tests (yesterday + tomorrow) plus an unknown-group test prove the gate.
- REVIEWS C3 (admin-queue leak) fully closed: useReviewQueue calls `get_pending_review_queue` SECURITY DEFINER RPC, NOT a direct table SELECT. A test asserts `supabase.from` was NOT called with 'submissions'; another asserts `not_admin` propagates as `Error.message`.
- REVIEWS C4 (UUID corruption cascade) fully closed: `newClientUuid` fail-hards with typed `Error('uuid_unavailable')` if `crypto.randomUUID` is unavailable; the test deletes the global stub for the duration of one test case and verifies (a) the typed error surfaces, (b) `submitMedia` is NEVER reached, (c) NO entry is enqueued.
- Realtime channel-mock pattern established: `jest.spyOn(supabase, 'channel').mockImplementation` captures the handler closure, tests drive synthetic payloads in-memory, `jest.spyOn(supabase, 'removeChannel')` validates teardown on unmount. Reusable for any future postgres_changes hook (Phase 4 leaderboard, Phase 5 notification subscriptions).

## Task Commits

Each task was committed atomically:

1. **Task 1: 4 read hooks (useTodaySubmission, usePendingReviewCount, useReviewQueue, useUploadQueue)** — `ad82dd8` (feat)
2. **Task 2: 2 mutation hooks (useSubmitToday + useReviewSubmission)** — `21ad4a9` (feat)
3. **Task 3: useTodaySubmissionRealtime channel hook** — `3ed613f` (feat)
4. **Task 4: 5 Jest test suites (28 cases)** — `9b8c55a` (test)

**Plan metadata:** [TBD next commit] (docs: complete plan)

## Files Created/Modified

### Created — Hooks (7)

- `src/features/submissions/useTodaySubmission.ts` — `useQuery` read of submissions for `(groupId, userId, todayLocalDate)`; `.maybeSingle()` because null is the expected "not yet submitted" state. Date-aware query key per REVIEWS C1.
- `src/features/submissions/usePendingReviewCount.ts` — `useQuery` calling `get_pending_review_count` RPC; 15s staleTime; trusts server-side 0-leak for non-admins per D-17.
- `src/features/submissions/useReviewQueue.ts` — `useQuery` calling `get_pending_review_queue` admin SECURITY DEFINER RPC (REVIEWS C3); maps `profile_updated_at` → `updated_at` for the public PendingSubmissionRow shape.
- `src/features/submissions/useUploadQueue.ts` — `useQuery` deriving `Map<groupId, {sizeLabel, count}>` from AsyncStorage queue via `readQueue()`; best-effort SDK 55 `File.size` lookup with 0 fallback.
- `src/features/submissions/useSubmitToday.ts` — `useMutation` wrapping `submitMedia`; typed errors propagate; network errors enqueue + throw `Error('queued')`; REVIEWS C4 newClientUuid fail-hard.
- `src/features/submissions/useReviewSubmission.ts` — `useMutation` calling `review_submission` RPC; invalidates `reviewQueue` + `pendingReviewCount` on success; intentionally does NOT invalidate `['submission', ...]` (Realtime owns it).
- `src/features/submissions/useTodaySubmissionRealtime.ts` — `useFocusEffect` channel subscribe with `user_id=eq.{userId}` filter; client-side date-narrowing via `todayLocalDate(groupTz, new Date())`; cleanup via `supabase.removeChannel`.

### Created — Tests (5)

- `tests/submissions/useTodaySubmission.test.tsx` — 6 cases: disabled-when-undefined (groupId), disabled-when-undefined (date), null-when-no-row, row-shape, date-aware key rotation, supabase error → Error.message.
- `tests/submissions/useSubmitToday.test.tsx` — 6 cases: happy path with deterministic uuid stub assertion, 3 typed errors (already_submitted_today, not_member, caption_too_long) propagate without enqueue, network error → enqueue + 'queued' + uploadQueue invalidation, REVIEWS C4 uuid_unavailable fail-hard with no enqueue.
- `tests/submissions/useReviewQueue.test.tsx` — 5 cases: disabled, REVIEWS C3 calls RPC NOT direct table SELECT, profile_updated_at flatten, null profile fields, not_admin propagation.
- `tests/submissions/useReviewSubmission.test.tsx` — 4 cases: approve happy path with invalidation, reject with reason payload check, not_admin propagation, invariant test that submission cache is NOT invalidated (Realtime owns it).
- `tests/submissions/useTodaySubmissionRealtime.test.tsx` — 9 cases: subscribe-with-filter, no-subscribe-without-userId, INSERT-today patch, UPDATE-today patch (ADM-04 review notification), REVIEWS C1 narrowing × 3 (yesterday/tomorrow/unknown-group), removeChannel-on-unmount, payload.old fallback.

### Modified

None.

## Decisions Made

(See `key-decisions` in frontmatter for the full list with rationale. Highlights:)

- **Date-aware query key for both useTodaySubmission and useTodaySubmissionRealtime.** Pairs the read hook and the Realtime handler under the same key shape so cross-midnight rotation works without manual invalidation.
- **Server-side admin gate via SECURITY DEFINER RPC.** `useReviewQueue` calls `get_pending_review_queue` per REVIEWS C3 — eliminates the leak surface where a deep-link to /groups/[id]/review hit `.from('submissions').select()` before the route guard ran.
- **uuid fail-hard in `newClientUuid`.** No `${Date.now()}-${Math.random()...}` fallback. The previous fallback corrupted the AsyncStorage queue silently (Zod's `.uuid()` check failed → readQueue dropped the entire queue per the original Plan 03-03 behavior). The new typed error surfaces to the screen as an inline error rather than corrupting state.
- **Realtime hook does NOT auto-flush the upload queue.** That trigger lives in `uploadQueueManager.startQueueManager` (AppState + NetInfo wired in Plan 03-03). Adding it here would duplicate the trigger.

## Deviations from Plan

None — plan executed exactly as written. The plan's `<interfaces>` and PATTERNS.md guidance translated 1:1 to working code; the only adaptations were:

- **expo-router test mock added to `useTodaySubmissionRealtime.test.tsx`** (test wiring detail not specified by the plan but implied by jest-expo defaults). The mock provides a synchronous `useFocusEffect` shim via `React.useEffect` so the test does not pull in `@react-navigation/native` (which needs the full RN runtime that we mock to bare `{ AppState }`). This matches the established Phase 2 pattern in `tests/groups/groupDetailScreen.test.tsx` (which mocks `expo-router` for `useRouter` etc.).
- **The `uuid_unavailable` test reassigns `cryptoApi.randomUUID = undefined` rather than `delete`** because Node's webcrypto `randomUUID` is non-configurable on the prototype — `delete` is a no-op. Documented inline in the test.
- **`useReviewSubmission` passes `''` (empty string) for `p_rejection_reason`** when the input is null. The regenerated RPC type from Plan 03-02 declares the arg as non-nullable `string`; sending empty string is the canonical "no reason" signal that the server pgTAP suite (Plan 03-02) accepts.

No Rule-1/2/3 auto-fixes were needed.

## Issues Encountered

- **Initial Realtime test failure: `@react-navigation/native` transitive load.** The first test run failed because `useTodaySubmissionRealtime.ts` imports `useFocusEffect` from `expo-router`, which transitively requires `@react-navigation/native/src/theming/fonts.tsx` calling `Platform.select()` — but the test file mocks `react-native` to bare `{ AppState }` (required by the supabase singleton's AppState listener). Resolution: mock `expo-router` directly with a synchronous shim. Documented as a `patterns-established` entry above.
- **Initial uuid_unavailable test failure: `delete crypto.randomUUID` is a no-op in Node.** Node's webcrypto exposes `randomUUID` non-configurably on the global. The test was deleting and asserting it was gone, but Node's prototype kept providing it. Fixed by assigning `undefined` directly (the production code's `if (!cryptoApi?.randomUUID)` check catches it).
- **Pre-existing `design_refs/` vitest suite still failing** — same suite that fails on every Phase 3 plan run; not a regression of this plan. Tracked in `.planning/phases/03-capture-admin-review/deferred-items.md` (Plan 03-01).
- **Pre-existing supabase AppState listener leaks across tests** — Jest reports "did not exit one second after the test run has completed" because `src/lib/supabase.ts`'s `AppState.addEventListener` is never cleaned up in tests. Plan 01 artifact, affects every test that touches supabase.ts. Out of scope.

## Notes for Plan 03-06

The plan's `<output>` block requested explicit notes for the next plan; capturing them here:

1. **`useFocusEffect` from `expo-router` worked synchronously in the production hook** (jest-expo's default for `react-navigation`'s focus mock). The test file uses an explicit React.useEffect-based shim because we mock `expo-router` to avoid `@react-navigation/native` transitive load — but the production runtime path is unchanged.
2. **The Realtime channel-chain mock pattern is canonical**: see `tests/submissions/useTodaySubmissionRealtime.test.tsx` `setup()` helper. Reuse for any future postgres_changes subscription (Phase 4 leaderboard live-update, Phase 5 push notifications).
3. **Network-error heuristic regex `/network|fetch|timeout|abort|^[5]\d\d /i` does NOT false-positive** on any of the 7 known typed messages (`not_member`, `wrong_media_type`, `invalid_media_type`, `already_submitted_today`, `caption_too_long`, `not_authenticated`, `uuid_unavailable`) — verified by the typed-error tests in `useSubmitToday.test.tsx`. Adding to the typed-error allowlist if Plan 03-02 emits new tokens is a 1-line patch.
4. **Plan 03-06 wiring TODO:** `startQueueManager` (Plan 03-03) needs to be invoked from `app/_layout.tsx` (post-mount). Additionally, `enqueue` / `dequeue` / `flushQueue` callers need a way to invalidate the `['uploadQueue']` TanStack cache so `useUploadQueue` re-derives. Two options:
   - **(a) Inject a callback** into `startQueueManager(getSession, onMutate?)` and have callers fire `onMutate?.()` after each AsyncStorage write.
   - **(b) Tiny EventEmitter** in `uploadQueueManager.ts`; `useUploadQueue` listens via `useEffect` + `qc.invalidateQueries`. More decoupled but adds a dependency.
   Decide in Plan 03-06.
5. **`useUploadQueue` File-size lookup proved reliable in test mocks** (the SDK 55 `File` mock in `jest.setup.ts` returns `arrayBuffer()` but does not expose `.size`; the hook's try/catch swallows that and returns 0). On real device, validate that `.size` is synchronous and exposes the number; if not, fall back to showing only `count` in the QueueBadge label.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 7 hooks are ready for Plan 03-06 (Today screen + group-detail) and Plan 03-07 (capture screen + admin queue).
- The PendingSubmissionRow contract (REVIEWS C5) holds: `useReviewQueue` returns rows whose snake_case shape matches `<SwipeCard {...row} />` exactly (Plan 03-04 contract test).
- The Realtime cross-device path (rejected submission → submitter's device updates without invalidation) is wired and tested. Plan 03-07's review screen calls `useReviewSubmission`; Plan 03-06's Today screen calls `useTodaySubmissionRealtime` once at mount.
- Plan 03-06 wiring TODO (above) is the only remaining loose end.

## Self-Check: PASSED

Verified all claimed artifacts exist on disk:
- `src/features/submissions/useTodaySubmission.ts` — FOUND
- `src/features/submissions/useSubmitToday.ts` — FOUND
- `src/features/submissions/useReviewQueue.ts` — FOUND
- `src/features/submissions/useReviewSubmission.ts` — FOUND
- `src/features/submissions/usePendingReviewCount.ts` — FOUND
- `src/features/submissions/useUploadQueue.ts` — FOUND
- `src/features/submissions/useTodaySubmissionRealtime.ts` — FOUND
- `tests/submissions/useTodaySubmission.test.tsx` — FOUND
- `tests/submissions/useSubmitToday.test.tsx` — FOUND
- `tests/submissions/useReviewQueue.test.tsx` — FOUND
- `tests/submissions/useReviewSubmission.test.tsx` — FOUND
- `tests/submissions/useTodaySubmissionRealtime.test.tsx` — FOUND

Verified all task commits exist in git log:
- `ad82dd8` — FOUND (Task 1: 4 read hooks)
- `21ad4a9` — FOUND (Task 2: 2 mutation hooks)
- `3ed613f` — FOUND (Task 3: Realtime channel hook)
- `9b8c55a` — FOUND (Task 4: 5 test suites)

Verified test outcomes:
- `pnpm jest tests/submissions/` — 9 suites, 91 tests, all passing
- `pnpm jest --forceExit` — 38 of 39 suites passing (1 failure is pre-existing `design_refs/` vitest baseline; +30 net tests vs baseline 201)
- `pnpm typecheck` — 0 errors in our codebase (only pre-existing `design_refs/` noise from the untracked Lovable folder)

---
*Phase: 03-capture-admin-review*
*Completed: 2026-04-30*
