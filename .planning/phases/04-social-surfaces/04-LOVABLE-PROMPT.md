# Phase 4: Social Surfaces — Lovable Prompt

**Drafted:** 2026-05-06
**For:** Lovable project at `design_refs/design_code_for_claude/accounti-buzz-spark-main/`
**Backed by:** `.planning/phases/04-social-surfaces/04-CONTEXT.md`

> Per-phase workflow: paste this prompt into Lovable, take the generated code, paste it back into the Lovable project under `src/mocks/screens/Social.tsx`. The output becomes the visual SoT for Phase 4 planning + UI-SPEC.

---

## Prompt

You're extending the existing Accountibuzz mock app (the Lovable project at `design_refs/design_code_for_claude/accounti-buzz-spark-main/`). Stick strictly to the design tokens already in `src/index.css` (Manrope, `--primary` #FFDE42, `--accent` #53CBF3, `--surface`, `--muted`, `--border`, `--destructive`, `--radius-md` 12px, `--radius-pill`, `--elev-1`, `--elev-2`). Reuse existing primitives:
- `GroupCard`, `StatusPill`, `TypeChip`, `TabBar`, `CutoffHint`, `QueueBadge` — `src/mocks/screens/Today.tsx`
- `Avatar`, `MetaChip`, `AdminBadge`, `InviteCodePanel`, `CTA` — `src/mocks/primitives.tsx` and `src/mocks/groups/primitives.tsx`

Don't redefine these; import them. Manrope, mobile-first widths (~390px), light theme by default but classes must respect the existing `dark` mode tokens.

Phase 4 introduces four mock surfaces. Add them as new exported components in a new file `src/mocks/screens/Social.tsx`, plus a `Phase4InventoryScreen` and a route entry in whatever index lists existing inventories so they're navigable.

---

### 1. Today screen — `TodayScreenWithSocial`

Same layout as `TodayScreen` (header + scroll of GroupCards + TabBar). Extend `GroupCard` with a *social-signal line* below the existing CTA, separated by a thin `border-t border-border` divider with `pt-3 mt-3`. Render the line only when `social` prop is provided; do NOT change any existing GroupCard behavior.

The social line is a single horizontal flex row with three groups separated by `·` middots (text-caption, font-medium, text-muted-foreground):

- `<n>/<m> posted` — when `n === 0`, replace the whole line with `0/<m> posted · be the first` (text-foreground for "be the first")
- `<points> pts` — bold the points number, use `tabular-nums`
- `🔥<streak>` — show flame emoji + streak number, but use `text-muted-foreground` (no flame) when streak === 0

Render variations in `TodayScreenWithSocial`:
- "Morning Run Club" — photo, status=none, cutoff=9:00 AM, minutesLeft=240, social={posted:4, total:6, points:11, streak:3}
- "Evening Spanish" — video, status=approved, submittedAgo="1h ago", social={posted:6, total:6, points:18, streak:7}
- "Sunset Sketch Club" — photo, status=none, cutoff=9:00 PM, minutesLeft=47, social={posted:0, total:5, points:0, streak:0}  (be-the-first variant)
- "Cold Plunge Crew" — video, status=pending, submittedAgo="2m ago", queued=true, social={posted:2, total:8, points:7, streak:0}  (queued + streak-broken variant)

---

### 2. Group detail with social — `GroupDetailWithSocialScreen`

Single scrollable screen, all sections stacked, no sub-tabs, no separate routes. Keep the existing back-arrow header + display-size group title + meta chips (Photo, PT, 6/10 members) + InviteCodePanel pattern from `GroupDetailAdminWithPendingScreen`. Insert four new sections, in this order, between the meta chips and the existing Members section:

