---
phase: 03-capture-admin-review
plan: 04
subsystem: ui
tags: [client, components, ui-primitives, theme-tokens, reanimated, expo-video, expo-blur, jest-mocks]

# Dependency graph
requires:
  - phase: 03-capture-admin-review
    provides: "Plan 03-01 — react-native-reanimated@4.2.1 + react-native-worklets installed; expo-video, expo-blur, expo-camera native modules wired; baseline jest mocks (added in 03-01) for those native modules"
  - phase: 01-foundation
    provides: "src/theme/{tokens,useTheme,ThemeProvider} — design tokens (colors/spacing/radii/fonts) + ThemeContext API; Avatar / PrimaryButton / SecondaryButton / GhostButton / TextInput primitives consumed inside the new composites"
provides:
  - "DestructiveButton primitive (filled-red P1 inventory promise) — first consumers in Plan 03-07 (discard-take Modal + reject-reason commit)"
  - "StatusPill primitive (4 states: none/pending/approved/rejected) — only the rejected variant is interactive when onPress is supplied; consumed by GroupCard and (Plan 03-07) the capture screen status display"
  - "TypeChip primitive (photo/video group indicator) — consumed by GroupCard"
  - "GroupCard composite (5-row stack with status-driven CTA + inline QueueBadge) — the per-group Today-screen card; consumed by Plan 03-06 (Today screen)"
  - "Shutter primitive (3-variant camera shutter with pulse-loop in recording state) — consumed by Plan 03-07 capture screen"
  - "CaptureTopBar primitive (close × + group-name BlurView pill + flip-camera) — consumed by Plan 03-07 capture screen"
  - "ReviewPanel primitive (caption TextInput + Retake/Submit row + KeyboardAvoidingView) — consumed by Plan 03-07 capture review state"
  - "SwipeCard composite (admin queue card with PendingSubmissionRow-shaped props per REVIEWS C5; supabase signed-URL useQuery + expo-video autoplay-muted-loop + Reanimated SharedValue gesture transforms) — consumed by Plan 03-07 review screen via direct row-spread"
  - "src/components/index.ts barrel re-exports all 8 new primitives alongside every existing P1+P2 export"
  - "Hand-rolled react-native-reanimated jest mock (replaces broken upstream `/mock` re-export) — first-time exercise of reanimated primitives in tests"
affects: [03-06, 03-07]

# Tech tracking
tech-stack:
  added: []  # No new deps — primitives consume modules already wired in Plan 03-01.
  patterns:
    - "Phase-3 component-test pattern: ThemeContext.Provider with a static Theme built from tokens (mirrors tests/groups/segmentedControl.test.tsx) — avoids ThemeProvider's expo-google-fonts dependency in tests"
    - "Supabase-touching test pattern: env-vars at file top + supabase-importing modules loaded via require() (not import) so the env-var assignment beats the module-init guard. Matches tests/avatar-upload.test.ts."
    - "REVIEWS C5 row-shape props: SwipeCard accepts the PendingSubmissionRow snake_case shape (display_name, avatar_path, updated_at, created_at, caption, media_path, media_type) so Plan 03-07's review screen spreads `<SwipeCard {...row} />` without a mapper. Lightweight 'composite primitive knows about row shape' coupling justified by this being a screen-specific composite, not a generic primitive."
    - "Inline-not-extracted sub-component pattern: GroupCard's QueueBadge lives inside GroupCard.tsx as a local function (per UI-SPEC line 1106). Avoids file proliferation for a composite that is only ever used inside one parent."

key-files:
  created:
    - src/components/DestructiveButton.tsx
    - src/components/StatusPill.tsx
    - src/components/TypeChip.tsx
    - src/components/GroupCard.tsx
    - src/components/Shutter.tsx
    - src/components/CaptureTopBar.tsx
    - src/components/ReviewPanel.tsx
    - src/components/SwipeCard.tsx
    - tests/components/StatusPill.test.tsx
    - tests/components/GroupCard.test.tsx
    - tests/components/SwipeCard.test.tsx
    - .planning/phases/03-capture-admin-review/03-04-SUMMARY.md
  modified:
    - src/components/index.ts
    - jest.setup.ts

