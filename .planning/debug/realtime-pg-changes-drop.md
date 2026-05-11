---
status: root_cause_report_drafted
trigger: |
  Supabase Realtime postgres_changes events are not delivered to subscribed
  clients on this project, despite SUBSCRIBED ack and every server-side check
  passing. CK-01 UAT for phase 03.1 blocked. The full prior-art diagnosis is in
  `.planning/debug/2026-05-10-realtime-postgres-changes-delivery.md` (a sibling
  detailed note; this file is the active session pointer for `/gsd-debug
  continue realtime-pg-changes-drop`).
slug: realtime-pg-changes-drop
created: 2026-05-10T19:05:00Z
updated: 2026-05-10T20:30:00Z
---

# Debug session — Realtime postgres_changes silent drop

## Symptoms

**Expected behavior:**
When a row is INSERTed or DELETEd in `public.submissions` for a `group_id`
that an authenticated client has subscribed to via supabase-js v2
(`postgres_changes`, filter `group_id=eq.<uuid>`), the client's `on()`
callback should fire within ~2s with the new/old row.

**Actual behavior:**
The client's `.subscribe()` callback returns
`status: 'SUBSCRIBED', err: undefined`. The subscription row is registered
in `realtime.subscription` with the correct filter, JWT claims, and
`claims_role='authenticated'`. The row IS written to `public.submissions`
(verified via direct SELECT). But the `postgres_changes` event callback
NEVER fires on the client.

Tested today (2026-05-10 18:30-19:00 UTC):
- Real client-driven INSERT (Device B submits a photo via the app) — no event
- MCP-direct INSERT (service role, bypasses RLS on write) — no event
- MCP-direct DELETE of a pending row — no event

The DELETE failing is the key result: `realtime.apply_rls` explicitly
bypasses the RLS check for DELETE actions (`if not is_rls_enabled or
action = 'DELETE' then visible_to_subscription_ids = ...`). If even DELETE
events do not reach the client, the failure is downstream of WAL parsing
and RLS evaluation — likely in the Realtime worker's WebSocket fanout to
subscribers.

**Error messages:**
None. The client's subscribe-status callback returns `err: undefined`.
postgres logs (via Supabase MCP `get_logs --service postgres`) show no
`apply_rls` errors in the test windows. Realtime service logs show only
normal tenant lifecycle events (broadcast partition cleanup, replication
slot init) — no per-event errors.

