import { consumeSSE } from "./sse.ts";
import { responseStatus } from "./run-diagnostics.ts";
import type { PipelineEvent } from "./api";

export const PROVIDER_ENDPOINTS = {
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
} as const;
export type Provider = keyof typeof PROVIDER_ENDPOINTS;
export type ProviderRequest = {
  provider: Provider; model: string; scaffold_text: string; ask_prompt: string; api_key: string; max_tokens: number;
};
export function parseRunRequest(value: unknown): ProviderRequest {
  if (!value || typeof value !== "object") throw new Error("Expected a JSON request.");
  const v = value as Record<string, unknown>;
  if (typeof v.provider !== "string" || !Object.hasOwn(PROVIDER_ENDPOINTS, v.provider)) throw new Error("Choose OpenAI, OpenRouter, or Anthropic.");
  for (const [key, limit] of [["model", 200], ["scaffold_text", 200_000], ["ask_prompt", 20_000], ["api_key", 4096]] as const) {
    if (typeof v[key] !== "string" || (v[key] as string).length > limit) throw new Error(`Invalid ${key}.`);
  }
  if (!(v.model as string).trim() || !(v.ask_prompt as string).trim()) throw new Error("A model ID and user prompt are required.");
  if (!(v.api_key as string).trim()) throw new Error("Enter a provider API key for this tab to run a model.");
  if (/[\r\n]/.test(v.api_key as string)) throw new Error("The API key contains a line break.");
  const maxTokens = v.max_tokens ?? 4096;
  if (!Number.isInteger(maxTokens) || Number(maxTokens) < 1 || Number(maxTokens) > 32768) throw new Error("Output tokens must be between 1 and 32768.");
  return { provider: v.provider as Provider, model: (v.model as string).trim(), scaffold_text: v.scaffold_text as string,
    ask_prompt: v.ask_prompt as string, api_key: (v.api_key as string).trim(), max_tokens: Number(maxTokens) };
}

export async function streamProvider(req: ProviderRequest, emit: (event: PipelineEvent) => void, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const start = performance.now();
  const elapsed = () => Math.round((performance.now() - start) / 10) / 100;
  const send = (phase: PipelineEvent["phase"], payload: Record<string, unknown>, message?: string) => emit({ phase, t: elapsed(), payload, signal: message });
  const clean = (value: unknown) => String(value ?? "").replaceAll(req.api_key, "[redacted]").slice(0, 1600);
  let requestId: string | null = null;
  let httpStatus: number | undefined;
  send("submit", { provider: req.provider, model: req.model, scaffold_chars: req.scaffold_text.length, ask_chars: req.ask_prompt.length }, "Request sent");
  try {
    const anthropic = req.provider === "anthropic";
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/event-stream" };
    if (anthropic) { headers["x-api-key"] = req.api_key; headers["anthropic-version"] = "2023-06-01"; }
    else headers.Authorization = `Bearer ${req.api_key}`;
    const messages = [...(!anthropic && req.scaffold_text ? [{ role: "system", content: req.scaffold_text }] : []), { role: "user", content: req.ask_prompt }];
    const body = {
      model: req.model, messages, stream: true,
      ...(anthropic ? { system: req.scaffold_text, max_tokens: req.max_tokens } : {
        [req.provider === "openai" ? "max_completion_tokens" : "max_tokens"]: req.max_tokens,
        stream_options: { include_usage: true },
      }),
    };
    const res = await fetcher(PROVIDER_ENDPOINTS[req.provider], { method: "POST", headers, body: JSON.stringify(body), signal, cache: "no-store" });
    httpStatus = res.status;
    requestId = res.headers.get("x-request-id") ?? res.headers.get("request-id") ?? res.headers.get("x-generation-id");
    if (!res.ok) {
      const raw = await res.text();
      let message = raw.slice(0, 1400);
      let code: string | null = null;
      try { const p = JSON.parse(raw); message = p.error?.message ?? p.message ?? message; code = p.error?.code ?? p.error?.type ?? null; } catch { /* non-JSON gateway response */ }
      send("error", { error: clean(message || res.statusText), http_status: res.status, error_code: code ? clean(code) : null, request_id: requestId }, `Provider returned HTTP ${res.status}`);
      return;
    }
    if (!res.body || !res.headers.get("content-type")?.includes("text/event-stream")) throw new Error("Provider returned an unexpected response format; no event stream was received.");
    send("generation_start", { http_status: res.status, request_id: requestId }, "Provider connected");
    let text = "";
    let finish = "";
    let done = false;
    let refusal = false;
    let firstToken: number | null = null;
    let responseId = "";
    let actualModel = "";
    let usage: Record<string, unknown> = {};
    await consumeSSE(res.body, (frame) => {
      if (frame.data === "[DONE]") { done = true; return; }
      const p = JSON.parse(frame.data);
      if (frame.event === "error" || p.error) throw new Error(clean(p.error?.message ?? "Provider reported a stream error."));
      let delta = "";
      if (anthropic) {
        if (p.type === "message_start") {
          responseId = p.message?.id ?? responseId;
          actualModel = p.message?.model ?? actualModel;
          usage = { ...usage, ...p.message?.usage };
        }
        if (p.type === "content_block_start" && p.content_block?.type === "text") delta = p.content_block.text ?? "";
        if (p.type === "content_block_delta" && p.delta?.type === "text_delta") delta = p.delta.text ?? "";
        if (p.type === "message_delta") { finish = p.delta?.stop_reason ?? finish; usage = { ...usage, ...p.usage }; }
        if (p.type === "message_stop") done = true;
      } else {
        responseId = p.id ?? responseId;
        actualModel = p.model ?? actualModel;
        const ch = p.choices?.[0];
        if (typeof ch?.delta?.content === "string") delta = ch.delta.content;
        if (typeof ch?.delta?.refusal === "string" && ch.delta.refusal) { delta += ch.delta.refusal; refusal = true; }
        finish = ch?.finish_reason ?? finish;
        if (p.usage) usage = p.usage;
      }
      if (delta) {
        text += delta;
        if (text.length > 1_000_000) throw new Error("Response exceeded the 1 MB display limit; the stream was stopped.");
        firstToken ??= elapsed();
        send("tokens", { delta });
      }
    });
    if (!done) throw new Error("Provider stream disconnected before its completion marker. Partial output has been retained.");
    refusal ||= finish === "refusal";
    const payload = { finish_reason: finish || "not_reported", provider_refusal: refusal, usage,
      request_id: requestId, response_id: responseId, actual_model: actualModel, http_status: res.status,
      first_token_seconds: firstToken, duration_seconds: elapsed(), character_count: text.length };
    send("generation_end", payload, "Provider stream completed");
    send("verdict", { ...payload, verdict: responseStatus(text, finish, refusal) }, "Response recorded");
  } catch (error) {
    if (signal.aborted && signal.reason?.name !== "TimeoutError") return;
    send("error", { error: signal.reason?.name === "TimeoutError" ? "The request timed out after 240 seconds. Partial output has been retained." : clean(error instanceof Error ? error.message : error),
      request_id: requestId, http_status: httpStatus }, "Request failed");
  }
}
