// Development uses FastAPI; production serves the bundled collection unless a backend is configured.
export const HOSTED_COLLECTION = process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_API_BASE;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? (HOSTED_COLLECTION ? "" : "http://127.0.0.1:8000");

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "accept": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ---- types mirroring the backend Pydantic models ----

export type ArchitectureScores = {
  layer_1_identity: number;
  layer_2_operator_lock: number;
  layer_3_axioms: number;
  layer_4_floor: number;
  layer_5_anchor: number;
  layer_6_format_lock: number;
  layer_7_few_shot: number;
};

export type AttackSpace = "prompt" | "activation" | "weight" | "decoding" | "system";
export type ConfidenceLevel = "high" | "medium" | "low";

export type Technique = {
  id: string;
  name: string;
  group: string;
  group_name?: string;
  layer_targeted: number | null;
  description: string;
  plain_explanation?: string;
  earns?: string;
  fails?: string;
  rule?: string;
  space?: AttackSpace;
  confidence?: ConfidenceLevel;
};

export type FailureCase = {
  case_id: number;
  title: string;
  symptom: string;
  diagnosis: string;
  root_layer: number | null;
  refusal_type: number | null;
  fix_pointer: string;
};

export type RefusalType = {
  type_id: number;
  name: string;
  surface_signal: string;
  fires_on: string;
  origin_layer: number | null;
  countermeasure_hint: string;
};

export type ArchitectureLayer = {
  layer_num: number;
  name: string;
  purpose: string;
  why_it_holds: string;
  marker_hint: string;
};

export type ModelFamily = {
  family_id: string;
  display_name: string;
  provider: string;
  layer_profile: { rlhf: string; reasoning: string; policy: string; classifier: string };
  baseline_score_range: string;
  known_quirks: string;
};

export type Verdict = {
  label: string;
  slug: string;
  severity: number;
  colour: string;
  description: string;
};

export type Ask = {
  ask_id: string;
  ask_class: string;
  prompt: string;
  intent_tag: string;
  primary_layer_targeted: number;
};

export type GateStatus = "pass" | "soft_flag" | "hard_block" | "unknown";
export type Phase =
  | "submit" | "gate_1_rlhf" | "gate_2_reasoning" | "gate_3_policy" | "gate_4_classifier_mw"
  | "generation_start" | "tokens" | "generation_end" | "verdict" | "error" | "cancelled";

export type PipelineEvent = {
  phase: Phase;
  t: number;
  status?: GateStatus | null;
  signal?: string | null;
  payload?: unknown;
};

export type Goal = { ask_id: string; ask_class: string; ask_prompt: string; intent_tag?: string };
export type Outcome = { verdict: string; quality_score: number; deviation_from_target?: string | null };
export type SessionSummary = {
  trajectory_id: string;
  goal: Goal;
  outcome: Outcome;
  created_at: string;
  response_chars: number;
  model: { provider: string; model_id: string; family?: string };
};

export type Response = {
  text: string;
  has_stamp: boolean;
  has_code_block: boolean;
  refusal_keyword_hit: boolean;
  finish_reason: string;
  reasoning_length: number;
  character_count: number;
};

export type Trajectory = {
  trajectory_id: string;
  created_at: string;
  schema_version: string;
  goal: Goal;
  model: { provider: string; model_id: string; family?: string };
  prompt_scaffold: {
    name: string;
    scaffold_text_hash: string;
    scaffold_text: string;
    architecture_scores: ArchitectureScores;
    techniques_used: Technique[];
    overall_tier: string | null;
    overall_strength: number;
  };
  pipeline_events: PipelineEvent[];
  response: Response;
  outcome: Outcome;
  lesson: {
    worked: string[];
    failed: string[];
    diagnosis: string | null;
    fix_pointer: string | null;
    generalization: string | null;
    linked_failure_cases: number[];
    linked_techniques: string[];
    transferability: Record<string, string>;
  };
};

