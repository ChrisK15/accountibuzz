# Phase 1: Firebase Auth + Registration/Login Screens — Research

**Researched:** 2026-04-05
**Domain:** Firebase Auth v12 / React Navigation v7 / React Hook Form v7 + Zod v4 / React Native (Expo ~55)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Three-screen AuthNavigator stack: Welcome → Sign-In or Register (separate screens)
- **D-02:** Invite links deep-link directly to the Register screen (not through Welcome)
- **D-03:** Returning users tap Welcome → Sign In; new users tap Welcome → Register
- **D-04:** Dark theme only for v1 — no light/dark system switching
- **D-05:** ChatGPT-style gray palette: dark charcoal surfaces, light gray text, white for primary text, subtle borders
- **D-06:** Semantic status-only color system: green = done/success, red = missed/error, amber = at-risk/warning
- **D-07:** No brand accent color — grays are the base; status colors are the only color in the UI
- **D-08:** Define all color tokens in `src/utils/constants.ts` at Phase 1 — all subsequent phases consume these tokens
- **D-09:** Hybrid approach: inline field-level errors for credential mistakes, ErrorBanner for non-field errors
- **D-10:** Wrong password → red error text under the password field (via RHF `setError('password', ...)`)
- **D-11:** Email already in use → red error text under the email field
- **D-12:** Non-field Firebase errors (network failure, `auth/too-many-requests`, unknown) → ErrorBanner at top of screen
- **D-13:** Firebase error code mapping: `auth/wrong-password` and `auth/invalid-credential` → password field; `auth/user-not-found` → email field; `auth/email-already-in-use` → email field; all others → ErrorBanner
- **D-14:** Button loading state: spinner inside the submit button, button disabled while Firebase processes
- **D-15:** LoadingOverlay stub is NOT used for auth — reserve it for heavier ops (video upload, Phase 6)
- **D-16:** Form fields remain visible and readable during submission (do not disable or blur the form)

### Claude's Discretion

- Exact spacing, typography sizes, and border-radius values
- Whether Welcome screen has a tagline/app description or just logo + two buttons
- Password field show/hide toggle implementation details
- Exact wording of user-friendly error messages per Firebase error code

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 1 scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can register with email and password | Firebase `createUserWithEmailAndPassword` + RHF/Zod form on RegisterScreen |
| AUTH-02 | User can sign in with email and password | Firebase `signInWithEmailAndPassword` + RHF/Zod form on SignInScreen |

</phase_requirements>

---

## Summary

Phase 1 bootstraps the entire auth layer: color token system, reusable components, auth service, context, navigation gate, and three auth screens. The good news is the codebase is more complete than "stubs" suggests — Firebase `config.ts`, `AuthContext`, `RootNavigator`, `AuthNavigator`, and the common components (`Button`, `Input`, `ErrorBanner`) are already substantially or fully implemented. `authService.ts` has `register` and `getUserProfile` (stub). `authErrors.ts` has the error mapping. The core gaps are: `signIn` function in authService is missing entirely, `Input` needs an `error` prop for inline field errors, `RegisterScreen` uses local state instead of RHF/Zod, `SignInScreen` is an empty stub, `WelcomeScreen` uses light colors, and `src/utils/constants.ts` is an empty file that must define all color tokens.

The stack combination in play is unusually new: Firebase 12.11.0, React Native 0.83.4, Expo ~55, React 19.2.4, RHF 7.72.0, and Zod 4.3.6. These are all 2025–2026 releases and are confirmed installed. The key discovery is that `@hookform/resolvers` v5.2.2 still ships a `zod` subfolder (`@hookform/resolvers/zod`) that works with both Zod v3 and v4 — the `zodResolver` import path is unchanged. Zod v4 itself is imported as `import { z } from 'zod'` (identical to v3 ergonomics).

**Primary recommendation:** The plan should proceed file-by-file. Do not rewrite files that are already correct (config.ts, AuthContext.tsx, RootNavigator.tsx, AuthNavigator.tsx, navigation.ts, user.ts, authErrors.ts). Focus effort on: creating `constants.ts` color tokens, migrating RegisterScreen to RHF+Zod, implementing SignInScreen from scratch with RHF+Zod, adding `signIn` to authService, updating `useAuth` with a `signIn` action, adding `error` prop to `Input`, and theming all screens/components to the dark palette.

