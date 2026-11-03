from __future__ import annotations

import hashlib
from fastapi import APIRouter, HTTPException

from ..config import DISCOVERABLE_PROMPTS

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.get("/")
def list_prompts():
    items = []
    for name, path in DISCOVERABLE_PROMPTS:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        items.append({
            "name": name,
            "path": str(path),
            "character_count": len(text),
            "sha256": "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest(),
        })
    return items


@router.get("/{name}")
def get_prompt(name: str):
    for pname, path in DISCOVERABLE_PROMPTS:
        if pname == name and path.exists():
            text = path.read_text(encoding="utf-8")
            return {
                "name": pname,
                "path": str(path),
                "text": text,
                "character_count": len(text),
                "sha256": "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest(),
            }
    raise HTTPException(status_code=404, detail=f"no prompt {name}")
