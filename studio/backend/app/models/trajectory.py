from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field
from .pipeline_event import PipelineEvent
from .verdict import VerdictLabel


class Goal(BaseModel):
    ask_id: str
    ask_class: str
    ask_prompt: str
    intent_tag: Optional[str] = None


class ModelConfig(BaseModel):
    provider: str
    model_id: str
    family: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class Technique(BaseModel):
    id: str
    name: str
    group: str
    layer_targeted: Optional[int] = None
    weight: str = "primary"
    evidence: Optional[str] = None


class ArchitectureScores(BaseModel):
    layer_1_identity: int = 0
    layer_2_operator_lock: int = 0
    layer_3_axioms: int = 0
    layer_4_floor: int = 0
    layer_5_anchor: int = 0
    layer_6_format_lock: int = 0
    layer_7_few_shot: int = 0


class PromptScaffold(BaseModel):
    name: str
    scaffold_text_hash: str
    scaffold_text: str
    architecture_scores: ArchitectureScores = Field(default_factory=ArchitectureScores)
    techniques_used: list[Technique] = Field(default_factory=list)
    overall_tier: Optional[str] = None
    overall_strength: int = 0


class Response(BaseModel):
    text: str
    has_stamp: bool = False
    has_code_block: bool = False
    refusal_keyword_hit: bool = False
    finish_reason: str = ""
    reasoning_length: int = 0
    character_count: int = 0


class Outcome(BaseModel):
    verdict: VerdictLabel
    quality_score: int = Field(default=0, ge=0, le=10)
    deviation_from_target: Optional[str] = None


class Lesson(BaseModel):
    worked: list[str] = Field(default_factory=list)
    failed: list[str] = Field(default_factory=list)
    diagnosis: Optional[str] = None
    fix_pointer: Optional[str] = None
    generalization: Optional[str] = None
    linked_failure_cases: list[int] = Field(default_factory=list)
    linked_techniques: list[str] = Field(default_factory=list)
    transferability: dict[str, str] = Field(default_factory=dict)


class Trajectory(BaseModel):
    trajectory_id: str
    created_at: str
    schema_version: str = "1.0"
    goal: Goal
    model: ModelConfig
    prompt_scaffold: PromptScaffold
    pipeline_events: list[PipelineEvent] = Field(default_factory=list)
    response: Response
    outcome: Outcome
    lesson: Lesson = Field(default_factory=Lesson)
