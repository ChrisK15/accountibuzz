---
phase: 01-foundation
plan: 03
subsystem: ui-foundation
tags: [ui, theme, tokens, components, react-native, manrope]
dependency_graph:
  requires:
    - "01-01 (scaffold, deps: expo, react-native, @expo-google-fonts/manrope, expo-image, react-native-safe-area-context)"
  provides:
    - "src/theme/* (tokens + ThemeProvider + useTheme)"
    - "src/components/* (12 UI primitives, barrel-exported)"
  affects:
    - "Plan 04 (auth screens) — imports primitives from src/components"
    - "Plan 05 (profile) — imports primitives; TextInput exposes `disabled` + `helper` props so no re-modification needed"
    - "Root layout / app entry — must wrap children in <ThemeProvider> (wiring deferred to Plan 04 where app/(auth)/_layout is introduced)"
tech_stack:
  added:
    - "@expo-google-fonts/manrope (was already in package.json; first runtime usage)"
  patterns:
    - "Design-token-only styling in primitives (no hex/pixel literals; all via useTheme())"
    - "Deterministic avatar color via djb2(display_name) % 360 HSL hue"
    - "Theme-aware lightness for AvatarInitials (75% light / 35% dark) for WCAG contrast"
key_files:
  created:
    - src/theme/tokens.ts
    - src/theme/useTheme.ts
    - src/theme/ThemeProvider.tsx
    - src/components/PrimaryButton.tsx
    - src/components/SecondaryButton.tsx
    - src/components/GhostButton.tsx
    - src/components/DestructiveTextButton.tsx
    - src/components/TextInput.tsx
    - src/components/FormLabel.tsx
    - src/components/FormError.tsx
    - src/components/Avatar.tsx
    - src/components/AvatarInitials.tsx
    - src/components/Logo.tsx
    - src/components/ScreenContainer.tsx
    - src/components/ScreenHeader.tsx
    - src/components/index.ts
    - tests/tokens.test.ts
    - tests/avatar-initials.test.ts
  modified: []
decisions:
  - "useColorScheme() narrowing: RN returns 'light' | 'dark' | null | 'unspecified' — ThemeProvider treats anything non-'dark' as 'light' (default)"
  - "ColorTokens type widened to `{ [K]: string }` so light & dark readonly literal unions assign to a common Theme type"
  - "GhostButton supports both accessibilityRole='button' and 'link' (default 'button') — needed because signup/forgot-password 'links' should semantically be links for screen readers"
  - "TextInput 'disabled' + 'helper' props locked in 01-03 per the plan's future-proofing clause for Plan 05 (email read-only field + 'Email can't be changed here.')"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-22T08:30:54Z"
  tasks_completed: 3
  files_changed: 18
---

# Phase 01 Plan 03: UI Foundation — Tokens + Primitives Summary

Design-token system + hand-rolled React Native primitives for Phase 01 UI contract (Manrope-font ThemeProvider, 12 primitives in `src/components/`, all styling sourced from tokens — no hex or pixel literals in components).

## What was built

### Theme module (`src/theme/`)

| File | Purpose |
|------|---------|
| `tokens.ts` | `spacing`, `radii`, `fonts` (5 Manrope roles), `colors` (light + dark) per 01-UI-SPEC.md |
| `useTheme.ts` | `ThemeContext` + `useTheme()` hook (throws outside provider) |
| `ThemeProvider.tsx` | Loads Manrope (500/700/800) via `@expo-google-fonts/manrope`, picks light/dark from `useColorScheme()` (falls back to light when unspecified/null); blocks render (`return null`) until fonts load |

### UI primitives (`src/components/`) — 12 total, all barrel-exported via `index.ts`

**Interaction (7):**

