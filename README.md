# AccountiBuzz

A social accountability app for small groups. Members join a shared challenge, submit daily proof, and watch each other check in — the "you're the only one who didn't do it" moment drives action more than willpower alone.

Built with React Native + Expo + Firebase.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Comes with Node |
| Java JDK | 17 | Required for Android build |
| Android Studio | Latest | Needed for the emulator |

> **iOS?** An iPhone or Mac with Xcode is needed. The team currently develops on Android.

---

## First-Time Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd accountibuzz
npm install
```

### 2. Configure Firebase

```bash
cp .env.example .env
```

Open `.env` and fill in the Firebase credentials. Get them from the [Firebase Console](https://console.firebase.google.com) → your project → Project Settings → Your apps → Web app config.

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

> Ask a team member for the `.env` values — never commit the real credentials.

### 3. Enable Firebase services

In the Firebase Console, make sure these are turned on for the project:

- **Authentication** → Sign-in method → Email/Password: **Enable**
- **Firestore Database** → Create database (test mode is fine for dev)
- **Storage** → Get started (test mode) — requires Blaze plan

### 4. Set up an Android emulator

Open Android Studio → Virtual Device Manager → create a **Pixel 6** device with the latest system image (API 34+). Name it `Pixel_6`.

---

## Running the App

You need **two terminals** open.

**Terminal 1 — start the emulator**

```powershell
$env:PATH += ";$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator"
emulator -avd Pixel_6
```

Wait for the emulator to fully boot (home screen visible).

**Terminal 2 — run the app**

```bash
npm run android
```

The app will build and install on the emulator automatically. Hot reload is on — save a file and the app updates instantly.

---

## What's Built So Far

| Feature | Status |
|---------|--------|
| Register with email/password | Done |
| Sign in / sign out | Done |
| Display name setup (post-registration) | Done |
| Edit display name from profile | Done |
| Groups list screen | UI scaffold |
| Group detail + member list | UI scaffold |
| Leaderboard | UI scaffold |
| Profile screen | UI scaffold |
| Submit proof (photo/video) | Not started |
| Admin review queue | Not started |
| Streak tracking | Not started |
| Push notifications | Not started |

Scaffold screens show the intended UI with mock data. They are not wired to Firestore yet.

---

## Project Structure

```
src/
├── screens/
│   ├── auth/          # Welcome, Register, SignIn, SetupProfile
│   ├── groups/        # GroupList, GroupDetail, CreateGroup, ...
│   ├── leaderboard/   # Leaderboard, CompletionBoard
│   ├── profile/       # Profile, EditProfile, NotificationSettings
│   ├── submissions/   # SubmitChoice, Camera, Gallery, Preview, Status
│   └── admin/         # ReviewQueue, ReviewDetail
├── navigation/        # Tab, stack, and root navigators
├── components/        # Reusable UI (ErrorBanner, etc.)
├── services/firebase/ # All Firestore/Auth calls live here
├── hooks/             # useAuth, useGroup, useStreak, ...
├── context/           # AuthContext (auth state + profile)
├── types/             # TypeScript interfaces
└── utils/             # COLORS constants, error mappers
```

### Key rule: screens never talk to Firebase directly

```
Screen → Hook → Service → Firebase
```

All Firestore reads/writes go through `src/services/firebase/`. Screens call hooks, hooks call services.

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| Auth & DB | Firebase (Auth, Firestore, Storage) |
| Navigation | React Navigation v7 (bottom tabs + native stack) |
| Forms | React Hook Form + Zod |
| Theme | Dark-only · color tokens in `src/utils/constants.ts` |

---

## Common Issues

**`emulator: command not found`**
Add the Android SDK to your PATH (see Terminal 1 command above). On Mac/Linux, add it to `~/.zshrc` or `~/.bashrc`.

**`JAVA_HOME is not set`**
Install JDK 17 and set `JAVA_HOME` to its path. Android Studio usually installs its own JDK under `jbr/` — point to that.

**App shows blank screen after login**
Check that Firestore is enabled in the Firebase Console and that your `.env` values match the correct project.

**Metro bundler port conflict**
Run `npx kill-port 8081` then retry `npm run android`.
