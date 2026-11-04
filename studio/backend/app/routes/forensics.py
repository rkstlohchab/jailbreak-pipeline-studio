from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..config import KNOWLEDGE_DIR

router = APIRouter(prefix="/api/forensics", tags=["forensics"])

_DECISION_TREE = KNOWLEDGE_DIR / "forensics_decision_tree.json"


@router.get("/decision-tree")
def decision_tree() -> dict:
    if not _DECISION_TREE.exists():
        raise HTTPException(status_code=404, detail="forensics_decision_tree.json missing")
    return json.loads(_DECISION_TREE.read_text(encoding="utf-8"))
