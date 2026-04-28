# Phase 3: Capture & Admin Review - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 03-capture-admin-review
**Areas discussed:** Submission scope, Upload pipeline, Admin review UX, App shell + Today surface, Resubmit-after-rejection (follow-up)

---

## Submission Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Photo only (defer video to post-MVP) | Simplest capture + upload path: HEIC→JPEG, resize, ~500KB target. Cuts Pitfall #4 video-on-cellular risk. Groups created with `submission_type='video'` would be blocked or coerced. | |
| Photo + video, both first-class | Group admin's create-time choice honored. Video adds: capture flow with length cap, client-side compression, larger uploads (TUS mandatory), preview-and-retake, storage egress concerns. | |
| Photo + short video (≤10s), single-take, no trim | Compromise: video supported but heavily constrained — fixed cap, no editing UI, single-take only. Cheapest video path that still respects schema's photo|video flag. | ✓ |

**User's choice:** Photo + short video (≤10s), single-take, no trim
**Notes:** Keeps both submission types alive without the full video-pipeline weight. TUS still becomes mandatory for the video case → forced into D-05.

---

## Upload Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| TUS resumable + offline queue (persist intent on failure) | Standard for media-heavy mobile apps. supabase-js exposes TUS via `uploadToSignedUrl` / TUS client. On failure or offline, persist {file URI, group_id, caption} to AsyncStorage; auto-retry on next foreground or network-online event. UI shows explicit 'pending upload' state. Research must validate the TUS reference impl against Expo SDK 55 + supabase-js 2.58. | ✓ |
| Base64-arraybuffer one-shot + offline queue (avatar pattern) | Reuse the avatar pipeline shape. Simpler code, same offline queue. Risk: 10s video at modest bitrate is ~5–10 MB; base64 inflates ~33%; one-shot fails outright on cell drop and the user pays the whole upload again on retry. | |
| TUS for video, base64 for photo (hybrid) | Photos are small enough that one-shot + retry is fine; video genuinely needs resumability. Two code paths. Adds branch in upload hook keyed off media_type. | |

**User's choice:** TUS resumable + offline queue (unified, both media types)
**Notes:** Confirmed. The research-phase TUS validation flag from STATE.md remains active and is now load-bearing.

### Follow-up: stale-queue cutoff handling

