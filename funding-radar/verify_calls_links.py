#!/usr/bin/env python3
"""
Verify funding call links:
1) URL exists/reachable (HTTP 2xx/3xx)
2) Page content roughly matches expected call title

Input: calls.json (default: funding-radar/calls.json)
Output: JSON report with per-link checks + summary
"""

from __future__ import annotations

import argparse
import json
import re
import ssl
import unicodedata
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


UA = "Mozilla/5.0 (X11; Linux x86_64) OpenClaw-LinkVerifier/1.0"
STOPWORDS = {
    "de", "da", "do", "dos", "das", "e", "em", "para", "a", "o", "as", "os",
    "the", "and", "for", "of", "to", "in", "on", "with", "by", "an", "or",
}


@dataclass
class LinkCheck:
    program: str
    url: str
    exists: bool
    status_code: int | None
    final_url: str | None
    title_match: bool
    match_score: float
    page_title: str | None
    page_h1: str | None
    error: str | None


def _normalize(text: str) -> list[str]:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s-]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    toks = [t for t in text.split() if len(t) > 2 and t not in STOPWORDS]
    return toks


def _extract_title_and_h1(html: str) -> tuple[str | None, str | None]:
    title = None
    h1 = None

    m_title = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.I | re.S)
    if m_title:
        title = unescape(re.sub(r"\s+", " ", m_title.group(1)).strip())

    m_h1 = re.search(r"<h1[^>]*>(.*?)</h1>", html, flags=re.I | re.S)
    if m_h1:
        h1_raw = re.sub(r"<[^>]+>", " ", m_h1.group(1))
        h1 = unescape(re.sub(r"\s+", " ", h1_raw).strip())

    return title, h1


def _score_title_match(expected: str, observed_title: str | None, observed_h1: str | None) -> float:
    exp = set(_normalize(expected))
    if not exp:
        return 0.0
    cand = " ".join([observed_h1 or "", observed_title or ""])
    got = set(_normalize(cand))
    if not got:
        return 0.0
    return len(exp & got) / len(exp)


def check_url(program: str, url: str, timeout: int = 20, threshold: float = 0.45) -> LinkCheck:
    req = Request(url, headers={"User-Agent": UA})
    context = ssl.create_default_context()
    try:
        with urlopen(req, timeout=timeout, context=context) as resp:
            status = getattr(resp, "status", None) or resp.getcode()
            final_url = getattr(resp, "url", url)
            body = resp.read(300_000).decode("utf-8", errors="ignore")

        page_title, page_h1 = _extract_title_and_h1(body)
        score = _score_title_match(program, page_title, page_h1)
        exists = status is not None and 200 <= int(status) < 400
        return LinkCheck(
            program=program,
            url=url,
            exists=bool(exists),
            status_code=int(status) if status is not None else None,
            final_url=final_url,
            title_match=score >= threshold,
            match_score=round(score, 3),
            page_title=page_title,
            page_h1=page_h1,
            error=None,
        )
    except HTTPError as e:
        return LinkCheck(program, url, False, e.code, None, False, 0.0, None, None, f"HTTPError: {e}")
    except URLError as e:
        return LinkCheck(program, url, False, None, None, False, 0.0, None, None, f"URLError: {e}")
    except Exception as e:
        return LinkCheck(program, url, False, None, None, False, 0.0, None, None, f"Error: {e}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--calls", default=str(Path(__file__).resolve().parent / "calls.json"))
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent / "link_verification_report.json"))
    ap.add_argument("--timeout", type=int, default=20)
    ap.add_argument("--threshold", type=float, default=0.45)
    args = ap.parse_args()

    calls_path = Path(args.calls)
    out_path = Path(args.out)

    data: dict[str, Any] = json.loads(calls_path.read_text(encoding="utf-8"))
    calls = data.get("calls", [])

    checks: list[LinkCheck] = []
    for c in calls:
        program = str(c.get("program", "")).strip()
        url = str(c.get("link", "")).strip()
        if not program or not url:
            continue
        checks.append(check_url(program, url, timeout=args.timeout, threshold=args.threshold))

    ok_exists = sum(1 for c in checks if c.exists)
    ok_match = sum(1 for c in checks if c.title_match)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "calls_file": str(calls_path),
        "total_checked": len(checks),
        "exists_ok": ok_exists,
        "title_match_ok": ok_match,
        "checks": [asdict(c) for c in checks],
    }

    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"checked={len(checks)} exists_ok={ok_exists} title_match_ok={ok_match}")
    print(f"report={out_path}")
    # Non-zero only if link existence fails; title mismatch is warning-level.
    return 1 if ok_exists < len(checks) else 0


if __name__ == "__main__":
    raise SystemExit(main())
