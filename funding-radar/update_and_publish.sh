#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

allowed='^(funding-radar/(calls\.json|news\.json|link_fix_report\.json|link_verification_report\.json|codex_decision_report\.json|candidate_facts\.json|source_scan_state\.json))$'
dirty="$(git status --porcelain --untracked-files=no | awk '{print $2}' | grep -Ev "$allowed" || true)"
if [[ -n "$dirty" ]]; then
    echo "Refusing to publish while unrelated tracked files are modified:" >&2
    echo "$dirty" >&2
    exit 1
fi

python3 funding-radar/scan_funding_sources.py
python3 funding-radar/codex_decide_updates.py --apply
python3 funding-radar/import_funding_sources.py
python3 funding-radar/sync_calls_from_md.py
python3 funding-radar/fix_calls_links.py --no-probe
python3 funding-radar/verify_calls_links.py || echo "Warning: one or more funding links could not be verified" >&2
python3 -m py_compile funding-radar/scan_funding_sources.py funding-radar/codex_decide_updates.py funding-radar/import_funding_sources.py funding-radar/sync_calls_from_md.py funding-radar/fix_calls_links.py funding-radar/verify_calls_links.py
python3 -m json.tool funding-radar/calls.json >/dev/null
python3 -m json.tool funding-radar/news.json >/dev/null
python3 -m json.tool funding-radar/link_fix_report.json >/dev/null
python3 -m json.tool funding-radar/link_verification_report.json >/dev/null
python3 -m json.tool funding-radar/codex_decision_report.json >/dev/null
python3 -m json.tool funding-radar/candidate_facts.json >/dev/null
python3 -m json.tool funding-radar/source_scan_state.json >/dev/null

git add funding-radar/FUNDING_SOURCES.md funding-radar/calls.json funding-radar/news.json funding-radar/link_fix_report.json funding-radar/link_verification_report.json funding-radar/codex_decision_report.json funding-radar/verified_calls.json
if git diff --cached --quiet; then
    echo "Funding Radar is already current."
    exit 0
fi

git commit -m "Update Funding Radar $(date -u +%Y-%m-%d)"
git pull --rebase origin main
git push origin main
