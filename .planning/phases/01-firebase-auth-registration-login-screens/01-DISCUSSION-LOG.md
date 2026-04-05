# Phase 1: Firebase Auth + Registration/Login Screens - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the Q&A.

**Date:** 2026-04-04
**Phase:** 01-firebase-auth-registration-login-screens
**Mode:** discuss (advisor mode — research-backed comparison tables)
**Areas discussed:** Auth Flow Structure, Visual Identity, Error Presentation, Loading & Submission UX

---

## Assumptions Presented (via Advisor Research)

### Auth Flow Structure
| Option | Confidence | Notes |
|--------|-----------|-------|
| Welcome + separate Sign-In & Register screens | High | Recommended for invite-driven onboarding |
| Single screen with toggle | Medium | Better for returning-user-dominant flows |
| Welcome only with inline expand | Low | Poor deep-link support |

### Visual Identity
| Option | Confidence | Notes |
|--------|-----------|-------|
| Neutral base + semantic status colors | High | Directly encodes accountability mechanic |
| High-energy dark theme | Medium | Strong for competitive mode |
| Bright light theme | Medium | Better for collaborative/social feel |

### Error Presentation
| Option | Confidence | Notes |
|--------|-----------|-------|
| Hybrid inline + ErrorBanner | High | Satisfies criterion + handles edge cases |
| Inline only | Medium | Simpler but network errors need workaround |
| ErrorBanner only | Low | Fails acceptance criterion outright |

### Loading & Submission UX
| Option | Confidence | Notes |
|--------|-----------|-------|
| Button loading state | High | Lightweight, maps to Button stub |
| Full-screen LoadingOverlay | Medium | Better for heavier async ops |
| Disabled form + spinner | Low | Visually busy for short auth calls |

---

## Decisions Made

### Auth Flow Structure
- **Selected:** Welcome screen + separate Sign-In and Register screens
- **Reason:** Invite-link users deep-link to Register; returning users flow Welcome → Sign In

### Visual Identity
- **Selected:** Neutral base + semantic status colors
- **Refined:** Dark base (ChatGPT-style gray) — user explicitly does not want bright/light UI
- **User note:** "make it gray like chatgpt style gray" — OpenAI dark UI is the explicit reference
- **Key decision:** Status colors (green/red/amber) are the ONLY color; no brand accent color

### Error Presentation
- **Selected:** Hybrid — inline field errors (RHF `setError`) + ErrorBanner for non-field errors

### Loading & Submission UX
- **Selected:** Button loading state (spinner inside button, button disabled)

---

## Corrections Applied

None — all recommended options were accepted. Visual identity was refined mid-discussion (user specified dark mode preference and ChatGPT-gray reference).

---

## Deferred Ideas

None.