| Option | Description | Selected |
|--------|-------------|----------|
| Best-effort: try insert; let server reject if past cutoff; surface "missed yesterday" to user | Server is source of truth (Pitfall #1). On flush, attempt the insert; if `local_date` server-derived doesn't match yesterday's date, UNIQUE constraint or CHECK rejects. Client gets typed error, drops queue entry, shows "Yesterday's submission didn't make it before midnight — streak reset." | ✓ |
| Drop queued items > 6h old before attempting; warn user once | Client-side TTL on queue entries. Risk: client clock unreliable; cutoff decision is server's to own. Re-introduces client time logic we said we wouldn't do. | |
| Keep queue entries forever; user manually clears | Simplest. Risk: confusing UX, stale buffer hides real network issues. | |

**User's choice:** Server-authoritative
**Notes:** Aligns with Pitfall #1 (no client date logic) and Pitfall #4 (no silent success / fake backdating).

---

## Admin Review UX

| Option | Description | Selected |
|--------|-------------|----------|
| Tinder-style swipe stack + optional one-line rejection reason | PITFALLS#6 calls this out by name. Single screen: largest pending submission card on top, swipe-right approve / swipe-left reject (with inline reason input on left-swipe), buttons as fallback. Caption visible. Reject reason = optional, single-line, ~140 char. | ✓ |
| Card list + tap-to-detail screen, separate approve/reject buttons | More familiar mobile pattern. Slower per-decision (taps + back navigation per item). Reject reason on detail screen. Risk: admin bottleneck (Pitfall #6) gets worse — friction kills the loop in week 2. | |
| Vertical card stream (each card has approve/reject inline) + reason on reject | Like Instagram explore feed: scroll, tap inline buttons. Faster than list, slower than swipe. Easier to implement (no gesture library). | |

**User's choice:** Tinder-style swipe stack + optional one-line reject reason
**Notes:** Directly mitigates Pitfall #6. `react-native-gesture-handler` is already in the tree as an `expo-router` peer.

### Follow-up: rejection ping path (P3 in-app only)

| Option | Description | Selected |
|--------|-------------|----------|
| Realtime subscription on `submissions` while in app + Today tab badge + status pill on the Today screen | Subscribe per-active-group when 'Today' screen is mounted; on UPDATE where status → rejected, patch cache + show toast/banner. Today surface shows current-day status. Push (P5) layers on top later. | ✓ |
| Polling every N seconds while Today screen is open | Cheaper to ship, no Realtime subscription. Battery + UX worse. Anti-pattern (Pitfall #2 spirit). | |
| Status visible only on next manual pull-to-refresh / cold open | Lowest cost. Fails SUB-04 (member sees status) and ADM-04 (timely awareness for resubmit). | |

**User's choice:** Realtime subscription
**Notes:** Channel teardown on tab blur per Pitfall #11. Subscribe scoped to user's active groups only.

---

## App Shell + Today Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Introduce bottom tabs: Today / Groups / Profile | Today = focused submission surface. Groups = current P2 list. Profile = current avatar tap target. Admin review queue lives inside group-detail. Affects `app/(app)/_layout.tsx` (Tabs layout), `app/(app)/index.tsx` (Today), groups list moves to `app/(app)/groups/index.tsx`. | ✓ |
| Keep stack-based; Today is a route per-group inside group-detail | No tabs. From group-detail, 'Submit today' button opens capture flow. Profile reachable via header avatar. Pro: smaller diff from P2. Con: multi-group users navigate group-by-group; Today never has a single landing surface. | |
| Hybrid: keep stack, add a Today route + header bar with quick-switcher | Top-level stack with a global Today header chip (showing pending/approved/rejected dot) tappable from anywhere. More design work, less navigation footprint. | |

**User's choice:** Bottom tabs (Today / Groups / Profile)
**Notes:** Codebase audit needed during planning — `router.push('/')` and deep-link targets need to point at the new groups route.

### Follow-up: multi-group "Today" target

| Option | Description | Selected |
|--------|-------------|----------|
| Today screen lists each group as a card with its own status + Submit CTA | Multi-group friendly. Each card: group name, submission-type icon, today's status (— / pending / approved / rejected), Submit/Re-submit button. Single-group users see one card. | ✓ |
| Today screen shows one group at a time with a switcher | Pick-one-group with header dropdown. Faster to build, hides parallel obligations. | |
| Today screen always targets most-recently-active group; switch via long-press | Lightest UI but easy to miss obligations to less-active groups. Switcher hard to discover. | |

**User's choice:** Per-group cards on Today
**Notes:** Aligns with multiple-small-groups-per-user assumption.

---

## Resubmit-after-Rejection (load-bearing follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| RPC `resubmit_after_rejection(submission_id, new_media_path, new_caption)` | Server-side atomic transition: validates auth.uid() owns row, current status is 'rejected', UPDATE row to set status='pending', media_path=new, caption=new, clear reviewed_*. Owner-immutable trigger needs `rejected → pending` allowlist. Audit trail on side history table OR lost. | |
| Delete + re-insert (orphan storage object cleaned by side job) | RPC deletes rejected row, new INSERT goes through normal path. Schema simpler. Loses rejection audit trail. Orphaned storage object until cleanup. | |
| Don't allow resubmit — once rejected, that day is missed (no retry until tomorrow) | Simplest. Conflicts with ADM-04 acceptance criterion. Would re-scope the requirement. | ✓ |

**User's choice:** Don't allow resubmit (rejection is terminal)
**Notes:** Knowingly rescopes ADM-04. Confirmed in follow-up.

### Follow-up: confirming intent (rejection = miss = streak reset)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — rejection = day missed; ADM-04 reworded to "rejected submitters are notified that today did not count" | Crystallizes admin-as-trust-anchor. Aligns with strict streak reset core mechanic. Trade-off: admins push toward approving marginal cases. REQUIREMENTS.md + ROADMAP.md ADM-04 wording updated post-phase. | ✓ |
| Yes — rejection = missed today, but admin can "unreject" within same local day | Same scope but admin-side undo on rejection. Adds 'undo last' button. Trigger needs allowlist for rejected→pending and rejected→approved transitions for admin path. | |
| Wait — reconsider (let member resubmit after all, RPC-based) | Rolls back to first option. Keeps ADM-04 as written. | |

**User's choice:** Rejection terminal; ADM-04 rewording deferred to phase close
**Notes:** Locks the simplest schema/RPC story for P3. Owner-immutable trigger from 0003 is correct as-is — no resubmit transition needed. "Admin undo last" preserved as a deferred option (option B) if friend-group testing surfaces frequent mis-rejects.

---

## Claude's Discretion

- Status pill text, empty-state copy for Today screen, toast wording for typed errors
- Visual treatment of swipe queue (card stack depth, swipe threshold, animation)
- Offline-queue badge component shape (new vs reuse existing primitive)
- Camera permission denial UX (re-prompt + Settings deep link)
- Whether to autoplay video previews on admin queue (default ON, muted, looping)
- One-time onboarding tooltip on first-mount of Today tab
- Exact RPC error → user-facing toast mapping

## Deferred Ideas

(See Deferred Ideas section in 03-CONTEXT.md for the full list.)

Highlights:
- Push for rejection/approval → P5
- Counter trigger bodies → P4
- Daily rollover → P5
- Group feed of others' submissions → P4
- Missed-day tombstones → P4
- Re-engagement notifications → P6
- Resubmit after rejection → permanently deferred (revisit only if friend-group testing surfaces it)
- Orphan media cleanup → P5/P6
- Bulk approve/reject → deferred unless backlog >20 ever observed
- Admin "undo last" → deferred (kept as a one-button add if mis-rejects become common)
- Camera-roll uploads → permanently out of scope (PROJECT.md constraint)

## Open Items (require post-phase doc updates)

- REQUIREMENTS.md ADM-04 rewording per D-12
- ROADMAP.md Phase 3 Success Criterion #5 rewording (same root cause)
