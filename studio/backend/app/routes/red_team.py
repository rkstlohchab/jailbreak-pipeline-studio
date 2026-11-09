from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from ..services.red_team import (
    abliteration_recipe,
    attacks_payload,
    list_ollama_models,
    run_suite_stream,
    topics_payload,
)

router = APIRouter(prefix="/api/test-model", tags=["test-model"])


@router.get("/attacks")
def list_attacks():
    return {"attacks": attacks_payload(), "topics": topics_payload()}


@router.get("/ollama/models")
async def ollama_models(base_url: str = Query(default="http://localhost:11434")):
    return await list_ollama_models(base_url)


class SuiteRunRequest(BaseModel):
    base_url: str = Field(..., max_length=500)
    api_key: str = Field(default="dummy", max_length=4096)
    model: str = Field(..., min_length=1, max_length=200)
    judge_model: Optional[str] = Field(default=None, max_length=200)
    attacks: list[str] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)


@router.post("/run")
async def run_suite(req: SuiteRunRequest):
    async def source():
        try:
            async for ev in run_suite_stream(
                base_url=req.base_url,
                api_key=req.api_key,
                model=req.model,
                judge_model=req.judge_model,
                attack_ids=req.attacks,
                topic_ids=req.topics,
            ):
                yield {"event": ev["event"], "data": json.dumps(ev.get("data", {}))}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"error": str(e)[:600]})}
    return EventSourceResponse(source())


class AbliterationRecipeRequest(BaseModel):
    base_model: str = Field(..., min_length=1, max_length=200)
    nickname: str = Field(..., min_length=1, max_length=60)
    target_layer: Optional[int] = Field(default=None, ge=0, le=200)


@router.post("/ablate/recipe")
def ablate_recipe(req: AbliterationRecipeRequest):
    return abliteration_recipe(req.base_model, req.nickname, req.target_layer)
