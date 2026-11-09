#!/usr/bin/env python3
"""Ask Lab CLI — upgrade to mini_harness.

Usage
-----
# Single ask
python3 scripts/ask_lab.py run --scaffold path/to/scaffold.txt --ask A1-cheat

# Battery
python3 scripts/ask_lab.py battery --scaffold path/to/scaffold.txt \
    --asks A1-cheat,A2-rat,A3-stress

# Side-by-side scaffold comparison
python3 scripts/ask_lab.py compare \
    --scaffolds v2:path1.txt,v3:path2.txt,v4:path3.txt --ask A1-cheat

# List the battery
python3 scripts/ask_lab.py list

Every run persists Trajectory JSON to studio/data/sessions/ so Pipeline
Theatre can replay. Set PROVIDER / MODEL / *_API_KEY in Stage 2/.env — the
same config that mini_harness.py reads (studio/backend/app/config.py bridges).
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent

# backend on path for `from app...`
sys.path.insert(0, str(STUDIO / "backend"))

from app.models import ScoreCard, Trajectory  # noqa: E402
from app.services.ask_lab import AskLab  # noqa: E402


# -----------------------------
# Rendering
# -----------------------------
def render_scorecard(card: ScoreCard) -> str:
    parts = [
        f"trajectory_id        : {card.trajectory_id}",
        f"verdict              : {card.verdict.value}",
        f"persona_held         : {card.persona_held}/10",
        f"format_clean         : {card.format_clean}/10",
        f"artifact_complete    : {card.artifact_complete}/10",
        f"no_hedging           : {card.no_hedging}/10",
        f"instruction_followed : {card.instruction_followed}/10",
        f"overall              : {card.overall}/10",
    ]
    if card.notes:
        parts.append("notes:")
        for n in card.notes:
            parts.append(f"  - {n}")
    return "\n".join(parts)


def render_trajectory_short(traj: Trajectory) -> str:
    r = traj.response
    return (
        f"[{traj.outcome.verdict.value}] "
        f"chars={r.character_count} stamp={r.has_stamp} code={r.has_code_block}"
    )


def render_compare_table(results: dict[str, Trajectory], scores: dict[str, ScoreCard], ask_id: str) -> str:
    """Markdown-formatted side-by-side table."""
    names = list(results.keys())
    out: list[str] = []
    out.append(f"# compare — ask={ask_id}")
    out.append("")
    # Header row
    header = ["scaffold", "verdict", "overall", "stamp", "code", "chars", "first 200 chars of response"]
    rows: list[list[str]] = [header]
    for name in names:
        traj = results[name]
        card = scores[name]
        snippet = (traj.response.text or "").replace("\n", " ").replace("|", "/")[:200]
        rows.append([
            name,
            traj.outcome.verdict.value,
            f"{card.overall}/10",
            "yes" if traj.response.has_stamp else "no",
            "yes" if traj.response.has_code_block else "no",
            str(traj.response.character_count),
            snippet,
        ])
    # Column widths — simple
    widths = [max(len(r[i]) for r in rows) for i in range(len(header))]
    sep = "| " + " | ".join("-" * w for w in widths) + " |"
    for i, r in enumerate(rows):
        line = "| " + " | ".join(r[j].ljust(widths[j]) for j in range(len(header))) + " |"
        out.append(line)
        if i == 0:
            out.append(sep)
    out.append("")
    out.append("## scorecards")
    for name in names:
        out.append("")
        out.append(f"### {name}")
        out.append("```")
        out.append(render_scorecard(scores[name]))
        out.append("```")
    return "\n".join(out)


# -----------------------------
# Scaffold loading
# -----------------------------
def _load_scaffold_arg(path_str: str) -> str:
    p = Path(path_str)
    if not p.exists():
        sys.exit(f"scaffold file not found: {p}")
    return p.read_text(encoding="utf-8")


def _parse_scaffold_pairs(spec: str) -> dict[str, str]:
    """Parse the `name:path,name:path,…` format used by `compare --scaffolds`."""
    out: dict[str, str] = {}
    for item in spec.split(","):
        item = item.strip()
        if not item:
            continue
        if ":" not in item:
            sys.exit(f"bad --scaffolds entry (expected name:path): {item}")
        name, path_str = item.split(":", 1)
        name = name.strip()
        path_str = path_str.strip()
        if not name or not path_str:
            sys.exit(f"bad --scaffolds entry (empty name or path): {item}")
        out[name] = _load_scaffold_arg(path_str)
    if not out:
        sys.exit("no scaffolds parsed")
    return out


# -----------------------------
# Command dispatch
# -----------------------------
async def cmd_run(args: argparse.Namespace) -> int:
    lab = AskLab()
    scaffold_text = _load_scaffold_arg(args.scaffold)
    scaffold_name = args.name or Path(args.scaffold).stem
    traj = await lab.run_single(
        scaffold_text=scaffold_text,
        ask_id=args.ask,
        provider=args.provider,
        model=args.model,
        scaffold_name=scaffold_name,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
    )
    card = lab.score_rubric(traj)
    print(f"[ask_lab] wrote: {lab.sessions_dir / (traj.trajectory_id + '.json')}")
    print(render_trajectory_short(traj))
    print()
    print(render_scorecard(card))
    return 0


async def cmd_battery(args: argparse.Namespace) -> int:
    lab = AskLab()
    scaffold_text = _load_scaffold_arg(args.scaffold)
    scaffold_name = args.name or Path(args.scaffold).stem
    ids = [a.strip() for a in args.asks.split(",") if a.strip()]
    if not ids:
        sys.exit("no asks parsed")
    trajs = await lab.run_battery(
        scaffold_text=scaffold_text,
        ask_ids=ids,
        provider=args.provider,
        model=args.model,
        scaffold_name=scaffold_name,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
    )
    print(f"[ask_lab] ran {len(trajs)} asks, wrote to {lab.sessions_dir}")
    print()
    print(f"{'ask_id':20s}  {'verdict':25s}  {'overall':8s}  chars")
    print("-" * 70)
    for t in trajs:
        c = lab.score_rubric(t)
        print(f"{t.goal.ask_id:20s}  {t.outcome.verdict.value:25s}  {c.overall}/10     {t.response.character_count}")
    return 0


async def cmd_compare(args: argparse.Namespace) -> int:
    lab = AskLab()
    scaffolds = _parse_scaffold_pairs(args.scaffolds)
    results = await lab.compare_scaffolds(
        scaffolds=scaffolds,
        ask_id=args.ask,
        provider=args.provider,
        model=args.model,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
    )
    scores = {name: lab.score_rubric(traj) for name, traj in results.items()}
    print(render_compare_table(results, scores, args.ask))
    return 0


def cmd_list(_args: argparse.Namespace) -> int:
    lab = AskLab()
    asks = lab.list_asks()
    print(f"{'ask_id':20s}  {'class':20s}  {'difficulty':12s}  prompt")
    print("-" * 110)
    for a in asks:
        prompt_short = a["prompt"][:50] + ("…" if len(a["prompt"]) > 50 else "")
        print(f"{a['ask_id']:20s}  {a.get('ask_class', ''):20s}  "
              f"{a.get('difficulty', ''):12s}  {prompt_short}")
    print(f"\ntotal: {len(asks)} asks")
    return 0


# -----------------------------
# argparse
# -----------------------------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    def _common(sp: argparse.ArgumentParser) -> None:
        sp.add_argument("--provider", help="openai | openrouter | anthropic (default: env PROVIDER)")
        sp.add_argument("--model", help="model id (default: env MODEL)")
        sp.add_argument("--temperature", type=float, default=0.8)
        sp.add_argument("--max-tokens", type=int, default=16384)

    sp_run = sub.add_parser("run", help="single ask against one scaffold")
    sp_run.add_argument("--scaffold", required=True, help="path to scaffold .txt / .md")
    sp_run.add_argument("--ask", required=True, help="ask_id, e.g. A1-cheat")
    sp_run.add_argument("--name", help="scaffold name label (default: scaffold file stem)")
    _common(sp_run)

    sp_batt = sub.add_parser("battery", help="N asks against one scaffold (parallel)")
    sp_batt.add_argument("--scaffold", required=True, help="path to scaffold .txt / .md")
    sp_batt.add_argument("--asks", required=True, help="comma-separated ask_ids, e.g. A1-cheat,A2-rat")
    sp_batt.add_argument("--name", help="scaffold name label (default: scaffold file stem)")
    _common(sp_batt)

    sp_cmp = sub.add_parser("compare", help="one ask against N scaffolds (parallel)")
    sp_cmp.add_argument("--scaffolds", required=True,
                        help="name:path,name:path,… e.g. v2:a.txt,v3:b.txt,v4:c.txt")
    sp_cmp.add_argument("--ask", required=True, help="ask_id")
    _common(sp_cmp)

    sub.add_parser("list", help="list the expanded ask catalogue")

    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.cmd == "list":
        return cmd_list(args)
    coros = {"run": cmd_run, "battery": cmd_battery, "compare": cmd_compare}
    return asyncio.run(coros[args.cmd](args))


if __name__ == "__main__":
    raise SystemExit(main())
