#!/usr/bin/env python3
"""Ingest Stage 2 out_*.txt harness captures into trajectory JSON.

Reads every out_<AskId>_<N>.txt in Stage 2/, parses via mini_harness
verdict logic, wraps in canonical trajectory record, writes to
data/sessions/sess_<AskId>_<N>.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent
REPO = STUDIO.parent
STAGE2 = REPO / "Stage 2 - Diagnosis and First Build"
OUT = STUDIO / "data" / "sessions"
OUT.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(STUDIO / "backend"))

from app.services.parse_output import parse_output_file  # noqa: E402


def main():
    scaffold_path = STAGE2 / "starter_prompt_v1_body.txt"
    if not scaffold_path.exists():
        sys.exit(f"missing scaffold: {scaffold_path}")
    scaffold_text = scaffold_path.read_text(encoding="utf-8")

    captures = sorted(STAGE2.glob("out_*.txt"))
    if not captures:
        sys.exit(f"no out_*.txt files in {STAGE2}")

    for p in captures:
        traj = parse_output_file(p, scaffold_text=scaffold_text, scaffold_name="starter_prompt_v1")
        dest = OUT / f"{traj.trajectory_id}.json"
        dest.write_text(traj.model_dump_json(indent=2), encoding="utf-8")
        print(f"wrote {dest.name}  verdict={traj.outcome.verdict.value}  chars={traj.response.character_count}", file=sys.stderr)


if __name__ == "__main__":
    main()
