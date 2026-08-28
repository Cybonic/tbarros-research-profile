---
name: update-professor-radar
description: Maintain the private Portuguese Professor Auxiliar radar for AI, robotics, electrical engineering, and computer engineering, including its sources, parser, data, and weekly automation.
---

# Update Professor Radar

Read `professor-radar/PROJECT_MEMORY.md` first. Prefer the deterministic `update_professor_radar.py`; routine runs must not use an LLM to parse pages. Maintain official listing URLs in `sources.json`. Add small source-specific parsing only when the generic parser cannot handle a portal.

Preserve the public dashboard and show only verified matching positions. Do not expose scan caches or internal diagnostics. External notifications still require explicit authorization.

Run the built-in self-test and validate Python/JSON before accepting output. Require both Professor Auxiliar rank and an in-scope technical area. Preserve cached results on portal failure and never replace good output when every source fails. Report ambiguity rather than guessing.
