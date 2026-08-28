#!/usr/bin/env python3
"""Decision-only Codex gate for locally parsed Professor Radar candidates."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
MODEL = "gpt-5.3-codex"
API_URL = "https://api.openai.com/v1/responses"

SCHEMA = {
    "type": "object", "additionalProperties": False, "required": ["summary", "decisions"],
    "properties": {
        "summary": {"type": "string"},
        "decisions": {"type": "array", "items": {"type": "object", "additionalProperties": False,
            "required": ["candidate_id", "action", "fit_score", "why_now", "reason"],
            "properties": {"candidate_id": {"type": "string"}, "action": {"type": "string", "enum": ["publish", "reject"]},
                "fit_score": {"type": "integer", "minimum": 0, "maximum": 5},
                "why_now": {"type": "string"}, "reason": {"type": "string"}}}},
    },
}

INSTRUCTIONS = """You are only the editorial decision gate for Professor Radar at the University of Coimbra.
Local CLI code already fetched official Portuguese university portals, cached and diffed pages, followed same-domain notices, parsed titles and deadlines, and required both Professor Auxiliar rank and a target-area keyword. You cannot browse, parse, or change facts.

Publish only genuine open or officially forthcoming Professor Auxiliar / Assistant Professor competitions whose substantive area fits AI, robotics, autonomous systems, electrical/computer engineering, computer science, automation, control, perception, signal processing, telecommunications, or a clearly adjacent technical field.
Reject administrative pages, broad faculty pools without a concrete competition, keyword collisions, closed notices, and roles whose real field is out of scope. Use the supplied evidence only. For publish decisions use fit 3-5 and a <=25-word `why_now`; for rejection use fit 0-2 and an empty `why_now`. Return exactly one decision per candidate ID."""


def load_json(path: Path, default: dict) -> dict:
    try: return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError: return default


def compact_context(candidates: dict, current: dict, report: dict) -> dict:
    published_hashes = {item.get("content_hash") for item in current.get("positions", []) if item.get("content_hash")}
    hashes = report.get("candidate_hashes", {})
    rejected_hashes = {hashes.get(item["candidate_id"]) for item in report.get("decision", {}).get("decisions", []) if item.get("action") == "reject"}
    changed = [item for item in candidates.get("positions", []) if item.get("content_hash") not in published_hashes | rejected_hashes]
    def compact(item):
        return {"id": item["candidate_id"], "university": item["university"], "title": item["title"],
            "deadline": item["deadline"], "official_url": item["link"],
            "rank_evidence": item.get("rank_evidence", "")[:220], "area_evidence": item.get("area_evidence", "")[:260]}
    return {"target": "Professor Auxiliar in Portugal: AI, robotics, autonomy, electrical/computer engineering and close technical fields",
        "candidates": [compact(item) for item in changed[:30]],
        "published": [{"university": item["university"], "title": item["title"], "deadline": item["deadline"], "link": item["link"]} for item in current.get("positions", [])]}


def api_decision(context: dict, api_key: str, timeout: int) -> tuple[dict, dict]:
    body = {"model": MODEL, "store": False, "instructions": INSTRUCTIONS,
        "input": "Decide publication value from these locally extracted facts:\n" + json.dumps(context, ensure_ascii=False, separators=(",", ":")),
        "reasoning": {"effort": "low"},
        "text": {"format": {"type": "json_schema", "name": "professor_radar_decision", "strict": True, "schema": SCHEMA}},
        "metadata": {"job": "professor-radar-weekly"}}
    request = Request(API_URL, data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
    with urlopen(request, timeout=timeout) as response: raw = json.load(response)
    texts = [content["text"] for item in raw.get("output", []) if item.get("type") == "message" for content in item.get("content", []) if content.get("type") == "output_text"]
    if not texts: raise RuntimeError(f"Responses API returned no structured output (status={raw.get('status')})")
    return json.loads("".join(texts)), raw


def apply(decision: dict, candidates: dict, current: dict, context: dict) -> tuple[dict, dict]:
    facts = {item["candidate_id"]: item for item in candidates.get("positions", [])}
    expected = {item["id"] for item in context["candidates"]}; received = {item["candidate_id"] for item in decision["decisions"]}
    if expected != received: raise ValueError(f"decision IDs differ: missing={expected-received}, extra={received-expected}")
    current_hashes = {item.get("content_hash") for item in candidates.get("positions", []) if item.get("content_hash")}
    selected = {item["link"]: item for item in current.get("positions", []) if item.get("content_hash") and item.get("content_hash") in current_hashes}
    changes = {"added": [], "rejected": []}
    for choice in decision["decisions"]:
        candidate = facts[choice["candidate_id"]]
        if choice["action"] == "reject": changes["rejected"].append(candidate["title"]); continue
        if choice["fit_score"] < 3: raise ValueError(f"publish fit below threshold: {candidate['title']}")
        position = {k: candidate[k] for k in ("university", "title", "department", "deadline", "link", "source", "relevant", "content_hash")}
        position.update({"fit_score": choice["fit_score"], "why_now": choice["why_now"]})
        selected[position["link"]] = position; changes["added"].append(position["title"])
    output = {"last_scan": candidates.get("last_scan"), "scan_sources": candidates.get("scan_sources", {}),
        "positions": sorted(selected.values(), key=lambda item: (item["deadline"] == "unknown", item["deadline"], item["university"], item["link"]))}
    return output, changes


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--candidates", type=Path, default=ROOT / "candidate_facts.json")
    parser.add_argument("--results", type=Path, default=ROOT / "results.json"); parser.add_argument("--report", type=Path, default=ROOT / "codex_decision_report.json")
    parser.add_argument("--apply", action="store_true"); parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--response-file", type=Path); parser.add_argument("--timeout", type=int, default=120); args = parser.parse_args()
    candidates = load_json(args.candidates, {"positions": []}); current = load_json(args.results, {"positions": []}); prior = load_json(args.report, {})
    context = compact_context(candidates, current, prior); payload = json.dumps(context, ensure_ascii=False, separators=(",", ":"))
    if args.prepare_only:
        print(f"model={MODEL} context_bytes={len(payload.encode())} candidates={len(context['candidates'])} published={len(context['published'])}"); return 0
    raw = {}
    if not context["candidates"] and not args.response_file:
        decision = {"summary": "No new or changed candidates require editorial review.", "decisions": []}
    elif args.response_file: decision = json.loads(args.response_file.read_text(encoding="utf-8"))
    else:
        key = os.environ.get("OPENAI_API_KEY")
        if not key: print("OPENAI_API_KEY is required; public results were not changed.", file=sys.stderr); return 2
        decision, raw = api_decision(context, key, args.timeout)
    output, changes = apply(decision, candidates, current, context)
    if args.apply: args.results.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    hashes = {item["candidate_id"]: item["content_hash"] for item in candidates.get("positions", [])}
    report = {"generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(), "model": raw.get("model", MODEL),
        "response_id": raw.get("id"), "usage": raw.get("usage"), "applied": args.apply, "changes": changes,
        "candidate_hashes": hashes, "decision": decision}
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Professor decision: +{len(changes['added'])} rejected={len(changes['rejected'])}")
    return 0


if __name__ == "__main__": raise SystemExit(main())
