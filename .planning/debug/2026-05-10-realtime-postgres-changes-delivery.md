---
status: open
phase: 03.1-p3-polish-realtime-hardening
surface: supabase-realtime / postgres_changes delivery layer
opened: 2026-05-10T18:30:00Z
updated: 2026-05-10T19:00:00Z
severity: blocker  # blocks CK-01..CK-04 UAT
---

# Debug — Realtime postgres_changes events not delivered to subscribed clients

## Summary

`useReviewQueueRealtime` (Plan 03.1-01) subscribes successfully to
`review-queue:<groupId>:badge`, the subscription is registered in
`realtime.subscription` with the correct filter + JWT, but **no `postgres_changes`
events are delivered to the client** — neither INSERT (RLS-checked) nor DELETE
(RLS-bypassed by `realtime.apply_rls`). The same delivery issue likely affects
`useGroupFeedRealtime` (Phase 04 hook, also mounted on the same screen).

This is a server-side infrastructure issue, **not** a code defect in any Phase
03.1 hook. The code path is verified correct from the subscribe handshake
through the narrowing branches.

## What was ruled out

Each row below was verified during the 2026-05-10 18:30-19:00 UTC session via
the Supabase MCP and on-device Metro logs.

| Hypothesis | Status | Evidence |
|---|---|---|
| `submissions` not in `supabase_realtime` publication | ❌ ruled out | `pg_publication_tables` shows it IS published |
| `replica identity` not `full` | ❌ ruled out | `pg_class.relreplident = 'f'` |
| Replication slot inactive / lagging | ❌ ruled out | `supabase_realtime_replication_slot_...` is `active=true` |
| Subscription row not registered | ❌ ruled out | `realtime.subscription` shows row with correct `(group_id,eq,<uuid>)` filter, `claims_role='authenticated'`, valid JWT (exp 19:13 UTC) |
| Admin can't `SELECT` the row under standard auth | ❌ ruled out | Simulated `SET ROLE authenticated; SET LOCAL request.jwt.claims = ...`; row visible |
| Filter columns not in `auth_can_select` set | ❌ ruled out | All 12 `submissions` columns return true for `has_column_privilege('authenticated', 'public.submissions', col, 'SELECT')` |
| RLS function `is_group_member()` broken | ❌ ruled out | Returns true for admin (and admin IS in `group_members` for the group) |
| `realtime.apply_rls` throwing | ❌ ruled out | No errors in postgres logs around test windows |
| Channel name mismatch | ❌ ruled out | Client `subscribing` log channel name matches `realtime.subscription.subscription_id` lookup |
| Admin gate misfiring on Device A | ❌ ruled out | Per-device instrumented `[gate <userId-tag>]` log proved `isAdmin: true` evaluation, followed by `subscribing` + `subscribe status: SUBSCRIBED, err: undefined` |
| Race: Device B submits before Device A subscribed | ❌ ruled out | Final test had Device A subscribed for ~2m before MCP-direct INSERT at 18:57:26.55; subscription still active in `realtime.subscription` at the time |

## What was confirmed

- `[review-queue-rt] subscribing` fires on Device A (admin), correct channel name (`review-queue:9241be1e-3b59-4d7d-bda5-3b3ac008566f:badge`)
- `[review-queue-rt] subscribe status` returns `SUBSCRIBED, err: undefined`
- `realtime.subscription` shows the admin's subscription with `(group_id,eq,9241be1e-...)` filter, role=authenticated, JWT not expired
- WAL contains the INSERT (verified by direct `SELECT` after the insert)
- **No `[review-queue-rt] event received` log ever fires** on Device A — for either INSERT (Device B submit + MCP-direct insert) or DELETE (MCP-direct, which bypasses RLS in apply_rls)

## Conclusion

The Realtime worker → client WebSocket delivery path is silently failing for
this `(group_id,eq,uuid)` subscription. Because DELETE events also fail
(despite bypassing RLS in `apply_rls`), the failure is **downstream of WAL
parsing and RLS evaluation** — most likely in the worker's event-fanout to the
WebSocket, or in the channel topic routing.

## Hypothesis ranking for next investigation

1. **Project-level postgres_changes disabled** (Realtime Authorization mode
   enabled in dashboard — postgres_changes routes through a different path
   that requires explicit policies on `realtime.messages`)
2. **supabase-js v2.58 channel topic routing bug** with colons in channel name
   (`review-queue:<id>:<mountPoint>`) — although `subscribe status: SUBSCRIBED`
   strongly suggests this is not it
3. **Realtime worker tenant-cache staleness** — worker may be running with
   pre-migration state from before `replica identity full` was applied (P4
   migration `20260508233129`)

## Recommended next steps

- **Quickest test:** swap one of our `postgres_changes` channels for a
  Broadcast-based channel. If broadcast works, postgres_changes specifically
  is the broken surface and we can either (a) re-architect using Broadcast +
  server-side trigger function or (b) escalate to Supabase support with
  reproducible evidence.
- **Alternative:** add a periodic refetch fallback (TanStack Query
  `refetchInterval: 30_000`) for `usePendingReviewCount` + `useReviewQueue`
  so the UI still updates within ~30s even with broken Realtime. Acceptable
  for MVP but loses the "<2s" UX promise CK-01 targets.
- **Cross-AI:** the hook code paths have been exhausted by Claude; an
  independent review by Codex/Gemini on the same artifacts may surface a
  Supabase-side configuration angle missed here. Hand-off file should
  include this note + `useReviewQueueRealtime.ts` + the `realtime.apply_rls`
  source snippet captured in this session.

## UAT impact

CK-01..CK-04 are **BLOCKED** on this issue. They cannot pass while
postgres_changes delivery is broken. The downstream UAT (CK-05..CK-12)
is unaffected — the capture modal restoration and Shutter rewrite have
no Realtime dependency.

## Reproduction sequence (for handoff)

1. Device A signed in as the admin of a group; navigate to `/groups/[id]`
2. Confirm Metro logs: `[review-queue-rt] subscribing` + `subscribe status: SUBSCRIBED`
3. Confirm `realtime.subscription` table contains the admin's row with
   filter `(group_id,eq,<groupId>)`
4. Via Supabase MCP (service role, bypasses RLS), DELETE a `pending`
   submission row whose `group_id` matches the subscription
5. Observe: no `[review-queue-rt] event received` log on Device A