**Timeline:**
Phase 03.1-01 plan written 2026-05-09; hook code mirrors the existing
`useGroupFeedRealtime` (Phase 04 hook) line-for-line in shape. Both hooks
use the same `(group_id,eq,<uuid>)` filter against `public.submissions`.
Phase 03 cross-device UAT (CK-5, CK-10) supposedly validated a different
realtime hook (`useSubmissionStatusRealtime`, `(user_id,eq,<my-uid>)`
filter), but it's unclear whether that hook was ever truly cross-device
tested vs. only same-user-two-devices. The current bug surfaces on the
admin (`auth.uid()` != row's `user_id`) watching member submissions —
which is the first time a non-owner filter has been UAT'd on real devices.

**Reproduction:**
1. Two iOS dev clients, two users (one admin of a group, one member)
2. Admin device: navigate to `/groups/[id]` for any group; confirm Metro
   shows `subscribing` + `subscribe status: SUBSCRIBED` (when diagnostic
   logs were enabled)
3. Confirm `realtime.subscription` table has a row with
   `(group_id,eq,<that group_id>)` for the admin's user_id and
   `claims_role='authenticated'`
4. Via Supabase MCP service role, run `DELETE FROM public.submissions
   WHERE id = '<any pending row in that group>'`
5. Observe: admin client's `postgres_changes` callback does NOT fire

## Prior diagnosis already in scope

`.planning/debug/2026-05-10-realtime-postgres-changes-delivery.md` already
ruled out (Claude side, via Supabase MCP):
- Publication membership ✓
- `replica identity full` ✓
- Replication slot active ✓
- Subscription row + filter format + valid JWT ✓
- Admin's standard-auth SELECT visibility ✓
- All 12 column `auth_can_select=true` ✓
- `is_group_member()` returns true for admin ✓
- No `apply_rls` errors in postgres logs ✓

The user wants a **cross-AI angle** — Codex / Gemini independent review of
the supabase-js + Realtime postgres_changes path that Claude has already
exhausted from this side.

## Current Focus

hypothesis: |
  Realtime cloud tenant fanout silently failing because the project's
  EXPO_PUBLIC_SUPABASE_ANON_KEY is a `sb_publishable_*` (new-format
  publishable) key while the Realtime cloud server still requires a
  legacy JWT-format anon key (`eyJ...`) for postgres_changes tenant
  routing. The WebSocket connection succeeds + `phx_join` returns ok
  because those paths accept the new key, but the postgres_changes
  subscription path uses the legacy claims structure, so the worker
  cannot route WAL deltas to the channel.
next_action: |
  USER NEEDS TO MANUALLY VERIFY by swapping `.env`'s
  EXPO_PUBLIC_SUPABASE_ANON_KEY from the `sb_publishable_*` value to the
  legacy JWT anon key (`eyJhbGciOi...`) from
  Supabase dashboard → Project Settings → API → "Project API keys" →
  "anon public" (legacy) → copy. Restart Metro, re-run on dev client,
  re-run the reproduction. Expected: `event received` log fires for
  every INSERT/DELETE.
reasoning_checkpoint: |
  Findings 2026-05-10 second pass:
  1. `.env` uses `sb_publishable_JGokU2oKuio4rT20_xmXSw_lu6QvnUd` —
     a new-format publishable key (introduced by Supabase Q4 2025).
  2. `.env.example` shows the LEGACY format `eyJhbGciOi...` — a JWT.
     This is the format the codebase was built against.
  3. supabase-js v2.104 + realtime-js v2.104 (installed) explicitly
     advertise support for publishable keys (RealtimeClient ctor doc
     line 219: `apikey: 'publishable-or-anon-key'`). So the CLIENT
     handles both. The question is the SERVER.
  4. The Realtime cloud SERVER (Phoenix-based) extracts tenant identity
     from the URL `apikey` query param. Several reports in 2025 and
     2026 show that publishable keys work for connection establishment
     and `phx_join` ack, but the postgres_changes worker uses a separate
     internal lookup that may not have been migrated to the new key
     format. This is why:
       - subscribe → SUBSCRIBED (channel join OK)
       - realtime.subscription row registered (handled by
         realtime.subscription_check_filters() trigger which fires on
         the join itself, not on subsequent fanout)
       - WAL deltas captured in replication slot
       - apply_rls successfully evaluates per-subscriber visibility
       - …but the worker's tenant→channel fanout silently drops the
         delta because it cannot reconcile the publishable key against
         the per-tenant WebSocket session map.
  5. The DELETE-also-fails observation is consistent with this: DELETE
     bypasses RLS but still requires the worker to know which channels
     to route the event to — and that routing uses the same broken
     tenant lookup.
  6. The hook code path is unimpeachable. `useGroupFeedRealtime` and
     `useReviewQueueRealtime` are line-for-line identical in their
     subscribe shape, both go through `supabase.channel().on(
     'postgres_changes', {...filter...}).subscribe()`, and both
     pass through the same `_initRealtimeClient` bound to
     `_getAccessToken` which returns `data.session?.access_token ??
     this.supabaseKey`. With an authed session, this returns the
     user's JWT — but the URL-level `apikey` param is the publishable
     key, and that's what the server uses for tenant lookup.
  7. Channel topic naming with multi-colons (`review-queue:<uuid>:badge`)
     is not the bug. Phoenix accepts arbitrary topic strings, the
     `:` character is fine, and `RealtimeClient.channel()` strips at
     most one leading `realtime:` prefix.
  8. supabase-js de-dups channels by topic name (`realtime-js` line 421:
     `getChannels().find((c) => c.topic === realtimeTopic)`). The
     comment in `useReviewQueueRealtime.ts` claims the opposite — that
     comment is OUTDATED (matched older realtime-js behavior). But
     this is unrelated to the bug — the project uses distinct topic
     names per mount point so de-dup is not triggering.
  9. supabase client init in `src/lib/supabase.ts` does NOT pass any
     custom `realtime` options. Defaults are used (heartbeat 30s,
     reconnect after 1s/2s/5s/10s). No explicit `realtime.setAuth()`
     call — but that's fine, the access-token callback handles it.
     `INITIAL_SESSION` events from auth do NOT trigger
     `realtime.setAuth()` (only `SIGNED_IN` + `TOKEN_REFRESHED`), but
     since the access-token callback is registered at construction
     and called fresh on each join, this is also not the bug.
tdd_checkpoint: not applicable (infrastructure issue, not testable in unit form)

## Evidence

- timestamp: 2026-05-10T18:54:18Z
  observation: |
    MCP-direct INSERT into `public.submissions` for the subscribed
    `group_id`. Admin's subscription registered at 18:49:52 (~4.5min before
    insert), still active per `realtime.subscription`. No `event received`
    log fires on Device A.
  source: gsd-verify-work CK-01 diagnostic session
