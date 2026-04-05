# Technology Stack

**Analysis Date:** 2026-04-04

## Languages

**Primary:**
- TypeScript 5.3.3 - All source code in `src/`, config files (`app.config.ts`, `jest.config.js` uses JS)

**Secondary:**
- JavaScript - `jest.config.js`, root `index.ts` entry shim

## Runtime

**Environment:**
- React Native 0.76.9 via Expo managed workflow
- Targets: iOS, Android, and Web (via `react-native-web`)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Expo ~54.0.0 - Managed workflow, provides native module abstraction, dev tooling, build pipeline
- React 18.3.1 - UI rendering
- React Native 0.76.9 - Cross-platform mobile primitives

**Navigation:**
- `@react-navigation/native` ^7.2.0 - Navigation container and core
- `@react-navigation/native-stack` ^7.14.7 - Stack navigator
- `@react-navigation/bottom-tabs` ^7.15.7 - Tab bar navigator
- `react-native-screens` ~4.16.0 - Native screen optimization
- `react-native-safe-area-context` ~5.6.0 - Safe area insets

**Forms & Validation:**
- `react-hook-form` ^7.72.0 - Form state management
- `@hookform/resolvers` ^5.2.2 - Schema-based resolver bridge
- `zod` ^4.3.6 - Schema validation and type inference

**Testing:**
- Jest ^30.3.0 - Test runner
- `ts-jest` ^29.4.6 - TypeScript transformer for Jest
- `@testing-library/react-native` ^12.9.0 - Component testing utilities
- `react-test-renderer` ^18.3.1 - React rendering for tests

**Build/Dev:**
- Expo CLI (`expo start`, `expo start --android`, `expo start --ios`, `expo start --web`)
- Metro bundler (managed by Expo)
- `@expo/metro-runtime` ~4.0.1 - Web Metro runtime

## Key Dependencies

**Critical:**
- `firebase` ^12.11.0 - Backend-as-a-service: Auth, Firestore database, Cloud Storage
- `expo-notifications` ~0.32.16 - Push notification scheduling and receipt handling
- `expo-camera` ~17.0.10 - In-app camera for video/photo capture (submission flow)
- `expo-image-picker` ~17.0.10 - Gallery selection for submissions
- `expo-av` ~16.0.8 - Audio/video playback (submission preview and review)
- `expo-file-system` ~19.0.21 - Local file access for offline queuing and media handling
- `expo-media-library` ~18.2.1 - Access device media library
- `@react-native-async-storage/async-storage` 2.2.0 - Persistent local key-value storage
- `@react-native-community/netinfo` 11.4.1 - Network connectivity detection (offline support)

**Infrastructure:**
- `expo-linking` ~8.0.11 - Deep linking support (invite links)
- `expo-localization` ~17.0.8 - Locale/timezone detection
- `expo-device` ~8.0.10 - Device info (used for push token registration)
- `expo-status-bar` ~2.0.1 - Status bar control

## Configuration

**Environment:**
- Variables prefixed `EXPO_PUBLIC_` are inlined at build time by Expo
- Required vars (see `.env.example`):
  - `EXPO_PUBLIC_FIREBASE_API_KEY`
  - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
  - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `EXPO_PUBLIC_FIREBASE_APP_ID`
- `.env` file present at project root (not committed — gitignored)
- `.env.example` committed with empty values as reference

**Build:**
- `app.config.ts` - Dynamic Expo config; reads env vars and injects into `extra`
- `tsconfig.json` - Extends `expo/tsconfig.base`; strict mode on; path alias `@/*` → `src/*`
- `jest.config.js` - ts-jest preset; `node` test environment; `@/` alias mapped

**TypeScript:**
- Strict mode enabled
- Path alias `@/*` resolves to `src/*`; used for all internal imports

## Platform Requirements

**Development:**
- Node.js (version not pinned; no `.nvmrc` or `.node-version`)
- Expo Go app (for quick iteration) or native build via Expo EAS
- Firebase project credentials in `.env`

**Production:**
- iOS: App Store distribution via Expo EAS Build
- Android: Play Store distribution via Expo EAS Build
- Web: Static bundle via `expo export --platform web`
- No server-side runtime — fully client + Firebase BaaS

---

*Stack analysis: 2026-04-04*
