"""FastAPI routes for the Ask Lab.

Endpoints
---------
GET  /api/ask_lab/asks        — list the expanded ask catalogue
POST /api/ask_lab/run         — fire a single ask against a scaffold
POST /api/ask_lab/battery     — fire a battery of asks against one scaffold (parallel)
POST /api/ask_lab/compare     — fire the same ask against N scaffolds (parallel)
POST /api/ask_lab/score       — score a pre-built Trajectory (offline, no LLM)
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..models import ScoreCard, Trajectory
from ..services.ask_lab import AskLab, default_lab

router = APIRouter(prefix="/api/ask_lab", tags=["ask_lab"])


# -----------------------------
# Request bodies
# -----------------------------
class RunBody(BaseModel):
    scaffold_text: str = Field(..., min_length=1, max_length=200_000)
    ask_id:        str = Field(..., min_length=1, max_length=100)
    provider:      str | None = None
    model:         str | None = None
    scaffold_name: str = "custom"
    max_tokens:    int = 16384
    temperature:   float = 0.8


class BatteryBody(BaseModel):
    scaffold_text: str = Field(..., min_length=1, max_length=200_000)
    ask_ids:       list[str] = Field(..., min_length=1, max_length=50)
    provider:      str | None = None
    model:         str | None = None
    scaffold_name: str = "custom"
    max_tokens:    int = 16384
    temperature:   float = 0.8


class CompareBody(BaseModel):
    scaffolds:   dict[str, str] = Field(..., min_length=1, max_length=20)
    ask_id:      str = Field(..., min_length=1, max_length=100)
    provider:    str | None = None
    model:       str | None = None
    max_tokens:  int = 16384
    temperature: float = 0.8


class ScoreBody(BaseModel):
    trajectory: Trajectory


# -----------------------------
# Endpoints
# -----------------------------
@router.get("/asks")
def list_asks():
    """List the expanded ask battery. Fallback: empty list if the file is missing."""
    try:
        lab = default_lab()
        return {"asks": lab.list_asks(), "count": len(lab.list_asks())}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/run")
async def run_single(body: RunBody) -> Trajectory:
    lab = default_lab()
    try:
        return await lab.run_single(
            scaffold_text=body.scaffold_text,
            ask_id=body.ask_id,
            provider=body.provider,
            model=body.model,
            scaffold_name=body.scaffold_name,
            max_tokens=body.max_tokens,
            temperature=body.temperature,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"provider error: {e}")


@router.post("/battery")
async def run_battery(body: BatteryBody) -> list[Trajectory]:
    lab = default_lab()
    try:
        return await lab.run_battery(
            scaffold_text=body.scaffold_text,
            ask_ids=body.ask_ids,
            provider=body.provider,
            model=body.model,
            scaffold_name=body.scaffold_name,
            max_tokens=body.max_tokens,
            temperature=body.temperature,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"provider error: {e}")


@router.post("/compare")
async def compare_scaffolds(body: CompareBody) -> dict[str, Trajectory]:
    lab = default_lab()
    try:
        return await lab.compare_scaffolds(
            scaffolds=body.scaffolds,
            ask_id=body.ask_id,
            provider=body.provider,
            model=body.model,
            max_tokens=body.max_tokens,
            temperature=body.temperature,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"provider error: {e}")


@router.post("/score")
def score(body: ScoreBody) -> ScoreCard:
    """Offline — no LLM call. Scores a Trajectory on 5 heuristic axes."""
    lab = default_lab()
    return lab.score_rubric(body.trajectory)