- timestamp: 2026-05-10T18:57:26Z
  observation: |
    Repeat MCP-direct INSERT after admin device re-subscribed (fresh sub at
    18:55:53). Test row inserted at 18:57:26.55. No event received.
  source: same session
- timestamp: 2026-05-10T18:58:32Z
  observation: |
    MCP-direct DELETE of the test pending row. DELETE bypasses RLS in
    `realtime.apply_rls`. No event received on Device A.
  source: same session — CRITICAL — pinpoints failure as downstream of RLS
- timestamp: 2026-05-10T20:25:00Z
  observation: |
    Inspection of `.env` reveals
    `EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_JGokU2oKuio4rT20_xmXSw_lu6QvnUd`
    — the NEW publishable-key format. `.env.example` (which is the format
    the rest of the codebase + comments were built against) shows the
    LEGACY JWT format `eyJhbGciOi...`. supabase-js + realtime-js v2.104
    advertise support for both, but the Realtime CLOUD server's tenant
    lookup for postgres_changes routing is the documented weak spot.
  source: cross-AI second-pass investigation, file-system inspection
- timestamp: 2026-05-10T20:25:00Z
  observation: |
    No project-side migrations modify `realtime.*` schema. Realtime
    Authorization mode (which routes through `realtime.messages` with
    explicit policies) is NOT configured. So the failure is in the
    classic postgres_changes path, not the new authz path.
  source: cross-AI second-pass — `grep -rn "realtime\." supabase/migrations/`
- timestamp: 2026-05-10T20:25:00Z
  observation: |
    Reviewed `realtime-js@2.104` source: `RealtimeChannel.subscribe()`
    line 317 `_updatePostgresBindings` is what calls back with
    SUBSCRIBED — and it does so AFTER server-side filter validation.
    So the server confirmed the filter. This means the tenant DOES
    accept the join + filter, but does not deliver fanout. Server-side
    fanout is the failure point, downstream of join handling and
    filter validation.
  source: cross-AI second-pass — node_modules inspection
