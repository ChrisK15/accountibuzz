# Phase 1: Firebase Auth + Registration/Login Screens - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Email/password registration and sign-in for AccountiBuzz. Users can create accounts, sign in, and have their session persist across app restarts. Signing out returns them to the auth screens. Profile setup (display name, timezone) is Phase 2 — this phase ends the moment the authenticated user lands on the main app.

</domain>

<decisions>
## Implementation Decisions

### Auth Flow Structure
- **D-01:** Three-screen AuthNavigator stack: Welcome → Sign-In or Register (separate screens)
- **D-02:** Invite links deep-link directly to the Register screen (not through Welcome)
- **D-03:** Returning users tap Welcome → Sign In; new users tap Welcome → Register

### Visual Identity
- **D-04:** Dark theme only for v1 — no light/dark system switching
- **D-05:** ChatGPT-style gray palette: dark charcoal surfaces, light gray text, white for primary text, subtle borders
- **D-06:** Semantic status-only color system: green = done/success, red = missed/error, amber = at-risk/warning
- **D-07:** No brand accent color — grays are the base; status colors are the only color in the UI
- **D-08:** Define all color tokens in `src/utils/constants.ts` at Phase 1 — all subsequent phases consume these tokens

### Error Presentation
- **D-09:** Hybrid approach: inline field-level errors for credential mistakes, ErrorBanner for non-field errors
- **D-10:** Wrong password → red error text under the password field (via RHF `setError('password', ...)`)
- **D-11:** Email already in use → red error text under the email field
- **D-12:** Non-field Firebase errors (network failure, `auth/too-many-requests`, unknown) → ErrorBanner at top of screen
- **D-13:** Firebase error code mapping: `auth/wrong-password` and `auth/invalid-credential` → password field; `auth/user-not-found` → email field; `auth/email-already-in-use` → email field; all others → ErrorBanner

### Loading & Submission UX
- **D-14:** Button loading state: spinner inside the submit button, button disabled while Firebase processes
- **D-15:** LoadingOverlay stub is NOT used for auth — reserve it for heavier ops (video upload, Phase 6)
- **D-16:** Form fields remain visible and readable during submission (do not disable or blur the form)

### Claude's Discretion
- Exact spacing, typography sizes, and border-radius values
- Whether Welcome screen has a tagline/app description or just logo + two buttons
- Password field show/hide toggle implementation details
- Exact wording of user-friendly error messages per Firebase error code

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §AUTH-01, §AUTH-02 — Registration and sign-in acceptance criteria
- `.planning/ROADMAP.md` §Phase 1 — Success criteria (5 items), phase boundary, Jira story refs

### Existing Firebase Setup
- `src/services/firebase/config.ts` — Only implemented service file; exports `auth`, `db`, `storage` singletons. All auth calls import `auth` from here.

### Stubs to Implement
- `src/context/AuthContext.tsx` — Auth state provider; must expose user state and sign-out
- `src/navigation/RootNavigator.tsx` — Auth gate; routes to AuthNavigator or MainNavigator based on auth state
- `src/navigation/AuthNavigator.tsx` — Stack with Welcome, SignIn, Register screens
- `src/hooks/useAuth.ts` — Auth hook; wraps AuthContext and Firebase Auth calls
- `src/components/common/Button.tsx` — Must support loading state (spinner + disabled)
- `src/components/common/Input.tsx` — Must support error state (red border/text below)
- `src/components/common/ErrorBanner.tsx` — Used for non-field Firebase errors

### Conventions
- `.planning/codebase/CONVENTIONS.md` — Naming, StyleSheet.create pattern, React Hook Form + Zod usage, service/hook architecture

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/firebase/config.ts` — Fully implemented; exports `auth` singleton. Auth service functions should import from here.
- All component stubs (`Button.tsx`, `Input.tsx`, `ErrorBanner.tsx`, `LoadingOverlay.tsx`) exist as empty files — Phase 1 implements them.

### Established Patterns
- **Services**: Plain TS modules with named exports; no classes. Auth service → `src/services/firebase/authService.ts`
- **Hooks**: Custom hook wraps context; screens call hooks, not services directly
- **Forms**: React Hook Form + Zod schema via `@hookform/resolvers/zod` — mandatory for all form handling
- **Styling**: `StyleSheet.create` at bottom of file; 2-space indent; no Tailwind or UI library
- **Imports**: Always use `@/` alias (e.g., `@/services/firebase/config`), never relative paths within `src/`

### Integration Points
- `App.tsx` currently renders a placeholder — Phase 1 replaces its content with `<RootNavigator />`
- `src/types/navigation.ts` defines navigation param lists — `AuthStackParamList` must be populated
- `src/utils/constants.ts` must be created in Phase 1 with the full color token set (all subsequent phases depend on it)

</code_context>

<specifics>
## Specific Ideas

- "ChatGPT-style gray" — user explicitly referenced OpenAI's dark UI as the visual target
- No light/dark mode toggle — dark only for v1; user is uncomfortable with bright UIs
- Status colors (green/red/amber) should be the *only* color in the app — everything else is grays

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 01-firebase-auth-registration-login-screens*
*Context gathered: 2026-04-04*
