# Design Patterns — AccountiBuzz

**Project:** AccountiBuzz  
**Stack:** React Native (Expo) + Firebase  
**Author:** Timothy Do  
**Date:** 2026-04-04

---

## Overview

AccountiBuzz is a mobile accountability app built with React Native (Expo) and Firebase. The application architecture applies several well-established software design patterns to enforce separation of concerns, maintainability, and scalability. This document describes each pattern, where it is applied in the codebase, and the rationale behind its use.

---

## 1. Layered Architecture (Structural)

### Description

The application is organised into discrete horizontal layers, where each layer has a single responsibility and may only depend on the layer directly beneath it. No layer skips a level.

### Layers (top to bottom)

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Screens | `src/screens/` | Render UI; delegate all logic to hooks |
| Components | `src/components/` | Reusable, presentational UI pieces |
| Hooks | `src/hooks/` | Business logic, state, and side effects |
| Services | `src/services/firebase/` | All Firebase SDK calls; data access |
| Types | `src/types/` | Shared TypeScript interfaces; no logic |

### Rule enforced

Screens never import from `src/services/` directly. All data access goes through hooks, which in turn call services. This means Firebase can be replaced or mocked without touching a single screen.

### Example flow — submitting proof

```
SubmitScreen.tsx
  → useSubmission.ts        (hook: manages upload state)
    → submissionService.ts  (service: writes to Firestore + Storage)
      → Firebase SDK
```

### Rationale

Layered architecture reduces coupling between UI and data concerns. It makes the codebase easier to test, extend, and reason about, because the responsibility of each file is unambiguous from its location alone.

---

## 2. Service Layer / Repository Pattern (Structural)

### Description

All interactions with Firebase (Firestore, Firebase Storage, Firebase Auth) are encapsulated in dedicated service files under `src/services/firebase/`. No component or hook calls the Firebase SDK directly.

### Service files

| File | Responsibility |
|------|---------------|
| `authService.ts` | Register, sign in, sign out, auth state |
| `groupService.ts` | Create group, generate invite link, change mode |
| `membershipService.ts` | Join group, update role, set Sabbatical status |
| `submissionService.ts` | Upload proof, timestamp submission, query pending |
| `streakService.ts` | Read and update streak documents |
| `notificationService.ts` | Register FCM token, send notifications |

### Example

```ts
// src/services/firebase/submissionService.ts
export async function createSubmission(
  groupId: string,
  userId: string,
  mediaUri: string,
  mediaType: 'photo' | 'video'
): Promise<string> {
  // All Firebase logic lives here
}
```

### Rationale

Centralising data access in service files means that if Firebase changes its API, or if the backend is swapped entirely, only the service layer needs updating. The rest of the codebase remains untouched. It also enables clean unit testing — services can be mocked at the hook boundary.

---

## 3. Observer Pattern (Behavioural)

### Description

Rather than polling for updates, the application subscribes to real-time Firestore document and collection listeners via `onSnapshot`. When data changes in the database (e.g. a friend submits proof, an admin approves a submission), the change is pushed to all listening clients automatically.

### Where it is applied

| Hook | What it observes |
|------|-----------------|
| `useGroups.ts` | User's group list |
| `useLeaderboard.ts` | Leaderboard rankings in real time |
| `useStreak.ts` | Member's current streak count |
| `useReviewQueue.ts` | Admin's pending submission queue |
| `useSubmission.ts` | Submission status updates |

### Pattern structure

```ts
// Inside a hook — classic Observer subscription
useEffect(() => {
  const unsubscribe = onSnapshot(query, (snapshot) => {
    // Called every time data changes — push, not pull
    setData(snapshot.docs.map(doc => doc.data()))
  })

  return () => unsubscribe() // Cleanup on unmount
}, [groupId])
```

### Why this matters for AccountiBuzz

The core mechanic — seeing in real time that your friends have already completed the challenge — is powered entirely by the Observer pattern. When a friend's submission is approved, every member's leaderboard and completion board updates instantly without a manual refresh.

### Rationale

The Observer pattern decouples the data producer (Firestore) from the consumers (screens). New observers can be added without modifying the data source. It is the natural fit for real-time social features.

---

## 4. Command Pattern (Behavioural)

### Description

The offline upload queue encapsulates each media upload as a serialised command object. When the device has no network connection, upload jobs are stored in AsyncStorage rather than dropped. When connectivity is restored, the queue is drained and each command is executed in order.

### Where it is applied

