# Architecture

**Analysis Date:** 2026-04-04

## Pattern Overview

**Overall:** Layered React Native (Expo) client with Firebase backend-as-a-service

**Key Characteristics:**
- All persistence, auth, and real-time sync delegated to Firebase (Firestore, Auth, Storage, FCM)
- Client logic organized into discrete layers: services → hooks → screens/components
- Navigation tree gates access by auth state via a root navigator
- Offline-first queue for video uploads via a dedicated offline service layer
- Firebase Cloud Functions (server-side) handle automated streak finalization, auto-approval fallback, and push notification dispatch — these run outside the client codebase

## Layers

**Services Layer:**
- Purpose: All Firebase SDK calls live here; no component touches Firebase directly
- Location: `src/services/firebase/`
- Contains: `authService.ts`, `groupService.ts`, `membershipService.ts`, `notificationService.ts`, `streakService.ts`, `submissionService.ts`, `config.ts`
- Depends on: Firebase SDK (`firebase/auth`, `firebase/firestore`, `firebase/storage`)
- Used by: Custom hooks in `src/hooks/`

**Offline Service:**
- Purpose: Queues video upload jobs when the network is unavailable and retries on reconnect
- Location: `src/services/offline/uploadQueue.ts`
- Depends on: `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`
- Used by: `src/hooks/useOfflineQueue.ts`, `src/hooks/useSubmission.ts`

**Hooks Layer:**
- Purpose: Business logic and state management; bridge between services and UI
- Location: `src/hooks/`
- Contains: `useAuth.ts`, `useGroup.ts`, `useGroups.ts`, `useLeaderboard.ts`, `useNetworkStatus.ts`, `useNotifications.ts`, `useOfflineQueue.ts`, `useReviewQueue.ts`, `useStreak.ts`, `useSubmission.ts`
- Depends on: `src/services/`, `src/context/`
- Used by: Screens and components in `src/screens/`, `src/components/`

**Context Layer:**
- Purpose: App-wide shared state (auth session, network status)
- Location: `src/context/`
- Contains: `AuthContext.tsx`, `NetworkContext.tsx`
- Depends on: `src/hooks/useAuth.ts`, `@react-native-community/netinfo`
- Used by: Any component needing global state; consumed via hooks

**Navigation Layer:**
- Purpose: Declarative screen routing; splits auth vs. main app flows
- Location: `src/navigation/`
- Contains: `RootNavigator.tsx`, `AuthNavigator.tsx`, `MainNavigator.tsx`, `HomeStackNavigator.tsx`, `SubmitStackNavigator.tsx`, `ProfileStackNavigator.tsx`, `AdminStackNavigator.tsx`, `linking.ts`
- Depends on: `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`, `src/context/AuthContext.tsx`
- Used by: `App.tsx` (root mount)

**Screens Layer:**
- Purpose: Full-page UI views, composed from components; own no business logic beyond calling hooks
- Location: `src/screens/`
- Subdirectories: `auth/`, `groups/`, `submissions/`, `leaderboard/`, `profile/`, `admin/`
- Depends on: `src/hooks/`, `src/components/`, `src/navigation/`

**Components Layer:**
- Purpose: Reusable, presentational UI pieces
- Location: `src/components/`
- Subdirectories: `common/`, `groups/`, `leaderboard/`, `streaks/`, `submissions/`
- Depends on: React Native primitives, `src/types/`

**Types Layer:**
- Purpose: Shared TypeScript interfaces and type definitions
- Location: `src/types/`
- Contains: `group.ts`, `membership.ts`, `navigation.ts`, `notification.ts`, `streak.ts`, `submission.ts`, `user.ts`
- Depends on: Nothing (pure types)
- Used by: All other layers

**Utils Layer:**
- Purpose: Pure helper functions with no side effects
- Location: `src/utils/`
- Contains: `constants.ts`, `dateUtils.ts`, `inviteLink.ts`, `permissions.ts`, `streakUtils.ts`
- Depends on: Nothing (pure functions)
- Used by: Hooks, screens, and components

## Data Flow

**Authenticated User Action (e.g., submit proof):**

1. User interacts with a screen in `src/screens/submissions/`
2. Screen calls a hook (`useSubmission.ts`) which manages loading/error state
3. Hook calls a service function in `src/services/firebase/submissionService.ts`
4. Service writes to Firestore and uploads to Firebase Storage
5. If offline, `uploadQueue.ts` persists job to AsyncStorage and retries on reconnect
6. Firestore real-time listener in the hook propagates updated data back to screen

