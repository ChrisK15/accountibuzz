---
phase: 3
reviewers: [gemini, codex]
reviewed_at: 2026-04-28
plans_reviewed:
  - 03-01-PLAN.md
  - 03-02-PLAN.md
  - 03-03-PLAN.md
  - 03-04-PLAN.md
  - 03-05-PLAN.md
  - 03-06-PLAN.md
  - 03-07-PLAN.md
  - 03-08-PLAN.md
self_skipped: claude (running inside Claude Code — skipped for independence)
---

# Cross-AI Plan Review — Phase 3

> Two independent frontier-grade reviewers (Gemini 2.5 Pro via gemini-cli, GPT-5 via codex-cli). Both received the same prompt: full project context, roadmap section, requirements, CONTEXT.md, RESEARCH.md (abbreviated), and all 8 PLAN.md files (~120k tokens).

---

## Gemini Review

# Phase 3 Plan Review: Capture & Admin Review

## 1. Summary
The implementation plans for Phase 3 are exceptionally detailed and technically sound, demonstrating a deep understanding of Expo SDK 55 features and Supabase limitations. The use of a two-phase commit for uploads combined with an `AsyncStorage` queue provides the necessary robustness for a mobile-first "moment of truth" application. The decision to skip raw TUS in favor of a custom retry layer is a pragmatic trade-off for the 1–10 MB file envelope. However, there are critical edge cases regarding **Realtime cache pollution** and **DST-unsafe time calculations** that must be addressed to ensure the core streak mechanic remains authoritative and the UI remains truthful.

## 2. Strengths
*   **Robust Upload Integrity**: The two-phase commit (Storage first, then RPC) combined with the `upsert: false` idempotency contract (Plan 03-03, Task 3) ensures that media and database records never drift.
*   **Architectural Workarounds**: The strategy for the single-column Realtime filter (Plan 03-05, Task 3) is a standard but high-fidelity solution to a known Supabase limitation.
*   **Defense-in-Depth Security**: The triple-layer validation (RLS + SECURITY DEFINER RPC + Immutable Trigger) for `PLAT-03` (Plan 03-02, Task 1) is enterprise-grade and effectively mitigates cross-group administrative attacks.
*   **SDK 55 Alignment**: Leveraging the modern `File` class for `ArrayBuffer` reads (Plan 03-03, Task 3) significantly improves performance and future-proofs the codebase against the removal of the legacy `FileSystem` API.
*   **Testing Rigor**: The backfilling of pgTAP coverage for the existing `0003` trigger (Plan 03-02, Task 2) addresses critical technical debt from Phase 1.

## 3. Concerns

### [HIGH] Realtime Cache Pollution (Non-Today Updates)
*   **Plan**: 03-05
*   **Section**: Task 3 (`useTodaySubmissionRealtime.ts`)
*   **Description**: The handler (lines 35-43) unconditionally patches the `['submission', row.group_id, 'today']` cache with *any* row received via the user-filtered channel. If an admin reviews a submission from *yesterday* (or a late upload for a previous day finally flushes), the "Today" UI state will be overwritten by stale data.
*   **Impact**: Users will see yesterday's status (e.g., "Approved") on today's GroupCard, potentially bypassing the "not yet submitted" visual cues.

### [MEDIUM] Non-DST-Safe Cutoff Calculation
*   **Plan**: 03-03
*   **Section**: Task 2 (`time.ts`)
*   **Line**: 55 (`nextMidnightEpoch = todayMidnightEpoch + 24 * 60 * 60 * 1000`)
*   **Description**: Adding a fixed 86,400,000ms to a midnight epoch assumes every day is exactly 24 hours. On nights where clocks transition for DST, "midnight to midnight" is 23 or 25 hours.
*   **Impact**: The `minutesLeft` countdown will be off by exactly 60 minutes on transition days, leading to user confusion near the cutoff.

### [MEDIUM] Worklet Stale Closure Risk
*   **Plan**: 03-07
*   **Section**: Task 2 (`review.tsx`)
*   **Implementation**: While the plan correctly notes the need for a `topRef` (line 35), the `onApprove` and `onRejectIntent` handlers (lines 53-68) are wrapped in `useCallback` but then invoked via `runOnJS` inside the `Gesture.Pan()` end-handler.
*   **Impact**: If the stack re-renders and `translateX/Y` values aren't reset perfectly, or if the `pan` gesture object itself isn't re-memoized against the `topRef` identity, the `runOnJS` call might execute against a stale closure of the mutation hooks.