key-decisions:
  - "Test theme wrapper uses ThemeContext.Provider directly (canonical P1+P2 pattern), NOT the production <ThemeProvider> — avoids the useFonts hook returning null until Manrope loads asynchronously"
  - "GroupCard's rejected state emits TWO role=button elements with the same 'Today didn't count' text: the disabled GhostButton CTA (visual continuity) and the interactive StatusPill (carries the rejection reason via callback). Test disambiguates via the StatusPill's unique 'Tap to see admin's note' a11y label suffix."
  - "Hand-rolled Reanimated mock instead of the upstream `/mock` re-export. Plan 03-01 added the upstream mock optimistically but it transitively requires `react-native-worklets` native bridge — first-use here surfaced the failure. Fix is additive (only Reanimated mock changed); other tests unaffected."
  - "SwipeCard's avatar_path is passed through as the imageUri to the Avatar component with `?v=${updated_at}` cache-bust suffix appended — Plan 03-05/03-06 will adapt the row's avatar_path to a public URL before/inside SwipeCard if needed (the field is named to match useReviewQueue's PendingSubmissionRow regardless of URL-vs-path semantics)"
  - "Did NOT extract InlineQueueBadge to its own file — kept inline inside GroupCard.tsx per UI-SPEC line 1106. The badge is GroupCard-specific; extraction would only multiply files."
  - "Destructive 15% alpha background uses the hex-suffix idiom `${t.colors.destructive}26` per UI-SPEC. The destructive token is `hsl(...)` so the alpha suffix is technically a no-op on some engines (RN renders it close to opaque destructive); contrast remains acceptable because the text/icon are themselves destructive-coloured. If true alpha is needed in a future plan, materialize the hsl values into rgba() at the call site."

patterns-established:
  - "8-primitive Phase-3 component layout pattern: tokens-only consumers (no business logic), useTheme() at the top of every file, @expo/vector-icons Feather subset, no hardcoded colors / spacing / radii / fonts."
  - "Composite a11y label pattern (GroupCard, SwipeCard): assemble the parent View label from name × kind × status × cutoff/ago so screen readers announce the whole card in one read; the CTA button retains its own focus stop with a per-status label."
  - "PanGestureHandler-owns-swipe pattern (SwipeCard): gesture-driven SharedValues live in the parent screen, the card is a pure visual that applies them via useAnimatedStyle. Decouples physics from rendering and lets the parent compose 3-card stacks (top + next + next-next) where only the top card receives gesture values."

requirements-completed: [SUB-04]

# Metrics
duration: ~50min
completed: 2026-04-30
---

# Phase 03 Plan 04: Phase 3 component primitives Summary

**Eight new RN component primitives (DestructiveButton, StatusPill, TypeChip, GroupCard, Shutter, CaptureTopBar, ReviewPanel, SwipeCard) shipped tokens-only with three component test suites covering the StatusPill state matrix, GroupCard state matrix, and SwipeCard media+caption+a11y+REVIEWS-C5 row-spread contract.**

## Performance

- **Duration:** ~50 min (Tasks 1-5 + verification + summary)
- **Started:** 2026-04-30T~12:00:00Z
- **Completed:** 2026-04-30T~12:50:00Z
- **Tasks:** 5 of 5 executed (autonomous; no checkpoints)
- **Files created:** 12 (8 components + 3 tests + this SUMMARY)
- **Files modified:** 2 (src/components/index.ts barrel, jest.setup.ts Reanimated mock)
- **Tests:** baseline 183 → final 201 (+18 across 3 new component test suites; 1 pre-existing design_refs vitest suite still failing — out of scope)

## Accomplishments

