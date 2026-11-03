from __future__ import annotations

import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from ..services.harness_runner import run_event_stream

router = APIRouter(prefix="/api/run", tags=["run"])


class RunRequest(BaseModel):
    scaffold_text: str = Field(..., min_length=1, max_length=200_000)
    ask_prompt:    str = Field(..., min_length=1, max_length=20_000)
    provider:      str | None = None
    model:         str | None = None
    max_tokens:    int = 16384
    temperature:   float = 0.8


@router.post("/")
async def run(req: RunRequest):
    async def event_source():
        try:
            async for ev in run_event_stream(
                scaffold_text=req.scaffold_text,
                ask_prompt=req.ask_prompt,
                provider=req.provider,
                model=req.model,
                max_tokens=req.max_tokens,
                temperature=req.temperature,
            ):
                yield {"event": "pipeline", "data": ev.model_dump_json()}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"error": str(e)})}
    return EventSourceResponse(event_source())
