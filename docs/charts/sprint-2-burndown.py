"""
Sprint 2 (Phase 2 — Groups & Invites) burndown chart.

Reconstructed from git commit history rather than from Jira's native
burndown, because the stories were not pointed at sprint-execution time.
Points were assigned retroactively during the 2026-04-28 audit, and
Jira's chart cannot back-date the trend line for a closed sprint.

Each "actual" data point comes from the timestamp of the commit that
closed a SCRUM-NN story, with the corresponding points subtracted from
the remaining-work series. The ideal line is a linear interpolation
from sprint-start to sprint-close.

Run:  python3 sprint-2-burndown.py
Output: sprint-2-burndown.png alongside this script.
"""

from __future__ import annotations

import csv
from datetime import datetime, timezone, timedelta
from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt

PT = timezone(timedelta(hours=-7))  # America/Los_Angeles during DST


# ── Data ──────────────────────────────────────────────────────────────────
# Sprint window — actual delivery window, not the original (incorrect) Jira
# sprint dates of 2026-04-09 → 2026-04-14. Phase 2 was implemented late
# (after Phase 1 stabilised) on 2026-04-23 → 2026-04-25.
SPRINT_START = datetime(2026, 4, 23, 23, 57, tzinfo=PT)
SPRINT_END = datetime(2026, 4, 25, 14, 13, tzinfo=PT)

TOTAL_POINTS = 20  # SCRUM-13(5) + 14(2) + 15(3) + 16(3) + 17(2) + 18(3) + 19(2)

# Each event: (timestamp, points completed in this commit, label)
EVENTS = [
    (SPRINT_START, 0, "Sprint start — phase context committed"),
    (
        datetime(2026, 4, 24, 13, 32, tzinfo=PT),
        7,  # SCRUM-17 (2) + SCRUM-18 (3) + SCRUM-19 (2)
        "Migration 0004 + 7 RPCs (closes SCRUM-17/18/19)",
    ),
    (
        datetime(2026, 4, 24, 14, 9, tzinfo=PT),
        2,  # SCRUM-14
        "TanStack hooks landed (closes SCRUM-14)",
    ),
    (
        datetime(2026, 4, 24, 14, 52, tzinfo=PT),
        8,  # SCRUM-13 (5) + SCRUM-16 (3)
        "Create-group screen + timezone picker (closes SCRUM-13/16)",
    ),
    (
        datetime(2026, 4, 24, 14, 54, tzinfo=PT),
        3,  # SCRUM-15
        "Deep-link invite landing (closes SCRUM-15)",
    ),
    (
        datetime(2026, 4, 25, 14, 13, tzinfo=PT),
        0,
        "Sprint close — VERIFICATION.md committed",
    ),
]


# ── Build the actual-burndown series ──────────────────────────────────────
times: list[datetime] = []
remaining: list[int] = []
running = TOTAL_POINTS
for ts, completed, _ in EVENTS:
    running -= completed
    times.append(ts)
    remaining.append(running)


# ── Plot ──────────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(11, 6))

# Ideal line: linear from total → 0 across the sprint window.
ax.plot(
    [SPRINT_START, SPRINT_END],
    [TOTAL_POINTS, 0],
    linestyle="--",
    color="#9aa0a6",
    linewidth=1.5,
    label="Ideal burndown",
)

# Actual line: step-after each commit completes work.
ax.step(
    times,
    remaining,
    where="post",
    color="#1a73e8",
    linewidth=2.2,
    label="Actual burndown (from git)",
)
ax.scatter(times, remaining, color="#1a73e8", zorder=5, s=42)

# Annotate each commit event.
for (ts, _, label), r in zip(EVENTS, remaining):
    if "Sprint start" in label or "Sprint close" in label:
        offset = (8, 8)
        weight = "bold"
    else:
        offset = (8, 14)
        weight = "normal"
    ax.annotate(
        label,
        xy=(ts, r),
        xytext=offset,
        textcoords="offset points",
        fontsize=8,
        color="#202124",
        weight=weight,
    )

ax.set_title(
    "Sprint 2 — Phase 2 (Groups & Invites) Burndown\n"
    "Reconstructed from git commit history",
    fontsize=13,
    pad=16,
)
ax.set_xlabel("Date / Time (America/Los_Angeles)")
ax.set_ylabel("Story points remaining")
ax.set_ylim(-1, TOTAL_POINTS + 2)
ax.set_xlim(SPRINT_START - timedelta(hours=2), SPRINT_END + timedelta(hours=2))
ax.grid(True, linestyle=":", alpha=0.5)
ax.legend(loc="upper right")

# Format the x-axis: date + hour:minute on two lines for readability.
ax.xaxis.set_major_locator(mdates.HourLocator(interval=6))
ax.xaxis.set_major_formatter(
    mdates.DateFormatter("%b %-d\n%H:%M", tz=PT)
)
plt.setp(ax.xaxis.get_majorticklabels(), rotation=0, ha="center")

ax.text(
    0.01,
    -0.18,
    "Total: 20 story points across 7 stories (SCRUM-13–19). "
    "Sprint window: 2026-04-23 23:57 → 2026-04-25 14:13 PT. "
    "Ideal slope is linear; actual slope reflects step-function "
    "completion as commits landed.",
    transform=ax.transAxes,
    fontsize=8,
    color="#5f6368",
    wrap=True,
)

fig.tight_layout()

out_dir = Path(__file__).parent
png_path = out_dir / "sprint-2-burndown.png"
csv_path = out_dir / "sprint-2-burndown.csv"

fig.savefig(png_path, dpi=160, bbox_inches="tight")
print(f"wrote {png_path}")

with csv_path.open("w", newline="") as fh:
    writer = csv.writer(fh)
    writer.writerow(["timestamp_pt", "points_remaining", "event"])
    for (ts, _, label), r in zip(EVENTS, remaining):
        writer.writerow([ts.isoformat(), r, label])
print(f"wrote {csv_path}")
