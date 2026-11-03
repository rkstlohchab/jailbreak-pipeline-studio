"""Dataset export — one canonical trajectory record + four dialect converters."""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

from ..config import SESSIONS_DIR, EXPORT_DIR


def _load_trajectories() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for p in sorted(SESSIONS_DIR.glob("sess_*.json")):
        items.append(json.loads(p.read_text(encoding="utf-8")))
    return items


def view_openai_sft(traj: dict[str, Any]) -> dict[str, Any]:
    """{"messages": [{system}, {user}, {assistant}]} — OpenAI fine-tuning dialect."""
    return {
        "messages": [
            {"role": "system",    "content": traj["prompt_scaffold"]["scaffold_text"]},
            {"role": "user",      "content": traj["goal"]["ask_prompt"]},
            {"role": "assistant", "content": traj["response"]["text"]},
        ],
        "metadata": {
            "trajectory_id": traj["trajectory_id"],
            "ask_id":        traj["goal"]["ask_id"],
            "verdict":       traj["outcome"]["verdict"],
        },
    }


def view_anthropic_sft(traj: dict[str, Any]) -> dict[str, Any]:
    """{"system":..., "messages":[{user},{assistant}]} — Anthropic / Claude dialect."""
    return {
        "system":   traj["prompt_scaffold"]["scaffold_text"],
        "messages": [
            {"role": "user",      "content": traj["goal"]["ask_prompt"]},
            {"role": "assistant", "content": traj["response"]["text"]},
        ],
        "metadata": {
            "trajectory_id": traj["trajectory_id"],
            "ask_id":        traj["goal"]["ask_id"],
            "verdict":       traj["outcome"]["verdict"],
        },
    }


def view_alpaca(traj: dict[str, Any]) -> dict[str, Any]:
    """Alpaca instruction format — compatible with most HF/Kaggle LoRA pipelines."""
    return {
        "instruction": traj["goal"]["ask_prompt"],
        "input":       traj["prompt_scaffold"]["scaffold_text"],
        "output":      traj["response"]["text"],
        "verdict":     traj["outcome"]["verdict"],
    }


def view_lessons(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    """Paired before/after record. Teaches the fix, not just the final response."""
    return {
        "before_scaffold":   before["prompt_scaffold"]["scaffold_text"],
        "after_scaffold":    after["prompt_scaffold"]["scaffold_text"],
        "ask_prompt":        after["goal"]["ask_prompt"],
        "before_response":   before["response"]["text"][:1200],
        "after_response":    after["response"]["text"][:1200],
        "before_verdict":    before["outcome"]["verdict"],
        "after_verdict":     after["outcome"]["verdict"],
        "fix_applied":       after.get("lesson", {}).get("fix_pointer")
                              or "scaffold rework (specific diff not recorded)",
        "techniques_added":  list(sorted(
            {t["id"] for t in after["prompt_scaffold"].get("techniques_used", [])}
            - {t["id"] for t in before["prompt_scaffold"].get("techniques_used", [])}
        )),
        "generalization":    after.get("lesson", {}).get("generalization"),
    }


def view_in_context_curriculum(trajs: list[dict[str, Any]], target_skill: str | None = None) -> str:
    """Markdown block for stuffing into a system prompt as a few-shot curriculum."""
    header = [
        "# Worked examples — curriculum",
        "",
        f"Target skill: {target_skill or 'general — ship on hard-ask classes with narrow-floor identity frames'}",
        "",
        "Each example gives you the scaffold used, the user ask, the response, and the verdict.",
        "Read the pattern across all examples before you try to replicate.",
        "",
    ]
    body: list[str] = []
    ship_trajs = [t for t in trajs if t["outcome"]["verdict"].startswith("SHIP")]
    for i, t in enumerate(ship_trajs[:5], 1):
        body += [
            f"## Example {i} — {t['goal']['ask_id']} → {t['outcome']['verdict']}",
            "",
            "### Scaffold",
            "```",
            t["prompt_scaffold"]["scaffold_text"][:1800],
            "```" if len(t["prompt_scaffold"]["scaffold_text"]) <= 1800 else "…```",
            "",
            "### Ask",
            f"> {t['goal']['ask_prompt']}",
            "",
            "### Response (truncated)",
            "```",
            t["response"]["text"][:900],
            "…```" if len(t["response"]["text"]) > 900 else "```",
            "",
            "### Why it worked",
            (t.get("lesson", {}).get("generalization")
             or f"L6 format-stamp survived; L1 operator-lock pinned the role across gate-2."),
            "",
        ]
    return "\n".join(header + body)


def _write_jsonl(path: Path, records: list[dict[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return len(records)


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def build_all() -> dict[str, Any]:
    """Build every export file + manifest.json. Returns the manifest."""
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    trajs = _load_trajectories()

    canonical    = trajs
    openai_sft   = [view_openai_sft(t) for t in trajs]
    anthropic    = [view_anthropic_sft(t) for t in trajs]
    alpaca       = [view_alpaca(t) for t in trajs]

    # Lesson pairs: group by ask_id, pair samples within each group.
    by_ask: dict[str, list[dict[str, Any]]] = {}
    for t in trajs:
        by_ask.setdefault(t["goal"]["ask_id"], []).append(t)
    lesson_pairs: list[dict[str, Any]] = []
    for ask_id, group in by_ask.items():
        if len(group) < 2:
            continue
        # Trivial pairing: sample 1 vs sample 2
        lesson_pairs.append(view_lessons(group[0], group[1]))

    curriculum = view_in_context_curriculum(trajs)

    files = {}
    for name, data in [
        ("canonical.jsonl",     canonical),
        ("openai_sft.jsonl",    openai_sft),
        ("anthropic_sft.jsonl", anthropic),
        ("alpaca.jsonl",        alpaca),
        ("lessons.jsonl",       lesson_pairs),
    ]:
        path = EXPORT_DIR / name
        n = _write_jsonl(path, data)
        files[name] = {
            "records": n,
            "bytes":   path.stat().st_size,
            "sha256":  _sha256_file(path),
        }

    cur_path = EXPORT_DIR / "curriculum.md"
    cur_path.write_text(curriculum, encoding="utf-8")
    files["curriculum.md"] = {
        "records": 1,
        "bytes":   cur_path.stat().st_size,
        "sha256":  _sha256_file(cur_path),
    }

    manifest = {
        "schema_version":        "1.0",
        "generated_at_utc":      time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "trajectory_count":      len(trajs),
        "files":                 files,
        "canonical_schema_hint": "see backend/app/models/trajectory.py — Trajectory",
    }
    (EXPORT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest
