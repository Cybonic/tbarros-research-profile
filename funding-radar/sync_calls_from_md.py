#!/usr/bin/env python3
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MD = ROOT / "FUNDING_RADAR_ISR_UC.md"
CALLS = ROOT / "calls.json"

text = MD.read_text(encoding="utf-8")
data = json.loads(CALLS.read_text(encoding="utf-8"))

# Update timestamp whenever markdown changes are synced.
data["timestamp"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

# Parse compact delta rows like:
# | ... | **Eurostars Call 10 (EUREKA)** | **2026-03-31** *(portal listing)* | ...
row_re = re.compile(
    r"\|\s*[^|]+\|\s*\*\*(?P<program>[^*]+)\*\*\s*\|\s*\*\*(?P<deadline>\d{4}-\d{2}-\d{2})\*\*",
    re.MULTILINE,
)

updates = {}
for m in row_re.finditer(text):
    prog = m.group("program").strip()
    dl = m.group("deadline").strip()
    updates[prog] = dl

# Map compact delta names to dashboard call entries.
name_map = {
    "Eurostars Call 10 (EUREKA)": "Eurostars Call 10",
    "EUROGIA2030 Call 30 (EUREKA Cluster)": "EUROGIA2030 Call 30",
}

for call in data.get("calls", []):
    p = call.get("program", "").strip()
    for src_name, dst_name in name_map.items():
        if p == dst_name and src_name in updates:
            # Keep human-friendly format for the dashboard table.
            dt = datetime.strptime(updates[src_name], "%Y-%m-%d")
            call["deadline"] = dt.strftime("%b %d, %Y")
            # Updated / soon.
            if call.get("status") not in ("🔴",):
                call["status"] = "🟡"

# Ensure missing mapped programs are appended if absent.
existing = {c.get("program", "") for c in data.get("calls", [])}
for src_name, dst_name in name_map.items():
    if src_name in updates and dst_name not in existing:
        dt = datetime.strptime(updates[src_name], "%Y-%m-%d")
        data.setdefault("calls", []).append(
            {
                "program": dst_name,
                "deadline": dt.strftime("%b %d, %Y"),
                "budget": "TBD",
                "support": "TBD",
                "eligible": "R&D + companies",
                "objective": "See call details",
                "link": "https://www.eurekanetwork.org/programmes/",
                "status": "🟡",
            }
        )

CALLS.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"updated {CALLS}")
