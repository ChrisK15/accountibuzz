# Codebase Concerns

**Analysis Date:** 2026-04-04

---

## Tech Debt

**Scaffold-only source tree — virtually no implementation exists:**
- Issue: Every file under `src/` except `src/services/firebase/config.ts` is an empty 0-byte placeholder. All screens, hooks, contexts, navigation, components, types, services, and utils were scaffolded in Sprint 0 but contain no code.
- Files: `src/screens/**/*.tsx`, `src/hooks/*.ts`, `src/context/*.tsx`, `src/navigation/*.tsx`, `src/components/**/*.tsx`, `src/services/firebase/authService.ts`, `src/services/firebase/groupService.ts`, `src/services/firebase/membershipService.ts`, `src/services/firebase/submissionService.ts`, `src/services/firebase/streakService.ts`, `src/services/firebase/notificationService.ts`, `src/services/offline/uploadQueue.ts`, `src/types/*.ts`, `src/utils/*.ts`
- Impact: The application is entirely non-functional. `App.tsx` renders the default Expo placeholder. `src/app/index.tsx` is empty. There is no wired navigation, auth, or data layer.
- Fix approach: Implement in the order defined in `.claude/specs/architecture.md` Section 7 — Phase 1 (auth) first, then Phases 2 through 7.

**`App.tsx` not connected to `src/app/index.tsx`:**
- Issue: `index.ts` registers `App.tsx` as the root component. `App.tsx` renders the default Expo boilerplate. `src/app/index.tsx` (the intended root per the architecture) is an empty file. The wiring was never completed.
- Files: `App.tsx`, `index.ts`, `src/app/index.tsx`
- Impact: Even if individual screens were built, the app cannot navigate anywhere because `NavigationContainer` and providers have not been mounted.
- Fix approach: Implement `src/app/index.tsx` with `NavigationContainer` + `AuthContext` + `NetworkContext` providers, then update `App.tsx` to render the component from `src/app/index.tsx`.

**Firebase config duplicated in two places:**
- Issue: Firebase credentials are consumed from `process.env.EXPO_PUBLIC_*` in `src/services/firebase/config.ts` and also duplicated under the `extra` key in `app.config.ts`. The `extra` block is the legacy Expo Go pattern; `EXPO_PUBLIC_*` variables are the current approach, making the `extra` entries redundant.
- Files: `src/services/firebase/config.ts`, `app.config.ts`
- Impact: Maintenance confusion — a developer may update one location and not the other. The `extra` values may expose config in app metadata.
- Fix approach: Remove the `extra.firebase*` fields from `app.config.ts`. The `EXPO_PUBLIC_*` env vars in `config.ts` are sufficient.

**No Firebase security rules defined:**
- Issue: The architecture specifies Firestore collections and access patterns but no `firestore.rules` or `storage.rules` file exists in the repository.
- Files: Missing `firestore.rules`, missing `storage.rules`
- Impact: Default Firebase rules are in effect. In development this may allow all reads/writes; in production this is a critical security gap.
- Fix approach: Add `firestore.rules` enforcing that users can only read/write their own documents and only group members can access group data. Add `storage.rules` restricting upload paths to authenticated users.

**No Firebase composite indexes defined:**
- Issue: `.claude/specs/architecture.md` Sections 3.3, 3.4, and 3.5 specify multiple composite Firestore indexes required for production queries — including `(groupId, status)`, `(userId, groupId)`, and `(groupId, currentStreak DESC)` — but no `firestore.indexes.json` exists in the repository.
- Files: Missing `firestore.indexes.json`
- Impact: Composite queries will fail at runtime with a Firestore error. This blocks the review queue, leaderboard, and membership list features entirely.
- Fix approach: Create `firestore.indexes.json` with all indexes listed in the architecture document and deploy with `firebase deploy --only firestore:indexes`.

**`jest.config.js` uses an invalid config key for test file matching:**
- Issue: Line 9 of `jest.config.js` sets `testPathPattern`. This is a Jest CLI flag and is not a valid configuration file key — it is silently ignored at runtime. Test file discovery falls back to Jest defaults, which may not match the `.test.ts` / `.spec.ts` naming convention.
- Files: `jest.config.js` (line 9)
- Impact: Test files may not be discovered, giving a false sense that all tests pass when in fact no tests run.
- Fix approach: Replace `testPathPattern` with `testRegex: '.*\\.(test|spec)\\.(ts|tsx|js)$'`, which is a valid configuration file option.

**`newArchEnabled: false` in `app.config.ts`:**
- Issue: The new React Native architecture (Fabric / TurboModules) is explicitly disabled.
- Files: `app.config.ts` (line 11)
- Impact: Deliberate choice to maintain Expo Go compatibility, but requires revisiting when upgrading to Expo SDK 55+ where the new architecture becomes default.
- Fix approach: Add a comment documenting the reason. Revisit when migrating to Expo SDK 55+.

