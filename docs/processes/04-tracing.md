# 4. Tracing

How the team can answer, for any artifact, two questions:

1. **Forward trace**: "This requirement exists — where in the code does it live, what tests cover it, and which commits implemented it?"
2. **Backward trace**: "This commit / line of code / bug — which requirement does it serve, and why was it accepted?"

A change with no traceable origin is itself a defect.

## The traceability chain

```
Requirement (REQUIREMENTS.md)
   └── Phase (ROADMAP.md)                  ← maps phases to requirement IDs
        └── Phase Plan (.planning/phases/NN-name/NN-MM-PLAN.md)
             └── JIRA Epic (SCRUM-2..8)    ← one per phase
                  └── JIRA Story (SCRUM-9..43)
                       └── Git Commit      ← scoped (NN-MM)
                            └── Pull Request (when used)
                                 └── CI Run (typecheck + Jest + RLS)
                                      └── Verification entry (VERIFICATION.md)
                                           └── Release tag (vX.Y.Z, future)
```

Every link in this chain is **explicit and stable**: a requirement ID like `AUTH-04` appears verbatim in REQUIREMENTS.md, ROADMAP.md, the phase plan, the JIRA story, and (when relevant) the commit message body. There is no inference required.

## Stable identifiers

The project uses three identifier families and never changes an existing identifier:

| Identifier | Format | Example | Where assigned |
|---|---|---|---|
| Requirement ID | `<AREA>-<NN>` | `GRP-01`, `AUTH-04`, `SUB-03` | `REQUIREMENTS.md` |
| Phase / Plan ID | `<NN>` and `<NN>-<MM>` | Phase `02`, Plan `02-07` | `ROADMAP.md`, `.planning/phases/` |
| JIRA key | `SCRUM-<NN>` | `SCRUM-9`, `SCRUM-49` | Auto-assigned by JIRA |

If a requirement is dropped or replaced, its ID is **not** reused. Renumbering would break every existing trace.

## Forward trace — example walkthrough

**Question:** "Where is `AUTH-04` (User can create a profile with display name and avatar) implemented?"

1. Open `REQUIREMENTS.md`. `AUTH-04` is checked: `[x]`. Confirms it shipped.
2. Open `ROADMAP.md` → Phase 1 row. `AUTH-04` is listed under "Requirements" for Phase 1.
3. Open `.planning/phases/01-foundation/`. The relevant plan file is `01-05-PLAN.md` (profile screen + avatar upload + logout).
4. `git log --oneline --grep="01-05"` returns every commit that closed pieces of plan 01-05.
5. JIRA → SCRUM-2 (Auth epic) → child stories `SCRUM-9, SCRUM-10, SCRUM-11, SCRUM-12`. `SCRUM-11` ("set up display name") is the story that owns the implementation; its work log shows actual time spent.
6. `tests/` has the matching coverage; the CI run on the closing commit was green.
7. `VERIFICATION.md` for Phase 1 contains the UAT checklist that confirmed the AC.

Six artifacts. All linked by stable IDs. All checked into the repo.

## Backward trace — example walkthrough

**Question:** "Why does `src/hooks/useGroup.ts` exist, and what's it serving?"

1. `git blame src/hooks/useGroup.ts` shows the introducing commit. Commit message scope is `(02-03)`, so the work belongs to Phase 2, Plan 02-03.
2. `.planning/phases/02-groups/02-03-PLAN.md` lists the requirement IDs the plan addresses: `GRP-01, GRP-04, INV-02, …`.
3. `ROADMAP.md` confirms those IDs are scoped to Phase 2.
4. `REQUIREMENTS.md` shows the wording: `GRP-04` = "User can view a group's details, members, and rules."
5. JIRA epic `SCRUM-3` (Group Management) → child stories show effort, sprint membership, points, status.
6. If a downstream bug exists (e.g., `SCRUM-50` "group settings apply to wrong group"), it is parented to `SCRUM-3`, completing the loop from defect back to the requirement that defined the area.

## Cross-cutting trace points

A few additional bindings strengthen the chain:

- **Code-review findings**: Each finding in `REVIEW.md` is given an ID like `WR-01`, `WR-05`. Fix commits cite the ID directly: `fix(02): WR-05 swap Alert.alert kebab for ActionSheetIOS + Android sheet`. The review report lives next to the phase artifact.
- **JIRA Bug parent links**: Every bug must have a parent epic. After the recent audit, all six bugs (`SCRUM-48, 49, 50, 51, 53, 54`) are parented to one of the seven epics, so a bug always traces back to the requirement area it lives in.
- **CI artifacts**: GitHub Actions retains run logs per commit. A green run on the merge commit is the verification that the Definition of Done item "CI is green" was satisfied at the time of merge.

## Traceability matrix

A traceability matrix can be derived at any time by joining the three artifacts:

| Requirement ID | Phase | Plan(s) | JIRA Epic | JIRA Stories | Status |
|---|---|---|---|---|---|
| AUTH-01 | 01 | 01-04 | SCRUM-2 | SCRUM-9 | ✅ Done |
| AUTH-02 | 01 | 01-04 | SCRUM-2 | SCRUM-10 | ✅ Done |
| AUTH-03 | 01 | 01-05 | SCRUM-2 | (covered by 01-05) | ✅ Done |
| AUTH-04 | 01 | 01-05 | SCRUM-2 | SCRUM-11, SCRUM-12 | ✅ Done |
| GRP-01 | 02 | 02-02, 02-03 | SCRUM-3 | SCRUM-13 | ✅ Done |
| GRP-04 | 02 | 02-03 | SCRUM-3 | SCRUM-15 (related) | ✅ Done |
| GRP-05 | 02 | (none yet) | SCRUM-3 | SCRUM-54 (bug-driven) | 🟡 In Progress |
| SUB-01..06 | 03 | 03-01..08 | SCRUM-4 | SCRUM-20..24 | 🔵 In Progress |
| ADM-01..04 | 03 | 03-04..08 | SCRUM-5 | SCRUM-25..30 | 🔵 In Progress |
| LB-01, LB-02 | 04 | (planned) | SCRUM-7 | SCRUM-36, 37, 38 | ⚪ Open |
| PUSH-* | 05 | (planned) | SCRUM-8 | SCRUM-39..43 | ⚪ Open |

This table is regenerated as part of each phase-close commit so it never drifts more than one phase out of date.

## Why the trace matters

Traceability is the mechanism that makes everything else in the process work:

- **Change control** can answer "what does this change touch?" by walking the chain.
- **Status tracking** can answer "are we done?" by confirming all three artifacts agree.
- **Version control** can answer "why does this code exist?" by reading the commit scope and the linked plan.
- **Demo / submission** can answer "show me the requirement and the working feature" in two clicks.

If a change is made without a stable ID anywhere in this chain, it is treated as an orphan and either gets a backfilled trace (preferred) or is reverted (if traceability cannot be reconstructed).
