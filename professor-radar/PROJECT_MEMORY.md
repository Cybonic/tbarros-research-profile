# Professor Radar — Project Memory

## Purpose

Track open or officially announced forthcoming **Professor Auxiliar** positions at major Portuguese universities in artificial intelligence, robotics, electrical engineering, computer engineering, computer science, automation, control, perception, signal processing, telecommunications, and closely related areas.

Official university recruitment portals are authoritative. Rumours are not forthcoming positions. Closed positions must not remain active when a reliable deadline exists.

## Publication status

The user explicitly reversed the earlier private-only decision on 2026-08-28. The radar now has a public `index.html` and is linked from the main website. Keep the public page limited to verified matching positions and source health; do not expose scan caches or internal diagnostics.

## Important files

- `results.json`: generated current output for downstream private tooling.
- `index.html`, `style.css`, `script.js`: public dashboard.
- `sources.json`: official university listing pages.
- `update_professor_radar.py`: standard-library-only scanner and filter.
- `scan_state.json`: generated listing hashes and cached matches.
- `skill/SKILL.md`: compact operating instructions.
- `update_and_publish.sh`: local scan, validation, commit, rebase, and push command.
- `.github/workflows/update-professor-radar.yml`: optional manual validation only; it never updates data.

## Efficient weekly design

Updates run locally and are then pushed to GitHub. Run `bash professor-radar/update_and_publish.sh`; a local scheduler may invoke it weekly. GitHub Actions must not scan or generate Professor Radar data. Each listing is capped at 2 MB and hashed. An unchanged listing reuses cached results. Changed pages are parsed locally; detail pages are fetched only for same-domain recruitment links whose labels do not already establish rank and relevance. Routine runs use no LLM tokens.

Output fields are `last_scan`, `scan_sources`, and `positions`. Positions contain `university`, `title`, `department`, `deadline` (`YYYY-MM-DD` or `unknown`), `link`, `source`, and `relevant`.

If one source fails, retain its cache. If every source fails, preserve `results.json` and fail the job. Never guess missing deadlines.

Validate with `python3 professor-radar/update_professor_radar.py --self-test`, `python3 -m py_compile professor-radar/update_professor_radar.py`, and `python3 -m json.tool professor-radar/sources.json`.

The working tree already contained user-owned changes to `results.json` and an untracked `results.prev.json`; preserve them unless explicitly asked to replace them.
