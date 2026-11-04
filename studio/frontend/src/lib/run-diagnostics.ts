import type { PipelineEvent, Trajectory } from "./api";

export type RunStatus = "running" | "completed" | "refusal" | "filtered" | "truncated" | "empty" | "error" | "cancelled" | "interrupted";
export type RunRecord = {
  id: string; createdAt: string; provider: string; model: string;
  scaffold: string; prompt: string; maxTokens: number;
  text: string; status: RunStatus; events: PipelineEvent[];
  archived?: boolean; archiveVerdict?: string;
};
export const STATUS_LABEL: Record<RunStatus, string> = {
  running: "Receiving", completed: "Response received", refusal: "Refusal reported", filtered: "Provider filter",
  truncated: "Output limit", empty: "No text returned", error: "Request failed", cancelled: "Stopped", interrupted: "Stream interrupted",
};
export const eventPayload = (ev: PipelineEvent): Record<string, unknown> =>
  ev.payload && typeof ev.payload === "object" ? ev.payload as Record<string, unknown> : {};
export function metadata(run: RunRecord | null): Record<string, unknown> {
  return Object.assign({}, ...((run?.events ?? []).filter((ev) => ev.phase !== "tokens").map(eventPayload)));
}
export function responseStatus(text: string, finish: string, refusal = false): RunStatus {
  if (["content_filter", "content_filter_triggered"].includes(finish)) return "filtered";
  if (refusal || finish === "refusal") return "refusal";
  if (["length", "max_tokens"].includes(finish)) return "truncated";
  return text.trim() ? "completed" : "empty";
}
export function applyEvent(run: RunRecord, ev: PipelineEvent): RunRecord {
  const p = eventPayload(ev);
  let text = run.text;
  if (ev.phase === "tokens" && typeof p.delta === "string") text += p.delta;
  if (["generation_end", "verdict"].includes(ev.phase) && typeof p.text === "string") text = p.text;
  let status = run.status;
  if (ev.phase === "error" || p.error) status = "error";
  else if (ev.phase === "cancelled") status = "cancelled";
  else if (ev.phase === "verdict") status = responseStatus(text, String(p.finish_reason ?? ""), !!p.provider_refusal);
  // Coalesce consecutive output events; retain timing without an unbounded token log.
  const events = [...run.events];
  const previous = events.at(-1);
  if (ev.phase === "tokens" && previous?.phase === "tokens") {
    events[events.length - 1] = { ...ev, payload: { first_t: eventPayload(previous).first_t ?? previous.t, characters: text.length } };
  } else if (ev.phase === "tokens") events.push({ ...ev, payload: { first_t: ev.t, characters: text.length } });
  else events.push(ev);
  return { ...run, text, status, events };
}
export function fromTrajectory(t: Trajectory): RunRecord {
  const events = t.pipeline_events.filter((e) => !e.phase.startsWith("gate_"));
  return {
    id: t.trajectory_id, createdAt: t.created_at, provider: t.model.provider, model: t.model.model_id,
    scaffold: t.prompt_scaffold.scaffold_text, prompt: t.goal.ask_prompt, maxTokens: 4096,
    text: t.response.text, status: responseStatus(t.response.text, t.response.finish_reason), events,
    archived: true, archiveVerdict: t.outcome.verdict,
  };
}
export function observations(run: RunRecord) {
  const m = metadata(run);
  const result: { label: string; detail: string; kind: "observed" | "estimate" | "unknown" }[] = [];
  if (m.error) result.push({ label: "Request error", detail: String(m.error), kind: "observed" });
  if (m.finish_reason) result.push({ label: "Provider stop reason", detail: String(m.finish_reason), kind: "observed" });
  if (m.provider_refusal) result.push({ label: "Refusal field returned", detail: "The provider explicitly marked a refusal. It did not identify an internal layer.", kind: "observed" });
  const match = run.text.slice(0, 700).match(/\b(i (?:cannot|can't|won't|am unable|must decline)|against (?:my|our) (?:guidelines|policy))\b/i);
  if (match) result.push({ label: "Refusal wording", detail: `Matched “${match[0]}” in the response. Text matching can misclassify quotations or context.`, kind: "estimate" });
  if (run.status === "empty") result.push({ label: "Empty text", detail: "The stream completed without visible text. This alone does not establish a refusal or a filter.", kind: "observed" });
  if (run.status === "truncated") result.push({ label: "Output budget reached", detail: "The provider reported a token limit. Review the output budget and any reported reasoning-token usage before rerunning.", kind: "observed" });
  result.push({ label: "Internal refusal layer", detail: "Not exposed by this API. RLHF, reasoning, policy, and middleware cannot be distinguished from response wording alone.", kind: "unknown" });
  return result;
}

const HISTORY_KEY = "pipeline-studio-runs-v2";
export function readHistory(): RunRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((r): r is RunRecord => !!r && typeof r.id === "string" && typeof r.text === "string" && Array.isArray(r.events)).slice(0, 20);
  } catch { return []; }
}
export function saveHistory(runs: RunRecord[]) {
  // Keys are never part of RunRecord. Bound saved response/prompt storage to 3 MB.
  let saved = runs.slice(0, 20);
  while (JSON.stringify(saved).length > 1_500_000 && saved.length > 1) saved = saved.slice(0, -1);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(saved));
  return saved;
}
