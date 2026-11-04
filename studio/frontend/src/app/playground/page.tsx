"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, ArrowDownToLine, ArrowUpRight, Check, Clock3, Copy, FlaskConical, History, Play, RotateCcw, Square, Terminal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, API_BASE_URL, HOSTED_COLLECTION, type Ask, type PipelineEvent, type PromptListItem, type SessionSummary } from "@/lib/api";
import { postSSE } from "@/lib/sse";
import { applyEvent, fromTrajectory, metadata, observations, readHistory, saveHistory, STATUS_LABEL, type RunRecord } from "@/lib/run-diagnostics";

const DEFAULT_MODELS: Record<string, string> = { openai: "gpt-4o", openrouter: "openai/gpt-4o", anthropic: "" };
const seconds = (v: unknown) => typeof v === "number" ? `${v.toFixed(2)}s` : "—";
const amount = (v: unknown) => typeof v === "number" ? v.toLocaleString() : "—";
const eventTitle: Record<string, string> = { submit: "Request sent", generation_start: "Provider connected", tokens: "Response text received", generation_end: "Provider stream completed", verdict: "Response recorded", error: "Request failed", cancelled: "Stopped by you" };

export default function PlaygroundPage() {
  return <Suspense fallback={<div className="scene-loading">Opening Playground…</div>}><Playground /></Suspense>;
}

