# Charts

Reproducible charts for the COMP586 Accountibuzz project. Each chart is generated from data already in the repo (git history, `.planning/`, or Jira exports) so the figures regenerate exactly the same way every time.

## Available charts

| File | What it shows | Source data |
|---|---|---|
| [`sprint-2-burndown.py`](./sprint-2-burndown.py) → [`.png`](./sprint-2-burndown.png) | Sprint 2 (Phase 2 — Groups & Invites) burndown, reconstructed from git commit timestamps | Git log, story-point assignments from the 2026-04-28 audit |

Each `.py` script writes a sibling `.png` and `.csv` so the underlying data points are auditable, not just the picture.

## Why custom-built rather than Jira's native chart

Jira's burndown chart relies on the story-point trend at the time of each status change. For closed sprints in this project, points were assigned **retroactively** during the 2026-04-28 audit (most stories were unpointed at sprint-execution time). Jira cannot back-date the trend line, so the native burndown for closed sprints is flat or empty — visually misleading.

The reconstructed burndown uses **git commit timestamps** as the ground truth for "when was a unit of work actually completed." Each commit that closes one or more SCRUM stories drops the remaining-points series by the corresponding amount. This is more honest than Jira's view because it reflects what was actually built, not what the ticket-tracking metadata happened to say.

## Reproducing

```bash
cd docs/charts
pip3 install --quiet matplotlib
python3 sprint-2-burndown.py
# writes sprint-2-burndown.png and sprint-2-burndown.csv
```

## Methodology — for the assignment write-up

The burndown is constructed by:

1. Identifying the sprint's stories from `ROADMAP.md` (Phase 2 → SCRUM-13 through SCRUM-19).
2. Summing their story points → 20 points total.
3. For each story, finding the commit that closed it (the commit that landed the implementation against the story's acceptance criteria — identifiable from the commit scope `(02-NN)` and the corresponding plan in `.planning/phases/02-groups/`).
4. Plotting an event series of `(commit_timestamp, points_remaining_after_this_commit)`.
5. Overlaying an ideal linear burndown from sprint-start to sprint-close as a dashed reference.

The sprint window used is **the actual delivery window**, not the originally-scheduled Jira sprint dates. Phase 2 was executed on 2026-04-23 → 2026-04-25, which is what the chart spans. Plotting against the original Jira dates (2026-04-09 → 2026-04-14) would show a nonsensical late-finishing sprint and obscure the real productivity signal.
