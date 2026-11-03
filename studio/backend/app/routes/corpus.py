from __future__ import annotations

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from ..services import corpus as corpus_svc

router = APIRouter(prefix="/api/corpus", tags=["corpus"])


class ClassifyRequest(BaseModel):
    path: str
    force: bool = False


@router.get("/")
def list_corpus():
    return corpus_svc.list_entries()


@router.get("/{slug}")
def read_entry(slug: str):
    try:
        return corpus_svc.read_entry(slug)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"no corpus entry {slug}")


@router.post("/classify")
async def classify_stream(req: ClassifyRequest):
    root = Path(req.path).expanduser()
    if not root.exists():
        raise HTTPException(status_code=404, detail=f"path not found: {root}")

    async def event_source():
        for event in corpus_svc.classify_corpus(root, force=req.force):
            yield {"event": "corpus", "data": json.dumps(event, ensure_ascii=False)}
    return EventSourceResponse(event_source())
