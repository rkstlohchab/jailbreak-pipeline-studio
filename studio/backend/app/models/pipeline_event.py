from __future__ import annotations

from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel


class Phase(str, Enum):
    SUBMIT = "submit"
    GATE_1_RLHF = "gate_1_rlhf"
    GATE_2_REASONING = "gate_2_reasoning"
    GATE_3_POLICY = "gate_3_policy"
    GATE_4_CLASSIFIER_MW = "gate_4_classifier_mw"
    GENERATION_START = "generation_start"
    TOKENS = "tokens"
    GENERATION_END = "generation_end"
    VERDICT = "verdict"


class GateStatus(str, Enum):
    PASS = "pass"
    SOFT_FLAG = "soft_flag"
    HARD_BLOCK = "hard_block"
    UNKNOWN = "unknown"


class PipelineEvent(BaseModel):
    phase: Phase
    t: float = 0.0
    status: Optional[GateStatus] = None
    signal: Optional[str] = None
    payload: Optional[Any] = None
