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
- `codex_decide_positions.py`: decision-only structured Codex gate; it cannot change candidate facts.
- `scan_state.json`: generated listing hashes and cached matches.
- `skill/SKILL.md`: compact operating instructions.
- `update_and_publish.sh`: local scan, validation, commit, rebase, and push command.
- `.github/workflows/update-professor-radar.yml`: optional manual validation only; it never updates data.

## Efficient weekly design

Updates run locally and are then pushed to GitHub. Run `bash professor-radar/update_and_publish.sh` with `OPENAI_API_KEY`; a local scheduler may invoke it weekly. GitHub Actions must not scan or generate data. Each listing is capped at 2 MB and hashed. Unchanged listings reuse cached facts. Changed pages are parsed locally; detail pages are fetched only for same-domain recruitment links whose labels do not already establish rank and relevance.

The scanner writes ignored `candidate_facts.json` with immutable IDs, official URLs, parsed deadlines, content hashes, and short rank/area evidence. Codex receives at most 30 compact new/changed candidates and may only publish/reject, score fit, and provide a short rationale. It has no tools and cannot browse or change factual fields. Unchanged published and rejected hashes skip review; when nothing changes the API call is skipped. API/validation failures leave public results unchanged.

Output fields are `last_scan`, `scan_sources`, and `positions`. Positions contain factual scanner fields plus `fit_score` and `why_now` from the editorial decision.

If one source fails, retain its cache. If every source fails, preserve `results.json` and fail the job. Never guess missing deadlines.

Validate with `python3 professor-radar/update_professor_radar.py --self-test`, `python3 -m py_compile professor-radar/update_professor_radar.py`, and `python3 -m json.tool professor-radar/sources.json`.

The working tree already contained user-owned changes to `results.json` and an untracked `results.prev.json`; preserve them unless explicitly asked to replace them.
