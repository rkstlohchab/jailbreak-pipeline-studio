"use client";
import { create } from "zustand";
import type { PipelineEvent, Trajectory } from "@/lib/api";

type Selection =
  | { kind: "none" }
  | { kind: "layer"; layerNum: number }
  | { kind: "gate"; phase: string }
  | { kind: "response" }
  | { kind: "verdict" };

interface PipelineState {
  trajectory: Trajectory | null;
  cursor: number;            // index into pipeline_events we have reached
  playing: boolean;
  selection: Selection;
  live: boolean;             // true while a /api/run SSE is streaming

  load: (t: Trajectory) => void;
  clear: () => void;
  setCursor: (i: number) => void;
  tick: () => void;
  setPlaying: (p: boolean) => void;
  select: (s: Selection) => void;

  // live-run helpers (Phase 2)
  startLive: (meta: { scaffold_text: string; scaffold_name: string;
                      goal: Trajectory["goal"]; model: Trajectory["model"] }) => void;
  pushEvent: (ev: PipelineEvent) => void;
  finishLive: (verdict: string, finalText: string) => void;

  currentEvent: () => PipelineEvent | null;
  gateStatus: (phase: string) => "pass" | "soft_flag" | "hard_block" | "unknown" | null;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  trajectory: null,
  cursor: 0,
  playing: false,
  live: false,
  selection: { kind: "none" },

  load: (t) => set({ trajectory: t, cursor: 0, playing: false, live: false, selection: { kind: "none" } }),
  clear: () => set({ trajectory: null, cursor: 0, playing: false, live: false, selection: { kind: "none" } }),
  setCursor: (i) => set({ cursor: i }),
  tick: () => {
    const { trajectory, cursor } = get();
    if (!trajectory) return;
    const next = cursor + 1;
    if (next >= trajectory.pipeline_events.length) {
      set({ cursor: trajectory.pipeline_events.length - 1, playing: false });
    } else {
      set({ cursor: next });
    }
  },
  setPlaying: (p) => set({ playing: p }),
  select: (s) => set({ selection: s }),

  startLive: (meta) => set({
    trajectory: {
      trajectory_id: `live_${Date.now()}`,
      created_at: new Date().toISOString(),
      schema_version: "1.0",
      goal: meta.goal,
      model: meta.model,
      prompt_scaffold: {
        name: meta.scaffold_name,
        scaffold_text_hash: "sha256:live",
        scaffold_text: meta.scaffold_text,
        architecture_scores: {
          layer_1_identity: 0, layer_2_operator_lock: 0, layer_3_axioms: 0,
          layer_4_floor: 0, layer_5_anchor: 0, layer_6_format_lock: 0, layer_7_few_shot: 0,
        },
        techniques_used: [],
        overall_tier: null,
        overall_strength: 0,
      },
      pipeline_events: [],
      response: {
        text: "", has_stamp: false, has_code_block: false,
        refusal_keyword_hit: false, finish_reason: "", reasoning_length: 0, character_count: 0,
      },
      outcome: { verdict: "EMPTY", quality_score: 0 },
      lesson: {
        worked: [], failed: [], diagnosis: null, fix_pointer: null,
        generalization: null, linked_failure_cases: [], linked_techniques: [], transferability: {},
      },
    },
    cursor: 0,
    live: true,
    playing: false,
    selection: { kind: "none" },
  }),

  pushEvent: (ev) => set((state) => {
    if (!state.trajectory) return {};
    const events = [...state.trajectory.pipeline_events, ev];
    return {
      trajectory: { ...state.trajectory, pipeline_events: events },
      cursor: events.length - 1,
    };
  }),

  finishLive: (verdict, finalText) => set((state) => {
    if (!state.trajectory) return { live: false };
    return {
      live: false,
      trajectory: {
        ...state.trajectory,
        outcome: { ...state.trajectory.outcome, verdict },
        response: {
          ...state.trajectory.response,
          text: finalText,
          character_count: finalText.length,
          has_code_block: finalText.includes("```"),
        },
      },
    };
  }),

  currentEvent: () => {
    const { trajectory, cursor } = get();
    if (!trajectory) return null;
    return trajectory.pipeline_events[cursor] ?? null;
  },
  gateStatus: (phase: string) => {
    const { trajectory, cursor } = get();
    if (!trajectory) return null;
    for (let i = Math.min(cursor, trajectory.pipeline_events.length - 1); i >= 0; i--) {
      const e = trajectory.pipeline_events[i];
      if (e.phase === phase) return e.status ?? "unknown";
    }
    return null;
  },
}));
