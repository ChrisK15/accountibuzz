---
phase: 3
slug: capture-admin-review
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `03-RESEARCH.md` §Validation Architecture (lines 1475–1587). The Per-Task map will be filled in by the planner once PLAN.md task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (client)** | Jest 29 + jest-expo 55 + @testing-library/react-native 13 + @testing-library/jest-native 5 |
| **Framework (db)** | pgTAP via `supabase test db` (Supabase CLI 2.x) |
| **Config file** | `jest.config.js` (root) + `jest.setup.ts` (mocks) |
| **Quick run command** | `pnpm test` (Jest only) |
| **DB-only run** | `supabase test db` |
| **Full suite command** | `pnpm test:all` (Jest + pgTAP + typecheck) |
| **Estimated runtime** | ~30s Jest · ~10s pgTAP · ~15s typecheck |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- --findRelatedTests <changed-files>` (existing P1/P2 convention)
- **After every plan wave:** Run `pnpm test:all`
- **Before `/gsd-verify-work`:** Full suite must be green AND UAT walkthrough complete (per UI-SPEC § Manual UAT)
- **Max feedback latency:** 30 seconds (Jest quick run)

---

## Per-Task Verification Map

> Filled in by planner during PLAN.md generation. Each PLAN.md task gets: `task_id | plan | wave | requirement | threat_ref | secure_behavior | test_type | automated_command | file_exists | status`. The complete requirement→test mapping below provides the source data; planner allocates each row to the responsible task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(planner-fill)* | | | | | | | | | ⬜ pending |

### Source Data (Requirement → Test Map)

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| **SUB-01** | Photo capture → upload → row insert (happy path) | Jest integration | `pnpm jest tests/submissions/submitMedia.test.ts -t "photo happy path"` | ❌ Wave 0 |
| **SUB-01** | submit_today RPC accepts photo for photo group | pgTAP | `supabase test db --file submit_today` | ❌ Wave 0 |
| **SUB-01** | submit_today returns wrong_media_type when photo sent to video group | pgTAP | (same file) | ❌ Wave 0 |
| **SUB-02** | Video capture (10s cap) → upload → row insert | Jest integration (mocked CameraView) | `pnpm jest tests/submissions/submitMedia.test.ts -t "video happy path"` | ❌ Wave 0 |
| **SUB-02** | Manual UAT: 10s video on physical device, observe size | Manual UAT | UAT script | UAT only |
| **SUB-03** | Network failure during upload → entry enqueues to AsyncStorage | Jest integration | `pnpm jest tests/submissions/submitMedia.test.ts -t "network error enqueues"` | ❌ Wave 0 |
| **SUB-03** | Queue flushes on AppState 'active' | Jest integration | `pnpm jest tests/submissions/uploadQueueManager.test.ts -t "appstate flush"` | ❌ Wave 0 |
| **SUB-03** | Queue flushes on NetInfo isConnected | Jest integration | `pnpm jest tests/submissions/uploadQueueManager.test.ts -t "netinfo flush"` | ❌ Wave 0 |
| **SUB-03** | Manual UAT: airplane-mode-on-submit → queue → toggle off → flush | Manual UAT (PITFALLS §10) | UAT script | UAT only |
| **SUB-03** | Manual UAT: Slow-3G upload progress and resilience | Manual UAT (PITFALLS §10) | UAT script | UAT only |
| **SUB-04** | Today GroupCard reads useTodaySubmission and renders correct StatusPill | Jest component | `pnpm jest tests/components/GroupCard.test.tsx` | ❌ Wave 0 |
| **SUB-04** | Realtime payload patches the cache (mocked channel event) | Jest integration | `pnpm jest tests/submissions/useTodaySubmissionRealtime.test.ts` | ❌ Wave 0 |
| **SUB-05** | submit_today raises already_submitted_today on second insert | pgTAP | `supabase test db --file submit_today` | ❌ Wave 0 |
| **SUB-05** | Client drops queue entry on already_submitted_today | Jest integration | `pnpm jest tests/submissions/uploadQueueManager.test.ts -t "drops on already_submitted"` | ❌ Wave 0 |
| **SUB-06** | Caption ≤ 140 chars accepted | Jest unit | `pnpm jest tests/submissions/schemas.test.ts` | ❌ Wave 0 |
| **SUB-06** | Caption > 140 chars rejected (client + server) | Jest + pgTAP | (above + submit_today.sql) | ❌ Wave 0 |
| **ADM-01** | useReviewQueue returns pending submissions for groups admin manages | Jest + Supabase mock | `pnpm jest tests/submissions/useReviewQueue.test.ts` | ❌ Wave 0 |
| **ADM-01** | Non-admin gets empty list (RLS) | pgTAP | `supabase test db --file review_submission` | ❌ Wave 0 |
| **ADM-02** | review_submission(approved) updates status, reviewed_by, reviewed_at | pgTAP | `supabase test db --file review_submission` | ❌ Wave 0 |
| **ADM-03** | review_submission(rejected, reason) sets rejection_reason; (rejected, null) leaves null | pgTAP | (same) | ❌ Wave 0 |
| **ADM-04** (rescoped) | Realtime UPDATE event fires when admin updates status; Today screen patches cache | Jest integration | `pnpm jest tests/submissions/useTodaySubmissionRealtime.test.ts -t "review event"` | ❌ Wave 0 |
| **PLAT-03** | Non-admin calling review_submission gets not_admin typed error | pgTAP | `supabase test db --file review_submission` | ❌ Wave 0 |
| **PLAT-03** | Admin of group A cannot review submission of group B | pgTAP | `supabase test db --file review_submission -t "cross-group denied"` | ❌ Wave 0 |
| **PLAT-03** | 0003 admin-immutable trigger pins reviewed_by = auth.uid() | pgTAP (backfill 01 deferred-items flag) | `supabase test db --file submissions_admin_immutable` | ❌ Wave 0 |
| **PLAT-03** | 0003 trigger blocks admin attempt to change group_id, user_id, local_date, media_path | pgTAP | (same file) | ❌ Wave 0 |
| Tabs migration | All deep links resolve correctly post-migration | Jest integration | `pnpm jest tests/app/tabs-migration.test.ts` | ❌ Wave 0 |
| Swipe gesture | SwipeCard fires onApprove on right-swipe past threshold | Jest component (gesture mock) | `pnpm jest tests/components/SwipeCard.test.tsx -t "approve right swipe"` | ❌ Wave 0 |
| Swipe gesture | SwipeCard fires onRejectIntent on left-swipe past threshold | Jest component | (same) | ❌ Wave 0 |
| Capture flow | Permission denied → permission-denied screen renders | Jest component | `pnpm jest tests/app/capture-permission-denied.test.tsx` | ❌ Wave 0 |
| Capture flow | Discard-take modal blocks accidental dismiss when take captured | Jest component | `pnpm jest tests/app/capture-discard-modal.test.tsx` | ❌ Wave 0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test files below are NEW. The test infrastructure exists (Jest 29 + jest-expo 55 + @testing-library/react-native 13 + Supabase CLI 2.x); P3-specific test files do not exist yet.

### Jest test files

- [ ] `tests/submissions/submitMedia.test.ts` — covers SUB-01, SUB-02, SUB-03 happy + network-error paths
- [ ] `tests/submissions/uploadQueueManager.test.ts` — covers SUB-03 flush triggers + SUB-05 drop-on-conflict
- [ ] `tests/submissions/useTodaySubmission.test.ts` — covers SUB-04 initial fetch shape
- [ ] `tests/submissions/useTodaySubmissionRealtime.test.ts` — covers SUB-04 + ADM-04 Realtime patch
- [ ] `tests/submissions/useReviewQueue.test.ts` — covers ADM-01 admin queue read
- [ ] `tests/submissions/useSubmitToday.test.ts` — covers happy/typed-error mutation paths
- [ ] `tests/submissions/useReviewSubmission.test.ts` — covers approve/reject mutations
- [ ] `tests/submissions/schemas.test.ts` — covers SUB-06 caption validation
- [ ] `tests/components/StatusPill.test.tsx` — covers SUB-04 visual states
- [ ] `tests/components/GroupCard.test.tsx` — covers SUB-04 + queue badge integration
- [ ] `tests/components/SwipeCard.test.tsx` — covers swipe gesture (Reanimated test pattern)
- [ ] `tests/app/capture-permission-denied.test.tsx` — covers SUB-01/02 permission flow
- [ ] `tests/app/capture-discard-modal.test.tsx` — covers discard-take confirmation
- [ ] `tests/app/tabs-migration.test.ts` — covers D-14 deep-link audit

### pgTAP test files

- [ ] `supabase/tests/submit_today.sql` — covers SUB-01..05 (RPC happy + 3 typed-error paths)
- [ ] `supabase/tests/review_submission.sql` — covers ADM-02..03, PLAT-03 (admin-only + state machine + cross-group denied)
- [ ] `supabase/tests/get_pending_review_count.sql` — covers ADM-01 (badge + 0-leak)
- [ ] `supabase/tests/submissions_admin_immutable.sql` — backfills 0003 trigger coverage (01 deferred-items.md flag)

### `jest.setup.ts` mock additions

- [ ] `expo-camera` (CameraView + permissions hooks)
- [ ] `expo-video` (useVideoPlayer + VideoView)
- [ ] `@react-native-community/netinfo` (event listener + fetch)

### npm dependencies

- [ ] `@react-native-community/netinfo` — only NEW npm dep
- [ ] `expo-camera` plugin block in `app.config.ts` + dev-client rebuild (camera/mic permissions in Info.plist + AndroidManifest.xml)

---

## Manual-Only Verifications

Per PITFALLS.md §10 (physical-device + airplane-mode + Slow-3G testing during P3 UAT). These require a real device and cannot run in CI.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 10s video capture on physical device, observe size + battery impact | SUB-02 | Video encoding behavior + memory pressure differ from simulator | Record 10s video on each platform (iPhone + Android), confirm file < ~25 MB, app stays responsive |
| Airplane-mode-on-submit → queue → toggle off → flush | SUB-03 | Network state transitions need real radio | Toggle airplane mode on, tap Submit, observe QueueBadge, toggle off, observe auto-flush |
| Slow-3G upload progress and resilience | SUB-03 | Throttling needs real network conditions (or platform-tools throttle) | Use Network Link Conditioner (iOS) / Charles throttle (Android) at "Slow 3G", upload 5MB photo, verify progress bar, verify completion |
| JWT refresh during long upload | PITFALLS §12 | Auth token rotation depends on real Supabase session timing | Set device clock forward to force JWT expiry mid-upload, verify retry layer recovers |
| Realtime cross-fade on admin approval | SUB-04 / ADM-04 | Multi-device flow (admin device + member device) | On member device: open Today, observe Pending pill. On admin device: approve. On member device: pill cross-fades to Approved within 2s |
| Camera permission denial flow + Settings deep-link | SUB-01 / SUB-02 | iOS / Android Settings UX differs by version | Deny permission at OS prompt, observe permission-denied screen, tap Open Settings, grant, return to app, verify capture works |
| Tinder-stack swipe feel on physical device | ADM-02 / ADM-03 | Gesture timing + 60-120 FPS rendering only verifiable on real GPU | Open admin queue with ≥3 pending, swipe right + left + mid-drag-release, verify rubber-band + fly-off animations match UI-SPEC |
| Discard-take modal during in-progress recording | SUB-02 | Camera resource teardown timing | Start recording, tap × close, confirm `Discard?` modal, verify no recording leftover in temp dir |
| Reduced-motion mode disables gesture animations | UI-SPEC a11y | OS-level motion preference | Enable Reduce Motion in OS settings, verify swipe gestures still work but card-fly-off + cross-fade are instant |
| 11-checkpoint UAT walkthrough (full P3 flow) | All P3 requirements | End-to-end on real device | Per `/gsd-uat-phase` once written; covers signup → join group → submit → admin review → status update on member side |

---

## What Should NOT Be Mocked

- **Supabase client (`src/lib/supabase.ts`):** mock at the per-test level using `jest.spyOn(supabase, 'rpc')` etc. — same P2 pattern. Do NOT replace the singleton.
- **AsyncStorage:** existing mock is fine (in-memory).
- **Postgres functions in pgTAP:** test against the REAL function bodies via `supabase test db`. Never mock SQL.
- **The 0003 admin-immutable trigger:** explicit pgTAP coverage required — do not mock around it.
- **Realtime channels:** mock the `supabase.channel(...).on(...).subscribe()` chain at the per-test level so we can drive synthetic payloads into the handler. Do NOT globally mock the Realtime module.
- **`useFocusEffect`:** allow it to run synchronously in tests (jest-expo handles this); assert subscribe + unsubscribe both called.
- **Reanimated worklets:** use `react-native-reanimated/mock` per the official testing guide. Worklet code becomes JS-thread; gesture handlers can be invoked directly.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner fills in Per-Task map)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (18 NEW test files + 3 mock additions + 1 npm dep + plugin config)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (after Per-Task map filled)

**Approval:** pending