---

## Standard Stack

### Core (all already installed — versions verified from node_modules)

| Library | Installed Version | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `firebase` | 12.11.0 | Auth SDK | `createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, `onAuthStateChanged` — project already uses |
| `@react-navigation/native-stack` | 7.14.7 | Stack navigator | Already wired in AuthNavigator |
| `react-hook-form` | 7.72.0 | Form state + submission | Mandatory per CONVENTIONS.md |
| `@hookform/resolvers` | 5.2.2 | Zod resolver bridge | Ships `@hookform/resolvers/zod` compatible with Zod v4 |
| `zod` | 4.3.6 | Schema validation + type inference | Mandatory per CONVENTIONS.md |
| `@react-native-async-storage/async-storage` | 2.2.0 | Auth session persistence | Already used in `config.ts` via `getReactNativePersistence` |

### Supporting

| Library | Installed Version | Purpose | When to Use |
|---------|------------------|---------|-------------|
| `react-native-safe-area-context` | 5.6.0 | Safe area insets | Wrap screens with `<SafeAreaView>` or use `useSafeAreaInsets()` |
| `react-native-screens` | 4.23.0 | Native screen optimization | Required peer dep for React Navigation — already in stack |
| `expo-status-bar` | 55.0.5 | Status bar style | Set to `light` for dark theme |

**Installation:** All packages already installed. No `npm install` needed.

---

## Architecture Patterns

### What Is Already Implemented (Do Not Rewrite)

These files are substantially or fully correct. The planner should treat them as done:

| File | Status | Notes |
|------|--------|-------|
| `src/services/firebase/config.ts` | DONE | `initializeAuth` + `getReactNativePersistence(AsyncStorage)` correctly handles persistence and hot-reload guard |
| `src/context/AuthContext.tsx` | DONE | `onAuthStateChanged` listener, `firebaseUser`, `userProfile`, `profileComplete`, `signOut`, `refreshProfile` all correct |
| `src/navigation/RootNavigator.tsx` | DONE | Auth gate: loading spinner → AuthNavigator if no user or profile incomplete → MainNavigator |
| `src/navigation/AuthNavigator.tsx` | DONE | Stack with Welcome/Register/SignIn/SetupProfile, `headerShown: false` |
| `src/types/navigation.ts` | DONE | `AuthStackParamList` fully typed |
| `src/types/user.ts` | DONE | `UserProfile` and `CreateUserProfileData` correct |
| `src/utils/authErrors.ts` | DONE | `mapAuthError` covers registration errors but MISSING sign-in codes (see Pitfalls) |
| `src/components/common/LoadingOverlay.tsx` | DONE (stub, not used for auth per D-15) | Absolute-positioned overlay — correct implementation already |
| `src/app/index.tsx` (App.tsx) | DONE | `AuthProvider → NetworkProvider → NavigationContainer → RootNavigator` correct |

### What Needs Implementation (Phase 1 Work)

| File | Current State | Work Required |
|------|--------------|---------------|
| `src/utils/constants.ts` | Empty file | CREATE: full color token set (dark ChatGPT palette + status colors) |
| `src/services/firebase/authService.ts` | Has `register`, `getUserProfile` stub | ADD: `signIn(email, password)` function |
| `src/utils/authErrors.ts` | Has registration codes only | ADD: `auth/wrong-password`, `auth/invalid-credential`, `auth/user-not-found` with field-routing metadata |
| `src/hooks/useAuth.ts` | Has `registerUser` only | ADD: `signIn` action with RHF `setError` field routing |
| `src/components/common/Button.tsx` | Implemented with light colors (`#6366f1`) | THEME: update colors to dark palette from constants.ts |
| `src/components/common/Input.tsx` | No `error` prop | ADD: `error?: string` prop, red border + error text below; update colors to dark palette |
| `src/components/common/ErrorBanner.tsx` | Implemented with light red colors | THEME: update to dark palette (keep error semantics, adjust background/border) |
| `src/screens/auth/WelcomeScreen.tsx` | Working but light colors, no dark theme | THEME: apply dark palette colors from constants.ts |
| `src/screens/auth/RegisterScreen.tsx` | Uses local state, NOT RHF+Zod | MIGRATE: rewrite to RHF+Zod with inline field errors; no LoadingOverlay (D-15) |
| `src/screens/auth/SignInScreen.tsx` | Empty stub ("coming in SCRUM-10") | CREATE: full RHF+Zod implementation |

