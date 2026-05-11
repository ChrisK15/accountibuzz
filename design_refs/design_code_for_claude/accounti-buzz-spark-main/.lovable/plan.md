
# Accountibuzz — Mobile Design Reference

A single-scroll gallery of mobile-frame mockups (390×844) for the Accountibuzz React Native app. Light-mode and dark-mode versions of every screen, plus a token sheet and component inventory — all designed to port cleanly to React Native primitives.

## Design language

**Palette**
- Primary: `#FFDE42` (sunshine yellow) — used for primary CTAs, key highlights
- Accent: `#53CBF3` (sky blue) — used for secondary highlights, links, focus rings
- Success: warm green; Warning: amber; Destructive: warm red
- Neutrals: 3 greys (low/mid/high contrast)
- Light: white base (`#FFFFFF`) surface + soft off-white background
- Dark: carbon base (near-black) background + slightly lifted surface
- CTA text on yellow uses near-black for AA contrast in bright sun

**Type — Manrope**
- Display 32 / H1 24 / H2 20 / Body 16 / Caption 13 — weights 400/600/700/800

**Radii**: sm 6 · md 12 · lg 20 · pill 999
**Elevation**: e1 (subtle card lift) · e2 (raised CTA / sheet) — 2 levels only
**Spacing**: 4 / 8 / 12 / 16 / 24 / 32

## Layout for the gallery page
A single vertically scrolling page. Each screen renders inside a 390×844 phone frame with a small section title above it, so any frame can be screenshotted independently. Order:

1. Token sheet (light) → (dark)
2. Component inventory (light) → (dark)
3. Login (light) → (dark)
4. Sign Up (light) → (dark)
5. Forgot Password (light) → (dark)
6. Reset Password (light) → (dark)
7. Profile — view + edit toggle (light) → (dark)
8. Onboarding Profile Prompt (light) → (dark)

A sticky in-page jump menu at the top lets you scroll to any section.

## Screen specs (apply to both light & dark)

**Auth screens (Login / Sign Up / Forgot / Reset)**
- Top: app wordmark + 1-line context tagline
- Stacked labels above large inputs (52pt tap target), inline error text under field in destructive color
- Full-width primary CTA (yellow, near-black label), 16px above secondary link row
- Secondary text links use accent blue
- Sign Up has a tiny legal caption under the CTA
- Forgot Password has back-to-login link beneath CTA
- Reset Password shows password rules as a small caption under the first field

**Profile (view + edit toggle)**
- Header: title + single trailing action ("Edit" → "Cancel")
- Centered circular avatar (96px), initials-on-color fallback when empty (deterministic hash of display name → palette of 6 warm/cool tints)
- View mode: name (large), email (muted), streak/points strip below avatar to give product context
- Edit mode: name becomes input, "Change avatar" ghost button under avatar, email shown disabled, full-width "Save" CTA, then a low-weight "Log out" text-button at the bottom in destructive tone

**Onboarding Profile Prompt**
- Same skeleton as Profile/edit, but H1 reads "Let's set up your profile" with friendly subhead
- Full-width primary "Continue" CTA, "Skip for now" as muted text link below

## Component inventory screen
- **Buttons**: primary (yellow), secondary (outlined), ghost (text-only), destructive — each shown in default + pressed-look + loading (spinner replaces label, width preserved)
- **Text inputs**: default · focused (accent-blue ring) · error (destructive ring + helper text) · disabled
- **Avatars**: with image · initials fallback (showing 3 hash colors)
- All variants labeled with their token names

## Token sheet screen
A scannable reference: color swatches with hex + token name, type scale samples, radii squares, elevation cards, spacing ruler.

## Constraints honored
- Every CTA full-width on mobile
- Stacked labels everywhere, 48pt+ tap targets
- Inline errors under fields (no toasts)
- Loading spinner replaces button label, width fixed
- Headers limited to title + one trailing action
- No hover-only affordances; no tricks that don't translate to React Native
- Avatar fallback = deterministic color from name hash + initials

## Out of scope
Real auth, navigation between screens, persistence, animations beyond simple transitions — this is a static visual reference.
