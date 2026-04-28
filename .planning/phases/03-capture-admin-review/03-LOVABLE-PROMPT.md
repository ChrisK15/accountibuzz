---
phase: 3
slug: capture-admin-review
audience: Lovable (visual design + RN screen code generation)
status: draft
created: 2026-04-28
source: 03-CONTEXT.md decisions D-01..D-19
---

# Phase 3 — Lovable Prompts

> Three focused prompts. Run them in order so each builds on the previous Lovable state.
>
> 1. **Prompt A** — App shell (bottom tabs) + Today screen + group-detail admin entry
> 2. **Prompt B** — Capture flow (photo OR video, caption, submit)
> 3. **Prompt C** — Admin review queue (swipe stack, approve / reject)
>
> All three inherit the Phase 1 + Phase 2 design system unchanged. Don't reinvent tokens, don't restyle existing screens. Add new surfaces only.

---

## Shared Brief (paste at the top of each prompt)

> **Project:** Accountibuzz — a small-group accountability app for friends (≤10 per group). Members post one photo or short video per day toward a shared goal; one designated admin verifies. Tone is warm, energetic, concise — like a friend nudging a friend, never like a corporate productivity app.
>
> **Stack:** React Native + Expo (SDK 55) + Expo Router. Hand-rolled component library (no shadcn — that's web-only). Manrope font. `@expo/vector-icons` (Feather preferred).
>
> **Design system — locked, do not change:**
>
> | Token group | Values |
> |---|---|
> | Primary | yellow `#FFDE42` with near-black text on it (`--primary-fg`) |
> | Accent (links + focus only) | cyan `#53CBF3` |
> | Destructive | `hsl(4 78% 56%)` red |
> | Surface | warm off-white (light) / near-black (dark) — both themes ship |
> | Text | strong / regular / muted three-step |
> | Border | hairline 1px |
> | Spacing | 4 / 8 / 12 / 16 / 24 / 32 (tokens: xs / sm / md / lg / xl / 2xl) |
> | Radii | 6 (sm) / 12 (md) / 20 (lg) / pill |
> | Elevation | e1-subtle / e2 |
> | Type sizes | Display 32 / H1 24 / H2 20 / Body 16 / Caption 13 |
> | Type weights | 500 Medium / 700 Bold / 800 ExtraBold (800 reserved for Display only) |
>
> **Existing primitives (in `src/components/`) — reuse, do not duplicate:**
> `ScreenContainer`, `ScreenHeader`, `PrimaryButton`, `SecondaryButton`, `GhostButton`, `DestructiveTextButton`, `Modal`, `SegmentedControl`, `TextInput`, `FormLabel`, `FormError`, `Avatar` / `AvatarInitials`, `InviteCodeChip`.
>
> **Voice rules:**
> - Use *we / your group / friends* — never *user / organization*.
> - The word `Cancel` is banned as a dismiss label. Every modal needs a context-specific dismiss (`Stay here`, `Don't submit`, `Keep this draft`, etc.).
> - CTAs are verb + noun (`Create group`, `Submit photo`, `Approve`, `Reject`, `Open camera`).
>
> **Reference images attached:** `design_refs/design_token_1.png`, `design_refs/design_token_2.png`, `design_refs/component_inventory_1.png`, `design_refs/component_inventory_2.png` — match this visual language exactly.

---

# Prompt A — App Shell + Today Screen + Group-Detail Admin Entry

> Goal of this prompt: introduce the **bottom-tab shell** and the **Today screen** that becomes the primary daily surface, plus a one-line addition to the existing group-detail screen for admins.

## What's changing in the navigation shell

Up to now the signed-in app has been a single Stack with the groups list at `/`. Phase 3 replaces that with **three bottom tabs**:

| Tab | Route | Icon (Feather) | Label | Notes |
|---|---|---|---|---|
| **Today** | `/` | `sun` | `Today` | New — primary daily surface |
| **Groups** | `/groups` | `users` | `Groups` | Same content as the current groups-list, just moved |
| **Profile** | `/profile` | `user` | `Profile` | Existing profile screen, unchanged |

- Tab bar uses `--surface` background, `--border` 1px hairline on top.
- Active tab: icon + label in `--primary-fg` (near-black) with a 2px `--primary` (yellow) underline indicator above the icon. Inactive: `--text-muted`.
- Label is Caption-13/500. Icon size 22. Tab cell height 56pt + safe-area inset.
- No middle-tab special treatment, no FAB.

## Today screen

Mounts at `/`. The user lands here on app open if signed in.

### Layout

```
┌──────────────────────────────────────────────┐
│  Today                              [date]   │  ← ScreenHeader
│  Wednesday, Apr 28                           │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Morning runners              📷 Photo  │  │
│  │ Post a photo of your run before 9am    │  │
│  │                                        │  │
│  │ Status: —  ·  9:00 AM cutoff (4h left) │  │
│  │                                        │  │
│  │           [  Submit  ]                 │  │  ← Primary CTA
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Evening Spanish              🎬 Video  │  │
│  │ 10s clip of you reading aloud          │  │
│  │                                        │  │
│  │ Status: ⏳ Pending  ·  Submitted 2m ago│  │
│  │                                        │  │
│  │           [  Submitted  ]              │  │  ← Disabled / SecondaryButton
│  └────────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

- **Header:** Display 32 / 800 `Today` on line 1; Body 16 / 500 muted weekday + date on line 2 (e.g. `Wednesday, Apr 28`).
- One **GroupCard** per group the user belongs to. Cards stack vertically with `lg` (16px) gaps.
- Empty state (zero groups): centered illustration-free copy block —
  - H1 24 / 700: `No groups yet`
  - Body 16 / 500 muted: `Create one with friends or join one with a code.`
  - PrimaryButton: `Create a group` (routes to `/groups/new`)
  - Below it as accent text link: `Join with a code` (routes to `/groups/join`)

### GroupCard component (NEW — design this)

A card-style row, `--surface` background, `md` (12) radius, `e1-subtle` shadow, `lg` (16) internal padding.

```
┌─ Card content (top to bottom) ───────────────────┐
│ ROW 1:  [Group name H2 / 700]    [Type chip]     │
│ ROW 2:  Body 16 / 500 muted, 1-line truncate     │
│         (group.goal_description)                 │
│ ROW 3:  [StatusPill]  ·  [Cutoff hint Caption]   │
│ ROW 4:  [Submit / Submitted CTA]                 │
│                                                  │
│ ROW 5 (only if offline-queue item exists):       │
│         [QueueBadge — see below]                 │
└──────────────────────────────────────────────────┘
```

**Type chip** (top-right of card): pill-radius, Caption 13 / 500, surface-muted background, hairline border. Photo cards: `📷 Photo` (Feather `camera` icon + label). Video cards: `🎬 Video` (Feather `video` icon + label).

**Cutoff hint** logic (Caption 13 / 500 muted):
- More than 1 hour left: `9:00 AM cutoff (4h left)`
- Less than 1 hour: `9:00 AM cutoff (47m left)` — turn text `--destructive`
- Less than 5 minutes: `9:00 AM cutoff (3m left)` — text `--destructive`, weight 700
- Already submitted today: replace with `Submitted 2m ago` in muted (no cutoff shown)

The cutoff string drives the urgency feel — it's the one client-side reminder that the server-side cutoff is real.

### StatusPill component (NEW — design this)

A small pill, Caption 13 / 500, designed for the status row inside GroupCard and re-usable elsewhere.

| State | Label | Background | Text | Icon (left) |
|---|---|---|---|---|
| `none` | `—` (em-dash) | none, muted text only | `--text-muted` | none |
| `pending` | `Pending review` | `--surface-muted` + 1px `--border` | `--text` | Feather `clock` |
| `approved` | `Approved` | yellow `#FFDE42` at 100% (`--primary`) | `--primary-fg` near-black | Feather `check` |
| `rejected` | `Today didn't count` | `--destructive` at ~12% tint | `--destructive` | Feather `x-circle` |

Rejected pill should not feel like an error toast — it's a stated fact. No exclamation marks. Tapping a rejected pill opens a small Modal showing the admin's optional rejection reason (or "No reason given." in muted if none).

### CTA states (PrimaryButton — reuse the existing primitive)

| Status | CTA label | Style |
|---|---|---|
| `none` (haven't submitted) | `Submit` | PrimaryButton (yellow filled) |
| `pending` | `Submitted` | SecondaryButton, disabled appearance, no press feedback |
| `approved` | `Submitted` | SecondaryButton, disabled appearance |
| `rejected` | `Today didn't count` | GhostButton, disabled, with subtle `--destructive` left border |

Tapping `Submit` opens the capture flow scoped to that group (Prompt B).

### QueueBadge component (NEW — design this)

Only shown on cards where the user has a queued upload that hasn't completed (offline or in-flight).

Bottom row of the card, separated from the rest by a `--border` hairline:
- Left: Feather `upload-cloud` icon (16px) in `--text-muted`.
- Center: Caption 13 / 500 `Upload pending — 2.4 MB queued`. Text in `--text`.
- Right: GhostButton (icon-only, 32×32) with Feather `more-horizontal` — taps open a small bottom sheet listing pending uploads with a `Retry now` and `Discard` action per entry. Discard label inside the sheet uses the warning yellow `Discard upload?` modal pattern, not destructive red — discarding a queued upload is recoverable (user can re-record).

**Persistence:** the badge is a *visual state*, never a toast. It stays visible as long as the queue is non-empty. Pitfall #4 in our research: silent failure is the killer; visible state is the cure.

### Toolbar / pull-to-refresh

- Pull-to-refresh: triggers refetch of submissions for all visible groups. Use the standard RN `RefreshControl` with `tintColor` = `--text-muted`.
- No toolbar buttons.

### Realtime feel

When a card's status changes (pending → approved, pending → rejected) the card should update **inline with a soft 250ms cross-fade** of the StatusPill and CTA — no whole-card flash, no page-level toast. The change should feel like the card already knew.

## Group-detail screen — admin entry only

This screen already exists from Phase 2 (`app/(app)/groups/[id]/index.tsx`). **Do not redesign it.** The only change: when the signed-in user is the admin of this group AND there are pending submissions, add an entry inline in the existing list.

### "Pending review (N)" entry

Insert as a tap-row above the existing members list. Visual:

```
┌──────────────────────────────────────────────┐
│  Pending review (3)                       ›  │
│  Tap to approve or reject submissions        │
└──────────────────────────────────────────────┘
```

- `--surface` background, `md` radius, `lg` padding, e1-subtle shadow.
- Title: H2 20 / 700 `Pending review (N)` where N is the count.
- Subtitle: Body 16 / 500 muted.
- Right chevron: Feather `chevron-right`, `--text-muted`.
- Tappable; on press it routes to `/groups/[id]/review` (Prompt C).
- **Hidden entirely when:** user is not admin, OR pending count is 0.
- **Badge variant** when N > 9: show `Pending review (9+)` — don't render double-digit numbers in the title.

That is the entire change to group-detail. Members and the existing admin section (invite panel, Transfer admin, Delete group) stay exactly as-is.

## Out of scope for Prompt A (do NOT design these)

- The capture flow itself (Prompt B)
- The admin swipe queue (Prompt C)
- Anything inside the Profile tab (Phase 1)
- Anything inside the Groups tab beyond the one new admin entry above
- Push notifications (Phase 5)
- The "today feed of everyone else's submissions" (Phase 4 — this Today tab is **only the user's own submissions per group**)

---

# Prompt B — Capture Flow

> Goal: design the per-group capture screen reached by tapping `Submit` on a Today GroupCard. Two variants depending on group's `submission_type`: **photo** or **video** (≤10s, single take, no trim).

## Entry point

User is on Today, taps `Submit` on a GroupCard. Camera permission is requested if not granted. On grant, the capture screen mounts. On deny, fall back to a permission-explainer screen with `Open Settings` (Feather `settings`) deep-link.

## Capture screen (full-bleed, modal-style presentation)

The screen takes over the full viewport with a **slide-up modal** transition (not a tab change — the user is "stepping into" capture). A small `×` Close in the top-left dismisses back to Today (no draft is saved — pressing `×` while a take exists prompts a `Discard this take?` modal with `Discard` (destructive) and `Keep recording` (ghost)).

### Top bar

- Left: `×` Close button (Feather `x`, 32×32 hit target, white over the camera viewfinder, with a subtle dark scrim circle for legibility).
- Center: Caption 13 / 500 white over scrim — group name, e.g. `Morning runners`.
- Right: For **video only** — flip-camera button (Feather `refresh-cw`, 32×32). For photo, no right element.

### Viewfinder

Full-bleed camera preview behind the top bar and bottom panel. Slight darkening scrim only behind text overlays for legibility — viewfinder itself is never tinted.

### Bottom capture panel

Dark scrim panel anchored to bottom safe-area, ~140pt tall, holding capture controls.

#### Photo variant

```
┌─────────────────────────────────────────────┐
│                                             │
│         ┌──────┐                            │
│         │  ●   │  ← Round shutter button    │
│         └──────┘    72pt, white outer ring, │
│                     yellow inner fill       │
│                                             │
└─────────────────────────────────────────────┘
```

- Shutter: 72pt diameter, 4px white outer ring, inner circle is `--primary` yellow at full saturation. Press scales to 0.92 over 100ms.
- Centered horizontally. No flash toggle. No grid toggle. No timer.
- Tap → captures, transitions to **Review screen** below.

#### Video variant

```
┌─────────────────────────────────────────────┐
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0:10     │  ← Progress bar + countdown
│                                             │
│         ┌──────┐                            │
│         │  ●   │  ← Hold-to-record OR tap    │
│         └──────┘    Same shutter, when      │
│                     active fills red and    │
│                     transforms to square    │
│                                             │
└─────────────────────────────────────────────┘
```

- Same 72pt shutter shape. **Tap once** to start recording, **tap again** to stop. (Don't require hold-to-record — too easy to drop.)
- While recording: shutter fills `--destructive` red, the inner white circle morphs to a small white square (16pt), pulsing subtly.
- Above the shutter: 4px-tall progress bar, `--primary` yellow fill on `--surface-muted` track, animating left-to-right over 10s.
- To the right of the progress bar: countdown timer Caption 13 / 700 `0:10` → `0:09` → ... → `0:00`. Auto-stops at 10.0s and transitions to Review screen.
- Below the shutter: Caption 13 / 500 white-over-scrim hint: `Tap to start · 10 seconds max`. Disappears once recording starts.
- **No trim UI on Review.** Single take, no edits.

### Review screen (post-capture, pre-submit)

After the photo is taken or the video is recorded (or auto-stopped), transition to a Review state on the same screen.

- Photo: shows the captured still full-bleed.
- Video: shows the captured video looping with mute on by default; tap viewfinder to toggle mute (small Feather `volume-x` / `volume-2` icon overlay top-right while muted).

Bottom panel transforms to:

```
┌─────────────────────────────────────────────┐
│  [ Caption — single line, optional ]  0/140 │  ← TextInput with char counter
│                                             │
│  [ Retake ]              [  Submit  ]       │
└─────────────────────────────────────────────┘
```

- **Caption input** (reuse existing `TextInput`):
  - Single-line, 140 char hard cap.
  - Placeholder: `Add a note (optional)`.
  - Right-aligned char counter Caption 13 / 500: `0/140` muted; turns destructive red below 5 chars remaining or at 140.
  - Mirrors P2's create-group goal_description pattern.
- **Retake** (GhostButton): discards current take, returns to capture viewfinder.
- **Submit** (PrimaryButton, full-flex right side):
  - Label: `Submit photo` for photo variant, `Submit video` for video variant.
  - On press: button shows inline spinner (replace label with the spinner, button stays full-width yellow), and the upload begins.
  - **No success toast** — on RPC success the screen dismisses back to Today and the GroupCard there shows the new `Pending review` status with a soft cross-fade. The dismissal IS the success signal.
  - On error: the button reverts to enabled state and an inline FormError appears above the button row with copy from the error table below.

### Upload-in-progress state

If the user dismisses the screen while the upload is still in flight (offline, slow network), the QueueBadge on the Today GroupCard takes over the visible state. The user sees `Upload pending — N MB queued` on the card the moment they land back on Today.

### Copy

| Surface | Copy |
|---|---|
| Camera permission denied screen — title | `We need camera access` |
| Camera permission denied screen — body | `Tap below to grant access in Settings, then come back.` |
| Camera permission denied screen — CTA | `Open Settings` (PrimaryButton) |
| Camera permission denied screen — secondary | `Not now` (GhostButton, dismisses back to Today) |
| Microphone permission denied (video only) | `We need mic access too — videos record audio.` (same screen pattern) |
| Discard-this-take modal — title | `Discard this take?` |
| Discard-this-take modal — body | `You'll lose what you just recorded.` |
| Discard-this-take modal — primary | `Discard` (destructive filled) |
| Discard-this-take modal — dismiss | `Keep recording` (ghost) |
| Caption placeholder | `Add a note (optional)` |
| Photo Submit button | `Submit photo` |
| Video Submit button | `Submit video` |
| Submit error: `not_member` | `You're not in this group anymore.` |
| Submit error: `wrong_media_type` | `This group expects a {photo|video}, not a {video|photo}.` |
| Submit error: `already_submitted_today` | `You already submitted today. Streak's safe — see you tomorrow.` |
| Submit error: generic / network | `Couldn't submit. We'll keep your photo and try again.` (queue takes over) |

## Out of scope for Prompt B

- The Today screen, GroupCard, StatusPill, QueueBadge (Prompt A)
- Admin review (Prompt C)
- Camera-roll upload — explicitly out of scope (PROJECT.md: in-moment capture only)
- Trim / edit UI for video — explicitly out of scope
- Filters, AR effects, beauty modes
- Push notifications (Phase 5)

---

# Prompt C — Admin Review Queue

> Goal: design the swipe-style review queue reached by tapping the "Pending review (N)" entry on group-detail. Admin-only. Loads all pending submissions for that group as a card stack — swipe right to approve, swipe left to reject (with optional reason).

## Entry point

Admin on group-detail taps `Pending review (3)`. Routes to `/groups/[id]/review`. Stack-screen presentation (slide from right, like normal navigation), not modal — admins are doing focused work and may want to back out and return.

## Empty state (no pending submissions)

If the admin lands here and the queue is empty (e.g., a teammate just cleared it):

- Centered:
  - H1 24 / 700: `All caught up`
  - Body 16 / 500 muted: `Nothing's waiting on you.`
  - PrimaryButton: `Back to group` (returns to group-detail)

## Swipe queue layout

```
┌──────────────────────────────────────────────┐
│ ‹  Pending review                            │  ← ScreenHeader with back arrow
│    Morning runners                           │
├──────────────────────────────────────────────┤
│                                              │
│      ┌──────────────────────────────┐        │
│      │  [Avatar] Casey Chen         │        │
│      │  submitted 4m ago            │        │
│      │                              │        │
│      │  ┌────────────────────────┐  │        │
│      │  │                        │  │        │
│      │  │       MEDIA            │  │        │  ← Card stack (top card visible,
│      │  │   (photo or video      │  │        │     two more peek behind, scaled
│      │  │    autoplay-muted)     │  │        │     97% / 94%, offset 6pt down each)
│      │  │                        │  │        │
│      │  └────────────────────────┘  │        │
│      │                              │        │
│      │  "Mile 3 done before sunrise"│        │  ← Caption (if present)
│      │                              │        │
│      └──────────────────────────────┘        │
│                                              │
│   [ ✕  Reject ]            [ ✓  Approve ]    │  ← Fallback buttons
│                                              │
│   3 pending in this group                    │  ← Caption muted, bottom
└──────────────────────────────────────────────┘
```

### Card design

- `--surface` background, `lg` (20) radius, `e2` shadow.
- ~92% screen width, centered. Top inset 16pt below header.
- Internal padding: 16pt all around.
- **Card content top to bottom:**
  1. Submitter row: `Avatar` (40pt) on left + name (Body 16 / 700) over `submitted 4m ago` (Caption 13 / 500 muted), stacked.
  2. Media frame: full card width, ~16:9 aspect for video / 4:3 for photo, `md` (12) radius corners. Photo: `Image` cover. Video: `expo-video` autoplay + muted + loop. No play/pause controls on the card itself.
  3. Caption (if present): Body 16 / 500 in regular `--text`, italicized opening quote (`"…"`), max 3 lines with truncate.

### Card stack visuals

- **Top card** (active): full size, full opacity, full shadow.
- **Card 2** (next): 97% scale, 6pt offset down, 90% opacity, slightly reduced shadow.
- **Card 3** (next-next): 94% scale, 12pt offset down, 80% opacity, even less shadow.
- **Cards 4+:** not rendered, off-stack.
- When the top card is swiped, the stack animates: card 2 → top, card 3 → card 2, the next pending submission slides in as card 3.

### Swipe interaction

- **Right swipe (approve):** as the user drags right, a green check overlay appears on the right edge of the card with increasing opacity. Past a threshold (≈ 35% of screen width or 800px/s velocity), release commits an approve. The card flies off-screen-right with a 250ms ease-out, the next card snaps to top.
- **Left swipe (reject):** as the user drags left, a red X overlay appears on the left edge. Past the threshold, **don't commit immediately** — instead, snap the card back to ~30% off-screen-left and reveal a reject-reason input panel below the card (see Reject reason flow). The user can either confirm `Reject` or pull the card back to dismiss the reject.
- **Mid-drag release** (below threshold): card springs back to center with a rubber-band animation.
- Use `react-native-gesture-handler` (peer of `expo-router`).
- **Vertical swipe is disabled** on the card itself — no accidental-dismiss path.

### Approve / Reject fallback buttons

Below the card stack, two buttons:

- **Reject** (left, GhostButton with Feather `x` icon + label `Reject`, 50% width). Tap behavior = same as a left-swipe past threshold: opens the reject-reason panel.
- **Approve** (right, PrimaryButton with Feather `check` icon + label `Approve`, 50% width). Tap behavior = immediate approve, same animation as a right-swipe.

These buttons are essential — swipe is fun but a11y / discoverability needs the buttons too.

### Reject-reason flow

When reject is initiated (left-swipe past threshold OR Reject button tap):

1. Top card snaps to ~30% off-screen-left, faded to 60% opacity but still visible.
2. Inline panel slides up from below where the buttons were (or replaces them):

```
┌──────────────────────────────────────────────┐
│  Tell {Casey} what's off (optional)          │  ← FormLabel
│  [ Single-line input ]                  0/140│  ← TextInput + counter
│                                              │
│  ⚠ This rejection is final for today —       │  ← Warning, surface-muted bg
│    {Casey} can't resubmit. Streak resets at  │     border, body-16 text
│    midnight in {timezone}.                   │
│                                              │
│  [ Never mind ]            [  Reject  ]      │
└──────────────────────────────────────────────┘
```

- **Reason input** (reuse existing `TextInput`):
  - Single-line, 140 char hard cap.
  - Placeholder: `e.g. that's not today's run`.
  - Char counter behavior matches caption input.
  - Optional — empty submission is allowed.
- **Warning callout:** `--surface-muted` bg, hairline border, `md` radius, `lg` padding. Feather `alert-triangle` icon (small, in `--text`) on the left. This is the friction that prevents impulsive rejects (per CONTEXT specifics).
- **`Never mind`** (GhostButton): pulls the card back to center, dismisses the reason panel, returns to the buttons-below-card layout. No-op.
- **`Reject`** (DestructiveTextButton or destructive-filled — match Phase 2's convention for irreversible actions): commits the reject, the card flies off-screen-left, next card snaps in.

### First-review onboarding tooltip

The very first time an admin opens this queue (track per-user via SecureStore key e.g. `tooltip:admin_review:{userId}`), show a one-time tooltip overlay before the first card is interactive:

- Centered modal sheet (reuse `Modal` primitive):
  - Title H2 20 / 700: `How review works`
  - Body bullets:
    - `Swipe right or tap Approve — the submission counts.`
    - `Swipe left or tap Reject — today won't count for that member. They can't resubmit.`
    - `Add an optional one-line note when you reject so they know what's off.`
  - PrimaryButton: `Got it`
  - No dismiss button — the tooltip is one-time so the only exit is `Got it`.

Once dismissed, never shown again to that admin. Don't re-show on a fresh install — that's fine, it's a UX nicety, not a contract.

### Loading & error states

- **Initial load** (queue fetch): three skeleton cards in the stack position, shimmering with `--surface-muted` panels. No spinner.
- **Action in flight** (approve / reject RPC): no global spinner. The card has already animated off — the next card is interactable immediately. If the RPC fails, the card snaps back into the stack at top with an inline FormError toast docked below the card: `Couldn't save that decision. Try again.` Standard 4s auto-hide.
- **Queue empty after last action:** transition to the Empty state above with a 250ms fade.

### Bottom-of-screen counter

Caption 13 / 500 muted, centered: `3 pending in this group`. Updates on each action. When zero, fades out as the empty state takes over.

## Copy

| Surface | Copy |
|---|---|
| Header title | `Pending review` |
| Header subtitle (group name) | *(group.name)* |
| Empty state title | `All caught up` |
| Empty state body | `Nothing's waiting on you.` |
| Empty state CTA | `Back to group` |
| First-review tooltip title | `How review works` |
| First-review tooltip CTA | `Got it` |
| Approve button | `Approve` |
| Reject button | `Reject` |
| Reject reason label | `Tell {name} what's off (optional)` |
| Reject reason placeholder | `e.g. that's not today's run` |
| Reject warning callout | `This rejection is final for today — {name} can't resubmit. Streak resets at midnight in {timezone}.` |
| Reject panel dismiss | `Never mind` |
| Reject panel commit | `Reject` |
| Pending counter | `{N} pending in this group` |
| RPC error inline | `Couldn't save that decision. Try again.` |

## Out of scope for Prompt C

- The Today screen and GroupCard (Prompt A)
- Capture flow (Prompt B)
- Cross-group review surface (intentionally per-group only at MVP — see CONTEXT D-16)
- Bulk approve / reject (deferred — see CONTEXT)
- "Undo last decision" (deferred)
- Filtering / sorting the queue (no need at small group sizes)
- Push notifications when admin gets new pending submissions (Phase 5)

---

## Handoff back to Claude

When you've run all three prompts in Lovable and you have generated React Native screen code:

1. Drop the generated files into the repo (likely `src/screens/today/`, `src/screens/capture/`, `src/screens/review/` plus any new components into `src/components/`).
2. Drop any new design-token PNGs / inventory exports into `design_refs/` if Lovable produced any.
3. Re-run `/gsd-plan-phase 3 --skip-ui` so I plan against the actual code you've landed.

I'll do the `app/` Expo Router wiring, the navigation refactor (Stack → Tabs), the Supabase RPC integration, the realtime subscription wiring, the offline queue, and any adaptation needed to fit your existing component primitives. The Lovable code is the visual + interaction source; I'll make it real against the data layer.