**Auth Gate (app startup):**

1. `index.ts` registers root component via Expo's `registerRootComponent`
2. `App.tsx` mounts navigation tree
3. `RootNavigator.tsx` reads `AuthContext` to decide whether to render `AuthNavigator` or `MainNavigator`
4. `AuthContext` subscribes to Firebase Auth state changes; any sign-in/sign-out toggles the navigator

**Admin Review Flow:**

1. Admin opens `ReviewQueueScreen.tsx` → `useReviewQueue.ts` fetches pending submissions from Firestore
2. Admin approves/flags in `ReviewDetailScreen.tsx` → hook calls `submissionService.ts`
3. Firestore update triggers Cloud Function (server-side) to finalize streak credit

**Streak Finalization (server-side):**

1. Firebase Cloud Function listens to Firestore events (deadline, inactivity, grace-day)
2. Function writes updated streak documents to Firestore
3. Real-time listener in `useStreak.ts` propagates change to streak UI components

**State Management:**
- No global store (Redux/Zustand). State is React context for session-level globals (`AuthContext`, `NetworkContext`) and local React state inside hooks for feature-scoped data.

## Key Abstractions

**Firebase Config Singleton:**
- Purpose: Initializes Firebase once and exports `auth`, `db`, `storage` clients
- File: `src/services/firebase/config.ts`
- Pattern: Guards re-initialization on hot reload with `getApps().length === 0` check

**Service Functions:**
- Purpose: Each domain (auth, group, membership, submission, streak, notification) has a dedicated service file encapsulating all Firestore/Storage calls
- Examples: `src/services/firebase/authService.ts`, `src/services/firebase/groupService.ts`
- Pattern: Plain async functions; no class instances

**Custom Hooks:**
- Purpose: Encapsulate a single feature's state, loading, and error management
- Examples: `src/hooks/useGroups.ts`, `src/hooks/useStreak.ts`
- Pattern: Return `{ data, isLoading, error, ...actions }` tuple

**Navigation Param Types:**
- Purpose: Typed route params for all navigators, eliminating `any` prop drilling
- File: `src/types/navigation.ts`
- Pattern: `RootStackParamList`, `AuthStackParamList`, etc. passed to `@react-navigation` generics

**Offline Upload Queue:**
- Purpose: Persists upload jobs to AsyncStorage when offline; retries automatically on reconnect
- File: `src/services/offline/uploadQueue.ts`
- Pattern: Queue items serialized to AsyncStorage; `useNetworkStatus.ts` triggers drain on reconnect

## Entry Points

**App Bootstrap:**
- Location: `index.ts`
- Triggers: Expo runtime on device launch
- Responsibilities: Registers root component via `registerRootComponent(App)`

**App Root Component:**
- Location: `App.tsx`
- Triggers: Called by Expo runtime after registration
- Responsibilities: Renders navigation tree; should wrap with context providers (`AuthContext`, `NetworkContext`)

**Navigation Root:**
- Location: `src/navigation/RootNavigator.tsx`
- Triggers: Mounted by `App.tsx`
- Responsibilities: Reads auth state; conditionally renders `AuthNavigator` (unauthenticated) or `MainNavigator` (authenticated)

**Expo Config:**
- Location: `app.config.ts`
- Triggers: Expo CLI at build/start time
- Responsibilities: Declares app metadata, platform icons, Firebase environment variables passed via `extra`

## Error Handling

**Strategy:** Error state contained within each custom hook; surfaces to screen via returned `error` value

**Patterns:**
- Service functions throw on Firebase errors; hooks catch and store in local `error` state
- `ErrorBanner.tsx` component (`src/components/common/ErrorBanner.tsx`) renders inline error messages
- Offline errors surfaced via `OfflineBanner.tsx` (`src/components/common/OfflineBanner.tsx`) driven by `NetworkContext`

## Cross-Cutting Concerns

**Logging:** Not yet established (scaffold phase; no logging library added)
**Validation:** `zod` + `react-hook-form` — form input validation in screens
**Authentication:** Firebase Auth session; gated at navigation level via `AuthContext` and `RootNavigator`
**Offline Support:** `uploadQueue.ts` + `useOfflineQueue.ts` + `NetworkContext` for queued upload retry
**Permissions:** `src/utils/permissions.ts` — camera and media library permission helpers

---

*Architecture analysis: 2026-04-04*