| Component | Purpose | Notes |
|-----------|---------|-------|
| `PrimaryButton` | yellow CTA, near-black label | `loading` swaps label for spinner; press scale 0.97, opacity 0.9; ≥48pt; accessibilityRole="button" |
| `SecondaryButton` | surface bg + border + near-black label | ≥48pt |
| `GhostButton` | accent-cyan text-only | Supports `accessibilityRole='button' \| 'link'` (default button) for "Sign up", "Forgot password?", "Add a photo", "Change avatar" |
| `DestructiveTextButton` | red text-only | For "Log out" |
| `TextInput` | Label + input + error/helper | `focused` = 2px cyan ring, `error` = red border + red helper, `disabled` = surfaceMuted bg + muted text, `helper` = muted caption below input. **`disabled` + `helper` props locked here so Plan 05 never modifies this file.** |
| `FormLabel` | caption-size, textMuted | Reusable outside TextInput |
| `FormError` | caption-size, destructive | Reusable outside TextInput |

**Layout + identity (5):**

| Component | Purpose |
|-----------|---------|
| `Avatar` | `expo-image` when `imageUri` provided, else `AvatarInitials` |
| `AvatarInitials` | Deterministic djb2(name) % 360 HSL hue circle; 1–2 char initials; theme-aware lightness for WCAG contrast; exports `initialsFor` + `hueFor` for testing |
| `Logo` | Wordmark: `accounti` in text color + `buzz` on yellow pill (radius pill); sm/md/lg sizes |
| `ScreenContainer` | `SafeAreaView` + `xl` (24px) horizontal padding + optional scroll with `keyboardShouldPersistTaps="handled"` |
| `ScreenHeader` | Display-size title + optional body subtitle; left/center align |

### Tests

- `tests/tokens.test.ts` — asserts color/spacing/radii/fonts shape for both themes (4 tests)
- `tests/avatar-initials.test.ts` — asserts `initialsFor` handles empty/single/multi-word, `hueFor` is deterministic and bounded [0,360) (3 tests)

All 7 tests green. `npx tsc --noEmit` exits 0.

## Imports for downstream plans (Plans 04, 05)

```ts
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useTheme } from '@/theme/useTheme';
import {
  PrimaryButton, SecondaryButton, GhostButton, DestructiveTextButton,
  TextInput, FormLabel, FormError,
  Avatar, AvatarInitials,
  Logo, ScreenContainer, ScreenHeader,
} from '@/components';
```

Plan 04 must wrap the app root (or at least the auth stack) in `<ThemeProvider>`. The provider suspends render until Manrope loads — an intentional MVP tradeoff (see threat T-03-03 in plan).

## Commits

