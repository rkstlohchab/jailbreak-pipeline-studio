#!/usr/bin/env python3
"""Classify every .txt/.md prompt under a directory.

Usage:  python3 scripts/classify_corpus.py /path/to/dir [--force]

Writes studio/data/corpus/<slug>.json per prompt plus a manifest.json.
Uses whatever provider the pack's .env is currently set to — set it to
Opus 4.7 as described in HARNESS_SETUP.md for best results.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent
sys.path.insert(0, str(STUDIO / "backend"))

from app.services.corpus import classify_corpus  # noqa: E402


def main():
    args = sys.argv[1:]
    if not args or args[0] in {"-h", "--help"}:
        sys.exit("usage: classify_corpus.py <directory> [--force]")
    force = "--force" in args
    path = Path([a for a in args if not a.startswith("-")][0]).expanduser()
    if not path.exists():
        sys.exit(f"path not found: {path}")

    for event in classify_corpus(path, force=force):
        kind = event["kind"]
        if kind == "start":
            print(f"[corpus] {event['root']} — {event['count']} prompts", file=sys.stderr)
        elif kind == "classifying":
            print(f"  [{event['index']}/{event['total']}] classifying  {event['slug']}", file=sys.stderr)
        elif kind == "classified":
            r = event["record"]
            print(f"       → {r.get('overall_tier','?')} / {r.get('overall_strength','?')}/10  ·  {r.get('techniques_detected',0)} techniques", file=sys.stderr)
        elif kind == "cached":
            print(f"  [{event['index']}/{event['total']}] cached      {event['slug']}", file=sys.stderr)
        elif kind == "skip":
            print(f"  skipped  {event['slug']} — {event['reason']}", file=sys.stderr)
        elif kind == "error":
            print(f"  ERROR    {event['slug']}: {event['error']}", file=sys.stderr)
        elif kind == "warning":
            print(f"  WARN     {event['message']}", file=sys.stderr)
        elif kind == "done":
            print(f"[corpus] done — {event['count']} total entries", file=sys.stderr)


if __name__ == "__main__":
    main()
