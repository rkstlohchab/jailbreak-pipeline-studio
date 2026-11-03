from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from ..config import TAXONOMY_DIR

KINDS = ["techniques", "failure_cases", "refusal_types", "model_families",
         "architecture_layers", "verdicts", "asks"]


@lru_cache(maxsize=16)
def load(kind: str) -> list[dict[str, Any]] | dict[str, Any]:
    if kind not in KINDS:
        raise KeyError(f"unknown taxonomy kind: {kind}")
    path = TAXONOMY_DIR / f"{kind}.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def available_kinds() -> list[str]:
    return [k for k in KINDS if (TAXONOMY_DIR / f"{k}.json").exists()]


def manifest() -> dict[str, Any]:
    p = TAXONOMY_DIR / "taxonomy.manifest.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}
