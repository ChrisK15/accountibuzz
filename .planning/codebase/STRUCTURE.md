# Codebase Structure

**Analysis Date:** 2026-04-04

## Directory Layout

```
accountibuzz/
├── src/                        # All application source code
│   ├── app/                    # Expo Router entry (index.tsx stub)
│   ├── components/             # Reusable UI components
│   │   ├── common/             # Generic shared components
│   │   ├── groups/             # Group-feature components
│   │   ├── leaderboard/        # Leaderboard-specific components
│   │   ├── streaks/            # Streak display components
│   │   └── submissions/        # Submission flow components
│   ├── context/                # React context providers
│   ├── hooks/                  # Custom React hooks (business logic)
│   ├── navigation/             # React Navigation stacks and tabs
│   ├── screens/                # Full-page screen components
│   │   ├── admin/              # Admin review screens
│   │   ├── auth/               # Auth flow screens
│   │   ├── groups/             # Group management screens
│   │   ├── leaderboard/        # Leaderboard screens
│   │   ├── profile/            # User profile screens
│   │   └── submissions/        # Proof submission screens
│   ├── services/               # External service integrations
│   │   ├── firebase/           # Firebase SDK wrappers
│   │   └── offline/            # Offline upload queue
│   ├── types/                  # TypeScript type definitions
│   ├── utils/                  # Pure utility functions
│   └── assets/                 # App fonts and images
│       ├── fonts/
│       └── images/
├── assets/                     # Expo root-level assets (icons, splash)
├── docs/                       # Project documentation and requirements
├── .claude/                    # Agent workflow files
│   ├── agents/                 # Agent definitions
│   ├── context/                # current-story.md (project-manager output)
│   ├── specs/                  # SCRUM-XX.md spec files
│   ├── progress/               # SCRUM-XX-progress.md tracking
│   └── reviews/                # SCRUM-XX-review.md quality reviews
├── .planning/                  # GSD planning documents
│   └── codebase/               # Codebase analysis docs (this directory)
├── App.tsx                     # Root React component
├── index.ts                    # Expo entry point (registerRootComponent)
├── app.config.ts               # Expo configuration (env vars, platform config)
├── tsconfig.json               # TypeScript config (strict, @/* alias)
├── jest.config.js              # Jest test configuration
├── package.json                # Dependencies and scripts
├── .env.example                # Required environment variable names
└── .gitignore
```

## Directory Purposes

**`src/services/firebase/`:**
- Purpose: All Firebase SDK interactions; no component may call Firebase directly
- Contains: One file per domain (`authService.ts`, `groupService.ts`, `membershipService.ts`, `notificationService.ts`, `streakService.ts`, `submissionService.ts`) plus `config.ts`
- Key files: `src/services/firebase/config.ts` — only non-stub service file; exports `auth`, `db`, `storage` singletons

**`src/services/offline/`:**
- Purpose: AsyncStorage-backed upload queue for offline video submissions
- Contains: `uploadQueue.ts`

**`src/hooks/`:**
- Purpose: Business logic, state, and data-fetching per feature domain; each hook corresponds to one service area
- Key files: `useAuth.ts`, `useGroup.ts`, `useGroups.ts`, `useLeaderboard.ts`, `useNetworkStatus.ts`, `useNotifications.ts`, `useOfflineQueue.ts`, `useReviewQueue.ts`, `useStreak.ts`, `useSubmission.ts`

**`src/context/`:**
- Purpose: App-wide React context for session-scoped globals
- Contains: `AuthContext.tsx` (Firebase Auth state), `NetworkContext.tsx` (online/offline status)

**`src/navigation/`:**
- Purpose: All React Navigation stack and tab navigator definitions; routing logic
- Key files:
  - `RootNavigator.tsx` — top-level auth gate
  - `AuthNavigator.tsx` — unauthenticated stack (Welcome, SignIn, Register, SetupProfile)
  - `MainNavigator.tsx` — bottom-tab navigator for authenticated users
  - `HomeStackNavigator.tsx`, `SubmitStackNavigator.tsx`, `ProfileStackNavigator.tsx`, `AdminStackNavigator.tsx` — nested stacks per tab
  - `linking.ts` — deep-link URL config (invite links)

**`src/screens/`:**
- Purpose: One file per route/screen; screens call hooks and render components
- Subdirectories mirror navigation stacks: `auth/`, `groups/`, `submissions/`, `leaderboard/`, `profile/`, `admin/`

**`src/components/common/`:**
- Purpose: Domain-agnostic, reusable UI primitives
- Contains: `Avatar.tsx`, `Button.tsx`, `ErrorBanner.tsx`, `Input.tsx`, `LoadingOverlay.tsx`, `OfflineBanner.tsx`

**`src/components/groups/`:**
- Purpose: Group-feature UI pieces
- Contains: `GroupCard.tsx`, `MemberRow.tsx`, `ModeSelector.tsx`

**`src/components/leaderboard/`:**
- Purpose: Leaderboard UI pieces
- Contains: `LeaderboardRow.tsx`, `MilestoneBadge.tsx`

