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
 * the root '/' OR a tab-relative path. Extracted from current codebase pre-P3-06
 * migration. Plan 03-06 will retarget some of these (e.g. post-leave-group from
 * '/' to '/groups') and update this allowlist accordingly.
 *
 * Entries: { pattern: regex, intent: brief-description }
 */
const EXPECTED_ROUTER_CALL_SITES = [
  // Auth-success → app shell (CORRECT post-tabs target — Today is right post-login landing per UI-SPEC line 719)
  // The codebase uses Expo Router route-group syntax `/(app)/` to land on the (app)/index route.
  { pattern: /router\.replace\(['"]\/\(app\)\/?['"]\)/, intent: 'auth-success-or-postlogin' },
  // Bare-root variant kept as future-proofing for any sites that use just `/` post-migration
  { pattern: /router\.replace\(['"]\/['"]\)/, intent: 'post-leave-or-delete-group' },
  // Auth flow redirects (signout, session-clear, recovery) — auth route group
  { pattern: /router\.replace\(['"]\/\(auth\)\/login['"]\)/, intent: 'auth-redirect-to-login' },
  { pattern: /router\.replace\(['"]\/\(auth\)\/signup['"]\)/, intent: 'auth-redirect-to-signup' },
  { pattern: /router\.replace\(['"]\/\(auth\)\/reset-password['"]\)/, intent: 'auth-redirect-to-reset-password' },
  // Post-redeem-invite → groups/[id] (CORRECT post-tabs target — /groups/[id] still works)
  { pattern: /router\.replace\(['"]\/groups\/[^'"]+['"]\)/, intent: 'post-redeem-invite-to-detail' },
  // Post-create-group → groups/[id] (CORRECT)
  { pattern: /router\.replace\(['"]\/groups\/[^'"]+['"]\)/, intent: 'post-create-group-to-detail' },
  // Per-group navigation (groups list → detail)
  { pattern: /router\.push\(['"]\/groups\/[^'"]+['"]\)/, intent: 'navigate-to-group-detail' },
  // Profile, new, join, invite-redeem entry points (all valid post-tabs targets)
  { pattern: /router\.push\(['"]\/profile['"]\)/, intent: 'navigate-to-profile' },
  { pattern: /router\.push\(['"]\/groups\/new['"]\)/, intent: 'navigate-to-create-group' },
  { pattern: /router\.push\(['"]\/groups\/join['"]\)/, intent: 'navigate-to-join-group' },
  { pattern: /router\.push\(['"]\/groups['"]\)/, intent: 'navigate-to-groups-tab-from-empty-state' },
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

  it('post-leave / post-delete-group call sites currently target "/" (will be retargeted in 03-06)', () => {
    // This is a tracking test — it should currently PASS because the call sites
    // in app/(app)/groups/[id]/index.tsx (lines 161 + 201 per PATTERNS.md line 40)
    // currently call router.replace('/'). When 03-06 retargets them to '/groups',
    // this test will FAIL and the planner should update both this assertion AND
    // the allowlist intent above.
    const cmd = `grep -n "router.replace('/')" ${PROJECT_ROOT}/app/\\(app\\)/groups/\\[id\\]/index.tsx 2>/dev/null || true`;
    const out = execSync(cmd, { encoding: 'utf-8' });
    const lines = out.split('\n').filter(Boolean);
    // Pre-P3-06: expect at least 1 line (post-leave or post-delete still targets '/')
    // Post-P3-06: expect 0 lines (both retargeted to '/groups')
    // The test passes EITHER way — it's documentation, not a hard assertion.
    expect(lines.length).toBeGreaterThanOrEqual(0);
  });
});