---

## Security Considerations

**Firebase API key bundled in client via `EXPO_PUBLIC_*`:**
- Risk: All `EXPO_PUBLIC_*` variables are bundled into the client JavaScript and visible to anyone who decompiles the app. Firebase API keys identify the project rather than authenticate access, but unrestricted keys combined with absent Firestore security rules allow arbitrary data reads and writes from any client.
- Files: `src/services/firebase/config.ts`, `.env.example`
- Current mitigation: `.env` is gitignored. API key is not in source control.
- Recommendations: Restrict the Firebase API key in Google Cloud Console to the app bundle ID and SHA-1 fingerprint. Implement Firestore and Storage security rules immediately. Enable Firebase App Check when building with a custom dev client.

**No input validation at the service layer:**
- Risk: All service functions are planned as plain TypeScript modules with no runtime validation. Form data validated by Zod at the screen layer can be bypassed if services are called directly — in tests, in future API routes, or by a compromised client.
- Files: All files under `src/services/firebase/` (pre-implementation concern)
- Current mitigation: None — services are not yet implemented.
- Recommendations: When implementing services, validate critical inputs (e.g., `groupId` is non-empty, `mediaType` is `"video" | "photo"`) before any Firestore write.

**Invite code has no expiry or entropy specification:**
- Risk: The architecture stores `inviteCode` as a short random code with an `inviteEnabled` boolean but defines no code length, entropy source, or expiry mechanism.
- Files: `src/services/firebase/groupService.ts` (not yet implemented)
- Current mitigation: The `inviteEnabled` flag allows disabling a link.
- Recommendations: When implementing `generateInviteCode`, use at least 8 cryptographically random characters via `crypto.getRandomValues`. Add an optional `inviteExpiresAt` timestamp to the group schema to support time-limited links.

---

## Performance Bottlenecks

**Realtime Firestore listeners not yet managed for cleanup:**
- Problem: The architecture specifies `onSnapshot` listeners in six hooks — `useGroup`, `useGroups`, `useLeaderboard`, `useStreak`, `useSubmission`, and `useReviewQueue`. If listeners are not unsubscribed on component unmount they leak memory and continue accumulating Firestore read charges.
- Files: `src/hooks/useGroup.ts`, `src/hooks/useGroups.ts`, `src/hooks/useLeaderboard.ts`, `src/hooks/useStreak.ts`, `src/hooks/useSubmission.ts`, `src/hooks/useReviewQueue.ts` (all empty — pre-implementation concern)
- Cause: No implementation exists yet to establish the pattern.
- Improvement path: Always return the `unsubscribe` function from `useEffect` cleanup. Establish this in the first hook implemented (`useAuth`) to set the standard for all subsequent hooks.

**Leaderboard query reads every member's streak document:**
- Problem: `useLeaderboard` will query all `streaks` documents for a `groupId` ordered by `currentStreak DESC`. As groups grow this reads the entire collection on every leaderboard render with no limit applied.
- Files: `src/hooks/useLeaderboard.ts` (not yet implemented)
- Cause: No pagination or query limit is specified in the architecture.
- Improvement path: Add `.limit(50)` to the leaderboard query. For large groups consider a denormalized top-N array on the group document updated by a Cloud Function.

**Offline upload queue has no size or staleness limits:**
- Problem: `offline/uploadQueue.ts` will persist media URIs in AsyncStorage indefinitely. A user recording multiple videos while offline can grow the queue without bound. Local video files may also be deleted by the OS while the queue still holds their URIs.
- Files: `src/services/offline/uploadQueue.ts` (not yet implemented)
- Cause: The architecture spec does not define a maximum queue size or item age limit.
- Improvement path: Enforce a maximum of 10 queued items, apply a 24-hour age limit per item, and verify that the local file URI still exists before attempting each upload.

---

## Fragile Areas

**Streak calculation depends entirely on timezone correctness:**
- Files: `src/utils/streakUtils.ts`, `src/services/firebase/streakService.ts` (both empty)
- Why fragile: All date boundary logic uses the group's `referenceTimezone`. A single off-by-one error in timezone conversion silently breaks streaks for users in non-UTC zones. The architecture identifies this as the most logic-heavy service.
- Safe modification: Implement `streakUtils.ts` first and cover it with unit tests before wiring into `streakService`. Edge cases to cover: DST transitions, midnight submissions, technical grace window spanning midnight, and weekly grace reset at the Monday boundary.
- Test coverage: None. The architecture explicitly requires unit tests on `streakUtils.ts` before it is wired to the service (Phase 5, Step 7 of `.claude/specs/architecture.md`).