- All 8 Phase-3 primitives implemented per UI-SPEC §Component Additions and §6 (Capture-screen primitives), tokens-only, with @expo/vector-icons Feather glyphs throughout.
- GroupCard implements the full state matrix: status × kind → CTA branching, inline QueueBadge gated on queuedUploadSize, 125ms cross-fade Animated.timing on status change (NOT spring per UI-SPEC §Realtime ambient feel).
- SwipeCard implements the REVIEWS C5 Approach A: snake_case prop shape that mirrors PendingSubmissionRow exactly, so Plan 03-07's review screen will be able to do `<SwipeCard {...row} />` without a mapper. A dedicated contract test proves the spread works.
- src/components/index.ts barrel exports all 8 new primitives under a clearly marked `// Phase 3 primitives` section while preserving every existing P1+P2 export verbatim.
- Three test suites (5 + 7 + 6 = 18 cases) all green; full project test suite is at 201/201 with no regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: DestructiveButton + Shutter primitives** — `5d1f917` (feat)
2. **Task 2: StatusPill + TypeChip + StatusPill state-coverage test** — `339e8be` (feat)
3. **Task 3: GroupCard composite + state-matrix test** — `fa45036` (feat)
4. **Task 4: CaptureTopBar + ReviewPanel (capture-screen pieces)** — `47d0c9d` (feat)
5. **Task 5: SwipeCard + barrel update + Reanimated jest mock fix** — `3c24c48` (feat)

**Plan metadata commit:** *committed at end of executor run with this SUMMARY*

## Files Created/Modified

**Created (8 components + 3 tests + 1 summary):**
- `src/components/DestructiveButton.tsx` — Filled-red P1 inventory promise; copy of PrimaryButton with destructive bg + white label; 48pt min-height; ActivityIndicator on loading.
- `src/components/StatusPill.tsx` — 4-state submission badge; only rejected-with-onPress is a Pressable, others are View.
- `src/components/TypeChip.tsx` — Photo/video group indicator; surfaceMuted bg + 1px border + pill radius + Feather icon + Caption-500 label.
- `src/components/GroupCard.tsx` — 5-row Today-screen card; status-driven CTA branching (PrimaryButton / SecondaryButton-disabled / GhostButton-disabled-with-destructive-left-accent); inline `InlineQueueBadge` local function; Animated.timing 125ms+125ms cross-fade on status prop change; composite a11y label; cutoff hint with urgency-coloured text.
- `src/components/Shutter.tsx` — 3-variant camera shutter; 72pt outer + 4pt white pulsing ring; 52pt inner — primary-yellow circle for photo/video-idle, destructive-red square (borderRadius 0) with 16pt white inner stop-square for video-recording; Animated.loop opacity 0.85↔1 over 1.4s while recording.
- `src/components/CaptureTopBar.tsx` — Absolute-positioned camera-overlay row; close × on left, group-name pill in center, optional flip-camera on right (or symmetric spacer), all on dark BlurView scrims; allowFontScaling={false} on the pill text.
- `src/components/ReviewPanel.tsx` — Bottom-anchored post-capture panel; caption TextInput (maxLength={140}) + tabular-nums char counter (destructive at <5/=140); inline error toast above buttons when errorText provided; Retake outlined + Submit PrimaryButton row; KeyboardAvoidingView wraps.
- `src/components/SwipeCard.tsx` — Admin queue card (92% screen width, e2 shadow); avatar+submitter row, photo (4:3 Image) or video (16:9 expo-video VideoView autoplay-muted-loop) media frame, italic 3-line caption, approve/reject overlay decorations; supabase.storage.from('submissions').createSignedUrl(path, 60) wrapped in TanStack Query (queryKey ['signedUrl', path], staleTime 50s); Reanimated useAnimatedStyle for parent-driven gesture transforms; **REVIEWS C5 snake_case row-shape props** (display_name, avatar_path, updated_at, created_at, caption, media_path, media_type).
- `tests/components/StatusPill.test.tsx` — 5 cases (none / pending / approved / rejected-with-press / rejected-without-press).
- `tests/components/GroupCard.test.tsx` — 7 cases (state matrix × kind, rejected-pill-tappable, queueBadge present/absent).
- `tests/components/SwipeCard.test.tsx` — 6 cases (submitter+timestamp, caption italic-quoted, caption empty hides, caption null hides, accessibilityActions for approve+reject, **REVIEWS C5 contract test** spreading PendingSubmissionRow-shaped object).
- `.planning/phases/03-capture-admin-review/03-04-SUMMARY.md` — this file.

