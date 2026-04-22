## Project

Accountibuzz

## Technology Stack

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
| **Expo SDK** | `55` (expo@~55.0.x) | App framework / native build system | Current stable (Feb 2026). Ships RN 0.83.1 + React 19.2, New Architecture only, Hermes v1. First-party libraries for camera, video, notifications, secure store, linking — all the pieces t

