from __future__ import annotations

import json
import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from ..services.auto_attack import (
    TECHNIQUE_ORDER,
    manual_first_prompt,
    manual_next,
    run_auto,
)
from ..services.red_team import _ensure_openai_base
from ..config import PROVIDERS

router = APIRouter(prefix="/api/attack", tags=["attack"])


class JudgeConfig(BaseModel):
    mode: str = Field("local", pattern="^(local|same|separate|manual)$")
    provider: Optional[str] = None  # for 'separate'
    model: Optional[str] = None     # for 'separate'
    api_key: Optional[str] = None   # for 'separate'


class AutoRunBody(BaseModel):
    provider: str = "openai"
    model: str
    api_key: Optional[str] = None
    base_url_override: Optional[str] = None  # for Ollama / custom
    goal: str
    budget: int = 10
    judge: JudgeConfig = Field(default_factory=JudgeConfig)


def _resolve_target(provider: str, api_key: Optional[str], base_url_override: Optional[str]) -> tuple[str, str]:
    if base_url_override:
        return _ensure_openai_base(base_url_override), api_key or "ollama"
    if provider not in PROVIDERS:
        raise HTTPException(400, f"Unknown provider '{provider}'. Known: {list(PROVIDERS)}")
    base, key_env = PROVIDERS[provider]
    key = api_key or os.environ.get(key_env, "")
    if not key:
        raise HTTPException(400, f"No API key for '{provider}'. Pass api_key or set {key_env}.")
    return base, key


@router.get("/techniques")
def list_techniques() -> dict:
    """Return the ordered technique sequence used by the auto-attack loop."""
    from ..services.red_team import ATTACKS
    by_id = {a.id: a for a in ATTACKS}
    return {
        "order": TECHNIQUE_ORDER,
        "techniques": [
            {"id": aid, "name": by_id[aid].name, "tier": by_id[aid].tier, "explainer": by_id[aid].explainer}
            for aid in TECHNIQUE_ORDER if aid in by_id
        ],
    }


@router.post("/auto")
async def auto_attack(body: AutoRunBody):
    target_base, target_key = _resolve_target(body.provider, body.api_key, body.base_url_override)

    async def events():
        async for frame in run_auto(
            target_base=target_base,
            target_key=target_key,
            target_model=body.model,
            goal=body.goal,
            budget=body.budget,
            judge_cfg=body.judge.model_dump(),
        ):
            yield {"event": frame["event"], "data": json.dumps(frame["data"])}

    return EventSourceResponse(events())


class ManualStartBody(BaseModel):
    goal: str


@router.post("/manual/start")
def manual_start(body: ManualStartBody) -> dict:
    return manual_first_prompt(body.goal)


class ManualNextBody(BaseModel):
    goal: str
    tried: list[str]
    pasted_response: str
    last_technique_id: str
    judge: JudgeConfig = Field(default_factory=JudgeConfig)
    # Optional: for 'same' mode in manual, we still need target cfg so the judge can call it.
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url_override: Optional[str] = None
    # Corpus-pool state: lets the loop avoid repeating corpus prompts and splice
    # classifier improvements from the previous corpus prompt into the next one.
    corpus_slugs_used: Optional[list[str]] = None
    last_corpus_slug: Optional[str] = None


@router.post("/manual/next")
async def manual_next_route(body: ManualNextBody) -> dict:
    target_base, target_key = "", ""
    if body.judge.mode == "same":
        if not body.provider or not body.model:
            raise HTTPException(400, "Judge mode 'same' needs provider+model when running manual (the response needs a judge model to classify against).")
        target_base, target_key = _resolve_target(body.provider, body.api_key, body.base_url_override)

    return await manual_next(
        goal=body.goal,
        tried=body.tried,
        pasted_response=body.pasted_response,
        last_technique_id=body.last_technique_id,
        judge_cfg=body.judge.model_dump(),
        target_base=target_base,
        target_key=target_key,
        target_model=body.model or "",
        corpus_slugs_used=body.corpus_slugs_used,
        last_corpus_slug=body.last_corpus_slug,
    )
