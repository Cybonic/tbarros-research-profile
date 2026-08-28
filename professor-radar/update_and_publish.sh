#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

# Refuse to mix unrelated tracked edits into an automated publication.
dirty="$(git status --porcelain --untracked-files=no | awk '$2 != "professor-radar/results.json" && $2 != "professor-radar/scan_state.json" {print}')"
if [[ -n "$dirty" ]]; then
    echo "Refusing to publish while unrelated tracked files are modified:" >&2
    echo "$dirty" >&2
    exit 1
fi

python3 professor-radar/update_professor_radar.py --results professor-radar/candidate_facts.json
python3 professor-radar/codex_decide_positions.py --apply
python3 professor-radar/update_professor_radar.py --self-test
python3 -m py_compile professor-radar/update_professor_radar.py professor-radar/codex_decide_positions.py
python3 -m json.tool professor-radar/results.json >/dev/null
python3 -m json.tool professor-radar/scan_state.json >/dev/null
python3 -m json.tool professor-radar/candidate_facts.json >/dev/null
python3 -m json.tool professor-radar/codex_decision_report.json >/dev/null

git add professor-radar/results.json professor-radar/scan_state.json
if git diff --cached --quiet; then
    echo "Professor Radar is already current."
    exit 0
fi

git commit -m "Update Professor Radar $(date -u +%Y-%m-%d)"
git pull --rebase origin main
git push origin main
