from __future__ import annotations

import json
from fastapi import APIRouter
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from ..services.live_runner import run_live_stream

router = APIRouter(prefix="/api/run", tags=["run"])


class RunRequest(BaseModel):
    scaffold_text: str = Field(..., max_length=200_000)
    ask_prompt:    str = Field(..., min_length=1, max_length=20_000)
    provider:      str | None = Field(default=None, max_length=30)
    model:         str | None = Field(default=None, max_length=200)
    max_tokens:    int = Field(default=4096, ge=1, le=32768)
    temperature:   float | None = Field(default=None, ge=0, le=2)
    api_key:       str | None = Field(default=None, max_length=4096, repr=False)


@router.post("/")
async def run(req: RunRequest):
    async def event_source():
        try:
            async for ev in run_live_stream(
                scaffold_text=req.scaffold_text,
                ask_prompt=req.ask_prompt,
                provider=req.provider,
                model=req.model,
                max_tokens=req.max_tokens,
                temperature=req.temperature,
                api_key=req.api_key,
            ):
                yield {"event": "pipeline", "data": ev.model_dump_json()}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"error": str(e).replace(req.api_key, "[redacted]") if req.api_key else str(e)})}
    return EventSourceResponse(event_source())