### [LOW] Component/Hook Import Depth
*   **Plan**: 03-06
*   **Section**: Task 1 & 2
*   **Description**: Moving `index.tsx` to `groups/index.tsx` increases import depth. The plan specifies `../../../src/...`, but the workspace structure shows `app/` and `src/` are siblings.
*   **Impact**: `app/(app)/groups/index.tsx` is at depth 3 relative to root. `src/` is at depth 1. Correct relative path is `../../../src/...`. The plan is correct, but the move might break `tests/groups/groupsListScreen.test.tsx` if it relies on hardcoded relative paths to the app directory.

## 4. Suggestions
*   **Fix Realtime Filtering**: In `useTodaySubmissionRealtime.ts`, the handler must calculate `todayLocalDate(groupTz)` for the specific group in the payload before calling `setQueryData`. If `row.local_date !== today`, the event should be ignored.
*   **Robust Midnight Logic**: In `time.ts`, instead of adding `24 * 60 * 60 * 1000`, construct the "next day" string (e.g., if today is `2026-04-28`, target `2026-04-29T00:00:00`) and pass that through the `epochForLocalInTz` helper. This lets the `Intl` API handle the DST offset correctly.
*   **Gesture Memoization**: In `review.tsx`, ensure the `pan` gesture object is wrapped in a `useMemo` that depends on `top.id`. This ensures the gesture handler is always bound to the specific card it is interacting with, preventing ID mismatch during rapid swipes.
*   **Refactor `submitMedia` Result**: Change `submitMedia` (Plan 03-03) to return a discriminated union `{ status: 'success', id: string } | { status: 'queued' }` rather than using `throw new Error('queued')`. Using exceptions for expected control flow (offline mode) can make debugging stack traces more difficult.

## 5. Risk Assessment
**Risk: MEDIUM**
The plan is architecturally sound, but the high-stakes nature of the streak mechanic means that any discrepancy in timezone math or Realtime state synchronization (the "Concerns" above) could lead to "false resets" or "false saves," which directly undermines the app's core value of reliable accountability.

**Reviewer:** Gemini CLI (gsd-plan-reviewer) — `gemini-2.5-pro`, default

---

## Codex Review (GPT-5)

## Summary

The plans are unusually thorough and mostly aligned with the product goal, but they are too confident in several fragile seams. The biggest blockers are admin-review authorization leakage, date/cache semantics around "today," DST/cutoff math, and some implementation-contract mismatches that will either fail typecheck or silently corrupt UX. I would not greenlight execution until the HIGH items are resolved.

## Strengths

- Server-side `submit_today` / `review_submission` RPC approach is directionally right: DB derives `local_date`, validates membership/admin, and catches unique violations.
- The TUS rollback to `storage.upload()` + queue is pragmatic for 1-10MB MVP media.
- Realtime single-column filter limitation is acknowledged instead of hand-waved.
- Physical-device UAT covers the right risky areas: camera, flaky network, Realtime, rejection terminality.
- Phase dependencies are mostly explicit, especially 03-03/03-05 depending on regenerated RPC types.

## Concerns

### HIGH — Non-admins can likely view the admin review queue by deep link

`useReviewQueue` explicitly relies on RLS that permits any group member to read submissions, not just admins, then the review screen calls it directly without an `isAdmin` gate. A non-admin member deep-linking to `/groups/[id]/review` can likely see pending media/captions even if mutations fail. The threat model's "empty-state covers it" claim is false. See `.planning/phases/03-capture-admin-review/03-05-PLAN.md:346-366`, `.planning/phases/03-capture-admin-review/03-07-PLAN.md:516-520`, `.planning/phases/03-capture-admin-review/03-07-PLAN.md:1055`.

### HIGH — Realtime "today" cache can be overwritten by yesterday/tomorrow rows

`useTodaySubmission(groupId, todayLocalDate)` accepts the date but omits it from the query key, and the Realtime handler patches `['submission', group_id, 'today']` for every payload without checking `row.local_date`. This breaks if the app stays open across midnight or if a prior-day review event arrives. See `.planning/phases/03-capture-admin-review/03-05-PLAN.md:260-277` and `.planning/phases/03-capture-admin-review/03-05-PLAN.md:681-688`.

### HIGH — Cutoff math is core-mechanic code but hand-rolled and untested

`cutoffStateFor` computes next midnight as `todayMidnightEpoch + 24h`, which is wrong across DST transitions. The same task explicitly says no dedicated tests because helpers are "low-risk"; they are not. This is the product's core daily cutoff mechanic. See `.planning/phases/03-capture-admin-review/03-03-PLAN.md:379-383` and `.planning/phases/03-capture-admin-review/03-03-PLAN.md:458`.

### HIGH — Queue UUID fallback can create invalid queue entries that later self-delete

