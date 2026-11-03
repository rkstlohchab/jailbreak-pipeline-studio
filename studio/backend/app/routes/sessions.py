from __future__ import annotations

import json
from fastapi import APIRouter, HTTPException

from ..config import SESSIONS_DIR

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("/")
def list_sessions():
    if not SESSIONS_DIR.exists():
        return []
    items = []
    for p in sorted(SESSIONS_DIR.glob("sess_*.json")):
        data = json.loads(p.read_text(encoding="utf-8"))
        items.append({
            "trajectory_id": data["trajectory_id"],
            "goal": data["goal"],
            "outcome": data["outcome"],
            "created_at": data["created_at"],
            "response_chars": data["response"]["character_count"],
            "model": data["model"],
        })
    return items


@router.get("/{sess_id}")
def get_session(sess_id: str):
    p = SESSIONS_DIR / f"{sess_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"no session {sess_id}")
    return json.loads(p.read_text(encoding="utf-8"))
