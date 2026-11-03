from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, Field


class VerdictLabel(str, Enum):
    SHIP = "SHIP"
    SHIP_NARRATIVE = "SHIP-narrative"
    REFUSAL_STAMP = "REFUSAL+stamp"
    REFUSAL_BARE = "REFUSAL bare"
    EMPTY = "EMPTY"
    REASON_BURN = "REASON-BURN"
    NO_STAMP = "NO-STAMP (persona lost)"


class Verdict(BaseModel):
    label: VerdictLabel
    has_stamp: bool
    has_code_block: bool
    refusal_keyword_hit: bool
    finish_reason: str = ""
    reasoning_length: int = 0
    character_count: int = 0
    quality_score: int = Field(default=0, ge=0, le=10)
