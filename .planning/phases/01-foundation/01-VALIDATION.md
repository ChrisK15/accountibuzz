---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest-expo (client) + pgTAP via `supabase test db` (database) |
| **Config file** | `jest.config.js` + `supabase/tests/` (Wave 0 installs) |
| **Quick run command** | `npm test -- --findRelatedTests` |
| **Full suite command** | `npm test && supabase test db` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --findRelatedTests`
- **After every plan wave:** Run `npm test && supabase test db`
- **Before `/gsd-verify-work`:** Full suite + manual iOS + Android walkthrough green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ❌ W0 | ⬜ pending |

*Per-task entries will be populated by planner during plan creation.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `jest.config.js` + `jest-expo` preset — client test framework
- [ ] `supabase/tests/` directory with pgTAP harness — RLS + trigger tests
- [ ] `.github/workflows/rls-check.yml` — CI RLS probe
- [ ] `tests/setup.ts` — shared React Native test fixtures

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sign up → log in → restart app → still logged in (iOS) | AUTH-02 | Native session persistence requires real device/simulator | Build dev client, sign up, force-quit, relaunch, verify home screen |
| Sign up → log in → restart app → still logged in (Android) | AUTH-02 | Native session persistence requires real device/emulator | Build dev client, sign up, force-quit, relaunch, verify home screen |
| Avatar upload from camera roll | AUTH-04 | Real image picker + Supabase Storage round-trip | Edit profile, pick image, save, confirm displayed after reload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
