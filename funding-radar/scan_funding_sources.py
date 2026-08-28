#!/usr/bin/env python3
"""Fetch, cache, parse, and pre-filter official funding pages without an LLM."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from hashlib import sha256
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urljoin, urlparse, urldefrag
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".source-cache"
UA = "Mozilla/5.0 FundingRadar/2.0 (+official-source-monitor)"
CALL_WORDS = re.compile(r"\b(call|calls|grant|funding|proposal|application|candidatur|concurso|aviso|open call|deadline)\b", re.I)
FIT_WORDS = re.compile(r"\b(AI|artificial intelligence|robot\w*|autonom\w*|computer|computing|digital|electr\w*|mobility|manufactur\w*|sensor\w*|perception|machine learning|cyber|energy|health|agri\w*)\b", re.I)
ELIG_WORDS = re.compile(r"\b(Portugal|Portuguese|Europe\w*|EU|universit\w*|research organisation|consorti\w*|academi\w*)\b", re.I)
DEADLINE_WORDS = re.compile(r"\b(deadline|cut[ -]?off|submit|submission|applications?|apply|closes?|until|prazo|candidatur\w*)\b", re.I)
GENERIC_TITLES = re.compile(r"^(calls? for (proposals|tenders)|funding opportunities|life(?: calls for proposals \d{4})?|eic business acceleration services|mit portugal program research overview|horizon europe: marie skłodowska-curie actions)$", re.I)
MONTHS = {m.lower(): i for i, m in enumerate(("", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"))}
MONTHS.update({m[:3]: n for m, n in MONTHS.items() if m})


class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.links = []; self._href = None; self._text = []
    def handle_starttag(self, tag, attrs):
        if tag == "a": self._href = dict(attrs).get("href"); self._text = []
    def handle_data(self, data):
        if self._href is not None: self._text.append(data)
    def handle_endtag(self, tag):
        if tag == "a" and self._href is not None:
            self.links.append((self._href, " ".join(self._text).strip())); self._href = None; self._text = []


def plain(html: str) -> str:
    text = re.sub(r"<(script|style|nav|footer)\b.*?</\1>", " ", html, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", unescape(text)).strip()


def title(html: str) -> str:
    for pattern in (r"<h1[^>]*>(.*?)</h1>", r"<title[^>]*>(.*?)</title>"):
        match = re.search(pattern, html, re.I | re.S)
        if match:
            return plain(match.group(1))[:180]
    return "Untitled official call"


def resource_urls() -> list[str]:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    blocks = re.findall(r'<ul class="resources-list">(.*?)</ul>', html, re.S)
    return sorted(set(re.findall(r'href="(https://[^"]+)"', "".join(blocks))))


def fetch(url: str, cached: dict, timeout: int) -> tuple[str, dict, bool]:
    CACHE.mkdir(exist_ok=True)
    cache_file = CACHE / f"{sha256(url.encode()).hexdigest()}.html"
    cached_body = cache_file.read_text(encoding="utf-8", errors="ignore") if cache_file.exists() else ""
    headers = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"}
    if cached_body and cached.get("etag"): headers["If-None-Match"] = cached["etag"]
    if cached_body and cached.get("last_modified"): headers["If-Modified-Since"] = cached["last_modified"]
    try:
        with urlopen(Request(url, headers=headers), timeout=timeout) as response:
            body = response.read(2_000_000).decode("utf-8", errors="ignore")
            meta = {"etag": response.headers.get("ETag"), "last_modified": response.headers.get("Last-Modified"), "sha256": sha256(body.encode()).hexdigest()}
            cache_file.write_text(body, encoding="utf-8")
            return body, meta, meta["sha256"] != cached.get("sha256")
    except HTTPError as exc:
        if exc.code == 304 and cached_body:
            return cached_body, {k: cached.get(k) for k in ("etag", "last_modified", "sha256")}, False
        if cached_body:
            return cached_body, {k: cached.get(k) for k in ("etag", "last_modified", "sha256")}, False
        raise RuntimeError(f"{url}: {exc}") from exc
    except Exception as exc:
        if cached_body:
            return cached_body, {k: cached.get(k) for k in ("etag", "last_modified", "sha256")}, False
        raise RuntimeError(f"{url}: {exc}") from exc


def same_official_family(source: str, target: str) -> bool:
    a, b = urlparse(source).hostname or "", urlparse(target).hostname or ""
    return a == b or a.endswith("." + b) or b.endswith("." + a) or (a.endswith("europa.eu") and b.endswith("europa.eu"))


def discover(source: str, html: str) -> list[str]:
    parser = Links(); parser.feed(html); found = []
    for href, label in parser.links:
        url = urldefrag(urljoin(source, href))[0]
        if re.search(r"_[a-z]{2}(?:\?|$)", url) and not re.search(r"_en(?:\?|$)", url): continue
        if url.startswith("https://") and same_official_family(source, url) and CALL_WORDS.search(f"{label} {url}"):
            found.append(url)
    if CALL_WORDS.search(plain(html)[:5000]): found.append(source)
    return list(dict.fromkeys(found))


def dates(text: str, as_of: date) -> list[date]:
    values = set()
    for y, m, d in re.findall(r"\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b", text):
        try: values.add(date(int(y), int(m), int(d)))
        except ValueError: pass
    for d, m, y in re.findall(r"\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b", text):
        try: values.add(date(int(y), int(m), int(d)))
        except ValueError: pass
    month_names = "|".join(sorted(MONTHS, key=len, reverse=True))
    for month, day, year in re.findall(rf"\b({month_names})\s+(\d{{1,2}})(?:st|nd|rd|th)?[,]?\s+(20\d{{2}})\b", text, re.I):
        try: values.add(date(int(year), MONTHS[month.lower()], int(day)))
        except ValueError: pass
    for day, month, year in re.findall(rf"\b(\d{{1,2}})\s+({month_names})\s+(20\d{{2}})\b", text, re.I):
        try: values.add(date(int(year), MONTHS[month.lower()], int(day)))
        except ValueError: pass
    return sorted(value for value in values if value >= as_of)


def snippets(text: str, pattern: re.Pattern, limit: int = 2) -> list[str]:
    results = []
    for match in pattern.finditer(text):
        start, end = max(0, match.start() - 100), min(len(text), match.end() + 180)
        item = text[start:end].strip()
        if item not in results: results.append(item)
        if len(results) == limit: break
    return results


def deadline_snippet(text: str, value: date) -> str:
    month = value.strftime("%B")
    forms = [value.isoformat(), value.strftime("%d/%m/%Y"), value.strftime("%-d/%-m/%Y"),
        f"{month} {value.day}, {value.year}", f"{month} {value.day} {value.year}", f"{value.day} {month} {value.year}"]
    pattern = re.compile("|".join(re.escape(item) for item in forms), re.I)
    for item in snippets(text, pattern, 4):
        if DEADLINE_WORDS.search(item): return item
    return ""


def parse_candidate(url: str, source: str, html: str, as_of: date) -> dict | None:
    text = plain(html); future = dates(text, as_of)
    fit = sorted(set(match.group(0).lower() for match in FIT_WORDS.finditer(text)))
    name = title(html)
    if not future or not fit or GENERIC_TITLES.match(name): return None
    deadline = next(((value, deadline_snippet(text, value)) for value in future if deadline_snippet(text, value)), None)
    if not deadline: return None
    deadline_value, deadline_evidence = deadline
    identifier = sha256(url.encode()).hexdigest()[:16]
    money = re.search(r"(?:€|EUR)\s?[\d.,]+\s?(?:million|M|k)?", text, re.I)
    return {"id": identifier, "program": name, "deadline": deadline_value.isoformat(), "official_url": url,
        "source_portal": source, "fit_terms": fit[:12], "budget_evidence": money.group(0) if money else "See official call",
        "eligibility_evidence": snippets(text, ELIG_WORDS), "deadline_evidence": [deadline_evidence],
        "scope_evidence": snippets(text, FIT_WORDS), "content_hash": sha256(text.encode()).hexdigest()}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today())
    parser.add_argument("--timeout", type=int, default=20); parser.add_argument("--max-details", type=int, default=80)
    parser.add_argument("--workers", type=int, default=8); parser.add_argument("--output", type=Path, default=ROOT / "candidate_facts.json")
    parser.add_argument("--state", type=Path, default=ROOT / "source_scan_state.json")
    args = parser.parse_args()
    state = json.loads(args.state.read_text(encoding="utf-8")) if args.state.exists() else {"pages": {}}
    sources, errors, pages = resource_urls(), [], state.get("pages", {})
    discovered = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(fetch, url, pages.get(url, {}), args.timeout): url for url in sources}
        for job in as_completed(jobs):
            url = jobs[job]
            try:
                body, meta, changed = job.result(); pages[url] = meta
                discovered.extend((target, url) for target in discover(url, body))
            except Exception as exc: errors.append(str(exc))
    unique = list(dict.fromkeys(discovered))[:args.max_details]
    candidates = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(fetch, url, pages.get(url, {}), args.timeout): (url, source) for url, source in unique}
        for job in as_completed(jobs):
            url, source = jobs[job]
            try:
                body, meta, changed = job.result(); pages[url] = meta
                item = parse_candidate(url, source, body, args.as_of)
                if item: candidates.append(item)
            except Exception as exc: errors.append(str(exc))
    by_url = {item["official_url"]: item for item in candidates}
    result = {"generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(), "as_of": args.as_of.isoformat(),
        "stats": {"sources": len(sources), "detail_pages": len(unique), "candidates": len(by_url), "errors": len(errors)},
        "candidates": sorted(by_url.values(), key=lambda item: (item["deadline"], item["program"]))[:60], "errors": errors[:20]}
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    # Persist validators and compact facts, not page bodies, in Git. Bodies only help within this run.
    compact_pages = {url: {k: value.get(k) for k in ("etag", "last_modified", "sha256")} for url, value in pages.items()}
    args.state.write_text(json.dumps({"updated_at": result["generated_at"], "pages": compact_pages}, indent=2) + "\n", encoding="utf-8")
    print(f"sources={len(sources)} details={len(unique)} candidates={len(by_url)} errors={len(errors)}")
    return 0 if sources else 1


if __name__ == "__main__":
    raise SystemExit(main())
