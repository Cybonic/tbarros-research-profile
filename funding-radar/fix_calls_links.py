#!/usr/bin/env python3
"""
Auto-fix known wrong/stale funding links in calls.json.

Strategy:
1) Program-specific canonical URL map for stable official sources.
2) Domain migration fixes (e.g., old KDT JU domain).
3) Optional best-effort reachability probe (HEAD/GET) to keep report fields useful.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen

UA = "Mozilla/5.0 (X11; Linux x86_64) OpenClaw-LinkFixer/1.0"


# Canonical links (official portals/pages)
CANONICAL_BY_PROGRAM = {
    "PRR Reindustrializar": "https://www.iapmei.pt/PRODUTOS-E-SERVICOS/Incentivos-Financiamento/Sistemas-de-Incentivos/PRR.aspx",
    "MSCA Doctoral Networks": "https://marie-sklodowska-curie-actions.ec.europa.eu/calls",
    "Horizon Europe — Digital Cluster": "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search",
    "Portugal 2030 — Research Excellence": "https://www.portugal2030.pt/avisos/",
    "ERC Starting Grants": "https://erc.europa.eu/apply-grant/starting-grant",
    # KDT JU has transitioned; Chips JU is the current official umbrella.
    "KDT Joint Undertaking": "https://www.chips-ju.europa.eu/",
    "Digital Europe — AI Track": "https://digital-strategy.ec.europa.eu/en/activities/digital-programme",
    "FCT Grants": "https://www.fct.pt/financiamento/programas-de-financiamento/",
    # EUREKA blocks some bots; point to program pages under same domain.
    "Eurostars Call 10": "https://www.eurekanetwork.org/programmes/eurostars/",
    "EUROGIA2030 Call 30": "https://www.eurekanetwork.org/programmes/eurogia2030/",
}

# Broad old->new migration fallbacks
DOMAIN_REWRITES = {
    "www.kdt-ju.europa.eu": "www.chips-ju.europa.eu",
}


@dataclass
class FixEvent:
    program: str
    old_link: str
    new_link: str
    reason: str


def _probe(url: str, timeout: int = 12) -> tuple[bool, int | None, str | None]:
    req = Request(url, headers={"User-Agent": UA}, method="GET")
    try:
        with urlopen(req, timeout=timeout) as r:
            code = getattr(r, "status", None) or r.getcode()
            final = getattr(r, "url", url)
            return (200 <= int(code) < 400), int(code), final
    except HTTPError as e:
        return False, e.code, None
    except URLError:
        return False, None, None
    except Exception:
        return False, None, None


def apply_fixes(data: dict[str, Any], do_probe: bool = True) -> tuple[dict[str, Any], list[FixEvent]]:
    fixes: list[FixEvent] = []
    calls = data.get("calls", [])

    for call in calls:
        program = str(call.get("program", "")).strip()
        old = str(call.get("link", "")).strip()
        if not old:
            continue

        new = old
        reason = None

        # Program canonical override first.
        if program in CANONICAL_BY_PROGRAM:
            cand = CANONICAL_BY_PROGRAM[program]
            if cand != old:
                new = cand
                reason = "program_canonical"

        # Domain rewrite fallback.
        for src, dst in DOMAIN_REWRITES.items():
            if src in new:
                rw = new.replace(src, dst)
                if rw != new:
                    new = rw
                    reason = reason or "domain_rewrite"

        if new != old:
            call["link"] = new
            fixes.append(FixEvent(program=program, old_link=old, new_link=new, reason=reason or "rewrite"))

        if do_probe:
            ok, code, final = _probe(call["link"])
            call["link_check"] = {
                "ok": ok,
                "status": code,
                "final_url": final,
                "checked_at": datetime.now(timezone.utc).isoformat(),
            }

    data["timestamp"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return data, fixes


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser()
    here = Path(__file__).resolve().parent
    ap.add_argument("--calls", default=str(here / "calls.json"))
    ap.add_argument("--report", default=str(here / "link_fix_report.json"))
    ap.add_argument("--no-probe", action="store_true")
    args = ap.parse_args()

    calls_path = Path(args.calls)
    report_path = Path(args.report)

    data = json.loads(calls_path.read_text(encoding="utf-8"))
    new_data, fixes = apply_fixes(data, do_probe=not args.no_probe)

    calls_path.write_text(json.dumps(new_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "calls_file": str(calls_path),
        "fixes_applied": len(fixes),
        "fixes": [f.__dict__ for f in fixes],
    }
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"fixes_applied={len(fixes)}")
    print(f"report={report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
