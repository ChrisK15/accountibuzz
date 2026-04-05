# Coding Conventions

**Analysis Date:** 2026-04-04

## Overview

The codebase is a React Native / Expo app written in TypeScript with strict mode enabled. Most `src/` files are stubs (empty), but the architecture spec at `.claude/specs/architecture.md` defines the intended conventions, and the few implemented files (`App.tsx`, `src/services/firebase/config.ts`, `app.config.ts`, `index.ts`) confirm them.

## Naming Patterns

**Files:**
- Screens: PascalCase with `Screen` suffix — `SignInScreen.tsx`, `GroupDetailScreen.tsx`
- Navigators: PascalCase with `Navigator` suffix — `RootNavigator.tsx`, `AuthNavigator.tsx`
- Hooks: camelCase with `use` prefix — `useAuth.ts`, `useGroup.ts`, `useNetworkStatus.ts`
- Services: camelCase with `Service` suffix — `authService.ts`, `groupService.ts`
- Components: PascalCase — `Button.tsx`, `GroupCard.tsx`, `StreakCounter.tsx`
- Types files: camelCase by domain — `user.ts`, `group.ts`, `navigation.ts`
- Utils: camelCase by function area — `dateUtils.ts`, `streakUtils.ts`, `inviteLink.ts`
- Config: camelCase — `config.ts`, `constants.ts`

**Functions:**
- Exported service functions: camelCase — `register`, `signIn`, `createGroup`, `uploadMedia`
- React components: PascalCase default exports
- Custom hooks: camelCase with `use` prefix

**Variables:**
- camelCase throughout
- Constants: camelCase in `src/utils/constants.ts` (not SCREAMING_SNAKE_CASE)

**Types / Interfaces:**
- PascalCase — `AuthContextValue`, `UserProfile`, `AuthStackParamList`
- Navigation param lists suffixed with `ParamList` — `HomeStackParamList`, `SubmitStackParamList`
- Union string literal types for enums — `"competitive" | "collaborative"`, `"pending" | "approved" | "resubmit_requested" | "flagged"`

## Code Style

**Formatting:**
- No Prettier or ESLint config detected (`.eslintrc`, `.prettierrc`, `biome.json` absent)
- TypeScript compiler enforces style via `tsconfig.json` with `"strict": true`
- Indentation: 2-space (observed in `App.tsx`, `jest.config.js`, `app.config.ts`)

**Linting:**
- No ESLint config present — TypeScript strict mode is the only enforced lint
- `"strict": true` in `tsconfig.json` means: `strictNullChecks`, `noImplicitAny`, etc.

## Import Organization

**Path Aliases:**
- `@/*` maps to `src/*` — configured in both `tsconfig.json` and `jest.config.js`
- Use `@/services/firebase/config` not relative `../../services/firebase/config`

**Order (observed in `App.tsx` and `src/services/firebase/config.ts`):**
1. External packages (e.g., `expo-status-bar`, `react-native`, `firebase/app`)
2. Internal `@/` aliased imports
3. Relative imports (avoided in favour of `@/`)

**Example (from `src/services/firebase/config.ts`):**
```typescript
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
```

## Module Design

**Services are plain TypeScript modules, not classes:**
- All service functions are named exports from a flat `.ts` file
- They import `db`, `auth`, `storage` from `src/services/firebase/config.ts`
- No `class MyService` pattern — use `export function createGroup(...)` style

**Exports:**
- Components: default export (React component)
- Services: named exports (individual functions)
- Types: named exports (interfaces/types)
- Hooks: named exports (`export function useAuth()`)
- Config: named exports (`export const auth`, `export const db`, `export const storage`)

**No barrel files:** Each module is imported directly by path, not via `index.ts` re-exports.

## React Component Patterns

**Functional components only** — no class components.

**StyleSheet pattern (from `App.tsx`):**
```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```
Styles are defined at the bottom of the file using `StyleSheet.create`.

**Navigation screens** receive navigation props typed via the param lists in `src/types/navigation.ts`.

## State Management

**React Context + custom hooks only** — no Redux, no Zustand, no MobX.
- Contexts: `src/context/AuthContext.tsx`, `src/context/NetworkContext.tsx`
- Hooks consume contexts: `useAuth` wraps `AuthContext`, `useNetworkStatus` wraps `NetworkContext`
- Hook naming: domain-specific (`useGroup`, `useGroups`, `useStreak`, `useLeaderboard`)

## Forms

**React Hook Form + Zod** for all form handling:
- `react-hook-form` for form state and validation
- `zod` for schema validation via `@hookform/resolvers/zod`
- Do not use uncontrolled inputs without React Hook Form

## Error Handling

**Pattern (per architecture spec):**
- Service functions should propagate thrown errors up to hooks
- Hooks expose an `error` state to screens
- UI renders `<ErrorBanner>` from `src/components/common/ErrorBanner.tsx` when error state is non-null

**Firebase guard (from `src/services/firebase/config.ts`):**
```typescript
// Prevent re-initializing on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
```

## Environment Variables

**All Firebase env vars are prefixed `EXPO_PUBLIC_`:**
```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
```
Accessed via `process.env.EXPO_PUBLIC_*` (never from `.env` directly in code).

## Comments

**When to comment:**
- Explain non-obvious intent (e.g., `// Prevent re-initializing on hot reload`)
- Architecture-level decisions go in `.claude/specs/architecture.md`, not inline

**No JSDoc observed** in current implemented files — not a stated convention.

## TypeScript Specifics

- All Firestore timestamps use `Timestamp` type from Firebase SDK, not `Date`
- All dates stored as strings in `"YYYY-MM-DD"` format for timezone-safe comparison
- Navigation param lists defined in `src/types/navigation.ts` — all stacks typed
- Prefer union string literals over TypeScript enums

---

*Convention analysis: 2026-04-04*
