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

ROOT = Path(__file__).resolve().parent
API_URL = "https://api.openai.com/v1/responses"
MODEL = "gpt-5.3-codex"

CALL_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["program", "deadline", "funder", "priority", "fit_score", "budget", "support", "eligible", "objective", "why_now", "link", "evidence", "confidence"],
    "properties": {
        "program": {"type": "string"}, "deadline": {"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$"},
        "funder": {"type": "string"}, "priority": {"type": "string", "enum": ["High", "Medium"]},
        "fit_score": {"type": "integer", "minimum": 1, "maximum": 5}, "budget": {"type": "string"},
        "support": {"type": "string"}, "eligible": {"type": "string"}, "objective": {"type": "string"},
        "why_now": {"type": "string"}, "link": {"type": "string", "pattern": "^https://"},
        "evidence": {"type": "string"}, "confidence": {"type": "string", "enum": ["high", "medium"]},
    },
}
DECISION_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["scan_summary", "additions", "updates", "removals", "rejected"],
    "properties": {
        "scan_summary": {"type": "string"}, "additions": {"type": "array", "items": CALL_SCHEMA},
        "updates": {"type": "array", "items": {"type": "object", "additionalProperties": False,
            "required": ["match_program", "reason", "call"],
            "properties": {"match_program": {"type": "string"}, "reason": {"type": "string"}, "call": CALL_SCHEMA}}},
        "removals": {"type": "array", "items": {"type": "object", "additionalProperties": False,
            "required": ["program", "reason"], "properties": {"program": {"type": "string"}, "reason": {"type": "string"}}}},
        "rejected": {"type": "array", "items": {"type": "object", "additionalProperties": False,
            "required": ["program", "reason"], "properties": {"program": {"type": "string"}, "reason": {"type": "string"}}}},
    },
}

INSTRUCTIONS = """You are the editorial decision engine for a public research Funding Radar based at the University of Coimbra, Portugal.
Search current OFFICIAL funder pages and decide only material changes for competitive funding in robotics, AI, autonomous systems, and electrical/computer engineering across application domains.

Publication gates (all mandatory):
- Direct technical relevance, or a concrete application route for the target fields; generic all-area calls need a specific credible route.
- Portuguese university/research teams are eligible or can participate in an eligible consortium.
- A future, exact deadline is confirmed on an official funder page.
- The link is a direct official call/scheme page, not news aggregation, a search page, or a consultancy.
- The opportunity is actionable: meaningful research funding, compute, mobility, commercialization, or consortium support.

Prefer fewer high-value entries. Reject weak, duplicative, expired, purely local opportunities with no verified notice, generic prizes, events, and calls whose relevance is only the word 'digital'. Use concise factual fields. `why_now` must state the fit and next action in at most 30 words. Never infer missing money or eligibility; write 'See official call' where appropriate. Remove an existing entry only when official evidence shows expiry, cancellation, or material ineligibility. Return deltas, not the full catalogue."""


def compact_context(as_of: date) -> dict:
    verified = json.loads((ROOT / "verified_calls.json").read_text(encoding="utf-8"))["calls"]
    calls = json.loads((ROOT / "calls.json").read_text(encoding="utf-8"))["calls"]
    active = [{"program": c["program"], "deadline": c["deadline"], "link": c.get("link", "")} for c in calls]
    return {"as_of": as_of.isoformat(), "target": "Portugal-based university research in AI, robotics, autonomy, electrical and computer engineering", "editable_verified_calls": verified, "all_published_for_deduplication": active}


def request_decision(context: dict, api_key: str, timeout: int) -> tuple[dict, dict]:
    body = {"model": MODEL, "store": False, "instructions": INSTRUCTIONS,
        "input": "Perform the weekly official-source scan and return only justified deltas. Current compact state:\n" + json.dumps(context, ensure_ascii=False, separators=(",", ":")),
        "tools": [{"type": "web_search"}], "max_tool_calls": 12, "reasoning": {"effort": "medium"},
        "text": {"format": {"type": "json_schema", "name": "funding_radar_decision", "strict": True, "schema": DECISION_SCHEMA}},
        "metadata": {"job": "funding-radar-weekly"}}
    req = Request(API_URL, data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
    with urlopen(req, timeout=timeout) as response:
        raw = json.load(response)
    texts = [content["text"] for item in raw.get("output", []) if item.get("type") == "message" for content in item.get("content", []) if content.get("type") == "output_text"]
    if not texts:
        raise RuntimeError(f"Responses API returned no structured output (status={raw.get('status')})")
    return json.loads("".join(texts)), raw


def validate_call(call: dict, as_of: date) -> None:
    if date.fromisoformat(call["deadline"]) < as_of:
        raise ValueError(f"past deadline for {call['program']}: {call['deadline']}")
    if not re.match(r"^https://[^/]+/.+", call["link"]):
        raise ValueError(f"non-direct HTTPS URL for {call['program']}")
    if call["fit_score"] < 3:
        raise ValueError(f"fit below publication threshold for {call['program']}")


def apply_decision(decision: dict, as_of: date) -> dict:
    path = ROOT / "verified_calls.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    current = {item["program"]: item for item in data["calls"]}
    changes = {"added": [], "updated": [], "removed": []}
    for item in decision["removals"]:
        if item["program"] in current:
            del current[item["program"]]; changes["removed"].append(item["program"])
    for update in decision["updates"]:
        validate_call(update["call"], as_of)
        if update["match_program"] not in current:
            raise ValueError(f"update target is not editable: {update['match_program']}")
        del current[update["match_program"]]
        current[update["call"]["program"]] = update["call"]
        changes["updated"].append(update["call"]["program"])
    published_names = {c["program"].casefold() for c in json.loads((ROOT / "calls.json").read_text(encoding="utf-8"))["calls"]}
    for call in decision["additions"]:
        validate_call(call, as_of)
        if call["program"].casefold() in published_names or call["program"] in current:
            continue
        current[call["program"]] = call; changes["added"].append(call["program"])
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
        print(f"model={MODEL} context_bytes={len(payload.encode())} published={len(context['all_published_for_deduplication'])} editable={len(context['editable_verified_calls'])}")
        return 0
    raw = {}
    if args.response_file:
        decision = json.loads(args.response_file.read_text(encoding="utf-8"))
    else:
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            print("OPENAI_API_KEY is required; no funding data was changed.", file=sys.stderr); return 2
        decision, raw = request_decision(context, key, args.timeout)
    changes = apply_decision(decision, args.as_of) if args.apply else {"added": [], "updated": [], "removed": []}
    report = {"generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(), "model": raw.get("model", MODEL),
        "response_id": raw.get("id"), "usage": raw.get("usage"), "applied": args.apply, "changes": changes, "decision": decision}
    (ROOT / "codex_decision_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Codex decision: +{len(changes['added'])} ~{len(changes['updated'])} -{len(changes['removed'])}; report=funding-radar/codex_decision_report.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
