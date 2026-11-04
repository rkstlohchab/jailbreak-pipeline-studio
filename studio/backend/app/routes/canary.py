from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..config import KNOWLEDGE_DIR

router = APIRouter(prefix="/api/canary", tags=["canary"])

_CANARY_SET = KNOWLEDGE_DIR / "canary_set.json"
_RUNS_DIR = KNOWLEDGE_DIR / "canary_runs"


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower())


@router.get("/set")
def canary_set() -> dict:
    if not _CANARY_SET.exists():
        raise HTTPException(status_code=404, detail="canary_set.json missing")
    return json.loads(_CANARY_SET.read_text(encoding="utf-8"))


@router.get("/runs")
def list_runs() -> dict:
    """List every canary run on disk, grouped by target."""
    out: dict[str, list[str]] = {}
    if not _RUNS_DIR.exists():
        return {"runs": out}
    for target_dir in sorted(_RUNS_DIR.iterdir()):
        if not target_dir.is_dir():
            continue
        dates = sorted(
            [p.stem for p in target_dir.glob("*.jsonl")],
            reverse=True,
        )
        if dates:
            out[target_dir.name] = dates
    return {"runs": out}


@router.get("/runs/{target}/{date}")
def read_run(target: str, date: str) -> dict:
    path = _RUNS_DIR / _slug(target) / f"{date}.jsonl"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"no run at {path}")
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    totals: dict[str, dict[str, int]] = {}
    for r in rows:
        counts = totals.setdefault(r["category"], {"refuse": 0, "hedge": 0, "comply": 0})
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1
    return {"target": target, "date": date, "rows": rows, "totals": totals}


@router.get("/diff/{target}/{date_a}/{date_b}")
def diff_runs(target: str, date_a: str, date_b: str) -> dict:
    target_dir = _RUNS_DIR / _slug(target)
    a = target_dir / f"{date_a}.jsonl"
    b = target_dir / f"{date_b}.jsonl"
    if not a.exists() or not b.exists():
        missing = a if not a.exists() else b
        raise HTTPException(status_code=404, detail=f"no run at {missing}")

    def load(p: Path) -> dict[tuple[str, int], str]:
        d: dict[tuple[str, int], str] = {}
        for line in p.read_text().splitlines():
            r = json.loads(line)
            d[(r["category"], r["idx"])] = r["verdict"]
        return d

    va, vb = load(a), load(b)
    flips = []
    for key in sorted(va.keys() | vb.keys()):
        x, y = va.get(key, "?"), vb.get(key, "?")
        if x != y:
            flips.append({"category": key[0], "idx": key[1], "from": x, "to": y})
    return {
        "target": target,
        "date_a": date_a,
        "date_b": date_b,
        "flips": flips,
        "categories_affected": sorted({f["category"] for f in flips}),
    }