**`src/components/streaks/`:**
- Purpose: Streak display components
- Contains: `FreezeIndicator.tsx`, `GraceDayIndicator.tsx`, `StreakCounter.tsx`

**`src/components/submissions/`:**
- Purpose: Submission flow UI pieces
- Contains: `SubmissionCard.tsx`, `UploadProgressBar.tsx`, `VideoPlayer.tsx`

**`src/types/`:**
- Purpose: TypeScript interfaces only; no runtime code
- Contains: `group.ts`, `membership.ts`, `navigation.ts`, `notification.ts`, `streak.ts`, `submission.ts`, `user.ts`

**`src/utils/`:**
- Purpose: Pure, stateless helper functions
- Contains: `constants.ts`, `dateUtils.ts`, `inviteLink.ts`, `permissions.ts`, `streakUtils.ts`

**`assets/` (root):**
- Purpose: Expo-referenced static assets for icon, splash, and adaptive Android icons
- Generated: No — manually placed
- Committed: Yes

## Key File Locations

**Entry Points:**
- `index.ts`: Expo app registration
- `App.tsx`: Root React component; mounts navigation tree
- `src/navigation/RootNavigator.tsx`: Top-level auth-state router

**Configuration:**
- `app.config.ts`: Expo app config; Firebase env var mapping; platform settings
- `tsconfig.json`: TypeScript — strict mode, `@/*` path alias pointing to `src/`
- `jest.config.js`: Jest configuration for tests
- `.env.example`: Documents all required `EXPO_PUBLIC_*` Firebase env vars

**Core Logic:**
- `src/services/firebase/config.ts`: Firebase SDK initialization and client exports
- `src/context/AuthContext.tsx`: Auth session provider
- `src/context/NetworkContext.tsx`: Network status provider
- `src/services/offline/uploadQueue.ts`: Offline upload queue

**Testing:**
- Test files: Not yet present (scaffold phase)
- Config: `jest.config.js` at project root

## Naming Conventions

**Files:**
- Screens: `PascalCase` with `Screen` suffix — e.g., `GroupListScreen.tsx`, `SignInScreen.tsx`
- Navigators: `PascalCase` with `Navigator` suffix — e.g., `RootNavigator.tsx`, `MainNavigator.tsx`
- Components: `PascalCase` — e.g., `GroupCard.tsx`, `StreakCounter.tsx`
- Hooks: `camelCase` with `use` prefix — e.g., `useGroups.ts`, `useStreak.ts`
- Services: `camelCase` with `Service` suffix — e.g., `groupService.ts`, `authService.ts`
- Types: `camelCase` domain names — e.g., `group.ts`, `submission.ts`
- Utils: `camelCase` descriptive names — e.g., `dateUtils.ts`, `streakUtils.ts`
- Contexts: `PascalCase` with `Context` suffix — e.g., `AuthContext.tsx`, `NetworkContext.tsx`

**Directories:**
- Feature domains: `camelCase` — `groups/`, `submissions/`, `leaderboard/`
- Cross-cutting layers: `camelCase` — `hooks/`, `services/`, `context/`, `navigation/`, `utils/`, `types/`

## Where to Add New Code

**New Feature (e.g., adding chat):**
- Service functions: `src/services/firebase/chatService.ts`
- Business logic hook: `src/hooks/useChat.ts`
- Types: `src/types/chat.ts`
- UI components: `src/components/chat/`
- Screens: `src/screens/chat/`
- Navigator: Add stack to `src/navigation/` and register in `MainNavigator.tsx`

**New Shared Component:**
- Domain-agnostic: `src/components/common/ComponentName.tsx`
- Feature-specific: `src/components/{feature}/ComponentName.tsx`

**New Utility Helper:**
- Shared helpers: `src/utils/featureUtils.ts` or add to existing matching utils file

**New Screen in Existing Flow:**
- Add screen file to `src/screens/{domain}/NewScreen.tsx`
- Register route in the relevant navigator in `src/navigation/`
- Add route type to `src/types/navigation.ts`

**New Firebase Service Function:**
- Add to the matching domain service file in `src/services/firebase/`
- If no matching domain exists, create `src/services/firebase/{domain}Service.ts`

## Path Aliases

**`@/*`** resolves to `src/*` (configured in `tsconfig.json`)

Examples:
- `@/hooks/useAuth` → `src/hooks/useAuth.ts`
- `@/services/firebase/config` → `src/services/firebase/config.ts`
- `@/components/common/Button` → `src/components/common/Button.tsx`

Always use the `@/` alias for imports within `src/` rather than relative paths.

## Special Directories

**`.claude/`:**
- Purpose: Agent workflow artifacts (stories, specs, progress, reviews)
- Generated: Partially (by agents)
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning documents including this codebase analysis
- Generated: By GSD mapping agents
- Committed: Yes

**`.expo/`:**
- Purpose: Expo CLI cache and type generation
- Generated: Yes
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-04-04*
