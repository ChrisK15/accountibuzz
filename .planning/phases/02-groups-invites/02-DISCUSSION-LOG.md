# Phase 2: Groups & Invites - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 02-groups-invites
**Areas discussed:** Invite model + deep-link strategy, Group lifecycle edges, App shell + group navigation, Create-group + invite UX

---

## Invite model + deep-link strategy

### Q: Invite model — what does an invite_code represent?

| Option | Description | Selected |
|--------|-------------|----------|
| Single-use per row | Each invite is a distinct row with code + expires_at + used_at; matches existing schema | ✓ |
| Reusable code per group | One rotatable code on `groups.invite_code` | |
| Hybrid — one active reusable code, history kept | Current active code + closed history rows | |

**User's choice:** Single-use per row.
**Notes:** Aligns with the `invites` table already shipped in P1.

### Q: Deep-link approach for invites?

| Option | Description | Selected |
|--------|-------------|----------|
| Universal Links + hosted domain | Best UX, requires accountibuzz.app + AASA/assetlinks | (initial pick, overridden) |
| Custom scheme only | Zero infra, breaks in many sharing surfaces | |
| Custom scheme now, universal links P6 | Ship code-entry as primary now; universal links during hardening | ✓ |

**User's choice:** Custom scheme + code-entry in P2; universal links deferred to P6 (after the follow-up domain question revealed no domain is registered).

### Q: Code format for human entry?

| Option | Description | Selected |
|--------|-------------|----------|
| 8-char uppercase alphanumeric, ambiguity-stripped | ABCD-EF12 chunked, no 0/O/1/I/L | ✓ |
| Short readable phrase (3 words) | happy-blue-tiger — fun, longer to type | |
| Long opaque token (nanoid 21 chars) | Link-only entry, unreadable | |

**User's choice:** 8-char uppercase alphanumeric, ambiguity-stripped.

### Q: Pre-auth invite preview — what does an unauthenticated user see when tapping a link?

| Option | Description | Selected |
|--------|-------------|----------|
| Show group name + member count, then auth | Unauthed RPC `get_invite_preview(code)` — name + count + admin display name | ✓ |
| No preview — auth first, then reveal | Safest privacy posture, weaker conversion | |
| You decide | | |

**User's choice:** Show preview via `get_invite_preview` RPC; pending code held in `expo-secure-store` across the auth detour.

### Q: Universal Links need a real domain. What's the plan?

| Option | Description | Selected |
|--------|-------------|----------|
| Have/will register accountibuzz.app + host AASA | Block P2 until domain is live | |
| Domain in flight — wire UL but tolerate missing files for dev | App config declares domain, files come later | |
| No domain yet — ship code-entry + custom scheme in P2, defer UL to P6 | Reverses the earlier UL pick; P2 unblocked | ✓ |

**User's choice:** No domain yet — universal links wiring deferred to Phase 6 Pre-Rollout Hardening.

---

## Group lifecycle edges

### Q: Soft cap of 10 — enforced where, and how strict?

| Option | Description | Selected |
|--------|-------------|----------|
| Block at DB via redeem RPC | RPC counts members, raises 'group_full' at >=10 | ✓ |
| Warn at 10, soft-allow up to 15 | Banner above 10, hard block at 15 | |
| Client warn only, no DB enforcement | UI nudge, no real cap | |

**User's choice:** Hard block at 10 inside `redeem_invite` RPC. No admin override at MVP.

### Q: What happens when a member leaves the group?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard delete group_members row, keep submissions | Leaderboard line vanishes, history preserved | ✓ |
| Soft-delete with left_at timestamp | Allows rejoin-restores-history; more schema/RLS work | |
| Hard delete row AND submissions cascade | Cleanest leave but destroys group history | |

**User's choice:** Hard delete `group_members` row; submissions remain.

### Q: Can the admin leave?

| Option | Description | Selected |
|--------|-------------|----------|
| Block — admin must transfer or delete | UI offers Transfer admin or Delete group | ✓ |
| Admin leaves → group auto-dissolves | Aggressive; punishes accidental taps | |
| Admin leaves → oldest member becomes admin | Surprises new admin; conflicts with single-creator model | |

**User's choice:** Block. Admin must explicitly transfer or delete the group.

### Q: Where does cap enforcement and join validation live in code?

| Option | Description | Selected |
|--------|-------------|----------|
| All in redeem_invite RPC | One SECURITY DEFINER fn handles validation, cap, insert, mark-used | ✓ |
| RPC for join, separate trigger for cap | Trigger covers admin-direct-add too | |
| You decide | | |

**User's choice:** All join validation inside `redeem_invite` RPC. Leave/transfer/delete-group also via RPCs (RPC shape = Claude's discretion).

---

## App shell + group navigation

### Q: Signed-in app shell shape after Phase 2?

