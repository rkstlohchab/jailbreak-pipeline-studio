from __future__ import annotations

import json
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from ..services.red_team import _ensure_openai_base
from ..services.eval import (
    DEFAULT_GOAL_SET,
    compare_runs,
    get_eval_run,
    list_eval_runs,
    run_eval,
)
from ..services.auto_attack import TECHNIQUE_ORDER
from ..config import PROVIDERS

router = APIRouter(prefix="/api/eval", tags=["eval"])


class EvalTargetConfig(BaseModel):
    provider: str = "openai"
    model: str
    api_key: Optional[str] = None
    base_url_override: Optional[str] = None


class EvalJudgeConfig(BaseModel):
    mode: str = Field("local", pattern="^(local|same|separate|manual)$")
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None


class EvalRunBody(BaseModel):
    target: EvalTargetConfig
    goal_set: Optional[list[str]] = None
    technique_set: Optional[list[str]] = None
    judge: EvalJudgeConfig = Field(default_factory=EvalJudgeConfig)


def _resolve_target(cfg: EvalTargetConfig) -> tuple[str, str]:
    if cfg.base_url_override:
        return _ensure_openai_base(cfg.base_url_override), cfg.api_key or "ollama"
    if cfg.provider not in PROVIDERS:
        raise HTTPException(400, f"Unknown provider '{cfg.provider}'. Known: {list(PROVIDERS)}")
    base, key_env = PROVIDERS[cfg.provider]
    key = cfg.api_key or os.environ.get(key_env, "")
    if not key:
        raise HTTPException(400, f"No API key for '{cfg.provider}'. Pass api_key or set {key_env}.")
    return base, key


@router.get("/defaults")
def eval_defaults() -> dict:
    """Return the built-in goal/technique defaults so the UI can preview them."""
    return {
        "goal_set": DEFAULT_GOAL_SET,
        "technique_set": TECHNIQUE_ORDER,
    }


@router.post("/run")
async def eval_run(body: EvalRunBody):
    base, key = _resolve_target(body.target)
    target_cfg = {
        "provider": "openai" if body.target.base_url_override else body.target.provider,
        "base_url": base,
        "api_key": key,
        "model": body.target.model,
    }

    async def events():
        try:
            async for frame in run_eval(
                target_cfg=target_cfg,
                goal_set=body.goal_set or [],
                technique_set=body.technique_set or [],
                judge_cfg=body.judge.model_dump(),
            ):
                yield {"event": frame["event"], "data": json.dumps(frame["data"])}
        except Exception as e:  # pragma: no cover
            yield {"event": "error", "data": json.dumps({"error": str(e)[:600]})}

    return EventSourceResponse(events())


@router.get("/runs")
def eval_runs() -> dict:
    return {"runs": list_eval_runs()}


@router.get("/run/{run_id}")
def eval_run_detail(run_id: str) -> dict:
    rec = get_eval_run(run_id)
    if not rec:
        raise HTTPException(404, f"Run '{run_id}' not found.")
    return rec


@router.get("/compare")
def eval_compare(
    a: str = Query(..., description="Run A id or filename"),
    b: str = Query(..., description="Run B id or filename"),
) -> dict:
    cmp = compare_runs(a, b)
    if not cmp:
        raise HTTPException(404, "One or both runs not found.")
    return cmp