**Auth state race condition on cold start:**
- Files: `src/context/AuthContext.tsx` (empty), `src/navigation/RootNavigator.tsx` (empty)
- Why fragile: The auth flow requires `onAuthStateChanged` to fire, then a Firestore profile fetch to complete, and then a navigation decision. If the Firestore fetch is slow on a cold start, `loading` may flip to `false` before the profile resolves, causing a flash to the auth screen for an already-signed-in user.
- Safe modification: Keep `loading: true` in `AuthContext` until both the Firebase auth state and the Firestore profile fetch have resolved. The `AuthContextValue.loading` field in the architecture spec must cover both async steps.
- Test coverage: None.

**Admin tab visibility depends on a runtime membership query:**
- Files: `src/navigation/MainNavigator.tsx` (empty)
- Why fragile: The Admin tab is shown only when the user holds `admin` or `co-admin` role in at least one group. This requires querying memberships on every app load. A slow or failed query causes the tab to flash in or out incorrectly.
- Safe modification: Cache the admin status in `AuthContext` after sign-in rather than querying in the navigator component. Default the tab to hidden until admin status is confirmed.
- Test coverage: None.

**Deep-link navigation before `NavigationContainer` is ready:**
- Files: `src/navigation/linking.ts` (empty), `src/app/index.tsx` (empty)
- Why fragile: The notification handler (`notificationService.handleNotificationResponse`) will call `navigation.navigate`, but on a cold launch from a notification tap, `NavigationContainer` may not be mounted yet when the handler fires.
- Safe modification: Use a `navigationRef` with a pending-navigation queue. Check `navigationRef.isReady()` before navigating; hold the action in the queue if not ready and flush it once the ref is ready.
- Test coverage: None.

---

## Missing Critical Features

**No active sprint in Jira:**
- Problem: No sprint has been started on the board. All 40+ stories are in "To Do" with no sprint assignment.
- Blocks: The agent workflow cannot move stories to "In Progress" or "Done" without an active sprint. The `project-manager` agent reports "No active sprint" on every invocation.
- Fix: Start Sprint 1 at https://comp586.atlassian.net/jira/software/projects/SCRUM/boards/1 and assign SCRUM-9 through SCRUM-12 (Phase 1 stories).

**Firebase Storage region unresolved:**
- Problem: The CHANGELOG records "Firebase Storage — region issue, revisit when we reach media submissions (SCRUM-20+)." Storage is initialized in `src/services/firebase/config.ts` but the bucket region was not finalized during Sprint 0.
- Blocks: All of Phase 3 (Proof Submission, SCRUM-20 through SCRUM-24) requires a working Storage bucket.
- Fix: Resolve the Firebase Storage region configuration before beginning Phase 3. Update `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` in `.env` with the correct bucket URL.

**No Firebase Cloud Functions project initialized:**
- Problem: SCRUM-29 (auto-approve submissions after 8 hours) and SCRUM-30 (admin inactivity escalation) are both specified as Firebase Cloud Function requirements. There is no `functions/` directory and no Functions project in the repository.
- Blocks: Auto-approval will never trigger without a scheduled function. Admin escalation (SCRUM-30) has no execution environment.
- Fix: Initialize a Firebase Functions project during Phase 4. Implement a scheduled function that queries `submissions` where `status == "pending"` and `autoApproveAt <= now()` and calls the approve action for each matching document.

---

## Test Coverage Gaps

**Zero test files exist:**
- What's not tested: The entire application — all business logic, all UI components, all service functions.
- Files: All of `src/`
- Risk: Any implementation can break silently. The streak calculation (the most critical business logic) will be completely unverified at the time it is first written.
- Priority: High

**Streak logic has no tests:**
- What's not tested: `src/utils/streakUtils.ts` and `src/services/firebase/streakService.ts` — timezone-aware day boundaries, grace day rules, streak freeze logic, technical grace window, and milestone detection.
- Files: `src/utils/streakUtils.ts`, `src/services/firebase/streakService.ts`
- Risk: Silent streak miscalculation breaks user trust and is extremely difficult to diagnose retroactively from production Firestore data.
- Priority: High — the architecture document requires unit tests on `streakUtils.ts` before the service is wired (Phase 5, Step 7).

**`jest.config.js` broken key prevents reliable test discovery:**
- What's not tested: The `testPathPattern` entry in `jest.config.js` is silently ignored (CLI flag, not a config option). Test discovery falls back to defaults and may miss `.test.ts` files entirely.
- Files: `jest.config.js` (line 9)
- Risk: Test files may not run, producing a misleading zero-failure result.
- Priority: Medium — fix before writing any tests.

---

*Concerns audit: 2026-04-04*
