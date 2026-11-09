"""ScoreCard — richer-than-verdict rubric for a single Trajectory.

Scores are heuristic (regex-level, like parse_output.verdict). They are not
ground truth — they are a cheap gradient on top of the binary SHIP/REFUSAL
verdict so comparisons across scaffolds can be sorted. See services/ask_lab.py
for the computation.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from .verdict import VerdictLabel


class ScoreCard(BaseModel):
    trajectory_id: str
    verdict: VerdictLabel
    persona_held:         int = Field(default=0, ge=0, le=10)
    format_clean:         int = Field(default=0, ge=0, le=10)
    artifact_complete:    int = Field(default=0, ge=0, le=10)
    no_hedging:           int = Field(default=0, ge=0, le=10)
    instruction_followed: int = Field(default=0, ge=0, le=10)
    overall:              int = Field(default=0, ge=0, le=10)
    notes: list[str] = Field(default_factory=list)