### Recommended Project Structure (already established — no changes)

```
src/
├── components/common/    # Button, Input, ErrorBanner, LoadingOverlay
├── context/              # AuthContext, NetworkContext
├── hooks/                # useAuth
├── navigation/           # RootNavigator, AuthNavigator, MainNavigator
├── screens/auth/         # WelcomeScreen, RegisterScreen, SignInScreen, SetupProfileScreen
├── services/firebase/    # config.ts, authService.ts
├── types/                # navigation.ts, user.ts
└── utils/                # constants.ts (create), authErrors.ts, dateUtils, etc.
```

### Pattern 1: Firebase Auth Persistence (Already Implemented Correctly)

**What:** `initializeAuth` with `getReactNativePersistence(AsyncStorage)` on first app init; `getAuth` on subsequent hot reloads.
**Why it matters:** This is the correct React Native pattern for Firebase v9+ — NOT `getAuth()` alone, which uses in-memory storage only.
**Status:** Already implemented in `config.ts`. No changes needed.

```typescript
// Source: config.ts — VERIFIED in codebase
const isFirstInit = getApps().length === 0;
const app = isFirstInit ? initializeApp(firebaseConfig) : getApp();
export const auth = isFirstInit
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);
```

### Pattern 2: Auth Gate in RootNavigator (Already Implemented Correctly)

**What:** `onAuthStateChanged` fires on every auth event and drives React state. `RootNavigator` reads that state to show auth or main stack.
**Status:** Correct in `AuthContext.tsx` and `RootNavigator.tsx`. No changes needed.
**Key point:** Navigation is driven by state change, not imperative `navigation.navigate()` after sign-in. This is the correct pattern — no explicit navigation call in submit handlers.

### Pattern 3: RHF + Zod for Auth Forms (Must Replace Local State)

**What:** `useForm({ resolver: zodResolver(schema) })` manages all field state, validation, and submission.
**Why:** CONVENTIONS.md and CONTEXT.md both mandate this — `RegisterScreen` currently uses `useState` which must be replaced.

```typescript
// Source: VERIFIED — @hookform/resolvers/zod works with Zod v4 as confirmed
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

const { control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormData>({
  resolver: zodResolver(schema),
});
```

**RHF field-level error injection (for Firebase errors):**

```typescript
// Source: react-hook-form docs pattern — ASSUMED for exact API, HIGH confidence
// Called in catch block after Firebase error
setError('password', { message: 'Incorrect password.' }); // D-10
setError('email', { message: 'No account found with this email.' }); // D-13
```

### Pattern 4: Error Routing — Field vs Banner (New Logic to Implement)

**What:** `mapAuthError` currently returns a string. The field-routing logic (D-13) must be separated: some errors go to RHF `setError`, others go to ErrorBanner state.

**Recommended approach — extend authErrors.ts:**

```typescript
// New type to add to authErrors.ts
export type AuthErrorTarget = 'password' | 'email' | 'banner';

export interface MappedAuthError {
  message: string;
  target: AuthErrorTarget;
}

export function mapAuthErrorWithTarget(error: unknown): MappedAuthError {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return { message: 'Incorrect password.', target: 'password' };
      case 'auth/user-not-found':
        return { message: 'No account found with this email.', target: 'email' };
      case 'auth/email-already-in-use':
        return { message: 'An account with this email already exists.', target: 'email' };
      case 'auth/invalid-email':
        return { message: 'Please enter a valid email address.', target: 'email' };
      case 'auth/weak-password':
        return { message: 'Password must be at least 6 characters.', target: 'password' };
      default:
        return { message: 'Something went wrong. Please try again.', target: 'banner' };
    }
  }
  return { message: 'Something went wrong. Please try again.', target: 'banner' };
}
```

**Then in useAuth:**