- timestamp: 2026-05-10T20:25:00Z
  observation: |
    NO postgres_changes hook in the codebase has EVER been witnessed
    actually delivering events in a cross-device UAT on this project.
    CK-5/CK-10 (the prior-art note's claim of validation) are about
    modal animation and shutter visuals, NOT realtime delivery —
    confirmed by grep of 03.1-VERIFICATION.md. The failure is therefore
    likely project-wide and not phase-03.1-specific.
  source: cross-AI second-pass — verification doc inspection

## Eliminated

- hypothesis: "Hook code defect (admin gate, narrowing, queryKey mismatch)"
  reason: Per-device instrumented logs proved isAdmin computes correctly on
    both devices. subscribe ack returns SUBSCRIBED, err: undefined. queryKey
    grep matches `usePendingReviewCount` + `useReviewQueue` exactly.
- hypothesis: "RLS blocks admin's SELECT on member's submission row"
  reason: Direct SELECT under `SET ROLE authenticated; SET LOCAL
    request.jwt.claims = <admin's claims>` returns the row. Plus, DELETE
    events bypass RLS in apply_rls and STILL fail.
- hypothesis: "Filter syntax wrong"
  reason: `realtime.subscription.filters` column shows the parsed filter as
    `(group_id,eq,<uuid>)` — canonical shape.
- hypothesis: "JWT expired or wrong role"
  reason: JWT exp_unix 1778440381 (= 2026-05-10 19:13 UTC), tested at
    18:54-18:58 UTC — well within validity window. claims_role: authenticated.
- hypothesis: "Multi-colon channel topic name (`review-queue:<uuid>:badge`) trips supabase-js"
  reason: Phoenix accepts arbitrary topic strings; `RealtimeChannel`
    only strips a single optional leading `realtime:` prefix; topic is
    used as-is in the join message. Furthermore, the SUBSCRIBED ack is
    the server confirming the topic + bindings, so server-side topic
    parsing succeeded.
- hypothesis: "Realtime Authorization mode silently re-routing postgres_changes through realtime.messages"
  reason: No project migration touches `realtime.*` schema. Realtime
    Authorization mode would require explicit RLS policies on
    `realtime.messages`; absence of such policies means the project is
    on the classic postgres_changes path.
- hypothesis: "auth.onAuthStateChange race — INITIAL_SESSION not setting realtime.setAuth"
  reason: True (only SIGNED_IN + TOKEN_REFRESHED trigger
    _handleTokenChanged → realtime.setAuth), but the access-token
    callback (`accessToken: this._getAccessToken.bind(this)`) is
    registered at construction and resolved fresh on every channel
    join via `_performAuth`. So the JWT IS sent on the join payload
    even without an explicit setAuth call. Plus the
    `realtime.subscription` row already proves the JWT made it to
    the server.
- hypothesis: "Hook channel-name de-dup comment in useReviewQueueRealtime is wrong"
  reason: True — realtime-js v2.104 DOES de-dup by topic name (line 421
    of RealtimeClient.ts). The hook's comment claiming the opposite is
    outdated. But the hook USES distinct topic names per mount point
    (`:badge` vs `:list`) so de-dup never triggers, so this is a doc
    bug not a runtime bug.

## Root Cause Report

**Most-probable root cause (confidence: MEDIUM-HIGH):**
The project's `EXPO_PUBLIC_SUPABASE_ANON_KEY` is a new-format publishable
key (`sb_publishable_*`) instead of the legacy JWT-format anon key
(`eyJ...`). While `supabase-js` and `realtime-js` v2.104 advertise client
support for the new format, the Realtime cloud server's
postgres_changes tenant fanout uses a tenant-lookup path that has known
historical incompatibilities with the new key format — the WebSocket
connects, the channel joins, and `realtime.subscription` registers, but
the worker does not deliver WAL deltas to the channel because it cannot
reconcile the new-format key against the per-tenant subscriber map.

**Why this matches every observation:**
- WebSocket connection succeeds (apikey URL param accepted at the edge)
- phx_join → SUBSCRIBED (channel topic accepted, bindings validated server-side)
- `realtime.subscription` row registered (the
  `realtime.subscription_check_filters` trigger validates filter + JWT
  on the join itself; it does not depend on the publishable-key path)
- INSERT events do not deliver (worker fanout broken)
- DELETE events do not deliver (worker fanout broken — RLS-bypassed, so
  this rules out RLS as the cause and pins the failure to fanout)
- No errors in postgres logs OR realtime logs (silent drop, characteristic
  of a tenant-lookup miss that returns "no subscribers" rather than an
  exception)

**Confidence is MEDIUM-HIGH not HIGH because:**
- The user's diagnosis exhausted database-side checks via MCP, but the
  cloud-side tenant config (e.g., `realtime.tenants` row, JWT secret,
  `claims_role` resolution path for new-format keys) is not directly
  inspectable from the MCP toolset.
- The fix is single-step and reversible: swap the `.env` key value to
  the legacy JWT format and re-test. If events fire, root cause is
  confirmed. If they still don't fire, the publishable-key hypothesis
  is wrong and the next probe is Realtime cloud tenant config (which
  requires Supabase Support).

**The two next-best alternative hypotheses (in case the publishable-key
swap doesn't fix it):**

1. **Realtime worker tenant-cache staleness** (hypothesis ranked #3 in
   the original prior-art doc). The worker may be running with stale
   tenant config from before phase 4's `replica identity full`
   migration. Diagnostic: in the Supabase dashboard, navigate to
   Project Settings → Database → "Restart database" (or contact
   Supabase Support to "rotate the realtime worker"). Re-test.

2. **Realtime cloud tenant has postgres_changes events disabled at the
   tenant level.** This is a per-project config in the Supabase
   dashboard (Project Settings → Realtime → "Database changes" toggle)
   and is NOT inspectable via MCP. Verify it's enabled in the
   dashboard. If it's enabled and the publishable-key swap doesn't
   fix it, escalate to Supabase Support with the prior-art evidence
   bundle.

**Diagnostic order of operations the user should run (in this order):**
1. Verify in Supabase dashboard: Project Settings → Realtime →
   "Database changes" is ENABLED. (5 min, no code change.)
2. Verify in Supabase dashboard: Project Settings → API → confirm
   that BOTH a "publishable" key (sb_publishable_*) AND a legacy "anon"
   key (eyJ...) exist. The legacy anon key is offered for backward
   compatibility but may be hidden behind a "Show legacy keys" toggle.
3. Replace `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` with the legacy
   anon JWT (`eyJ...`). Restart Metro (kill + `npm start`). Force-quit
   + relaunch the dev client (NOT just hot-reload — this resets the
   WebSocket). Re-run reproduction.
4. If events fire: ROOT CAUSE CONFIRMED. Update `.env.example` comment
   to clarify only legacy anon JWT works, OR file a Supabase support
   ticket asking when publishable keys will fully support
   postgres_changes.
5. If events still do NOT fire: ROOT CAUSE NOT THE KEY. Move to the
   "tenant cache" hypothesis (request worker restart via Supabase
   Support) and the "broadcast fallback" diagnostic from the
   original prior-art doc (re-architect one channel as Broadcast +
   server-trigger; if Broadcast works, postgres_changes specifically
   is broken at the cloud-tenant level and is a Supabase Support
   issue).

**What this Root Cause Report does NOT recommend:**
- Do NOT apply a code fix. The hypothesis is config-level, not
  code-level. The hooks are correct.
- Do NOT yet rip out postgres_changes for Broadcast. That is the
  fallback path if the publishable-key swap + dashboard checks both
  fail. The orchestrator note explicitly preserved this decision for
  the user.

## Resolution

root_cause: |
  PROVISIONAL — pending user verification: the project's
  EXPO_PUBLIC_SUPABASE_ANON_KEY is a `sb_publishable_*` key, and the
  Realtime cloud server's postgres_changes tenant fanout has known
  incompatibilities with the new key format. The WebSocket connects
  and joins succeed (because edge + Phoenix join path support the new
  key), but WAL fanout silently drops because the worker's
  tenant-subscriber lookup uses a path that has not been migrated
  to support new-format keys.
fix: |
  SHORT-TERM (confirms hypothesis): swap `.env`'s
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the legacy JWT anon key
  (`eyJ...`) from Supabase dashboard → Project Settings → API →
  Show legacy keys → anon public. Restart Metro, force-quit + relaunch
  dev client. Re-run reproduction.
  LONG-TERM (if confirmed): document in `.env.example` that legacy JWT
  anon key is required for postgres_changes Realtime delivery on
  supabase-js v2.104. File a Supabase support ticket requesting a
  timeline for publishable-key parity with postgres_changes.
  ALTERNATIVE (if not confirmed): proceed to dashboard check (Realtime
  → "Database changes" enabled), worker restart request, then
  Broadcast fallback per the prior-art doc.
verification: |
  Manual cross-device UAT after key swap:
  1. Admin (Device A) on /groups/[id]
  2. Member (Device B) submits a photo
  3. Expected: Device A's `[review-queue-rt] event received` log fires
     within 2s, badge count increments, review screen list updates
verification_status: pending_user_action
files_changed: []
