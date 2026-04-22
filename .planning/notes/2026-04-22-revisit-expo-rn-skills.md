---
date: "2026-04-22 12:00"
promoted: false
---

Revisit Expo/RN implementation with new expo:* skills. Today (2026-04-22) we hit environmental traps (Expo Go SDK mismatch, stale native build, white-screen cold-start gate bug, reset-password deep link flow implemented from memory instead of docs). The new expo:* and supabase:* skills are installed as of end-of-day. Review 01-01 scaffold + supabase client config, 01-04 auth screens (especially reset-password), 01-05 avatar upload pipeline, and 01-06 dev-build instructions against the canonical patterns from those skills. Likely quick wins: standardize on QueryParams.getQueryParams + Linking.useLinkingURL for all deep links, route dev-build vs EAS build docs into README, ensure TanStack Query hooks match expo:native-data-fetching pattern. Not blocking — phase 01 works. Post-MVP cleanup pass.
