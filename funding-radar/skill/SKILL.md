---
name: update-funding-radar
description: Maintain and locally publish the ISR/UC Funding Radar, including curated funding deltas, canonical links, validation reports, and GitHub updates.
---

# Update Funding Radar

Read `funding-radar/PROJECT_MEMORY.md` first. Use `update_and_publish.sh` for routine local synchronization and publication. GitHub Actions must not generate Funding Radar data.

Treat `FUNDING_RADAR_ISR_UC.md` as curated input, not proof that calls are current. Verify material deadline or eligibility changes against official sources before editing it. Prefer deterministic scripts and compact official pages; do not spend LLM tokens reparsing unchanged material.

When `funding_calls.xlsx` changes, run `import_funding_sources.py` and preserve every row in `FUNDING_SOURCES.md`, separating non-past calls from historical ones. The workbook has no URLs; maintain reviewed official mappings in `workbook_call_links.json`. Never invent links, hide verification caveats, or present inferred funding bodies as verified.

Link-check failures are warnings, not grounds to delete a call. Report ambiguity and preserve official URLs. Do not mix unrelated repository changes into automated funding commits.