#### 2a. Leaderboard section
- Section header: `text-h2`, "Leaderboard" left, small "See all" link (text-accent, font-semibold) on the right when there are >5 members.
- Container: rounded-md surface card (`bg-surface border border-border shadow-e1`), inside it a vertical list of up to 5 `LeaderboardRow` components, divided by `divide-y divide-border`.
- A `LeaderboardRow` is a horizontal flex (h-14, px-4 py-2.5, items-center, gap-3):
  - rank chip on the far left: a 24×24 rounded-pill with `text-caption font-bold`. Rank 1 = `bg-primary text-primary-foreground`; rank 2/3 = `bg-muted text-foreground`; rank 4+ = no chip, just bold tabular-nums in muted-foreground.
  - 36×36 `Avatar` (use the existing `Avatar` primitive)
  - flex-1 column: `text-body font-bold text-foreground` name (with " (you)" appendix when `you` is true, in muted-foreground); below that, a row of `text-caption text-muted-foreground`: 🔥<streak> · joined Apr 3 (omit join date if not provided, just show streak)
  - far right: `<points>` in `text-h2 tabular-nums font-extrabold` + tiny "pts" label below in caption muted

Variants for the demo:
1. Maya Chen — points 24, streak 12, avatar src
2. Alex Rivera (you) — points 18, streak 7
3. Jordan Lee — points 14, streak 3
4. Sam Patel — points 9, streak 0  (broken streak — flame muted)
5. Riley Tan — points 4, streak 1

Below the 5 rows, a single full-width row "Show all 8 members" (button-shaped, `text-body font-semibold text-accent`, h-12, with a small `ChevronDown` icon) — only render when total members > 5.

#### 2b. Today's posts section (FEED-01)
- Section header: `text-h2`, "Today's posts (3)" with the count in muted-foreground.
- Vertical stack (`space-y-3`) of `FeedItem` cards. Each `FeedItem`:
  - rounded-md surface card with shadow-e1, padding p-3
  - horizontal flex: 48×48 Avatar, flex-1 column with name (text-body font-bold) + relative time (text-caption text-muted-foreground "3m ago") on its own line, then optional caption (text-body, line-clamp-2, mt-1)
  - far right: 80×80 rounded-md media thumbnail (use a placeholder Unsplash image; for video posts overlay a small play triangle in the corner)

Variants:
1. Jordan Lee — photo, "morning run, 3 miles", 3m ago
2. Maya Chen — video, no caption, 27m ago
3. Alex Rivera (you) — photo, "3 chapters down", 1h ago

Empty-state variant of the same section ("No posts yet today · be the first to log proof") — render in `Phase4InventoryScreen` for visual reference.

#### 2c. Still to post section (FEED-02)
- Section header: `text-caption font-bold uppercase tracking-wider text-muted-foreground`, "Still to post"
- Below: a single horizontal row of overlapping avatars (`-space-x-2`) — first 5 visible, then a `+N` chip if more. Each Avatar is 32×32 with a 2px white ring (`ring-2 ring-surface`). To the right of the avatar row, in `text-body font-medium text-muted-foreground`: "Sam · Riley · 2 more" (just the names, comma-list with overflow if >3).
- Show the cutoff inline at the right end: a small `Clock` icon + "9:00 PM cutoff" in `text-caption text-muted-foreground`.

#### 2d. Missed yesterday section (FEED-03)
- Only render when count > 0.
- Section header: `text-caption font-bold uppercase tracking-wider text-muted-foreground`, "Missed yesterday"
- Render as a quiet, factual chip row inside a single rounded-md `bg-muted/40` container (no border, no shadow). Each entry is an inline chip: `[28×28 Avatar (grayscale-50 opacity-70)] <name>` separated by middots. Treatment is *muted* — never red, never alarmist. No streak counts. Single line on the same surface for compactness when ≤4 missers; wrap when more.
- Trailing micro-copy below the chips, `text-caption text-muted-foreground`: "Streaks reset at 12:00 AM PT".

Variants for the demo: Sam Patel, Riley Tan missed yesterday (2 of 8 members).

After these four new sections, the existing **Members (N/10)** roster, then admin-only **Pending review (3)** row (existing `PendingReviewRow`), then the destructive **Transfer admin / Delete group** zone — all unchanged.

---

### 3. Expanded leaderboard — `LeaderboardExpandedScreen`

When the user taps "Show all 8 members" the leaderboard expands inline (preferred — render the same screen with all members visible). Provide this as a separate screen variant for the inventory: same group-detail screen, but the Leaderboard section shows all 8 rows, the "See all" link in the header reads "Show top 5", and there's no inline expand button at the bottom. No tabs, no modal — just the same scroll with more rows.

