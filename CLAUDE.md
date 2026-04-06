# AccountiBuzz — Project Guide

## Goal
Timothy is learning to code by building AccountiBuzz. The workflow prioritizes **learning over speed** — Timothy writes the code, Claude mentors.

## Jira
- Site: `comp586.atlassian.net` (NOT `ai-mentor.atlassian.net` — different project)
- Project: `SCRUM`
- Board: https://comp586.atlassian.net/jira/software/projects/SCRUM/boards/1
- Account: Timothy Do (`thinhdo1410@gmail.com`)

## Workflow

```
project-manager → discuss → plan → code-coach (Timothy codes) → quality-reviewer → verify
```

### Step 1 — Check Jira
Invoke `project-manager` to pull the current sprint and identify the next story.
Writes to `.claude/context/current-story.md`.

**Start every session with:**
> "Check Jira and tell me what we're working on"

### Step 2 — Discuss
Talk through what the story is building and why. Answer:
- What problem does this solve for the user?
- What files will change?
- Any decisions to make before coding?

### Step 3 — Plan
Break the story into small, ordered steps Timothy can follow.
Each step should be one concept or one file — not overwhelming.

### Step 4 — Code (Timothy writes, Claude mentors)
Invoke `code-coach` to guide implementation.
- Claude explains each step before Timothy writes it
- Timothy writes the code himself
- Claude reviews each piece before moving on
- Claude never writes full files unless Timothy is completely stuck and asks

### Step 5 — Review
Invoke `quality-reviewer` to review the completed story.
Feedback should teach, not just correct.

### Step 6 — Verify
Run the app, test the acceptance criteria from the Jira story manually.

## Agents

| Agent | Role |
|-------|------|
| `project-manager` | Pulls Jira sprint, writes current-story.md |
| `code-coach` | Mentors Timothy through writing code step by step |
| `quality-reviewer` | Reviews completed code with learning-focused feedback |

## Project Structure

```
.claude/
├── agents/          # agent definitions
└── context/         # current-story.md (updated by project-manager)

.planning/           # roadmap, phase context, conventions
src/                 # React Native app source
android/             # Native Android build
```

## GSD + Jira Mapping

| GSD Phase | Jira Stories |
|-----------|-------------|
| Phase 1 | SCRUM-9, SCRUM-10 |
| Phase 2 | SCRUM-11, SCRUM-12 |
| Phase 3 | SCRUM-13, SCRUM-14, SCRUM-15 |
| Phase 4 | SCRUM-16, SCRUM-17, SCRUM-18, SCRUM-19 |
| Phase 5 | SCRUM-20, SCRUM-21, SCRUM-22 |
| Phase 6 | SCRUM-23, SCRUM-24 |
| Phase 7 | SCRUM-25, SCRUM-26, SCRUM-27, SCRUM-28 |
| Phase 8 | SCRUM-29, SCRUM-30 |
| Phase 9 | SCRUM-31, SCRUM-34 |
| Phase 10 | SCRUM-32, SCRUM-33, SCRUM-35, SCRUM-18 |
| Phase 11 | SCRUM-36, SCRUM-37, SCRUM-38 |
| Phase 12 | SCRUM-39, SCRUM-40, SCRUM-41, SCRUM-42, SCRUM-43 |

## Dev Environment

```powershell
# Terminal 1 — start emulator
$env:PATH += ";$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator"
emulator -avd Pixel_6

# Terminal 2 — run app
cd E:\claude\projects\accountibuzz
npm run android
```