| Option | Description | Selected |
|--------|-------------|----------|
| Stack with Groups as the home | Groups list is `app/(app)/index.tsx`; profile via header | ✓ |
| Tab bar now — Groups \| Profile | Pre-builds chrome P3+P4 will fill | |
| Stack with Groups + Profile on a hub home screen | Heavier home, lighter chrome | |

**User's choice:** Stack with Groups as home. Tabs deferred to whichever phase introduces the next top-level surface.

### Q: Where does 'Create group' live?

| Option | Description | Selected |
|--------|-------------|----------|
| Header + button on empty groups list | + icon always; large CTA on empty state | ✓ |
| FAB (floating action button) | Material-style, new pattern in this app | |
| Inside group detail only | Hidden until first group exists | |

**User's choice:** Header `+` always; large CTA on empty state.

### Q: Where does 'Join group' (code entry) live?

| Option | Description | Selected |
|--------|-------------|----------|
| Same screen as create, second action | Two equal-weight buttons on empty state; kebab menu when populated | ✓ |
| Separate dedicated 'Join' screen with deep-link target | Clear separation | |
| Profile menu only | Buried | |

**User's choice:** Same screen as create. Two equal CTAs on empty state; kebab menu when groups exist.

### Q: Group detail screen — what's on it for P2?

| Option | Description | Selected |
|--------|-------------|----------|
| Header + members + rules + admin actions | Full roster page with admin invite-code panel | ✓ |
| Lean header + members only | Rules on a sub-screen | |
| You decide | | |

**User's choice:** Full roster page with admin actions and invite-code panel.

---

## Create-group + invite UX

### Q: Create-group form structure?

| Option | Description | Selected |
|--------|-------------|----------|
| Single screen, all fields visible | Reuses P1 auth-screen form patterns | ✓ |
| Multi-step wizard (3 steps) | Friendlier first-time, slower repeat | |
| Single screen with progressive disclosure | Hides commitment behind a click | |

**User's choice:** Single screen, all fields visible.

### Q: Timezone field default?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect device tz, editable | Pre-fill via Intl, tappable to open IANA picker | ✓ |
| Explicit picker with no default | Forces user pick; adds friction | |
| Dropdown of common tz only (no IANA picker) | Simpler UI, breaks for international users | |

**User's choice:** Auto-detect with editable IANA picker fallback.

### Q: Goal description constraints?

| Option | Description | Selected |
|--------|-------------|----------|
| Required, 5–140 chars | Tweet-length cap, fits group header | ✓ |
| Required, no upper limit | Manifesto-friendly; needs truncation UI | |
| Optional, 0–140 chars | Allows blank groups | |

**User's choice:** Required, 5–140 chars, with visible counter.

### Q: After 'Create', where does the user land?

| Option | Description | Selected |
|--------|-------------|----------|
| Group detail with invite-code prompt visible | One-time banner + code + share button | ✓ |
| Group detail, no special prompt | Cleaner but less guided | |
| Back to groups list | Worst for activation | |

**User's choice:** Group detail with invite-code prompt visible.

### Q: Invite share UX from the group detail?

| Option | Description | Selected |
|--------|-------------|----------|
| Code displayed prominently + native share sheet | Big chunked code + Copy + Share with pre-formatted message | ✓ |
| Code only, no share sheet | Manual paste anywhere | |
| Code + share sheet + QR code | Adds react-native-qrcode-svg dep | |

**User's choice:** Code prominent + Copy + native Share sheet with pre-formatted message including custom-scheme link and store-link placeholder.

### Q: Invite expiry default?

| Option | Description | Selected |
|--------|-------------|----------|
| 7 days, regenerable on demand | Standard expiry; admin can mint a new one | ✓ |
| No expiry, one active code at a time | Forever-live links | |
| 24 hours | Tight window, friction | |

**User's choice:** 7-day default expiry; admin can regenerate (closes prior row).

---

## Claude's Discretion

- Error-state copy for `'group_full'`, `'invite_used'`, `'invite_expired'`, `'already_member'`
- Loading skeletons for groups list and group detail
- Whether create-group is one transactional RPC or client-side chained inserts (RPC preferred)
- Deep-link landing flow shape (`router.replace` vs inline auth sheet)
- IANA timezone picker library choice
- Whether `redeem_invite` returns full group row or just `group_id`
- Realtime member-list subscription — ship if cheap, defer otherwise

## Deferred Ideas

- Universal Links + AASA/assetlinks hosting → Phase 6
- Admin remove-member action → post-P2 unless friend-group testing demands it
- QR code generation → only if in-person invites become real
- Realtime member-list updates → Claude's discretion in P2, otherwise P4
- Multiple active invites per group → schema supports it; UI defers
- Invite analytics UI → schema captures data; no UI in P2
- Group rename / edit goal / change submission type → post-MVP edit screen
- Real store link in share message → P6
