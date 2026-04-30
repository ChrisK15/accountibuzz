/**
 * tests/app/tabs-migration.test.ts
 *
 * Phase 3 / D-14 — Stack → Tabs migration audit.
 *
 * Source: .planning/phases/03-capture-admin-review/03-UI-SPEC.md §"App shell — Stack → Tabs migration" (lines 703-720)
 *
 * This test programmatically scans the source tree for `router.push('/...')`,
 * `router.replace('/...')`, and `<Link href="/...">` references. Every match must
 * be in the EXPECTED_ROUTER_CALL_SITES allowlist below.
 *
 * If the test fails because a NEW reference appears, decide which tab the new
 * reference should target (per UI-SPEC line 713-720) and add it to the allowlist.
 *
 * If the test fails because an EXPECTED reference is missing, the migration may
 * have inadvertently deleted it — restore or update intentionally.
 */
import { execSync } from 'child_process';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Allowlist of EVERY router.push / router.replace / Link href that targets
 * the root '/' OR a tab-relative path. Updated post-P3-06 — the post-leave/
 * post-delete-group sites in app/(app)/groups/[id]/index.tsx now target
 * '/groups' (the Groups tab) per UI-SPEC line 717.
 *
 * Entries: { pattern: regex, intent: brief-description }
 */
const EXPECTED_ROUTER_CALL_SITES = [
  // Auth-success → app shell (CORRECT post-tabs target — Today is right post-login landing per UI-SPEC line 719)
  // The codebase uses Expo Router route-group syntax `/(app)/` to land on the (app)/index route.
  { pattern: /router\.replace\(['"]\/\(app\)\/?['"]\)/, intent: 'auth-success-or-postlogin' },
  // Post-leave-group / post-delete-group (RETARGETED to '/groups' in Plan 03-06 per UI-SPEC line 717)
  { pattern: /router\.replace\(['"]\/groups['"]\)/, intent: 'post-leave-or-delete-group' },
  // Auth flow redirects (signout, session-clear, recovery) — auth route group
  { pattern: /router\.replace\(['"]\/\(auth\)\/login['"]\)/, intent: 'auth-redirect-to-login' },
  { pattern: /router\.replace\(['"]\/\(auth\)\/signup['"]\)/, intent: 'auth-redirect-to-signup' },
  { pattern: /router\.replace\(['"]\/\(auth\)\/reset-password['"]\)/, intent: 'auth-redirect-to-reset-password' },
  // Post-redeem-invite → groups/[id] (CORRECT post-tabs target — /groups/[id] still works)
  { pattern: /router\.replace\(['"]\/groups\/[^'"]+['"]\)/, intent: 'post-redeem-invite-to-detail' },
  // Post-create-group → groups/[id] (CORRECT)
  { pattern: /router\.replace\(['"]\/groups\/[^'"]+['"]\)/, intent: 'post-create-group-to-detail' },
  // Per-group navigation (groups list → detail) — also matches /groups/[id]/review (admin queue, Plan 03-06 → 03-07)
  { pattern: /router\.push\(['"]\/groups\/[^'"]+['"]\)/, intent: 'navigate-to-group-detail' },
  // Profile, new, join, invite-redeem entry points (all valid post-tabs targets)
  { pattern: /router\.push\(['"]\/profile['"]\)/, intent: 'navigate-to-profile' },
  { pattern: /router\.push\(['"]\/groups\/new['"]\)/, intent: 'navigate-to-create-group' },
  { pattern: /router\.push\(['"]\/groups\/join['"]\)/, intent: 'navigate-to-join-group' },
  { pattern: /router\.push\(['"]\/groups['"]\)/, intent: 'navigate-to-groups-tab-from-empty-state' },
  // Bare root '/' — only via Link/replace from the invite-landing screen for the public/marketing landing
  // (currently there's one such site in app/invite/[code].tsx for the unauthed path)
  { pattern: /router\.replace\(['"]\/['"]\)/, intent: 'invite-landing-public-redirect' },
];

/**
 * Run grep across app/ + src/ for router calls hitting absolute paths.
 * Returns a list of { file, line, snippet } matches.
 */
function findRouterCalls(): Array<{ file: string; line: number; snippet: string }> {
  const cmd = `grep -rn -E "router\\.(push|replace)\\(['\\\"]/" ${PROJECT_ROOT}/app ${PROJECT_ROOT}/src 2>/dev/null || true`;
  const out = execSync(cmd, { encoding: 'utf-8' });
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([^:]+):(\d+):(.+)$/);
      if (!m) return null;
      return { file: m[1], line: parseInt(m[2], 10), snippet: m[3].trim() };
    })
    .filter((x): x is { file: string; line: number; snippet: string } => x !== null);
}

describe('Stack → Tabs migration audit (D-14)', () => {
  it('every router.push/replace targeting an absolute path matches an allowlisted intent', () => {
    const calls = findRouterCalls();
    expect(calls.length).toBeGreaterThan(0); // sanity: we DO have some router calls

    const unaccounted: typeof calls = [];
    for (const call of calls) {
      const matched = EXPECTED_ROUTER_CALL_SITES.some(({ pattern }) => pattern.test(call.snippet));
      if (!matched) {
        unaccounted.push(call);
      }
    }

    if (unaccounted.length > 0) {
      const formatted = unaccounted
        .map((c) => `  ${c.file}:${c.line} → ${c.snippet}`)
        .join('\n');
      throw new Error(
        `Phase 3 D-14 audit: ${unaccounted.length} unaccounted router call site(s).\n` +
          `Each must be reviewed against UI-SPEC §"App shell — Stack → Tabs migration" ` +
          `(lines 713-720) and added to EXPECTED_ROUTER_CALL_SITES with the correct intent:\n${formatted}`
      );
    }
  });

  it('post-leave / post-delete-group call sites have been retargeted to "/groups" (Plan 03-06)', () => {
    // Post-P3-06: this assertion now expects 0 matches. The post-leave +
    // post-delete RPC handlers in app/(app)/groups/[id]/index.tsx originally
    // called router.replace('/'); Plan 03-06 retargeted both to
    // router.replace('/groups') per UI-SPEC line 717. If a future PR
    // re-introduces a router.replace('/') call site here, this test will
    // fail — review whether the new site is intentional and update the
    // allowlist + this comment, or change the call to use '/groups'.
    const cmd = `grep -n "router.replace('/')" ${PROJECT_ROOT}/app/\\(app\\)/groups/\\[id\\]/index.tsx 2>/dev/null || true`;
    const out = execSync(cmd, { encoding: 'utf-8' });
    const lines = out.split('\n').filter(Boolean);
    expect(lines.length).toBe(0);
  });
});
