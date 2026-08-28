# Funding Radar — Project Memory

## Purpose

Track Portuguese and European funding opportunities relevant to ISR/UC work in AI, robotics, and digitization. The public dashboard reads `calls.json` and `news.json`.

## Local publication workflow

Funding Radar data is generated locally, never by GitHub Actions. Run `bash funding-radar/update_and_publish.sh` with `OPENAI_API_KEY` in its environment. One GPT-5.3-Codex Responses API call searches official pages and returns structured editorial deltas; deterministic code validates and applies them before rebuilding `calls.json`, checking links, committing, and pushing to `origin/main`.

The local cron schedule runs Mondays at 09:00 Europe/Lisbon. Logs go to `/tmp/funding-radar-weekly.log`.

## Editorial decision policy

`codex_decide_updates.py` is the editorial gate for web-discovered entries. It sends a compact deduplication context, uses official-source web search, and requests strict structured output. Publication requires a future exact deadline, direct official link, Portugal-relevant eligibility, fit score of at least 3/5, and an actionable reason. The call fails closed when the API key, API response, or validation is unavailable. Spreadsheet entries remain user-controlled and are never deleted by the model.

The API response and token usage are retained in `codex_decision_report.json`. Rejected candidates are kept there for audit but not shown publicly. `OPENAI_API_KEY` is a local secret and must never be committed.

## Files

- `FUNDING_RADAR_ISR_UC.md`: curated source notes and changes.
- `funding_calls.xlsx`: user-maintained workbook of calls and deadlines.
- `FUNDING_SOURCES.md`: generated human-readable catalogue and relevance analysis of every workbook row. Non-past workbook calls are also merged into `calls.json`; unresolved sources render as “Official notice pending.”
- `import_funding_sources.py`: deterministic workbook-to-Markdown converter.
- `codex_decide_updates.py`: one-call Codex/API official-source scan, relevance decision, validation, and delta application.
- `codex_decision_report.json`: generated decision audit, including additions, updates, removals, rejections, response ID, and token usage.
- `workbook_call_links.json`: reviewed mapping from workbook call names to official pages and concise verification notes. Keep questionable dates explicit; never substitute an unofficial or generic page merely to fill a link.
- `verified_calls.json`: opportunities verified against official portals during source scans; kept separate from workbook-derived entries.
- `calls.json`, `news.json`: public dashboard data.
- `sync_calls_from_md.py`: applies recognized Markdown deltas to dashboard data.
- `fix_calls_links.py`: canonicalizes official URLs.
- `verify_calls_links.py`: checks reachability and approximate title match.
- `link_fix_report.json`, `link_verification_report.json`: generated diagnostics.
- `update_and_publish.sh`: safe local update and Git publication command.

Link verification failures are warnings because official portals sometimes block automated requests. Inspect failures rather than deleting calls automatically.