`useSubmitToday` falls back to `${Date.now()}-${Math.random()...}` for `client_uuid`, but `queueEntrySchema` requires `z.string().uuid()`. A queued offline submission created under that fallback will fail `readQueue()` parsing later and the corruption handler deletes the entire queue. See `.planning/phases/03-capture-admin-review/03-05-PLAN.md:492-497`, `.planning/phases/03-capture-admin-review/03-05-PLAN.md:541-549`, `.planning/phases/03-capture-admin-review/03-03-PLAN.md:802-808`, `.planning/phases/03-capture-admin-review/03-03-PLAN.md:821-827`.

### HIGH — SwipeCard props do not match review queue row shape

`SwipeCard` expects camelCase props like `submitterName`, `mediaPath`, `submittedAtIso`, but the review screen spreads `PendingSubmissionRow` directly, which has `display_name`, `media_path`, `created_at`. This will fail typecheck or render blank fields unless mapped. See `.planning/phases/03-capture-admin-review/03-04-PLAN.md:931-937` and `.planning/phases/03-capture-admin-review/03-07-PLAN.md:660-675`.

### MEDIUM — `useVideoPlayer` hook usage risks hook-order/type bugs

The capture plan calls `useVideoPlayer(mediaUri, ...)` while `mediaUri` can be null and the shown review branch is conditional. If implemented conditionally, it violates Rules of Hooks; if unconditional, it may pass null to a hook expecting a source. See `.planning/phases/03-capture-admin-review/03-07-PLAN.md:333-363`.

### MEDIUM — Success haptic fires before submit succeeds

The capture submit handler triggers success haptics before `mutateAsync`. Failed or queued submissions can feel like success. See `.planning/phases/03-capture-admin-review/03-07-PLAN.md:372-382`.

### MEDIUM — Queue flush trigger testing is contradictory

The plan says `uploadQueueManager.test.ts` exercises AppState and NetInfo triggers, then later says it does not test `startQueueManager` directly. That is the exact code that wires those triggers. See `.planning/phases/03-capture-admin-review/03-03-PLAN.md:37` and `.planning/phases/03-capture-admin-review/03-03-PLAN.md:1041`.

### MEDIUM — Verification criteria allow closing with deferred core requirements

03-08 allows DEFERRED receipts, including Slow-3G/JWT tests, and success criteria allow "PASS receipt OR explicit deferred-with-reason" for all requirements. That can mark SUB-03 complete without actually proving flaky-network resilience. See `.planning/phases/03-capture-admin-review/03-08-PLAN.md:265-281` and `.planning/phases/03-capture-admin-review/03-08-PLAN.md:414-417`.

### LOW — Jest mock plan risks duplicate module mock confusion

03-01 says append a second `jest.mock('expo-file-system')` and claims re-calling is idempotent. Jest mock hoisting with duplicate factories is brittle; replace the existing mock in one place instead. See `.planning/phases/03-capture-admin-review/03-01-PLAN.md:268-278`.

## Suggestions

- Add an admin-only `get_pending_review_queue(group_id)` RPC, or gate `useReviewQueue` with `enabled: isAdmin` after `useGroup`; do not rely on group-member SELECT RLS for admin-only media.
- Change submission query keys to include local date: `['submission', groupId, todayLocalDate]`. Realtime should either receive active group timezone/date map or invalidate affected group queries instead of blindly `setQueryData`.
- Replace cutoff math with a tested timezone utility and add unit tests for DST boundaries, 23:59/00:00, and at least `America/Los_Angeles`, `America/New_York`, `UTC`, `Pacific/Kiritimati`.
- Centralize UUID generation and make fallback RFC4122-valid using `getRandomValues`; never allow queue writes that fail `queueEntrySchema`.
- Add explicit mapping from `PendingSubmissionRow` to `SwipeCardProps` in review screen.
- Move success haptic after mutation success; use neutral/warning haptic for queued if desired.
- Make SUB-03 UAT non-deferrable for phase close, at least airplane-mode + reconnect.

## Risk Assessment

**HIGH** — the plans are comprehensive, but current gaps hit the core mechanic: admin-only review privacy, day-boundary correctness, Realtime status truth, and offline queue reliability.

**Reviewer:** Codex CLI (gsd-plan-reviewer) — `gpt-5.5`, default reasoning

---

## Consensus Summary

### Agreed Strengths (mentioned by both reviewers)

- **Two-phase commit upload pipeline** is sound: Storage upload first, then RPC; `upsert: false` idempotency is correct.
- **TUS → `supabase.storage.upload()` rollback** is a pragmatic call given the 1-10MB envelope and absence of an SDK 55 reference impl.
- **Defense-in-depth on `PLAT-03`** (RLS + RPC + 0003 trigger) is well-architected.
- **Realtime single-column filter limitation** is honestly acknowledged in the design rather than hand-waved.

### Agreed Concerns (HIGH-priority — both reviewers caught these)