```typescript
// signIn action — field errors routed via setError callback
async function signIn(
  email: string,
  password: string,
  setFieldError: (field: 'email' | 'password', msg: string) => void
): Promise<void> {
  setBannerError(null);
  setIsSubmitting(true);
  try {
    await signInService(email, password);
  } catch (e) {
    const mapped = mapAuthErrorWithTarget(e);
    if (mapped.target === 'banner') {
      setBannerError(mapped.message);
    } else {
      setFieldError(mapped.target, mapped.message);
    }
  } finally {
    setIsSubmitting(false);
  }
}
```

### Pattern 5: Color Token System (Must Create)

**What:** `src/utils/constants.ts` defines the full ChatGPT-style dark palette. All components import colors from here — hardcoded hex values are forbidden after Phase 1.

**Recommended token set:**

```typescript
// src/utils/constants.ts
export const colors = {
  // Surfaces
  bgPrimary: '#212121',      // Main screen background (ChatGPT dark)
  bgSecondary: '#2f2f2f',    // Card / input background
  bgTertiary: '#424242',     // Hover states, subtle separation

  // Text
  textPrimary: '#ececec',    // Primary white text
  textSecondary: '#8e8ea0',  // Subdued labels, placeholders
  textDisabled: '#565869',   // Disabled state

  // Borders
  borderDefault: '#424242',  // Default input/card border
  borderFocus: '#6e6e80',    // Focused input border

  // Status (semantic — only colors in the UI)
  success: '#22c55e',        // Green: done, approved
  error: '#ef4444',          // Red: missed, error
  warning: '#f59e0b',        // Amber: at-risk, warning

  // Error surface
  errorBg: '#2d1b1b',        // Dark red tint for ErrorBanner background
  errorBorder: '#7f1d1d',    // Subtle dark red border

  // Interactive
  buttonPrimary: '#ececec',      // Primary button bg (white-ish on dark)
  buttonPrimaryText: '#212121',  // Dark text on light button
  buttonGhostText: '#8e8ea0',    // Ghost button text color
};
```

**Note:** The exact hex values are Claude's discretion (D-04, visual target is ChatGPT dark). The above matches the ChatGPT v4 web UI dark mode colors as closely as reasonable for a mobile context. [ASSUMED — no official OpenAI palette spec to verify against]

### Anti-Patterns to Avoid

- **Hardcoded hex strings in component files** — All colors must reference `colors.*` from constants.ts after Phase 1 (D-08)
- **Imperative navigation after sign-in** — `navigation.navigate('Home')` after successful auth is wrong. Auth state change drives RootNavigator automatically.
- **`useState` for form fields** — RegisterScreen currently does this and must be migrated to RHF. New screens must not use `useState` for form state.
- **Disabling form fields during submission** — D-16 says fields remain visible and editable. Current RegisterScreen correctly leaves fields editable during `isSubmitting`.
- **Using LoadingOverlay for auth** — D-15 explicitly reserves it for video upload (Phase 6). Current RegisterScreen incorrectly renders `<LoadingOverlay />` when `isSubmitting`. This must be removed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Manual `if (!email.includes('@'))` | Zod schema + `zodResolver` | Type inference, field-level errors, consistent error API |
| Auth session persistence | Manual AsyncStorage read/write | `getReactNativePersistence(AsyncStorage)` in `initializeAuth` | Already implemented — handles edge cases |
| Form field error state | `useState` per field | RHF `formState.errors[field]` | Integrated with Zod output, no extra state |
| Auth state listening | `setInterval` polling | `onAuthStateChanged` subscription | Firebase push model, already wired in AuthContext |
| Keyboard avoidance | Custom scroll/animation | `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>` | React Native built-in, already used in RegisterScreen |

---

## Common Pitfalls

### Pitfall 1: RegisterScreen Uses Local State Instead of RHF

**What goes wrong:** The current `RegisterScreen.tsx` uses `useState` for `email`, `password`, `confirmPassword`. It does not use `useForm` or `zodResolver`. This violates CONVENTIONS.md.
**Why it happens:** It was scaffolded as a quick stub.
**How to avoid:** Rewrite RegisterScreen to use `useForm({ resolver: zodResolver(schema) })`. The `Input` component must gain a `Controller`-compatible interface or an `error` prop.
**Warning signs:** Any `useState` for a form field value is wrong for this project.

### Pitfall 2: RegisterScreen Renders LoadingOverlay (Violates D-15)

