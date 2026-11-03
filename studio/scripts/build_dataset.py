#!/usr/bin/env python3
"""Build all dataset export files from data/sessions/ into datasets/export/."""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent
sys.path.insert(0, str(STUDIO / "backend"))

from app.services.dataset_export import build_all  # noqa: E402

if __name__ == "__main__":
    manifest = build_all()
    print(json.dumps(manifest, indent=2))
