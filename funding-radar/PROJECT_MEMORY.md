# Funding Radar — Project Memory

## Purpose

Track Portuguese and European funding opportunities relevant to ISR/UC work in AI, robotics, and digitization. The public dashboard reads `calls.json` and `news.json`.

## Local publication workflow

Funding Radar data is generated locally, never by GitHub Actions. Run `bash funding-radar/update_and_publish.sh`. The command synchronizes the curated compact-delta Markdown into `calls.json`, normalizes canonical links, probes links, validates Python and JSON, commits only generated funding data/reports, rebases, and pushes to `origin/main`.

The local cron schedule runs Mondays at 09:00 Europe/Lisbon. Logs go to `/tmp/funding-radar-weekly.log`.

## Important limitation

The current deterministic pipeline does **not discover new opportunities from the web**. `FUNDING_RADAR_ISR_UC.md` is the curated source of programme/deadline changes; the scripts synchronize and verify it. Update that Markdown after an evidence-based funding review when new calls must be added. Do not claim automatic discovery until a dedicated official-source scanner exists.

## Files

- `FUNDING_RADAR_ISR_UC.md`: curated source notes and changes.
- `funding_calls.xlsx`: user-maintained workbook of calls and deadlines.
- `FUNDING_SOURCES.md`: generated human-readable catalogue and relevance analysis of every workbook row. Non-past workbook calls are also merged into `calls.json` for the public dashboard; missing URLs render as “Official link pending.”
- `import_funding_sources.py`: deterministic workbook-to-Markdown converter.
- `calls.json`, `news.json`: public dashboard data.
- `sync_calls_from_md.py`: applies recognized Markdown deltas to dashboard data.
- `fix_calls_links.py`: canonicalizes official URLs.
- `verify_calls_links.py`: checks reachability and approximate title match.
- `link_fix_report.json`, `link_verification_report.json`: generated diagnostics.
- `update_and_publish.sh`: safe local update and Git publication command.

Link verification failures are warnings because official portals sometimes block automated requests. Inspect failures rather than deleting calls automatically.