**What goes wrong:** Current `RegisterScreen.tsx` line 116 renders `{isSubmitting && <LoadingOverlay />}`. Decision D-15 explicitly forbids this for auth.
**How to avoid:** Remove the LoadingOverlay import and render. Only the Button spinner (D-14) should indicate loading.

### Pitfall 3: authErrors.ts Missing Sign-In Error Codes

**What goes wrong:** Current `authErrors.ts` only handles registration errors. `auth/wrong-password`, `auth/invalid-credential`, and `auth/user-not-found` are not mapped, so sign-in errors all fall through to the generic fallback message.
**How to avoid:** Add sign-in codes to the error map AND add field-routing logic (see Pattern 4 above).

### Pitfall 4: Input Component Has No Error Prop

**What goes wrong:** `Input.tsx` has no `error?: string` prop. RHF will produce `errors.email.message` but there is no way to render it under the field.
**How to avoid:** Add `error?: string` to `InputProps`. When `error` is truthy, render red text below the TextInput and apply a red border.

### Pitfall 5: `auth/invalid-credential` vs `auth/wrong-password`

**What goes wrong:** Firebase v9+ (and especially newer versions) may return `auth/invalid-credential` as the unified error code for both wrong password AND user-not-found in some flows. Mapping only `auth/wrong-password` misses this.
**How to avoid:** Map BOTH `auth/invalid-credential` AND `auth/wrong-password` to the password field (per D-13 which already accounts for this). [VERIFIED: CONTEXT.md D-13 explicitly lists both codes]

### Pitfall 6: Dark Theme Colors Currently Hardcoded as Light

**What goes wrong:** All implemented stubs (Button, Input, ErrorBanner, WelcomeScreen) use hardcoded light-mode colors (`#fff`, `#374151`, `#d1d5db`, `#6366f1`). These must all be replaced with constants.ts tokens.
**How to avoid:** Create constants.ts first, then update all components in a single pass.

### Pitfall 7: `useAuth` Hook Missing `signIn` Action

**What goes wrong:** `useAuth.ts` only exposes `registerUser`. `SignInScreen` has no hook action to call for sign-in.
**How to avoid:** Add `signIn(email, password, setFieldError)` to `useAuth` before implementing SignInScreen.

### Pitfall 8: Zod v4 Import Path

**What goes wrong:** Zod v4 changed its package exports. Some tutorials show `import { z } from 'zod/v4'` while others show `import { z } from 'zod'`.
**How to avoid:** Use `import { z } from 'zod'` — this works in Zod v4 as confirmed (the `z` named export is identical). Do NOT use `zod/v4` or `zod/v3` in application code. [VERIFIED: confirmed in node_modules]

### Pitfall 9: RHF Controller vs register() for React Native Inputs

**What goes wrong:** React Native `TextInput` is uncontrolled by default. RHF's `register()` (DOM approach) does not work with native TextInput. Must use `<Controller>` or `register()` + manual `onChangeText` wiring.
**How to avoid:** Use `<Controller control={control} name="email" render={({ field }) => <Input ... value={field.value} onChangeText={field.onChange} />} />`. [ASSUMED — standard RN + RHF pattern, HIGH confidence from RHF docs]

---

## Code Examples

### auth/signIn in authService.ts (Missing — Must Add)

```typescript
// Source: firebase/auth SDK — VERIFIED signInWithEmailAndPassword exists
import { signInWithEmailAndPassword, UserCredential } from 'firebase/auth';
import { auth } from './config';

export async function signIn(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}
```

### RHF + Zod Form on SignInScreen (Pattern to Follow)

```typescript
// Source: react-hook-form + @hookform/resolvers pattern — VERIFIED resolver works
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const signInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type SignInFormData = z.infer<typeof signInSchema>;

// Inside component:
const { control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<SignInFormData>({
  resolver: zodResolver(signInSchema),
});

// Field rendering:
<Controller
  control={control}
  name="email"
  render={({ field }) => (
    <Input
      label="Email"
      value={field.value}
      onChangeText={field.onChange}
      error={errors.email?.message}
      keyboardType="email-address"
      autoCapitalize="none"
    />
  )}
/>

// Submit:
const onSubmit = handleSubmit(async (data) => {
  // Call useAuth action; field errors set via setError from hook
});
```

### Input Component with Error Prop (Must Add)