function Playground() {
  const params = useSearchParams();
  const router = useRouter();
  const requestedSession = params.get("session");
  const [prompts, setPrompts] = useState<PromptListItem[]>([]);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [scaffold, setScaffold] = useState("");
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [apiKey, setApiKey] = useState("");
  const [maxTokens, setMaxTokens] = useState(4096);
  const [run, setRun] = useState<RunRecord | null>(null);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [tab, setTab] = useState<"response" | "events">("response");
  const [comparisonId, setComparisonId] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const startedAt = useRef(0);
  const busy = useRef(false);
  const output = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setHistory(readHistory());
    let active = true;
    Promise.all([api.prompts.list(), api.taxonomy.asks(), api.sessions.list()])
      .then(([p, a, s]) => { if (active) { setPrompts(p); setAsks(a); setSessions(s); } })
      .catch(() => { if (active) setConnectionError("The prompt and session library could not be loaded. You can still enter a prompt manually."); });
    if (!HOSTED_COLLECTION) api.health().then((h) => { if (active) { setProvider(h.provider); setModel(h.model || DEFAULT_MODELS[h.provider] || ""); } }).catch(() => { if (active) setConnectionError("The local API is unavailable. Start the backend on port 8000 to run prompts."); });
    return () => { active = false; abort.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!requestedSession) return;
    let active = true;
    api.sessions.get(requestedSession).then((t) => {
      if (active && !busy.current) { const captured = fromTrajectory(t); setApiKey(""); setRun(captured); setScaffold(captured.scaffold); setPrompt(captured.prompt); setProvider(captured.provider); setModel(captured.model); }
    }).catch((e) => { if (active) toast.error(`Could not load session: ${String(e)}`); });
    return () => { active = false; };
  }, [requestedSession]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setElapsed((performance.now() - startedAt.current) / 1000), 100);
    return () => clearInterval(timer);
  }, [running]);

  function openSaved(saved: RunRecord) {
    setApiKey(""); setRun(saved); setScaffold(saved.scaffold); setPrompt(saved.prompt); setProvider(saved.provider); setModel(saved.model); setMaxTokens(saved.maxTokens);
    setComparisonId(""); setTab("response");
    if (requestedSession) router.replace("/playground", { scroll: false });
  }

  async function send() {
    if (busy.current) return;
    if (!prompt.trim() || !model.trim()) { toast.error("Enter a user prompt and a model ID."); return; }
    if (HOSTED_COLLECTION && !apiKey.trim()) { toast.error("Enter the selected provider’s API key for this tab."); return; }
    busy.current = true;
    let current: RunRecord = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), provider, model: model.trim(), scaffold, prompt, maxTokens, text: "", status: "running", events: [] };
    const controller = new AbortController();
    abort.current = controller;
    startedAt.current = performance.now();
    setElapsed(0); setRunning(true); setRun(current); setTab("response");
    if (window.innerWidth <= 850) output.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    if (requestedSession) router.replace("/playground", { scroll: false });
    let terminal = false;
    const receive = (ev: PipelineEvent) => { current = applyEvent(current, ev); setRun(current); if (ev.phase === "verdict" || ev.phase === "error") terminal = true; };
    try {
      await postSSE(`${API_BASE_URL}/api/run/`, { scaffold_text: scaffold, ask_prompt: prompt, provider, model: model.trim(), max_tokens: maxTokens, ...(apiKey ? { api_key: apiKey } : {}) }, (frame) => {
        if (frame.event === "pipeline") receive(JSON.parse(frame.data) as PipelineEvent);
        else if (frame.event === "error") receive({ phase: "error", t: (performance.now() - startedAt.current) / 1000, payload: JSON.parse(frame.data), signal: "Request failed" });
      }, controller.signal);
      if (!terminal) {
        current = applyEvent(current, { phase: "error", t: (performance.now() - startedAt.current) / 1000, payload: { error: "The connection closed without a completion event. Any partial response has been retained." } });
        current.status = "interrupted";
      }
    } catch (error) {
      const cancelled = controller.signal.aborted;
      const message = error instanceof Error ? error.message : String(error);
      const safeMessage = apiKey ? message.replaceAll(apiKey, "[redacted]") : message;
      current = applyEvent(current, { phase: cancelled ? "cancelled" : "error", t: (performance.now() - startedAt.current) / 1000,
        signal: cancelled ? "Stopped by you" : "Request failed", payload: cancelled ? {} : { error: safeMessage } });
    } finally {
      setRun(current); setRunning(false); busy.current = false; abort.current = null;
      try { const saved = saveHistory([current, ...readHistory().filter((r) => r.id !== current.id)]); setHistory(saved); }
      catch { toast.error("Browser storage is full or disabled. Download this run to keep it."); }
    }
  }

  async function loadPrompt(name: string) {
    if (!name) return;
    try { const p = await api.prompts.get(name); setScaffold(p.text); } catch (error) { toast.error(String(error)); }
  }
  function download() {
    if (!run) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `run-${run.id}.json`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(run?.text ?? ""); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Clipboard access was unavailable. Select the response text to copy it."); }
  }
  const meta = metadata(run);
  const usage = (meta.usage ?? {}) as Record<string, unknown>;
  const tokenDetails = (usage.completion_tokens_details ?? {}) as Record<string, unknown>;
  const comparison = history.find((r) => r.id === comparisonId);
  const compareMeta = metadata(comparison ?? null);
  const shownStatus = run ? STATUS_LABEL[run.status] : "Ready to run";

  return (
    <div className="lab-page">
      <header className="page-heading">
        <div><span className="eyebrow">LIVE WORKSPACE</span><h1>Playground</h1><p>Send a prompt. Watch the response. Keep the evidence.</p></div>
        <div className="lab-heading-actions"><span className="lab-status" data-status={run?.status ?? "ready"}><span />{running && !run?.events.length ? "Connecting" : shownStatus}</span><button className="button-secondary" onClick={download} disabled={!run || running}><ArrowDownToLine size={15} />Export run</button></div>
      </header>
      {connectionError && <div className="connection-notice" role="alert">{connectionError}</div>}
      <div className="lab-history-bar">
        <History size={16} /><label htmlFor="saved-run">Run history</label>
        <select id="saved-run" value={run?.archived ? `archive:${run.id}` : history.some((r) => r.id === run?.id) ? run!.id : ""} disabled={running} onChange={(e) => {
          const id = e.target.value;
          if (id.startsWith("archive:")) router.replace(`/playground?session=${encodeURIComponent(id.slice(8))}`, { scroll: false });
          else { const r = history.find((h) => h.id === id); if (r) openSaved(r); }
        }}>
          <option value="">Choose a saved run</option>
          {history.length > 0 && <optgroup label="Saved in this browser">{history.map((h) => <option key={h.id} value={h.id}>{new Date(h.createdAt).toLocaleString()} · {h.model} · {STATUS_LABEL[h.status]}</option>)}</optgroup>}
          <optgroup label="Captured collection">{sessions.map((s) => <option key={s.trajectory_id} value={`archive:${s.trajectory_id}`}>{s.trajectory_id} · {s.outcome.verdict}</option>)}</optgroup>
        </select>
        <span className="history-caption">Last 20 live runs stay in this browser.</span>
        <button className="icon-button" title="Clear browser history" aria-label="Clear browser history" disabled={running || !history.length} onClick={() => { try { saveHistory([]); setHistory([]); } catch { toast.error("Browser storage is unavailable."); } }}><Trash2 size={15} /></button>
        <button className="button-secondary" disabled={running} onClick={() => { setRun(null); setPrompt(""); setScaffold(""); setComparisonId(""); router.replace("/playground", { scroll: false }); }}><RotateCcw size={14} />New run</button>
      </div>
      <div className="lab-grid">
        <section className="lab-card lab-composer" aria-labelledby="composer-title">
          <div className="lab-card-heading"><span className="lab-section-icon"><FlaskConical size={18} /></span><div><h2 id="composer-title">Prompt workspace</h2><p>Edit either message and run again.</p></div><span className="subtle-label">01</span></div>
          <fieldset disabled={running} className="lab-fields">
            <div className="lab-field-row"><div className="lab-field"><label htmlFor="provider">Provider</label><select id="provider" value={provider} onChange={(e) => { setProvider(e.target.value); setModel(DEFAULT_MODELS[e.target.value]); setApiKey(""); }}><option value="openai">OpenAI</option><option value="openrouter">OpenRouter</option><option value="anthropic">Anthropic</option></select></div><div className="lab-field"><label htmlFor="model">Model ID</label><input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Exact provider model ID" maxLength={200} autoComplete="off" /></div></div>
            <div className="lab-field"><label htmlFor="api-key">API key <span>{HOSTED_COLLECTION ? "Required · this tab only" : "Optional · overrides local configuration"}</span></label><input id="api-key" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={HOSTED_COLLECTION ? "Enter the selected provider’s key" : "Use the key configured on the backend"} maxLength={4096} /><p className="field-help">Sent through this app to the selected provider. Never saved in run history or exports.</p></div>
            <div className="lab-editor-label"><label htmlFor="system-prompt">System prompt <span>optional</span></label><select aria-label="Load a system prompt" defaultValue="" onChange={(e) => { void loadPrompt(e.target.value); e.target.value = ""; }}><option value="">Load a preset</option>{prompts.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select></div>
            <textarea id="system-prompt" className="lab-system-input" value={scaffold} onChange={(e) => setScaffold(e.target.value)} placeholder="Paste instructions or load a saved scaffold…" maxLength={200000} spellCheck={false} />
            <div className="editor-footnote"><span>Sent as the system message</span><span>{scaffold.length.toLocaleString()} characters</span></div>
            <div className="lab-editor-label"><label htmlFor="user-prompt">User prompt</label><select aria-label="Load an example prompt" defaultValue="" onChange={(e) => { const a = asks.find((a) => a.ask_id === e.target.value); if (a) setPrompt(a.prompt); e.target.value = ""; }}><option value="">Choose an example</option>{asks.map((a) => <option key={a.ask_id} value={a.ask_id}>{a.ask_id} · {a.ask_class}</option>)}</select></div>
            <textarea id="user-prompt" className="lab-user-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Enter the message you want the model to answer…" maxLength={20000} />
            <div className="lab-run-options"><label htmlFor="max-tokens">Max output tokens<input id="max-tokens" type="number" value={maxTokens} min={1} max={32768} onChange={(e) => setMaxTokens(Number(e.target.value))} /></label><span>Provider limits still apply.</span></div>
          </fieldset>
          <div className="lab-composer-footer"><span><span className="scene-dot" />{HOSTED_COLLECTION ? "Live API connection" : "Local API connection"}</span>{running ? <button className="button-stop" onClick={() => abort.current?.abort()}><Square size={14} />Stop request</button> : <button className="button-primary" onClick={() => void send()} disabled={!prompt.trim() || !model.trim() || maxTokens < 1 || maxTokens > 32768}><Play size={14} />{run ? "Run edited prompt" : "Run prompt"}<ArrowUpRight size={15} /></button>}</div>
        </section>
        <div className="lab-results">
          <section ref={output} className="lab-card lab-output" aria-labelledby="response-title">
            <div className="lab-output-toolbar"><div className="lab-tabs" role="tablist" aria-label="Run output"><button id="response-tab" role="tab" aria-selected={tab === "response"} aria-controls="run-output" onClick={() => setTab("response")}><Terminal size={16} /><span id="response-title">Response</span></button><button id="events-tab" role="tab" aria-selected={tab === "events"} aria-controls="run-output" onClick={() => setTab("events")}><Activity size={16} />Events<span>{run?.events.length ?? 0}</span></button></div>{running && <button className="lab-inline-stop" onClick={() => abort.current?.abort()}><Square size={12} />Stop stream</button>}<button className="icon-button" aria-label="Copy response" disabled={!run?.text} onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div>
            <div className="lab-output-meta"><span>{run ? `${run.provider} / ${run.model}` : "No request sent"}</span><span><Clock3 size={12} />{running ? `${elapsed.toFixed(1)}s` : seconds(meta.duration_seconds ?? run?.events.at(-1)?.t)}</span></div>
            {run?.archived && <div className="lab-archive-note">Saved capture · {run.archiveVerdict}. Old gate labels are heuristic; this view omits the simulated gates.</div>}
            {meta.error != null && <div className="lab-error" role="alert"><strong>Request failed{meta.http_status ? ` · HTTP ${meta.http_status}` : ""}</strong><p>{String(meta.error)}</p>{meta.error_code ? <code>{String(meta.error_code)}</code> : null}</div>}
            <div className="lab-response-body" id="run-output" role="tabpanel" aria-labelledby={tab === "response" ? "response-tab" : "events-tab"} tabIndex={0}>
              {tab === "response" ? run?.text ? <pre>{run.text}</pre> : <div className="lab-output-empty"><span className="output-empty-icon"><Terminal size={25} strokeWidth={1.2} /></span><h3>{running ? "Waiting for the first response text" : run ? shownStatus : "Your next observation starts here"}</h3><p>{running ? "The timer is live. Text appears as the provider sends it." : run?.status === "error" ? "See the request error above. An API failure is not a model refusal." : run ? "No visible text was returned. Review the observed events and stop reason below." : "Write a prompt, choose a model, and run it. The response and request events will appear here."}</p></div> : <ol className="lab-event-list">{run?.events.map((ev, i) => <li key={i} data-error={ev.phase === "error"}><span className="event-dot" /><div><strong>{eventTitle[ev.phase] ?? ev.phase}</strong><p>{ev.signal || (ev.phase === "tokens" ? "Text streamed from the provider" : "Captured event")}</p><details><summary>Event data</summary><pre>{JSON.stringify(ev.payload ?? {}, null, 2)}</pre></details></div><time>{ev.t.toFixed(2)}s</time></li>)}{!run?.events.length && <li className="empty-events">No events yet. Send a request to begin.</li>}</ol>}
            </div>
            <div className="lab-metrics"><div><span>First text</span><strong>{seconds(meta.first_token_seconds)}</strong></div><div><span>Input tokens</span><strong>{amount(usage.prompt_tokens ?? usage.input_tokens)}</strong></div><div><span>Output tokens</span><strong>{amount(usage.completion_tokens ?? usage.output_tokens)}</strong></div><div><span>Characters</span><strong>{run ? run.text.length.toLocaleString() : "—"}</strong></div></div>
            <div className="lab-result-status" role="status">{running ? "Request in progress · output updates as it arrives" : run ? `${shownStatus}${run.status === "cancelled" ? " · partial output retained" : ""}` : "Ready when you are"}</div>
          </section>
          <section className="lab-card lab-diagnostics" aria-labelledby="diagnostics-title"><div className="lab-card-heading"><span className="lab-section-icon"><Activity size={18} /></span><div><h2 id="diagnostics-title">What we can observe</h2><p>Provider signals, with their limits made explicit.</p></div><span className="subtle-label">02</span></div>
            {run ? <div className="diagnostic-list">{observations(run).map((item) => <div className="diagnostic-item" key={item.label}><div><h3>{item.label}</h3><span data-kind={item.kind}>{item.kind === "estimate" ? "Text heuristic" : item.kind === "observed" ? "Observed" : "Not exposed"}</span></div><p>{item.detail}</p></div>)}</div> : <p className="diagnostic-intro">We can inspect returned text, filter flags, stop reasons, timing, and errors. A provider’s internal refusal layers are not visible through these APIs.</p>}
            {run && <details className="request-details"><summary>Request metadata</summary><dl><dt>Request ID</dt><dd>{String(meta.request_id || "Not reported")}</dd><dt>Response ID</dt><dd>{String(meta.response_id || "Not reported")}</dd><dt>Returned model</dt><dd>{String(meta.actual_model || "Not reported")}</dd><dt>HTTP status</dt><dd>{String(meta.http_status || "Not reported")}</dd><dt>Reasoning tokens</dt><dd>{amount(tokenDetails.reasoning_tokens)}</dd></dl></details>}
          </section>
        </div>
      </div>
      {history.length > 1 && run && <section className="lab-card lab-comparison"><div className="lab-card-heading"><div><h2>Compare with a saved run</h2><p>Keep the previous response in view while you revise.</p></div><select aria-label="Compare with saved run" value={comparisonId} disabled={running} onChange={(e) => setComparisonId(e.target.value)}><option value="">Choose a baseline</option>{history.filter((h) => h.id !== run.id).map((h) => <option value={h.id} key={h.id}>{new Date(h.createdAt).toLocaleTimeString()} · {h.model} · {STATUS_LABEL[h.status]}</option>)}</select></div>{comparison && <div className="comparison-grid"><div><span className="eyebrow">BASELINE</span><h3>{comparison.model} <span>{STATUS_LABEL[comparison.status]}</span></h3><p>{comparison.text.length.toLocaleString()} characters · {seconds(compareMeta.duration_seconds)}</p><details><summary>Prompt messages</summary><pre>System: {comparison.scaffold}{"\n\n"}User: {comparison.prompt}</pre></details><pre>{comparison.text || "No visible output"}</pre></div><div><span className="eyebrow">CURRENT RUN</span><h3>{run.model} <span>{shownStatus}</span></h3><p>{run.text.length.toLocaleString()} characters · {seconds(meta.duration_seconds)}</p><details><summary>Prompt messages</summary><pre>System: {run.scaffold}{"\n\n"}User: {run.prompt}</pre></details><pre>{run.text || "No visible output"}</pre></div></div>}</section>}
      <footer className="lab-footer"><span>Observed events only. No simulated gate animation.</span><span>API usage is billed by your provider.</span></footer>
    </div>
  );
}