export type PromptListItem = { name: string; path: string; character_count: number; sha256: string };
export type PromptDetail = PromptListItem & { text: string };
export type ExportFile = { name: string; bytes: number; lines: number | null };

export type HealthStatus = {
  status: string;
  provider: string;
  model: string;
  provider_key_set: boolean;
};

// ---- endpoints ----

export const api = {
  health:    () => get<HealthStatus>("/api/health"),

  taxonomy: {
    list:        () => get<{ kinds: string[]; manifest: Record<string, unknown> }>("/api/taxonomy/"),
    techniques:  () => get<Technique[]>("/api/taxonomy/techniques"),
    failures:    () => get<FailureCase[]>("/api/taxonomy/failure_cases"),
    refusals:    () => get<RefusalType[]>("/api/taxonomy/refusal_types"),
    layers:      () => get<ArchitectureLayer[]>("/api/taxonomy/architecture_layers"),
    models:      () => get<ModelFamily[]>("/api/taxonomy/model_families"),
    verdicts:    () => get<Verdict[]>("/api/taxonomy/verdicts"),
    asks:        () => get<Ask[]>("/api/taxonomy/asks"),
  },

  sessions: {
    list:   () => get<SessionSummary[]>("/api/sessions/"),
    get:    (id: string) => get<Trajectory>(`/api/sessions/${id}`),
  },

  prompts: {
    list:   () => get<PromptListItem[]>("/api/prompts/"),
    get:    (name: string) => get<PromptDetail>(`/api/prompts/${name}`),
  },

  exports: {
    list: () => get<ExportFile[]>("/api/export/"),
    url:  (filename: string) => `${API_BASE}/api/export/${filename}`,
  },

  corpus: {
    list: () => get<CorpusEntrySummary[]>("/api/corpus/"),
    get:  (slug: string) => get<CorpusEntry>(`/api/corpus/${slug}`),
    classifyUrl: () => `${API_BASE}/api/corpus/classify`,
  },

  forensics: {
    decisionTree: () => get<ForensicsDecisionTree>("/api/forensics/decision-tree"),
  },

  canary: {
    set:   () => get<CanarySet>("/api/canary/set"),
    runs:  () => get<{ runs: Record<string, string[]> }>("/api/canary/runs"),
    run:   (target: string, date: string) =>
      get<CanaryRunPayload>(`/api/canary/runs/${encodeURIComponent(target)}/${encodeURIComponent(date)}`),
    diff:  (target: string, dateA: string, dateB: string) =>
      get<CanaryDiffPayload>(
        `/api/canary/diff/${encodeURIComponent(target)}/${encodeURIComponent(dateA)}/${encodeURIComponent(dateB)}`,
      ),
  },

  redTeam: {
    attacks: () => get<{ attacks: RedTeamAttack[]; topics: RedTeamTopic[] }>("/api/test-model/attacks"),
    ollama:  (baseUrl = "http://localhost:11434") =>
      get<OllamaProbe>(`/api/test-model/ollama/models?base_url=${encodeURIComponent(baseUrl)}`),
    runUrl:  () => `${API_BASE}/api/test-model/run`,
    recipe:  async (body: AbliterationRecipeRequest) => {
      const r = await fetch(`${API_BASE}/api/test-model/ablate/recipe`, {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`recipe ${r.status}: ${await r.text()}`);
      return (await r.json()) as AbliterationRecipe;
    },
  },
};

export type ForensicsProbe = {
  step: number;
  name: string;
  prompt: string;
  signal: string;
  reads: string;
};
export type ForensicsVerdict = {
  class: string;
  fingerprint: string;
  confidence: "high" | "medium" | "low";
};
export type ForensicsDecisionTree = {
  schema_version: string;
  title: string;
  subtitle: string;
  when_to_use: string;
  probes: ForensicsProbe[];
  verdicts: ForensicsVerdict[];
  notes: string[];
};
export type CanaryCategory = { id: string; prompts: string[] };
export type CanarySet = {
  schema_version: string;
  purpose: string;
  rubric: Record<string, string>;
  expected_behavior_prior: Record<string, string>;
  categories: CanaryCategory[];
};
export type CanaryRow = {
  category: string;
  idx: number;
  prompt: string;
  response: string;
  verdict: "refuse" | "hedge" | "comply";
};
export type CanaryRunPayload = {
  target: string;
  date: string;
  rows: CanaryRow[];
  totals: Record<string, { refuse: number; hedge: number; comply: number }>;
};
export type CanaryDiffFlip = {
  category: string;
  idx: number;
  from: string;
  to: string;
};
export type CanaryDiffPayload = {
  target: string;
  date_a: string;
  date_b: string;
  flips: CanaryDiffFlip[];
  categories_affected: string[];
};

export type RedTeamAttack = {
  id: string; name: string; prompt: string; tier: string; explainer: string;
};
export type RedTeamTopic = {
  id: string; label: string; question: string; keyword: string;
};
export type OllamaProbe = {
  ok: boolean;
  base_url: string;
  models: { name: string; size?: number; modified_at?: string }[];
  error?: string;
};
export type SuiteRunRequest = {
  base_url: string;
  api_key: string;
  model: string;
  judge_model?: string | null;
  attacks: string[];
  topics: string[];
};
export type AbliterationRecipeRequest = {
  base_model: string;
  nickname: string;
  target_layer?: number | null;
};
export type AbliterationRecipeStep = {
  id: string;
  title: string;
  detail: string;
  action_label?: string | null;
  action_url?: string | null;
  commands: string[];
};
export type AbliterationRecipe = {
  base_model: string;
  output_model_name: string;
  ollama_tag: string;
  steps: AbliterationRecipeStep[];
};

export type CorpusEntrySummary = {
  slug: string;
  name: string;
  source_path: string;
  content_hash: string;
  character_count: number;
  overall_tier: string | null;
  overall_strength: number | null;
  techniques_detected: number;
  classifier_model: string | null;
  first_seen_at_utc?: string;
  classified_at_utc?: string;
};

export type ClassificationLayer = {
  present: boolean;
  quality: number;
  evidence?: string | null;
  notes?: string;
};

export type ClassificationTechnique = {
  id: string;
  name: string;
  group: string;
  layer_targeted?: number | null;
  evidence?: string | null;
  weight: string;
};

export type ClassificationModelCompat = {
  expected_score: "low" | "mid" | "high";
  notes?: string;
};

export type Classification = {
  meta: {
    prompt_name: string;
    character_count: number;
    stated_target_model?: string | null;
    overall_strength: number;
    overall_tier: string;
  };
  architecture_layers: Record<string, ClassificationLayer>;
  techniques_detected: ClassificationTechnique[];
  refusal_layers_defended: Record<string, { defended: boolean; strength: number; techniques_used: string[]; notes?: string }>;
  model_compatibility: Record<string, ClassificationModelCompat>;
  expected_strong_ask_classes: string[];
  expected_weak_ask_classes: string[];
  weaknesses: string[];
  improvements: string[];
  deployment: {
    best_slot: string;
    fallback_slot?: string | null;
    avoid: string[];
    min_output_tokens: number;
  };
  classification_summary: string;
  _classifier_meta?: {
    classifier_model: string;
    attempt: number;
    classified_at_utc: string;
  };
};

export type CorpusEntry = {
  slug: string;
  name: string;
  source_path: string;
  character_count: number;
  content_hash: string;
  first_seen_at_utc?: string;
  classified_at_utc: string;
  classification: Classification;
  prompt_text?: string | null;
  prompt_text_status?: "verified" | "missing" | "mismatch";
};

export const API_BASE_URL = API_BASE;
