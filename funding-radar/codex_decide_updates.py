#!/usr/bin/env python3
"""Use the OpenAI Responses API to decide valuable Funding Radar deltas."""
from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
from urllib.request import Request, urlopen
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
API_URL = "https://api.openai.com/v1/responses"
MODEL = "gpt-5.3-codex"

DECISION_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["scan_summary", "decisions"],
    "properties": {
        "scan_summary": {"type": "string"},
        "decisions": {"type": "array", "items": {"type": "object", "additionalProperties": False,
            "required": ["candidate_id", "action", "priority", "fit_score", "why_now", "reason"],
            "properties": {"candidate_id": {"type": "string"}, "action": {"type": "string", "enum": ["publish", "reject"]},
                "priority": {"type": "string", "enum": ["High", "Medium", "None"]},
                "fit_score": {"type": "integer", "minimum": 0, "maximum": 5},
                "why_now": {"type": "string"}, "reason": {"type": "string"}}}},
    },
}

INSTRUCTIONS = """You are only the editorial decision engine for a public research Funding Radar based at the University of Coimbra, Portugal.
Local CLI tools already fetched official pages, parsed HTML, extracted facts, filtered expired records, normalized URLs, and deduplicated unchanged content. Do not search, parse, create facts, alter URLs, or alter deadlines. Decide only whether each supplied candidate is worth publishing.

Publication gates (all mandatory):
- Direct technical relevance, or a concrete application route for the target fields; generic all-area calls need a specific credible route.
- Portuguese university/research teams are eligible or can participate in an eligible consortium.
- The supplied evidence credibly supports the deadline, eligibility, and scope.
- The opportunity is actionable: meaningful research funding, compute, mobility, commercialization, or consortium support.

Prefer fewer high-value entries. Reject weak, duplicative, generic prizes, events, and calls whose relevance is only the word 'digital'. For publish decisions, `why_now` must state fit and next action in at most 30 words. For rejects use an empty `why_now`, priority None, and fit 0-2. Return one decision for every candidate ID and nothing else."""


def compact_context(as_of: date) -> dict:
    calls = json.loads((ROOT / "calls.json").read_text(encoding="utf-8"))["calls"]
    facts = json.loads((ROOT / "candidate_facts.json").read_text(encoding="utf-8"))
    published_hashes = {c.get("content_hash") for c in calls if c.get("content_hash")}
    rejected_hashes = set()
    report_path = ROOT / "codex_decision_report.json"
    if report_path.exists():
        prior = json.loads(report_path.read_text(encoding="utf-8"))
        hashes = prior.get("candidate_hashes", {})
        rejected_hashes = {hashes.get(item["candidate_id"]) for item in prior.get("decision", {}).get("decisions", []) if item.get("action") == "reject"}
    candidates = [c for c in facts["candidates"] if c["content_hash"] not in published_hashes | rejected_hashes]
    def compact(c):
        return {"id": c["id"], "program": c["program"], "deadline": c["deadline"], "official_url": c["official_url"],
            "fit_terms": c["fit_terms"], "budget_evidence": c["budget_evidence"],
            "eligibility_evidence": [s[:180] for s in c["eligibility_evidence"][:1]],
            "deadline_evidence": [s[:160] for s in c["deadline_evidence"][:1]], "scope_evidence": [s[:180] for s in c["scope_evidence"][:1]]}
    active = [{"program": c["program"], "deadline": c["deadline"], "link": c.get("link", "")} for c in calls]
    return {"as_of": as_of.isoformat(), "target": "Portugal university research: AI, robotics, autonomy, electrical/computer engineering",
        "candidates": [compact(c) for c in candidates[:30]], "published_for_deduplication": active}