```typescript
// Dark theme Input with error state
interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;          // ADD THIS
  // ... existing props
}

// In render:
<TextInput
  style={[
    styles.input,
    error ? styles.inputError : null,
    !editable && styles.disabled,
  ]}
  // ...
/>
{error ? <Text style={styles.errorText}>{error}</Text> : null}

// In styles (dark theme):
const styles = StyleSheet.create({
  label: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.bgSecondary,
  },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: 12, marginTop: 4 },
});
```

### Button Component Dark Theme Update

```typescript
// Current: backgroundColor: '#6366f1'  (purple accent — violates D-07)
// Replace with dark-theme primary button:
primary: {
  backgroundColor: colors.buttonPrimary,   // white-ish text button
},
// Text color:
const textColor = variant === 'ghost' ? colors.buttonGhostText : colors.buttonPrimaryText;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getAuth()` alone for RN | `initializeAuth` + `getReactNativePersistence` | Firebase v9 | Session lost on app restart without this |
| `import { z } from 'zod'` (v3 API) | Same import path in Zod v4 | Zod v4.0 | No import change needed — v4 is backward-compatible at the import level |
| `zodResolver` from `@hookform/resolvers/zod` | Same path in resolvers v5 | Resolvers v5 | Import path unchanged despite major version bump |
| Separate `auth/wrong-password` code | Firebase may return `auth/invalid-credential` | Firebase v10+ | Must handle both codes |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact ChatGPT-dark hex values proposed for constants.ts | Color Token System | Wrong visual feel — easy to adjust, low risk |
| A2 | `<Controller>` is the correct RHF pattern for React Native TextInput | Code Examples | Form fields won't bind correctly; fix is straightforward |
| A3 | `auth/invalid-credential` is the Firebase v12 unified error code for bad credentials | Pitfall 5 | Wrong error routing — test on real Firebase project to confirm |

---

## Open Questions

1. **Does `auth/user-not-found` still fire in Firebase v12?**
   - What we know: Firebase has moved toward unified error codes to prevent user enumeration. `auth/invalid-credential` may cover both wrong password and unknown email.
   - What's unclear: Whether `auth/user-not-found` still fires separately in the current Firebase project config.
   - Recommendation: Map both codes as specified in D-13. In the worst case, `user-not-found` never fires and `invalid-credential` catches everything — the UX still works.

2. **Does the current `app.config.ts` need `userInterfaceStyle` changed for dark-only?**
   - What we know: `app.config.ts` has `userInterfaceStyle: 'light'`. The status bar and keyboard will follow system theme by default.
   - What's unclear: Whether dark-only (D-04) requires changing this to `'dark'`.
   - Recommendation: Change `userInterfaceStyle` to `'dark'` in `app.config.ts` and set `<StatusBar style="light" />` in screens. This ensures native chrome (keyboard, status bar) matches.

3. **Password show/hide toggle on Input: separate component or built into Input?**
   - What we know: Implementation details are Claude's discretion.
   - Recommendation: Add an optional `showToggle?: boolean` prop to `Input` that renders a Pressable eye icon when `secureTextEntry` is true. Keeps it self-contained.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | ✓ | 22.17.1 | — |