Add 3 more low-rank variants (rank 6: Tomás García points 2 streak 0, rank 7: Priya Shah points 1 streak 1, rank 8: Devon Kim points 0 streak 0).

---

### 4. Empty / sparse states — `GroupDetailWithSocialEmptyScreen`

A fresh group with no submissions yet. Render the same group-detail layout but with:
- Leaderboard: all members at 0 pts / 0 streak, alphabetical order, no rank chips, with a faded `bg-muted/40` callout above: "Nobody's on the board yet — submit today to start the streak."
- Today's posts: empty-state row "No posts yet today · be the first to log proof" inside a dashed-border surface card (`border-dashed`).
- Still to post: all members shown, "X member · 8 still to post"
- Missed yesterday: section absent (no row).

---

### 5. Phase 4 inventory — `Phase4InventoryScreen`

A single scrollable inventory page (mirror the existing `Phase3InventoryScreen` shape) with sections labeled in `text-caption font-bold uppercase tracking-wider text-muted-foreground`:

1. **Social signal line** — show 4 GroupCard variants from spec 1 stacked
2. **Leaderboard rows** — show all 8 LeaderboardRow variants in a single card, divided
3. **Feed items** — show photo + video + with-caption + no-caption variants in `space-y-3`
4. **Still to post** — show 3 width-of-text-row variants: 1 misser, 3 missers, 8 missers (overflow to +N chip)
5. **Missed yesterday tombstone** — show 0-count (rendered nothing → render as "—" placeholder labeled "no tombstones"), 2-count, 5-count

Each section under a small descriptive subtitle in `text-body font-medium text-muted-foreground`.

---

### Constraints — non-negotiable

- No reactions, hearts, comments, or DMs anywhere. Don't add them even speculatively.
- No red banners on streak breaks. Tombstones and zero-streak rows must read *factual*, not punitive.
- No "X just lost their N-day streak" celebration moments — quiet only.
- No new icons beyond what's already in `lucide-react` (use `Flame`, `Clock`, `Camera`, `Video`, `ChevronDown`, `ChevronRight`, `ChevronLeft`, `MoreHorizontal`, `Users`, `Sun`, `User`, `Check`, `XCircle`, `UploadCloud`, `Play`).
- No new color tokens. Everything composes from the existing CSS variables.
- No images beyond reusing the `Avatar` primitive (which falls back to initials) plus a few Unsplash-stock thumbnail URLs for media posts and avatars (already an established pattern in existing mocks).
- All numeric counters use `tabular-nums`.
- Mobile width target ~390px. All cards use `rounded-md` (12px) + `shadow-e1`. Headers use the project's display/h1/h2/body/caption type scale already defined in `tailwind.config.ts`.

Output: extend the project, ship `src/mocks/screens/Social.tsx` with all named exports above, and add a route or inventory entry so the new screens are reachable. Don't touch any of the Phase 1/2/3 existing screens or primitives — only extend.

---

## Bias / decisions baked into the prompt

- Reuses Phase 3's `GroupCard` rather than creating a new card type — D-13's "social-signal line" is purely additive so the mock matches the implementation's "extend in place" plan.
- Tombstones use `bg-muted/40` (no red, no border) so the visual doesn't pre-judge Phase 6's re-engagement narrative.
- Leaderboard "Show all" is *inline expand* on the same screen, matching D-10's tap-to-expand decision (no modal, no separate route).
- Inventory + empty/sparse variants give visuals for the edge cases the planner will need to reference.

## After Lovable returns

1. Drop `src/mocks/screens/Social.tsx` into `design_refs/design_code_for_claude/accounti-buzz-spark-main/src/mocks/screens/`.
2. Wire it into the inventory router (whatever lists `Phase3InventoryScreen` etc.).
3. Export PNGs of the 5 main screens to `design_refs/` so the React Native planner has visual targets.
4. Feed the resulting visuals into `/gsd-ui-phase 4` to produce the `04-UI-SPEC.md` design contract.
