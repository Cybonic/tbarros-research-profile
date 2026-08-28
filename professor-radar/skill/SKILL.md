---
name: update-professor-radar
description: Maintain the private Portuguese Professor Auxiliar radar for AI, robotics, electrical engineering, and computer engineering, including its sources, parser, data, and weekly automation.
---

# Update Professor Radar

Read `professor-radar/PROJECT_MEMORY.md` first. Use `update_and_publish.sh` for routine local updates and GitHub publication. GitHub Actions must not generate the data. `update_professor_radar.py` must do all fetching, caching, parsing, factual extraction, deadline/rank/area filtering, and hashing. `codex_decide_positions.py` receives only compact changed facts and may only publish/reject, score fit, and write a short rationale. Never give the model tools, raw HTML, or authority over factual fields. Maintain official listing URLs in `sources.json`.

Preserve the public dashboard and show only verified matching positions. Do not expose scan caches or internal diagnostics. External notifications still require explicit authorization.

Run the built-in self-test and validate Python/JSON before accepting output. Require both Professor Auxiliar rank and an in-scope technical area. Preserve cached results on portal failure and never replace good output when every source fails. Report ambiguity rather than guessing.