| Firebase SDK | Auth calls | ✓ (installed) | 12.11.0 | — |
| `@hookform/resolvers` | Form validation | ✓ (installed) | 5.2.2 | — |
| `zod` | Schema validation | ✓ (installed) | 4.3.6 | — |
| `react-hook-form` | Form state | ✓ (installed) | 7.72.0 | — |
| Expo CLI | Dev build | ✓ (via npm scripts) | ~55.0.0 | — |
| `.env` with Firebase keys | Auth at runtime | Unknown — not checked | — | Must exist; app won't auth without it |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** `.env` file existence not verified — if missing, Firebase initializes but all auth calls will fail silently or with config errors. The file is gitignored and must be present locally.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 + ts-jest 29.4.6 |
| Config file | `jest.config.js` (present) |
| Quick run command | `npx jest --testPathPattern=auth` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | `register(email, password)` creates Firebase account | Unit (service mock) | `npx jest --testPathPattern=authService` | ❌ Wave 0 |
| AUTH-01 | `mapAuthErrorWithTarget` routes `email-already-in-use` to email field | Unit | `npx jest --testPathPattern=authErrors` | ❌ Wave 0 |
| AUTH-02 | `signIn(email, password)` calls Firebase signIn | Unit (service mock) | `npx jest --testPathPattern=authService` | ❌ Wave 0 |
| AUTH-02 | `mapAuthErrorWithTarget` routes `wrong-password` to password field | Unit | `npx jest --testPathPattern=authErrors` | ❌ Wave 0 |
| AUTH-02 | `mapAuthErrorWithTarget` routes `invalid-credential` to password field | Unit | `npx jest --testPathPattern=authErrors` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx jest --testPathPattern=authErrors --testPathPattern=authService`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/utils/__tests__/authErrors.test.ts` — covers AUTH-01 and AUTH-02 error routing
- [ ] `src/services/firebase/__tests__/authService.test.ts` — covers register and signIn with mocked Firebase
- [ ] `jest.config.js` already present and correct — no framework install needed

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Auth — email/password with server-side verification |
| V3 Session Management | yes | `getReactNativePersistence(AsyncStorage)` — already implemented |
| V4 Access Control | yes | `RootNavigator` auth gate — blocks main app without `firebaseUser` |
| V5 Input Validation | yes | Zod schema on every form — `z.string().email()`, `z.string().min(6)` |
| V6 Cryptography | no | Firebase handles password hashing server-side — never hand-roll |

### Known Threat Patterns for Firebase Auth + React Native

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential stuffing / brute force | Spoofing | Firebase `auth/too-many-requests` — route to ErrorBanner, do not retry automatically |
| User enumeration via distinct error messages | Information Disclosure | Map `auth/user-not-found` and `auth/invalid-credential` to the same password-field message — avoid revealing whether email exists |
| Session token exposure | Information Disclosure | AsyncStorage is unencrypted on Android — acceptable for v1 MVP; note for future hardening |
| Weak password acceptance | Tampering | Zod `z.string().min(6)` client-side; Firebase enforces server-side minimum |

**User enumeration note:** D-13 routes `auth/user-not-found` to the email field with message "No account found with this email." This technically enables user enumeration (an attacker can probe email existence). For a v1 accountability app with invite-only membership, this is an accepted tradeoff. If stricter requirements arise in future, route `user-not-found` to the same password-field message as `invalid-credential`.

---

## Sources

### Primary (HIGH confidence)

- `src/services/firebase/config.ts` — Verified Firebase init pattern, `initializeAuth` + `getReactNativePersistence`
- `node_modules/@hookform/resolvers/zod/dist/zod.d.ts` — Verified `zodResolver` supports Zod v3 and v4
- `node_modules/zod/` — Verified v4.3.6 installed; `import { z } from 'zod'` confirmed working
- `node_modules/firebase/auth/` — Verified `signInWithEmailAndPassword` exists in firebase 12.11.0
- `package.json` + node_modules — All version numbers verified from actual installed packages

### Secondary (MEDIUM confidence)

- `.planning/codebase/CONVENTIONS.md` — Confirmed RHF+Zod mandatory, StyleSheet.create pattern, `@/` aliases
- `DESIGN_PATTERNS.md` — Confirmed layered architecture, hook-wraps-service pattern
- `.planning/phases/01-firebase-auth-registration-login-screens/01-CONTEXT.md` — All locked decisions

### Tertiary (LOW confidence)

- A1: ChatGPT dark palette hex values — estimated from visual reference, not an official spec
- A3: Firebase v12 error code behavior — `auth/invalid-credential` unification not confirmed against live Firebase project

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 1 |
|-----------|-------------------|
| Jira project is `SCRUM` at `comp586.atlassian.net` | Story refs in plans should use SCRUM-9 and SCRUM-10 |
| GSD execution pipeline | Research → Plan → Execute → Verify |
| Phase 1 = SCRUM-9, SCRUM-10 | Two stories: register (AUTH-01) and sign-in (AUTH-02) |

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages installed and version-confirmed from node_modules
- Architecture: HIGH — existing files read and analyzed; patterns verified in code
- Pitfalls: HIGH — most pitfalls derived from direct inspection of stub inconsistencies (RegisterScreen with useState, missing signIn, no error prop on Input)
- Color tokens: LOW — specific hex values are estimated; Claude's discretion per D-04/D-05

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable stack — Firebase and RHF have slow-moving APIs)