| # | Concern | Plan(s) | Severity |
|---|---------|---------|----------|
| **C1** | **Realtime cache pollution: handler patches `['submission', group_id, 'today']` for any row, including yesterday/tomorrow events** | 03-05 (Task 3, lines 35-43 / 260-277 / 681-688) | **HIGH** |
| **C2** | **DST-unsafe cutoff math: `nextMidnightEpoch = todayMidnightEpoch + 86_400_000` breaks on 23h/25h transition days** | 03-03 (Task 2, line 55 / 379-383 / 458) | **HIGH** (per Codex) / MEDIUM (per Gemini) — treat as HIGH given core mechanic |

### Codex-only HIGH concerns (Gemini did not flag)

| # | Concern | Plan(s) | Severity |
|---|---------|---------|----------|
| **C3** | **Non-admin can deep-link to `/groups/[id]/review` and see pending media** — `useReviewQueue` relies on group-member SELECT RLS, no `isAdmin` gate on the screen | 03-05 (lines 346-366), 03-07 (lines 516-520, 1055) | **HIGH (security)** |
| **C4** | **Queue UUID fallback in `useSubmitToday` is not RFC4122-valid** — fails `queueEntrySchema.uuid()`, corruption handler then drops the entire queue | 03-05 (492-497, 541-549), 03-03 (802-808, 821-827) | **HIGH** |
| **C5** | **SwipeCard prop mismatch** — expects `submitterName / mediaPath / submittedAtIso`; review screen spreads `display_name / media_path / created_at`. Will fail typecheck or render blank | 03-04 (931-937), 03-07 (660-675) | **HIGH** |

### Codex-only MEDIUM concerns

| # | Concern | Plan(s) |
|---|---------|---------|
| **C6** | `useVideoPlayer(mediaUri, ...)` called with possibly-null `mediaUri` — Rules of Hooks risk if guarded conditionally | 03-07 (333-363) |
| **C7** | Success haptic fires *before* `mutateAsync` resolves — failed submits feel successful | 03-07 (372-382) |
| **C8** | Queue flush trigger testing contradictory: plan says `uploadQueueManager.test.ts` exercises AppState+NetInfo, then says `startQueueManager` itself isn't tested | 03-03 (37 / 1041) |
| **C9** | Verification allows DEFERRED receipts including Slow-3G/JWT — could mark SUB-03 done without proving flaky-network resilience | 03-08 (265-281, 414-417) |

### Gemini-only MEDIUM concerns

| # | Concern | Plan(s) |
|---|---------|---------|
| **C10** | Worklet stale closure risk in swipe `pan` gesture — gesture not memoized against `top.id`, may bind to stale `runOnJS` callbacks during rapid swipes | 03-07 (Task 2, lines 53-68) |

### Divergent views

- **Risk assessment:** Gemini says **MEDIUM** overall; Codex says **HIGH**. The difference is C3 (non-admin queue access) — Codex catches this as a real security bug; Gemini missed it. Codex's verdict should win because the concern is concrete and verifiable in the plan files, not a judgment call.
- **DST severity:** Gemini calls it MEDIUM (UX inconvenience); Codex calls it HIGH (core mechanic). Treat as HIGH — the cutoff timer drives streak resets in P5, so off-by-one-hour math is foundational.

### Recommended action

Run `/gsd-plan-phase 3 --reviews` to feed REVIEWS.md back into the planner. The planner should produce targeted patches addressing C1-C5 (all HIGH) at minimum, plus C6-C9 (Codex MEDIUMs) since each maps to a concrete plan section. C10 (Gemini's worklet memoization) is good defensive guidance to fold in.

**Most urgent fix order (if patching manually rather than re-planning):**
1. **C3 (admin gate)** — add `enabled: isAdmin` to `useReviewQueue` AND/OR introduce `get_pending_review_queue(group_id)` SECURITY DEFINER RPC that checks admin-of-group inline. Also: gate the route — non-admin landing on `/groups/[id]/review` should redirect.
2. **C2 (DST cutoff math)** — replace epoch arithmetic with `Intl`-based next-day-string construction; add unit tests for DST boundaries in `America/Los_Angeles` (PST→PDT spring forward), `America/New_York`, and the no-DST `UTC`/`Pacific/Kiritimati` baselines.
3. **C1 (Realtime cache scoping)** — include `local_date` in the query key; reject events whose `row.local_date !== todayLocalDate(groupTz)`.
4. **C4 (UUID fallback)** — use `crypto.randomUUID()` (available in RN 0.83.1 + Hermes via `react-native-get-random-values`); never write a non-RFC4122 string into the queue.
5. **C5 (SwipeCard prop mapping)** — add an explicit mapping function in the review screen, or rename SwipeCard props to match the row shape.
6. **C6-C10** — bundle into the same replan pass; each is a small targeted edit.
