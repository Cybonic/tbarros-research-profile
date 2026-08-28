# Funding Radar — Project Memory

## Purpose

Track Portuguese and European funding opportunities relevant to ISR/UC work in AI, robotics, and digitization. The public dashboard reads `calls.json` and `news.json`.

## Local publication workflow

Funding Radar data is generated locally, never by GitHub Actions. Run `bash funding-radar/update_and_publish.sh` with `OPENAI_API_KEY` in its environment. Local CLI tools fetch, cache, diff, parse, normalize, and pre-filter official pages. GPT-5.3-Codex receives only compact candidate facts and returns publication decisions; deterministic code applies them before rebuilding `calls.json`, checking links, committing, and pushing.

The local cron schedule runs Mondays at 09:00 Europe/Lisbon. Logs go to `/tmp/funding-radar-weekly.log`.

## Editorial decision policy

`scan_funding_sources.py` performs all network and parsing work. It scans the resource links already published on the page, follows at most 80 likely official call links, caches bodies and HTTP validators locally, extracts dates/budgets/eligibility/scope with deterministic rules, and writes `candidate_facts.json`. Generic pages, expired dates, and records without technical fit are discarded before Codex.

`codex_decide_updates.py` receives at most 30 compact facts and can only publish or reject candidate IDs, assign priority/fit, and write a short action rationale. It has no web-search or other tool access and cannot alter extracted URLs, deadlines, or evidence. Unchanged published and rejected content is skipped, including the API call when nothing needs review. Publication still requires deterministic validation and a fit score of at least 3/5. The call fails closed on errors. Spreadsheet entries remain user-controlled.

The API response and token usage are retained in `codex_decision_report.json`. Rejected candidates are kept there for audit but not shown publicly. `OPENAI_API_KEY` is a local secret and must never be committed.

## Files

- `FUNDING_RADAR_ISR_UC.md`: curated source notes and changes.
- `funding_calls.xlsx`: user-maintained workbook of calls and deadlines.
- `FUNDING_SOURCES.md`: generated human-readable catalogue and relevance analysis of every workbook row. Non-past workbook calls are also merged into `calls.json`; unresolved sources render as “Official notice pending.”
- `import_funding_sources.py`: deterministic workbook-to-Markdown converter.
- `codex_decide_updates.py`: decision-only Codex/API gate, structured validation, and deterministic delta application.
- `scan_funding_sources.py`: local concurrent crawler, HTTP cache/diff engine, parser, fact extractor, and hard filter.
- `candidate_facts.json`: ignored local compact factual candidates produced without an LLM.
- `source_scan_state.json`: ignored local HTTP hashes and validators used to avoid unchanged downloads.
- `.source-cache/`: ignored local HTML cache; never sent to Codex or committed.
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