| File | Role |
|------|------|
| `src/services/offline/uploadQueue.ts` | Persists and executes upload commands |
| `src/hooks/useOfflineQueue.ts` | Manages queue state and drain trigger |
| `src/hooks/useNetworkStatus.ts` | Notifies when to drain (network restored) |
| `src/context/NetworkContext.tsx` | Broadcasts network state app-wide |

### Command object structure

```ts
type UploadJob = {
  id: string
  groupId: string
  userId: string
  localUri: string        // Path to media on device
  mediaType: 'photo' | 'video'
  initiatedAt: string     // ISO timestamp — set at tap, not upload
  retryCount: number
}
```

### Execution flow

```
User taps "Submit" (offline)
  → Job serialised → AsyncStorage
  → Network restored
    → Queue drains → submissionService.ts executes each job
```

### Rationale

Submissions are timestamped at the moment the user taps submit, not when the upload completes. This means poor connectivity cannot unfairly penalise a member who submitted on time. The Command pattern enables this deferred, reliable execution.

---

## 5. Strategy Pattern (Behavioural)

### Description

A group can operate in one of two modes — **Competitive** or **Collaborative**. Both modes share the same underlying submission and streak data, but they display it differently. The mode acts as a strategy that determines which view is rendered.

### Where it is applied

| Mode | Strategy | Screen |
|------|----------|--------|
| Competitive | Ranked leaderboard (fastest + most consistent) | `LeaderboardScreen.tsx` |
| Collaborative | Completion board (who has submitted today) | `CompletionBoardScreen.tsx` |

### Pattern structure

```ts
// Group navigator selects strategy based on group.mode
function GroupHomeScreen({ group }: Props) {
  if (group.mode === 'competitive') {
    return <LeaderboardScreen groupId={group.id} />
  }
  return <CompletionBoardScreen groupId={group.id} />
}
```

### Rationale

Different groups have different motivational needs. A competitive group of gym friends may want a ranked leaderboard; a supportive study group may prefer seeing who has checked in without ranking. The Strategy pattern allows the behaviour to be swapped at runtime without changing the underlying data model.

---

## 6. Custom Hook Pattern (React-specific)

### Description

All business logic, side effects, and feature-scoped state are extracted from screens into dedicated custom hooks. Screens remain purely presentational — they call a hook and render what it returns.

### Convention

Every hook returns a consistent shape:

```ts
const { data, isLoading, error, ...actions } = useFeatureName()
```

### Example hooks

| Hook | Returns |
|------|---------|
| `useAuth.ts` | `{ user, isLoading, signIn, register, signOut }` |
| `useStreak.ts` | `{ streak, isLoading, error }` |
| `useSubmission.ts` | `{ submissions, isLoading, error, submitProof }` |
| `useReviewQueue.ts` | `{ queue, isLoading, approve, reject, flag }` |

### Rationale

Extracting logic into hooks makes screens thin and readable. It also makes the logic independently testable — a hook can be tested without rendering any UI. This is the React idiomatic equivalent of a ViewModel in MVVM.

---

## 7. Provider / Context Pattern (React-specific)

### Description

App-wide shared state that would otherwise require prop drilling is managed via React Context. Providers wrap the navigation tree at the root and make state available to any component in the app.

### Contexts

| Context | Location | Provides |
|---------|----------|----------|
| `AuthContext` | `src/context/AuthContext.tsx` | Current user, auth loading state |
| `NetworkContext` | `src/context/NetworkContext.tsx` | Online/offline status |

### Structure

```
App.tsx
  └── AuthContext.Provider
        └── NetworkContext.Provider
              └── NavigationContainer
                    └── RootNavigator  ← reads AuthContext to gate access
```

### Rationale

Auth state and network status are cross-cutting concerns needed throughout the app. Context avoids passing these values through every component prop chain. The `RootNavigator` reads `AuthContext` to decide whether to render the auth flow or the main app — a clean, centralised auth gate.

---

## Summary

| Pattern | Category | Where Applied |
|---------|----------|---------------|
| Layered Architecture | Structural | Entire codebase (`types → services → hooks → screens`) |
| Service Layer | Structural | `src/services/firebase/` |
| Observer | Behavioural | Firestore `onSnapshot` listeners in all hooks |
| Command | Behavioural | Offline upload queue (`uploadQueue.ts`) |
| Strategy | Behavioural | Competitive vs. Collaborative group mode |
| Custom Hook | React | All feature logic in `src/hooks/` |
| Provider / Context | React | `AuthContext`, `NetworkContext` |

---

*Document generated: 2026-04-04*  
*Codebase: `E:\claude\projects\accountibuzz`*
