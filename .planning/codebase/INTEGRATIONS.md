# External Integrations

**Analysis Date:** 2026-04-04

## APIs & External Services

**Backend-as-a-Service:**
- Firebase (Google) - Core backend platform
  - SDK/Client: `firebase` ^12.11.0 (modular v9+ API)
  - Config: `src/services/firebase/config.ts`
  - Exports: `auth`, `db`, `storage` — shared singletons used across all service modules
  - Auth: All six `EXPO_PUBLIC_FIREBASE_*` env vars required at build time

**Push Notifications:**
- Expo Push Notification Service - Delivers push notifications to iOS and Android
  - SDK/Client: `expo-notifications` ~0.32.16
  - Service stub: `src/services/firebase/notificationService.ts` (empty — not yet implemented)
  - Hook stub: `src/hooks/useNotifications.ts` (empty — not yet implemented)
  - Device info used for token registration: `expo-device` ~8.0.10

## Data Storage

**Databases:**
- Firebase Firestore (NoSQL document database)
  - Connection: `EXPO_PUBLIC_FIREBASE_PROJECT_ID` (part of Firebase config)
  - Client: `getFirestore` from `firebase/firestore` — exported as `db` from `src/services/firebase/config.ts`
  - Service modules (all currently empty stubs):
    - `src/services/firebase/groupService.ts`
    - `src/services/firebase/membershipService.ts`
    - `src/services/firebase/streakService.ts`
    - `src/services/firebase/submissionService.ts`

**File Storage:**
- Firebase Cloud Storage - Video and image submission uploads
  - Connection: `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - Client: `getStorage` from `firebase/storage` — exported as `storage` from `src/services/firebase/config.ts`
  - Upload queue for offline support: `src/services/offline/uploadQueue.ts` (stub)

**Local Storage:**
- AsyncStorage (`@react-native-async-storage/async-storage` 2.2.0) - Persistent local key-value store
  - Used for: offline queue persistence, cached data, auth state
- Expo FileSystem (`expo-file-system` ~19.0.21) - Local file operations for media staging before upload

**Caching:**
- AsyncStorage (local only; no dedicated cache layer or Redis)

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication
  - Client: `getAuth` from `firebase/auth` — exported as `auth` from `src/services/firebase/config.ts`
  - Service: `src/services/firebase/authService.ts` (empty stub — implementation pending)
  - Context: `src/context/AuthContext.tsx` (empty stub — implementation pending)
  - Hook: `src/hooks/useAuth.ts` (empty stub — implementation pending)
  - Screens: `src/screens/auth/SignInScreen.tsx`, `src/screens/auth/RegisterScreen.tsx`, `src/screens/auth/WelcomeScreen.tsx`, `src/screens/auth/SetupProfileScreen.tsx`
  - Expected auth methods: Email/password (inferred from register/sign-in screens)

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Bugsnag, or Datadog SDK present)

**Logs:**
- No structured logging library detected; console-based logging expected

**Analytics:**
- None detected (no Firebase Analytics, Mixpanel, Amplitude, etc.)

## CI/CD & Deployment

**Hosting:**
- Expo EAS (inferred from Expo managed workflow and `expo` ~54.0.0)
- No `eas.json` present yet — EAS not yet configured

**CI Pipeline:**
- None detected (no GitHub Actions, CircleCI, or Bitrise config)

## Device Capabilities (Native Integrations)

**Camera:**
- `expo-camera` ~17.0.10 - Live camera capture for video submissions
- Screens: `src/screens/submissions/CameraScreen.tsx`

**Media Library:**
- `expo-image-picker` ~17.0.10 - Gallery picker for selecting existing media
- `expo-media-library` ~18.2.1 - Access and save to device media library
- Screens: `src/screens/submissions/GalleryPickerScreen.tsx`

**Audio/Video Playback:**
- `expo-av` ~16.0.8 - Video playback for submission preview and admin review
- Components: `src/components/submissions/VideoPlayer.tsx`

**Network Detection:**
- `@react-native-community/netinfo` 11.4.1 - Monitors connectivity state
- Context: `src/context/NetworkContext.tsx` (stub)
- Hook: `src/hooks/useNetworkStatus.ts` (stub)
- Component: `src/components/common/OfflineBanner.tsx`

## Deep Linking

**Invite Links:**
- `expo-linking` ~8.0.11 - Handles deep link routing for group invite URLs
- Navigation config: `src/navigation/linking.ts`
- Screen: `src/screens/groups/InviteLinkScreen.tsx`

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected (Firebase Firestore and Storage use SDK-based communication, not webhooks)

## Environment Configuration

**Required env vars:**
```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
```

**Secrets location:**
- `.env` file at project root (gitignored)
- `.env.example` committed with empty values for reference
- Variables exposed to app bundle at build time via `app.config.ts` `extra` block

---

*Integration audit: 2026-04-04*