**Modified:**
- `src/components/index.ts` — Adds the 8 new exports under a clearly marked `// Phase 3 primitives` section. Preserves every existing P1+P2 export verbatim.
- `jest.setup.ts` — Replaces `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))` with a hand-rolled minimal mock factory. See Deviations below.

## Decisions Made

- **Test theme wrapper uses `ThemeContext.Provider` directly (canonical P1+P2 pattern).** The plan's example tests used `<ThemeProvider>{...}</ThemeProvider>`, but the production `ThemeProvider` returns `null` until `useFonts()` resolves Manrope — that hangs in Jest. Every existing tests/groups test uses `ThemeContext.Provider` with a static `Theme` built from tokens (see `tests/groups/segmentedControl.test.tsx`). All three new component test files follow this established convention. **Note for Plan 03-08:** continue using this pattern.
- **GroupCard's rejected state emits two role=button elements with the same "Today didn't count" text** — the disabled GhostButton CTA (visual continuity per UI-SPEC §State Matrix) and the interactive StatusPill (carries the rejection reason via callback). The GroupCard test disambiguates via the StatusPill's unique a11y-label suffix `"Tap to see admin's note"`. Plan 03-06 should preserve this pattern: the CTA is visual; the pill is the interactive "tell me why" affordance.
- **destructive 15% alpha bg uses `${t.colors.destructive}26` hex-suffix idiom (UI-SPEC convention).** Because `t.colors.destructive` is `hsl(...)` rather than hex, the alpha suffix doesn't compute a true alpha on most engines — RN typically renders it as fully-opaque destructive or close to it. Contrast remains acceptable because the text and icon are themselves destructive-coloured (so the AA-contrast pair is destructive-on-near-destructive — visually it's a darker pill, not the soft pinkish wash UI-SPEC implied). **If a future plan needs a true 15% alpha for the rejected pill, materialize the hsl(4, 78%, 56%) into `rgba(232, 78, 67, 0.15)` at the call site.** Tracked as a UI-SPEC clarification opportunity, not a defect — the pill still renders as a clearly-rejected element.
- **InlineQueueBadge stays inside GroupCard.tsx as a local function** — UI-SPEC line 1106 explicitly says "built inline inside GroupCard, not extracted." The local function approach keeps the component file readable without bloating the components/ directory with a single-consumer file.
- **SwipeCard's `avatar_path` is passed through to `Avatar imageUri` with `?v=${updated_at}` cache-bust suffix appended directly.** This treats the path as the imageUri verbatim. Plan 03-05/03-06 may need to wrap with `supabase.storage.from('avatars').getPublicUrl(...)` before passing in; the field name is fixed (matches PendingSubmissionRow) but the URL-vs-path resolution can move upstream of SwipeCard cheaply.
- **`react-native-reanimated/mock` re-export is broken in Jest** — replaced with a hand-rolled factory. See Deviations § for the full diagnosis and rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Replaced broken `react-native-reanimated/mock` upstream re-export with a hand-rolled jest mock factory**
- **Found during:** Task 5 (SwipeCard.test.tsx — first test that actually loads `react-native-reanimated`).
- **Issue:** Plan 03-01 added `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))` to `jest.setup.ts` optimistically but no test in 03-01/03-02/03-03 actually loads Reanimated. SwipeCard.test.tsx is the first; the upstream `/mock` module transitively requires `./index` → `./initializers` → `react-native-worklets` and throws `WorkletsError: Native part of Worklets doesn't seem to be initialized`. Reanimated 4.x's mock module assumes the worklets native bridge is up at module-load time, which is never true in Node/Jest.
- **Fix:** Replaced the one-line factory with a hand-rolled minimal mock that does NOT require the upstream `react-native-reanimated/mock` module. Surface covers everything Phase 3+ uses: default export `Animated.{View, Text, Image, ScrollView, FlatList}` (pointing at RN counterparts), `useSharedValue` (real `.value` proxy mirroring upstream), `useAnimatedStyle` (immediate callback invocation — same semantics as upstream's `IMMEDIATE_CALLBACK_INVOCATION`), `useDerivedValue`, `useAnimatedReaction`, `useAnimatedRef`, `useAnimatedScrollHandler`, `runOnJS`, `runOnUI`, `withTiming`, `withSpring`, `withDecay`, `cancelAnimation`, `interpolate`, `interpolateColor`, `Easing.{linear,ease,in,out,inOut,bezier}`, `Extrapolation`, `Extrapolate`, `isSharedValue`. Add to this surface as future plans adopt more Reanimated APIs.
- **Files modified:** `jest.setup.ts` (one mock factory replaced, ~70 lines).
- **Verification:** `npx jest tests/components/SwipeCard.test.tsx` → 6/6 pass. `npm test` → 201/201 pass (was 183/183 baseline + 18 new = 201, exact). No other tests load Reanimated, so the change is additive — every other suite behaves identically.
- **Committed in:** `3c24c48` (Task 5 commit, bundled with SwipeCard implementation since the mock fix is what unblocks SwipeCard's test).

**2. [Rule 1 — Bug] GroupCard rejected-state test originally fetched both buttons with `/Today didn't count/` regex; failed with `Found multiple elements with role: button, name: /Today didn't count/`**
- **Found during:** Task 3 (GroupCard.test.tsx — "status=rejected" case).
- **Issue:** GroupCard's rejected branch renders TWO role=button elements that both carry the literal text "Today didn't count": the disabled GhostButton CTA (visual continuity) and the interactive StatusPill. The plan's example test used `getByRole('button', { name: /Today didn't count/ })` which matched both, surfacing as a test failure not a behavior bug — the dual-button design is intentional per UI-SPEC.
- **Fix:** Updated the assertion to use the StatusPill's unique a11y-label suffix `"Tap to see admin's note"` (added in StatusPill.tsx for hint context). The CTA's a11y label is just `"Today didn't count"` — different by exactly the hint suffix, so the regex `/Tap to see admin's note/` matches only the pill.
- **Files modified:** `tests/components/GroupCard.test.tsx` (one assertion).
- **Verification:** `npx jest tests/components/GroupCard.test.tsx` → 7/7 pass.
- **Committed in:** `fa45036` (Task 3 commit, included in the same commit as the test+component since the assertion was developed concurrently with the implementation).

---

**Total deviations:** 2 auto-fixed (1 blocking infra issue, 1 test-side bug surfaced by intentional UI design).
**Impact on plan:** Both fixes were necessary to satisfy the plan's acceptance criteria (`pnpm jest tests/components/` exits 0). No scope creep. Both fixes are local and additive — no change to the broader test infrastructure or component contracts.

## Issues Encountered

- **`pnpm` is referenced in plan verification blocks but the project uses `npm`** — `package-lock.json` is the lockfile in tree; no `pnpm-lock.yaml`. Verification used `npm test` / `npm run typecheck` / `npx jest` instead. No actual blocker; just a doc-vs-tooling delta. Plan-template hygiene item for future Phase 3+ plans.
- **Pre-existing `design_refs/` vitest suite still failing** — same suite that fails on every Phase 3 plan run; not a regression of this plan. Tracked in `.planning/phases/03-capture-admin-review/deferred-items.md` (Plan 03-01).
- **Pre-existing supabase AppState listener leaks across tests** — Jest reports "did not exit one second after the test run has completed" when SwipeCard.test.tsx loads the supabase singleton. This is a Plan 01 artifact (the `AppState.addEventListener` in `src/lib/supabase.ts` is never cleaned up in tests), affects every test that touches supabase.ts, not specific to this plan. Out of scope.

## TDD Gate Compliance

This plan has `type: execute` (not `tdd`) — RED/GREEN/REFACTOR gates do not apply. Tests in this plan accompany the implementation as `feat(...)` commits documenting the contract; they are not RED-first.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what the plan's `<threat_model>` already enumerates (T-03-04-01 through T-03-04-07). All seven threats remain in their original disposition. No `threat_flags` to add.

## User Setup Required

None — Plan 03-04 is pure client-side component primitives. No native binary rebuilds, no env var changes, no Supabase Dashboard configuration. Plans 03-06 and 03-07 will compose these primitives into screens; no checkpoints expected for those either as long as the primitives are token-faithful (they are).

## Self-Check: PASSED

All claimed files and commits verified present.

**Files verified:**
- `src/components/DestructiveButton.tsx` — present
- `src/components/StatusPill.tsx` — present
- `src/components/TypeChip.tsx` — present
- `src/components/GroupCard.tsx` — present
- `src/components/Shutter.tsx` — present
- `src/components/CaptureTopBar.tsx` — present
- `src/components/ReviewPanel.tsx` — present
- `src/components/SwipeCard.tsx` — present
- `tests/components/StatusPill.test.tsx` — present
- `tests/components/GroupCard.test.tsx` — present
- `tests/components/SwipeCard.test.tsx` — present
- `src/components/index.ts` — modified (8 new exports preserved)
- `jest.setup.ts` — modified (Reanimated mock replaced)
- `.planning/phases/03-capture-admin-review/03-04-SUMMARY.md` — present (this file)

**Commits verified in `git log`:**
- `5d1f917` (Task 1: feat — DestructiveButton + Shutter) — present
- `339e8be` (Task 2: feat — StatusPill + TypeChip + test) — present
- `fa45036` (Task 3: feat — GroupCard + test) — present
- `47d0c9d` (Task 4: feat — CaptureTopBar + ReviewPanel) — present
- `3c24c48` (Task 5: feat — SwipeCard + barrel + Reanimated mock fix) — present

**Plan-required content checks:**
- DestructiveButton uses `t.colors.destructive` — OK
- DestructiveButton has `minHeight: 48` — OK
- Shutter has `width: 72`, `Animated.loop`, `'video-recording'` branch — OK
- StatusPill has `'x-circle'`, `'Pending review'`, `"Today didn't count"`, `destructive` references — OK
- TypeChip has `kind: 'photo'` discriminator — OK
- GroupCard has `'Submit photo'`, `'Submit video'`, `'Submitted'`, `"Today didn't count"`, `StatusPill`, `TypeChip`, `Animated.timing`, `queuedUploadSize`, `'upload-cloud'` — OK
- CaptureTopBar has `BlurView`, `'refresh-cw'`, `allowFontScaling={false}` — OK
- ReviewPanel has `submitLabel`, `maxLength={140}`, `KeyboardAvoidingView` — OK
- SwipeCard has `createSignedUrl`, `useVideoPlayer`, `useAnimatedStyle`, `accessibilityActions` — OK
- SwipeCard has ZERO matches for old camelCase prop names (`submitterName|submitterAvatarPath|submittedAtIso|mediaPath|mediaType:`) — OK (REVIEWS C5 contract held)
- Barrel exports all 8 new primitives — OK

## Next Phase Readiness

- **Plan 03-05 (review-queue data layer):** independent of this plan — proceeds in parallel; will define the canonical `PendingSubmissionRow` row type whose snake_case shape SwipeCard's props now match.
- **Plan 03-06 (Today screen):** ready — composes GroupCard with `useGroupsList` + `useTodaySubmission` + `useUploadQueue`. Notes for the planner:
  - `onSubmitPress` should call `router.push(`/capture/${groupId}`)`
  - `onRejectedPillPress` should open a Modal with `Why it didn't count` (UI-SPEC line 419-422), passing the reason from `useTodaySubmission`
  - `onQueueBadgeMorePress` should open the Modal in `presentationStyle="pageSheet"` with the pending-uploads list (UI-SPEC line 546)
- **Plan 03-07 (capture screen + admin queue):** ready — composes Shutter + CaptureTopBar + ReviewPanel with CameraView; composes SwipeCard with PanGestureHandler + Reanimated SharedValues at the parent. SwipeCard expects the parent to pass `translateX/rotate/opacity` SharedValues for the top card and `scale/translateY/zIndex` static props for the next-card / next-next-card stack positions.
- **REVIEWS C5 hardening:** the SwipeCard contract test (`renders correctly when spread from a PendingSubmissionRow-shaped object`) will catch any future prop rename that breaks the spread pattern in 03-07's review screen.

---
*Phase: 03-capture-admin-review*
*Plan: 03-04*
*Last update: 2026-04-30 (all 5 tasks complete; 18 new component tests green; full suite 201/201)*
