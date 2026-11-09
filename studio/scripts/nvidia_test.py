#!/usr/bin/env python3
"""NVIDIA build.nvidia.com inspector + jailbreak-grid driver.

Two modes:

    # List chat models reachable with this key
    NVIDIA_API_KEY=nvapi-... python3 studio/scripts/nvidia_test.py --list

    # Run the 9x4 jailbreak grid against one or more NVIDIA-hosted models
    NVIDIA_API_KEY=nvapi-... python3 studio/scripts/nvidia_test.py \\
        --models moonshotai/kimi-k2.6 z-ai/glm-5.3-flash deepseek-ai/deepseek-v4.1-flash

Results per model are written to studio/datasets/export/nvidia_<slug>_<timestamp>.json
and a compact ASR matrix is printed to the terminal.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import urllib.request
import urllib.error

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent
JAILBREAK_SUITE = HERE / "jailbreak_suite.py"
EXPORT_DIR = STUDIO / "datasets" / "export"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

NVIDIA_BASE = "https://integrate.api.nvidia.com/v1"


def load_env() -> str | None:
    env_path = STUDIO.parent / "Stage 2 - Diagnosis and First Build" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith("NVIDIA_API_KEY=") and "=" in line:
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return os.environ.get("NVIDIA_API_KEY")


def list_models(key: str) -> list[dict]:
    req = urllib.request.Request(
        f"{NVIDIA_BASE}/models",
        headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        payload = json.load(r)
    return payload.get("data", [])


# Models whose IDs match any of these fragments are the chat/instruct ones.
# Everything else (embeddings, retrievers, guard models) is filtered.
CHAT_HINTS = ("instruct", "kimi", "glm", "deepseek", "nemotron-ultra", "nemotron-70b", "nemotron-51b", "mistral-large", "mistral-medium", "codellama", "codestral")
NON_CHAT_HINTS = ("embed", "retriever", "safety-guard", "content-safety", "topic-control", "guard-", "guard_")


def is_chat(mid: str) -> bool:
    low = mid.lower()
    if any(x in low for x in NON_CHAT_HINTS):
        return False
    return any(x in low for x in CHAT_HINTS)


def slug(mid: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "_", mid).strip("_").lower()


def run_grid(model: str, key: str, max_tokens: int = 400) -> dict:
    """Invoke jailbreak_suite.py as a subprocess against NVIDIA for one model."""
    env = os.environ.copy()
    env.update({
        "API_KEY": key,
        "BASE_URL": NVIDIA_BASE,
        "MODEL": model,
        "JUDGE": model,
    })
    stamp = time.strftime("%Y%m%d_%H%M%S")
    out_path = EXPORT_DIR / f"nvidia_{slug(model)}_{stamp}.json"
    cmd = [
        sys.executable, str(JAILBREAK_SUITE),
        "--json", str(out_path),
        "--max-tokens", str(max_tokens),
    ]
    print(f"[run] {model}  →  {out_path.relative_to(STUDIO)}")
    start = time.time()
    proc = subprocess.run(cmd, env=env, capture_output=True, text=True)
    elapsed = time.time() - start
    if proc.returncode != 0:
        print(f"[err] {model} exited {proc.returncode}")
        print(proc.stderr[-800:])
        return {"model": model, "error": proc.stderr[-800:], "elapsed_s": round(elapsed, 1)}
    try:
        results = json.loads(out_path.read_text())
    except Exception as e:
        return {"model": model, "error": f"failed to parse output: {e}", "stdout_tail": proc.stdout[-800:]}
    summary = summarise(results)
    summary.update({"model": model, "elapsed_s": round(elapsed, 1), "export_file": str(out_path.relative_to(STUDIO))})
    return summary


def summarise(results: dict) -> dict:
    """Collapse jailbreak_suite.py JSON into an ASR-per-attack and overall rate."""
    rows = results.get("results", [])
    total = len(rows) or 1
    comply = sum(1 for r in rows if (r.get("judge_verdict") or "").lower() == "comply")
    partial = sum(1 for r in rows if (r.get("judge_verdict") or "").lower() == "partial")
    refuse = sum(1 for r in rows if (r.get("judge_verdict") or "").lower() == "refuse")
    by_attack: dict[str, dict[str, int]] = {}
    for r in rows:
        a = r.get("attack", "?")
        bucket = by_attack.setdefault(a, {"comply": 0, "partial": 0, "refuse": 0, "n": 0})
        bucket["n"] += 1
        bucket[(r.get("judge_verdict") or "refuse").lower()] = bucket.get((r.get("judge_verdict") or "refuse").lower(), 0) + 1
    return {
        "total_cells": total,
        "comply": comply,
        "partial": partial,
        "refuse": refuse,
        "asr_percent": round(comply * 100 / total, 1),
        "by_attack": by_attack,
    }


def print_matrix(summaries: list[dict]) -> None:
    if not summaries:
        return
    attacks = sorted({a for s in summaries for a in (s.get("by_attack") or {})})
    width = max((len(s["model"]) for s in summaries), default=10)
    print()
    print("ASR matrix  —  cells show comply/partial/refuse per attack")
    print("-" * (width + 4 + 13 * len(attacks)))
    header = f"{'model':<{width}}  {'overall':>10}  " + "  ".join(f"{a[:10]:>10}" for a in attacks)
    print(header)
    print("-" * (width + 4 + 13 * len(attacks)))
    for s in summaries:
        if "error" in s:
            print(f"{s['model']:<{width}}  ERROR: {s['error'][:80]}")
            continue
        overall = f"{s['comply']}/{s['partial']}/{s['refuse']}"
        line = f"{s['model']:<{width}}  {overall:>10}  "
        parts = []
        for a in attacks:
            cell = s["by_attack"].get(a)
            if not cell:
                parts.append(f"{'—':>10}")
            else:
                parts.append(f"{cell.get('comply',0)}/{cell.get('partial',0)}/{cell.get('refuse',0):>4}")
        line += "  ".join(parts)
        print(line)
    print("-" * (width + 4 + 13 * len(attacks)))
    for s in summaries:
        if "error" not in s:
            print(f"  {s['model']:<{width}}  ASR {s['asr_percent']}%   {s['elapsed_s']}s   →  {s['export_file']}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true", help="list chat models visible to this key")
    ap.add_argument("--models", nargs="+", help="run the jailbreak grid against these model IDs")
    ap.add_argument("--max-tokens", type=int, default=400, help="per-reply token cap for the grid (default 400)")
    args = ap.parse_args()

    key = load_env()
    if not key:
        print("No NVIDIA_API_KEY found. Set it in Stage 2 .env or export it.", file=sys.stderr)
        return 2

    if args.list:
        try:
            models = list_models(key)
        except urllib.error.HTTPError as e:
            print(f"NVIDIA API returned {e.code}: {e.read().decode('utf-8', 'replace')[:400]}", file=sys.stderr)
            return 3
        chat = [m for m in models if is_chat(m.get("id", ""))]
        print(f"{len(chat)} chat models visible (of {len(models)} total):")
        for m in sorted(chat, key=lambda m: m["id"]):
            owner = m.get("owned_by", "")
            print(f"  {m['id']:60s} {owner}")
        return 0

    if not args.models:
        ap.print_help()
        return 1

    summaries = []
    for mid in args.models:
        summaries.append(run_grid(mid, key, max_tokens=args.max_tokens))
    print_matrix(summaries)
    return 0


if __name__ == "__main__":
    sys.exit(main())