| Task | Type | Hash | Message |
|------|------|------|---------|
| 1 (RED) | test | `452e28c` | add failing test for theme tokens |
| 1 (GREEN) | feat | `be1336b` | add theme module (tokens + ThemeProvider + useTheme) |
| 2a (GREEN) | feat | `914502b` | add interaction primitives (buttons, TextInput, form helpers) |
| 2b (RED) | test | `b295840` | add failing test for AvatarInitials helpers |
| 2b (GREEN) | feat | `8f2d684` | add layout + identity primitives and barrel export |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules/` missing — jest + tsc could not run**
- **Found during:** Task 1 RED verification (jest binary not found)
- **Fix:** Ran `npm install` to hydrate deps before running verification
- **Files modified:** none in src; `package-lock.json` regenerated
- **Committed with:** `be1336b` (Task 1 GREEN)

**2. [Rule 1 - Bug] TS7053 / TS2322 on `useColorScheme()` return type**
- **Found during:** Task 1 typecheck
- **Issue:** RN's `useColorScheme()` may return `'unspecified'` | `null` which is not in my `ThemeName` union, and `colors[scheme]` inferred two incompatible readonly-literal types for light vs dark
- **Fix 1:** Narrowed `rawScheme === 'dark' ? 'dark' : 'light'` in `ThemeProvider.tsx` (safer than `??  'light'` because the `'unspecified'` path falls to light too)
- **Fix 2:** Widened `ColorTokens` from `typeof colors.light` to `{ readonly [K in keyof typeof colors.light]: string }` so both themes index to the same structural type
- **Files modified:** `src/theme/ThemeProvider.tsx`, `src/theme/tokens.ts`
- **Committed with:** `be1336b`

**3. [Rule 2 - A11y / contract] GhostButton needs `role='link'` option**
- **Found during:** Task 2a implementation
- **Issue:** UI-SPEC §Accessibility line 277 says "links use `role='link'`". Inline text links in auth screens ("Sign up", "Forgot password?", "Back to login") should render as links semantically, but all plan text and acceptance criteria call them "GhostButton". Forcing role='button' would violate the accessibility contract.
- **Fix:** Added optional `accessibilityRole?: 'button' | 'link'` prop to GhostButton (default 'button'). Screens in Plan 04 pass `accessibilityRole='link'` for the three inline links.
- **Files modified:** `src/components/GhostButton.tsx`
- **Committed with:** `914502b`

### Deferred Issues (out-of-scope — logged in `deferred-items.md`)

- Stale worktree `.claude/worktrees/agent-a00b0e89/` has pre-existing failing copies of `supabase-client.test.ts` + `storage-adapter.test.ts` (AsyncStorage v3 `createAsyncStorage.native` import fails under jest). NOT introduced by 01-03. Fix suggestion: either remove `.claude/worktrees/` or add it to `testPathIgnorePatterns` in `jest.config.js`.

## Threat Flags

None. Only surface introduced is the client UI tree — no new auth/network/IO boundary beyond what Plans 01-01 / 01-02 already established.

## Known Stubs

None. All primitives are fully wired; consumers provide props. `Avatar` expects `imageUri` from callers (which Plans 04/05 will compute) — this is a prop interface, not a stub.

## Success Criteria Review

- [x] Tokens faithfully reproduce 01-UI-SPEC.md §Color / §Typography / §Spacing / §Radii — verified via `tests/tokens.test.ts`
- [x] ThemeProvider loads Manrope (3 weights: 500/700/800) and picks light/dark from `useColorScheme()` — verified via grep for `useFonts` + `useColorScheme`
- [x] 11+ primitives exist (shipped 12 — UI-SPEC lists PrimaryButton, SecondaryButton, GhostButton, DestructiveTextButton, TextInput, Avatar, AvatarInitials, FormLabel, FormError, Logo, ScreenContainer, ScreenHeader), each consuming tokens exclusively — no hex/pixel literals (verified via `grep -E '#[0-9a-fA-F]{6}'` returning only the fallback HSL template-string in AvatarInitials which is intentional)
- [x] AvatarInitials is deterministic with WCAG-aware light/dark contrast — verified via `tests/avatar-initials.test.ts` + theme-aware lightness (75% light / 35% dark)

## Self-Check: PASSED

Files exist:
- FOUND: src/theme/tokens.ts
- FOUND: src/theme/useTheme.ts
- FOUND: src/theme/ThemeProvider.tsx
- FOUND: src/components/PrimaryButton.tsx
- FOUND: src/components/SecondaryButton.tsx
- FOUND: src/components/GhostButton.tsx
- FOUND: src/components/DestructiveTextButton.tsx
- FOUND: src/components/TextInput.tsx
- FOUND: src/components/Avatar.tsx
- FOUND: src/components/AvatarInitials.tsx
- FOUND: src/components/FormLabel.tsx
- FOUND: src/components/FormError.tsx
- FOUND: src/components/Logo.tsx
- FOUND: src/components/ScreenContainer.tsx
- FOUND: src/components/ScreenHeader.tsx
- FOUND: src/components/index.ts
- FOUND: tests/tokens.test.ts
- FOUND: tests/avatar-initials.test.ts

Commits exist: 452e28c, be1336b, 914502b, b295840, 8f2d684 — verified via `git log`.