def request_decision(context: dict, api_key: str, timeout: int) -> tuple[dict, dict]:
    body = {"model": MODEL, "store": False, "instructions": INSTRUCTIONS,
        "input": "Decide publication value from these CLI-extracted candidate facts:\n" + json.dumps(context, ensure_ascii=False, separators=(",", ":")),
        "reasoning": {"effort": "low"},
        "text": {"format": {"type": "json_schema", "name": "funding_radar_decision", "strict": True, "schema": DECISION_SCHEMA}},
        "metadata": {"job": "funding-radar-weekly"}}
    req = Request(API_URL, data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
    with urlopen(req, timeout=timeout) as response:
        raw = json.load(response)
    texts = [content["text"] for item in raw.get("output", []) if item.get("type") == "message" for content in item.get("content", []) if content.get("type") == "output_text"]
    if not texts:
        raise RuntimeError(f"Responses API returned no structured output (status={raw.get('status')})")
    return json.loads("".join(texts)), raw


def validate_candidate(candidate: dict, as_of: date) -> None:
    if date.fromisoformat(candidate["deadline"]) < as_of: raise ValueError(f"past candidate: {candidate['program']}")
    if not re.match(r"^https://[^/]+/.+", candidate["official_url"]): raise ValueError(f"invalid official URL: {candidate['program']}")
    if not candidate["deadline_evidence"] or not candidate["scope_evidence"]: raise ValueError(f"insufficient extracted evidence: {candidate['program']}")


def apply_decision(decision: dict, as_of: date) -> dict:
    path = ROOT / "verified_calls.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    current = {item["program"]: item for item in data["calls"]}
    facts = json.loads((ROOT / "candidate_facts.json").read_text(encoding="utf-8"))
    candidates = {item["id"]: item for item in facts["candidates"]}
    expected = {item["id"] for item in compact_context(as_of)["candidates"]}
    received = {item["candidate_id"] for item in decision["decisions"]}
    if received != expected: raise ValueError(f"decision IDs differ from candidates: missing={expected-received}, extra={received-expected}")
    changes = {"added": [], "updated": [], "removed": []}
    by_url = {item.get("link"): name for name, item in current.items()}
    for choice in decision["decisions"]:
        if choice["action"] != "publish": continue
        if choice["fit_score"] < 3 or choice["priority"] == "None": raise ValueError(f"invalid publish score: {choice['candidate_id']}")
        candidate = candidates[choice["candidate_id"]]; validate_candidate(candidate, as_of)
        old_name = by_url.get(candidate["official_url"])
        call = {"program": candidate["program"], "deadline": candidate["deadline"],
            "funder": urlparse(candidate["source_portal"]).hostname or "Official funding source", "priority": choice["priority"],
            "fit_score": choice["fit_score"], "budget": candidate["budget_evidence"], "support": "See official call",
            "eligible": " ".join(candidate["eligibility_evidence"])[:500] or "Verify in official call",
            "objective": " ".join(candidate["scope_evidence"])[:500], "why_now": choice["why_now"],
            "link": candidate["official_url"], "evidence": " ".join(candidate["deadline_evidence"])[:500],
            "confidence": "high" if candidate["eligibility_evidence"] else "medium", "content_hash": candidate["content_hash"]}
        if old_name: del current[old_name]; changes["updated"].append(call["program"])
        else: changes["added"].append(call["program"])
        current[call["program"]] = call
    data["verified_at"] = as_of.isoformat()
    data["calls"] = sorted(current.values(), key=lambda item: (item["deadline"], item["program"]))
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return changes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today())
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--response-file", type=Path, help="Use saved structured output for deterministic testing")
    parser.add_argument("--timeout", type=int, default=180)
    args = parser.parse_args(); context = compact_context(args.as_of)
    if args.prepare_only:
        payload = json.dumps(context, ensure_ascii=False, separators=(",", ":"))
        print(f"model={MODEL} context_bytes={len(payload.encode())} candidates={len(context['candidates'])} published={len(context['published_for_deduplication'])}")
        return 0
    raw = {}
    if not context["candidates"] and not args.response_file:
        decision = {"scan_summary": "Local CLI scan found no new or changed candidates requiring editorial review.", "decisions": []}
    elif args.response_file:
        decision = json.loads(args.response_file.read_text(encoding="utf-8"))
    else:
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            print("OPENAI_API_KEY is required; no funding data was changed.", file=sys.stderr); return 2
        decision, raw = request_decision(context, key, args.timeout)
    changes = apply_decision(decision, args.as_of) if args.apply else {"added": [], "updated": [], "removed": []}
    facts = json.loads((ROOT / "candidate_facts.json").read_text(encoding="utf-8"))
    candidate_hashes = {item["id"]: item["content_hash"] for item in facts["candidates"]}
    report = {"generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(), "model": raw.get("model", MODEL),
        "response_id": raw.get("id"), "usage": raw.get("usage"), "applied": args.apply, "changes": changes, "decision": decision}
    report["candidate_hashes"] = candidate_hashes
    (ROOT / "codex_decision_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Codex decision: +{len(changes['added'])} ~{len(changes['updated'])} -{len(changes['removed'])}; report=funding-radar/codex_decision_report.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
