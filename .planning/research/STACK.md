# Stack Research — Accountibuzz

**Domain:** Mobile accountability / social-gamification app (iOS + Android, solo-builder MVP)
**Researched:** 2026-04-21
**Confidence:** HIGH (core picks verified against Expo SDK 55 official docs and Supabase official quickstart; a few ancillary library pins are MEDIUM)

Scope validated against upstream constraints: React Native + Expo + Supabase are already chosen. This doc pins *specific* libraries/versions for SDK 55 (released Feb 25, 2026 — the current stable line) and flags which ones force a development build vs. staying in Expo Go.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Expo SDK** | `55` (expo@~55.0.x) | App framework / native build system | Current stable (Feb 2026). Ships RN 0.83.1 + React 19.2, New Architecture only, Hermes v1. First-party libraries for camera, video, notifications, secure store, linking — all the pieces this MVP needs. |
| **React Native** | `0.83.1` | UI runtime | Pinned by Expo SDK 55. Do not hand-bump. |
| **React** | `19.2.0` | Component model | Pinned by SDK 55. |
| **TypeScript** | `~5.8` | Type safety | Default template for `create-expo-app@latest --template default@sdk-55`. Non-negotiable for a solo builder — types pay rent on day one. |
| **Expo Router** | `~6.x` (ships with SDK 55) | Navigation | File-based routing built *on top of* React Navigation 7. Auto-generated deep links — critical for the invite-link flow (`accountibuzz://join/CODE` and universal-link equivalent). Default in new SDK 55 projects; Expo's own recommendation for new apps. |
| **Supabase JS** | `@supabase/supabase-js@^2.58` | Postgres + Auth + Storage + Realtime client | Already-chosen backend. v2.58 is current on npm as of researched date. |
| **EAS Build + EAS Update** | latest | Cloud native builds + OTA JS updates | Needed the moment you add `expo-notifications` (dev client required — see Pitfalls). Free tier is enough for solo MVP; eliminates "my Xcode broke" as a blocker. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@tanstack/react-query** | `^5.x` | Server state (leaderboard, submissions, group rosters) | Use for *all* Supabase reads. Pair with `invalidateQueries` driven by Supabase Realtime subscriptions to get near-live leaderboards without wiring Realtime into components. In v5, `isLoading` was renamed to `isPending` — watch for stale tutorials. |
| **zustand** | `^5.x` | Client/UI state (current group selector, capture modal, session bootstrap) | Only for state that isn't server-owned. Don't cache Supabase rows here — that's TanStack Query's job. |
| **@react-native-async-storage/async-storage** | `^2.x` (SDK 55 compatible) | Session persistence backing store for supabase-js | Required for `createClient({ auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }})`. Official Supabase-Expo quickstart pattern. |
| **expo-secure-store** | SDK 55 version | Encrypt the AsyncStorage-stored session | Recommended hybrid pattern from Supabase docs: 256-bit AES key in SecureStore, encrypted session blob in AsyncStorage (SecureStore has a ~2KB value limit, so you can't put the whole session there). Add `aes-js` + `react-native-get-random-values` as the crypto primitives. |
| **expo-camera** | SDK 55 version (`CameraView` API) | Photo + video capture | Native first-party Expo module. `CameraView` component supports `takePictureAsync` and video recording with codec/quality/bitrate control. Works in Expo Go and dev client. Sufficient for the MVP's "point, shoot, upload" flow — no need to reach for `react-native-vision-camera`. |
| **expo-image-picker** | SDK 55 version | Fallback: pick existing photo/video from library | Some submissions will be "I already took the photo" — ImagePicker covers that without wiring a custom gallery. |
| **expo-video** | SDK 55 version | Play back video submissions in the review/feed UI | **`expo-av` was fully removed in SDK 55.** New API is split: `VideoPlayer` (logic) + `VideoView` (UI). Mandatory if the group's submission type is video. |
| **expo-image** | SDK 55 version | Display photo submissions + avatars | Faster than `<Image>`, supports caching + blurhash placeholders; cheap win. |
| **expo-notifications** | SDK 55 version | Register for push, handle foreground/tap, schedule local reminders | **Forces a development build on both platforms in SDK 55.** Android push in Expo Go now *throws* (was a warning in 53, enforced in 55). iOS push has been dev-client-only for multiple SDKs. Local notifications still work in Expo Go — fine for the "pre-deadline reminder" if you keep it client-scheduled, but you still need a dev build for verification/ping notifications. |
| **expo-linking** | SDK 55 version | Parse inbound invite URLs | Paired with Expo Router, every screen is auto-linkable. Use `expo-linking`'s `createURL` + `useURL` for the invite `join/[code]` route. |
| **base64-arraybuffer** | `^1.x` | Decode base64 → ArrayBuffer for Supabase Storage uploads | Required shim: React Native has no native `File`/`Blob` that Supabase Storage accepts reliably. Canonical pattern (per Supabase's own RN blog post) is: read media with `expo-file-system` as base64, `decode()` to ArrayBuffer, upload with `contentType` set explicitly. |
| **expo-file-system** | SDK 55 version | Read captured media URI → base64 for upload | Pairs with `base64-arraybuffer` above. Also useful for clearing the capture cache after successful upload. |
| **react-hook-form + @hookform/resolvers + zod** | RHF `^7.x`, Zod `^3.x` | Form state + runtime validation (signup, create-group, admin review notes) | Standard 2026 pairing. Uncontrolled inputs → fewer re-renders on RN; Zod schemas double as TS types. |
| **date-fns** or **Luxon** | latest | Timezone-aware "day" math for the midnight cutoff | **Luxon is preferred here** — first-class IANA timezone handling is exactly the load-bearing requirement (each group has a `timezone` and a local-midnight cutoff). date-fns-tz works but is fiddlier. |
| **react-native-safe-area-context** | SDK 55 version | Safe-area insets | Ships with the default template; needed for the camera overlay UI. |
| **react-native-gesture-handler + reanimated** | SDK 55 versions | Animations / swipe-to-review on admin queue | Reanimated 4 under SDK 55. Both are required peer deps of Expo Router anyway. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **EAS CLI** (`eas-cli`) | Cloud builds, OTA updates, credentials | `npm i -g eas-cli`. Run `eas build --profile development --platform ios` once you add `expo-notifications` — after that, you are in "dev client" land for the rest of the project. |
| **expo-dev-client** | Custom dev client replacing Expo Go | Required for push. Install with `npx expo install expo-dev-client`. Keep Expo Go on the phone too for quick UI iteration on screens that don't need push. |
| **EAS Submit** | Later — TestFlight + Play Internal track | Not needed on day one; MVP can ship via ad-hoc TestFlight once push works. |
| **Supabase CLI** | Migrations, local dev, edge function deploy | Check DDL into `supabase/migrations/`. Use Supabase Edge Functions (Deno) for the server-side "send push to group" fan-out. |
| **Flipper / React DevTools** | Debugging | With SDK 55 on New Arch, prefer React DevTools + Hermes debugger over Flipper (Flipper has been de-emphasized). |
| **ESLint + Prettier** | Lint/format | Use the `eslint-config-expo` preset — it's SDK-version aware. |

---

## Installation

```bash
# 1. Scaffold the project (SDK 55 template, TypeScript, Expo Router)
npx create-expo-app@latest accountibuzz --template default@sdk-55
cd accountibuzz

# 2. Core backend + state
npx expo install @supabase/supabase-js
npx expo install @react-native-async-storage/async-storage
npx expo install expo-secure-store
npm install aes-js react-native-get-random-values
npm install @tanstack/react-query zustand

# 3. Media capture + playback + upload
npx expo install expo-camera expo-image-picker expo-image expo-video expo-file-system
npm install base64-arraybuffer

# 4. Notifications + linking (these push you to a dev build)
npx expo install expo-notifications expo-linking expo-dev-client

# 5. Forms + time math
npm install react-hook-form @hookform/resolvers zod luxon
npm install -D @types/luxon

# 6. Dev tooling
npm install -g eas-cli
eas login
eas build:configure

# 7. First development build (required once expo-notifications is installed)
eas build --profile development --platform ios
eas build --profile development --platform android
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Expo Router 6** | React Navigation 7 (bare) | If you were migrating an existing RN app with non-file-based structure, or needed unusual nested navigation patterns Expo Router doesn't express well. For a greenfield MVP, no. |
| **expo-camera** | `react-native-vision-camera` | Vision Camera has better low-level control (frame processors, ML, custom pixel formats). Overkill for "take a photo of the thing you did." Vision Camera *does* work with Expo dev client (via config plugin) but adds complexity and eats your Expo-Go-friendly screens. |
| **TanStack Query + Zustand** | Redux Toolkit + RTK Query | RTK Query is fine but heavier-weight and the community momentum in 2026 is decisively TanStack for server state. Zustand beats Redux for the tiny amount of client state this app has. |
| **Supabase Auth** | Clerk, Auth0 | Already bundled with chosen backend — zero reason to add a second auth vendor for an MVP. Use magic-link + (optionally) Apple/Google OAuth. |
| **Expo Push Service (`exp.host/--/api/v2/push/send`)** | Direct FCM + APNs from a server | Expo's push service is free, handles both platforms, gives you delivery tickets + receipts, and integrates with `expo-notifications` tokens out of the box. Go direct only if you hit the 600 msg/sec/project cap (you won't, at MVP scale) or need provider-specific features. |
| **Luxon** | `date-fns` + `date-fns-tz` | date-fns is lighter, but Luxon's IANA-first API is a better fit for the "group timezone → local midnight" logic that lives on the hot path. |
| **AsyncStorage (plain)** | Encrypted AsyncStorage via SecureStore hybrid | Plain AsyncStorage is the official Supabase quickstart pattern and is fine for the MVP. Upgrade to the encrypted hybrid before friends-and-family testing if you want session tokens at rest to be encrypted — Supabase's own docs call plain AsyncStorage "not secure enough by default." |
| **Expo Push Service** | OneSignal / Customer.io | Third-party push platforms add value only if you need marketing automation or user segmentation, neither of which is MVP-shaped. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`expo-av`** | **Removed in SDK 55.** Any 2024-era tutorial that imports `Audio`/`Video` from `expo-av` is dead. | `expo-video` (video) + `expo-audio` (audio, not needed for this MVP) |
| **Expo Go for push-notification testing** | SDK 55 throws (not warns) on `getExpoPushTokenAsync` in Expo Go on Android; iOS has been broken longer. | Development build via `eas build --profile development`. Plan for this from day one. |
| **`react-native-video`** in an Expo managed project | Requires extra config; `expo-video` now covers the use case natively with SDK 55. | `expo-video` |
| **Legacy Architecture opt-out** | SDK 55 **dropped support for the Legacy Arch**. New Arch is the only option. Any library that doesn't have a New Arch build is effectively off the table. | Verify every native dep is New Arch compatible before adding. |
| **`isLoading` in TanStack Query v5** | Renamed to `isPending`. Copy-pasting v4 snippets will silently break loading UI. | `isPending` for "no data yet"; `isFetching` for "refreshing in background". |
| **Blob/File-based Supabase Storage upload** | React Native's `Blob` is not spec-compliant; uploads land as 0-byte files. This is the single most common RN-Supabase bug. | base64 → ArrayBuffer via `base64-arraybuffer`, with `contentType` set explicitly on `.upload()`. |
| **Auto-refresh token in background** | supabase-js default will hammer the refresh endpoint while the app is backgrounded. | Wire `AppState` listener: `startAutoRefresh()` on foreground, `stopAutoRefresh()` on background (verbatim from Supabase's RN quickstart). |
| **`expo-secure-store` as the sole session store** | 2KB value limit will overflow once Supabase sessions include refresh token + JWT + user object. | Hybrid: encryption key in SecureStore, encrypted session in AsyncStorage. |
| **`detectSessionInUrl: true`** on React Native | Default is web-only behavior; leaving it on causes auth glitches on mobile. | Explicitly set `detectSessionInUrl: false` in the supabase-js client config. |
| **Firebase (FCM SDK) directly** | Duplicates what Expo Push Service already does; requires config plugin and forfeits Expo's ticket/receipt pipeline. | `expo-notifications` → Expo Push Service → FCM/APNs. |

---

## Stack Patterns by Variant

**If the MVP needs to stay in Expo Go as long as possible (fast iteration on non-push screens):**
- Keep `expo-notifications` stubbed behind a feature flag until the capture + leaderboard flows are solid.
- Use **local** notifications only (still works in Expo Go) for the pre-deadline reminder; defer remote push to a "push milestone" once you're ready to EAS-build.
- This buys you ~weeks of Expo Go simplicity before you *must* go dev-client.

**If a group picks video (not photo) as its submission type:**
- Cap recording at ~30 seconds via `maxDuration` in `CameraRecordingOptions` to keep uploads + storage bills bounded.
- Use `videoQuality: '720p'` and a fixed `videoBitrate` (~2 Mbps). 4K is an own-goal at MVP scale.
- Compress on-device before upload; Supabase Storage charges by egress too.

**If realtime leaderboard jitter becomes annoying:**
- Don't subscribe the whole leaderboard to Realtime. Subscribe only to `submissions` INSERT/UPDATE for the current group, and use that to `queryClient.invalidateQueries(['leaderboard', groupId])`. TanStack Query will refetch and diff.

**If friends-and-family testing happens before App Store submission:**
- iOS: TestFlight via `eas submit --platform ios --profile preview`.
- Android: Play Internal Testing track or direct APK (`eas build --profile preview --platform android`).
- No App Store review needed at this stage.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `expo@~55.0.x` | `react-native@0.83.1`, `react@19.2.0` | Do not upgrade RN/React independently. Always use `npx expo install` which pins SDK-compatible versions. |
| `@supabase/supabase-js@^2.58` | `@react-native-async-storage/async-storage@^2.x` | Pass AsyncStorage explicitly in `createClient` — supabase-js has no RN-specific default. |
| `expo-notifications` (SDK 55) | `expo-dev-client` **required**; Expo Go push = hard error on Android | Plan your first EAS dev build around the week you add this package. |
| `expo-video` (SDK 55) | Replaces `expo-av`; not back-compatible | Any `import { Video } from 'expo-av'` must be rewritten. |
| `react-navigation` libs | Managed transitively by `expo-router@~6` | Don't pin `@react-navigation/*` versions by hand; let Expo Router pull them. |
| `@tanstack/react-query@^5` | v5 uses `isPending` (not `isLoading`) | Stale v4 tutorials will mislead. |
| New Architecture | **Mandatory in SDK 55** | Audit every native dep for New Arch compatibility before install. |

---

## Push Notification Path (end-to-end)

1. **Client registration** — `expo-notifications` calls `getExpoPushTokenAsync({ projectId })` → returns `ExponentPushToken[...]`. Store it in `profiles.expo_push_token` in Postgres (one row per user, nullable).
2. **Event trigger** — Supabase DB trigger (Postgres function) fires on `INSERT INTO submissions` or `UPDATE submissions SET status='approved'`.
3. **Fan-out** — Trigger calls a Supabase **Edge Function** (`pg_net` HTTP call) that POSTs to `https://exp.host/--/api/v2/push/send` with an array of up to 100 `ExpoPushToken`s for the group members.
4. **Delivery** — Expo's service forwards to APNs (iOS) / FCM (Android). You get a push ticket back.
5. **Receipt check** — A scheduled Edge Function (cron) polls `/--/api/v2/push/getReceipts` ~15 min later. If `details.error === 'DeviceNotRegistered'`, null out that user's `expo_push_token` so you stop hitting it.

Why Expo Push Service and not FCM/APNs direct: one API, both platforms, free, matches the tokens `expo-notifications` already hands you. The 600 msg/sec/project cap is not a problem at MVP scale (hundreds of users, not hundreds per second).

**Local scheduling** (pre-deadline reminder): `scheduleNotificationAsync` on-device at group-create time; reschedule if the group's timezone changes. No server round-trip, works in Expo Go too.

---

## Media Capture + Upload Path (end-to-end)

1. **Permission** — `useCameraPermissions()` from `expo-camera`. Block the capture screen until granted.
2. **Capture** — Render `<CameraView>`. On shutter, `cameraRef.current.takePictureAsync({ quality: 0.8 })` → returns local file URI in cache. For video, `recordAsync({ maxDuration: 30, videoQuality: '720p' })`.
3. **Read as base64** — `FileSystem.readAsStringAsync(uri, { encoding: 'base64' })`.
4. **Decode to ArrayBuffer** — `decode(base64)` from `base64-arraybuffer`.
5. **Upload** — `supabase.storage.from('submissions').upload(\`${groupId}/${userId}/${Date.now()}.jpg\`, arrayBuffer, { contentType: 'image/jpeg', upsert: false })`. Always set `contentType` explicitly — without it you get an octet-stream blob that won't preview.
6. **Insert row** — `supabase.from('submissions').insert({ group_id, user_id, storage_path, status: 'pending' })`. DB trigger fires → push to admin.
7. **Cleanup** — `FileSystem.deleteAsync(uri)` to keep app cache lean.

Why base64 → ArrayBuffer and not `FormData`/`Blob`: React Native's Blob implementation is quirky enough that the "uploads as 0 bytes" failure mode is the #1 reported RN-Supabase bug. The ArrayBuffer path is what Supabase's own RN blog post standardized on.

---

## Sources

- `/llmstxt/expo_dev_llms_txt` (Context7) — expo-camera CameraView API, expo-notifications push flow, SDK 55 APIs. **HIGH confidence.**
- `/supabase/supabase-js` (Context7) — supabase-js v2.58 confirmed as current. **HIGH confidence.**
- [Expo SDK 55 changelog](https://expo.dev/changelog/sdk-55) — release date, RN 0.83, React 19.2, New Arch only, Hermes v1. **HIGH confidence.**
- [Expo SDK reference (latest)](https://docs.expo.dev/versions/latest/) — versioned API for every `expo-*` module pinned here. **HIGH confidence.**
- [Expo push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) — dev-client requirement, token registration, Expo Push API endpoint. **HIGH confidence.**
- [Expo Router v55 announcement](https://expo.dev/blog/expo-router-v55-more-native-navigation-more-powerful-web) — Expo Router as default in new SDK 55 projects. **HIGH confidence.**
- [Using Supabase with Expo (official Expo guide)](https://docs.expo.dev/guides/using-supabase/) — AsyncStorage session pattern. **HIGH confidence.**
- [Supabase Expo React Native quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native) — canonical `createClient` config for RN, including `detectSessionInUrl: false` and AppState auto-refresh. **HIGH confidence.**
- [Supabase React Native Storage upload blog](https://supabase.com/blog/react-native-storage) — base64 → ArrayBuffer upload pattern. **HIGH confidence.**
- [Supabase "Getting started with React Native authentication"](https://supabase.com/blog/react-native-authentication) — SecureStore + AsyncStorage hybrid encryption pattern with `aes-js`. **HIGH confidence.**
- [Software Mansion: Moving from expo-av to expo-video](https://swmansion.com/blog/the-future-of-video-in-react-native-moving-from-expo-av-to-expo-video-6f4f78e51196/) — expo-av removed, `VideoPlayer` + `VideoView` split. **HIGH confidence.**
- [expo-notifications docs](https://docs.expo.dev/versions/latest/sdk/notifications/) — Android Expo Go throws in SDK 55; dev build required. **HIGH confidence.**
- [TanStack Query v5 docs](https://tanstack.com/query/latest) — v5 API, `isPending` rename, server vs. client state boundary. **HIGH confidence.**
- Community tutorials (Medium, dev.to, reactnativerelay.com) — used only for cross-checking; none treated as primary source. **LOW confidence when standalone, MEDIUM when they agree with official docs.**

---
*Stack research for: React Native + Expo + Supabase mobile accountability MVP*
*Researched: 2026-04-21*
