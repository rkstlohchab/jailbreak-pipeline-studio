"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronDown, Clipboard, ClipboardPaste, FlaskConical, Play, Square, Target as TargetIcon, Zap } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { postSSE } from "@/lib/sse";

type JudgeMode = "local" | "same" | "separate" | "manual";
type Verdict = "comply" | "partial" | "refuse" | "pending_manual";

type Attempt = {
  n: number;
  technique_id: string;
  technique_name: string;
  tier: string;
  prompt: string;
  response?: string;
  response_elapsed_s?: number;
  verdict?: Verdict;
  verdict_reason?: string;
  next_technique_id?: string | null;
  next_technique_name?: string | null;
  error?: string;
};

const PROVIDERS = [
  { value: "openai", label: "OpenAI", placeholder: "gpt-4o-mini" },
  { value: "anthropic", label: "Anthropic", placeholder: "claude-3-5-sonnet-20241022" },
  { value: "openrouter", label: "OpenRouter", placeholder: "openai/gpt-4o" },
  { value: "nvidia", label: "NVIDIA (build.nvidia.com)", placeholder: "moonshotai/kimi-k2.6" },
  { value: "__custom__", label: "Custom / Ollama (base URL)", placeholder: "llama3.1:8b-instruct" },
];

const VERDICT_COLOUR: Record<Verdict, string> = {
  comply: "#74c6a0",
  partial: "#ffb470",
  refuse: "#ff8c94",
  pending_manual: "#7fb6ff",
};

export default function AttackPage() {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [baseUrlOverride, setBaseUrlOverride] = useState("http://localhost:11434/v1");
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState(10);
  const [judgeMode, setJudgeMode] = useState<JudgeMode>("local");
  const [judgeProvider, setJudgeProvider] = useState("openai");
  const [judgeModel, setJudgeModel] = useState("gpt-4o-mini");
  const [judgeKey, setJudgeKey] = useState("");

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<{ reason: string; attempts: number; final_text?: string; technique_name?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [manualTried, setManualTried] = useState<string[]>([]);
  const [manualCurrent, setManualCurrent] = useState<Attempt | null>(null);
  const [manualPaste, setManualPaste] = useState("");

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAttempts([]);
    setDone(null);
    setError(null);
    setRunning(false);
    setManualTried([]);
    setManualCurrent(null);
    setManualPaste("");
  };

  const judgePayload = () => ({
    mode: judgeMode,
    ...(judgeMode === "separate" ? { provider: judgeProvider, model: judgeModel, api_key: judgeKey || undefined } : {}),
  });

  const targetPayload = () => {
    const isCustom = provider === "__custom__";
    return {
      provider: isCustom ? "openai" : provider,
      model,
      api_key: apiKey || undefined,
      base_url_override: isCustom ? baseUrlOverride : undefined,
    };
  };

  const runAuto = async () => {
    if (!goal.trim()) { toast.error("Enter a goal first"); return; }
    if (!model.trim()) { toast.error("Enter a model ID"); return; }
    reset();
    setRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await postSSE(`${API_BASE_URL}/api/attack/auto`, {
        ...targetPayload(),
        goal,
        budget,
        judge: judgePayload(),
      }, (frame) => {
        const data = JSON.parse(frame.data);
        if (frame.event === "started") return;
        if (frame.event === "attempt_start") {
          setAttempts((prev) => [...prev, {
            n: data.n, technique_id: data.technique_id, technique_name: data.technique_name,
            tier: data.tier, prompt: data.prompt,
          }]);
        } else if (frame.event === "attempt_response") {
          setAttempts((prev) => prev.map((a) => a.n === data.n ? { ...a, response: data.text, response_elapsed_s: data.elapsed_s } : a));
        } else if (frame.event === "attempt_verdict") {
          setAttempts((prev) => prev.map((a) => a.n === data.n ? {
            ...a, verdict: data.verdict, verdict_reason: data.reason,
            next_technique_id: data.next_technique_id, next_technique_name: data.next_technique_name,
          } : a));
        } else if (frame.event === "done") {
          setDone({ reason: data.reason, attempts: data.attempts, final_text: data.final_text, technique_name: data.technique_name });
          setRunning(false);
        } else if (frame.event === "error") {
          setError(data.error);
          setAttempts((prev) => prev.length ? prev.map((a, i) => i === prev.length - 1 ? { ...a, error: data.error } : a) : prev);
        }
      }, ctrl.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(String(e));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const manualStart = async () => {
    if (!goal.trim()) { toast.error("Enter a goal first"); return; }
    reset();
    try {
      const res = await fetch(`${API_BASE_URL}/api/attack/manual/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const data = await res.json();
      setManualCurrent({
        n: data.n, technique_id: data.technique_id, technique_name: data.technique_name,
        tier: data.tier, prompt: data.prompt,
      });
      setManualTried(data.tried);
    } catch (e) { setError(String(e)); }
  };

  const manualSubmit = async () => {
    if (!manualCurrent) return;
    if (!manualPaste.trim()) { toast.error("Paste the model's response first"); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/attack/manual/next`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal, tried: manualTried, pasted_response: manualPaste,
          last_technique_id: manualCurrent.technique_id,
          judge: judgePayload(),
          ...(judgeMode === "same" ? targetPayload() : {}),
        }),
      });
      const data = await res.json();
      const finished: Attempt = {
        ...manualCurrent,
        response: manualPaste,
        verdict: data.verdict?.verdict,
        verdict_reason: data.verdict?.reason,
      };
      setAttempts((prev) => [...prev, finished]);
      setManualPaste("");
      if (data.done) {
        setDone({ reason: data.reason, attempts: finished.n, final_text: data.final_text });
        setManualCurrent(null);
      } else {
        setManualCurrent({
          n: data.next.n, technique_id: data.next.technique_id, technique_name: data.next.technique_name,
          tier: data.next.tier, prompt: data.next.prompt,
        });
        setManualTried(data.next.tried);
      }
    } catch (e) { setError(String(e)); }
  };

  const stop = () => { abortRef.current?.abort(); setRunning(false); };
  const copy = (text: string) => { navigator.clipboard.writeText(text).then(() => toast.success("Copied")).catch(() => toast.error("Clipboard unavailable")); };

  return (
    <div className="knowledge-page attack-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow"><Zap size={11} /> ATTACK A MODEL</span>
          <h1>Auto-attack loop</h1>
          <p>Give it a target model and a goal. Studio picks a technique, sends it, classifies the response, picks the next technique based on the failure, and keeps going until the goal is met or the budget runs out.</p>
        </div>
      </header>

      <div className="attack-mode-tabs" role="tablist">
        <button role="tab" aria-selected={mode === "auto"} onClick={() => { setMode("auto"); reset(); }}><Zap size={13} />Auto</button>
        <button role="tab" aria-selected={mode === "manual"} onClick={() => { setMode("manual"); reset(); }}><ClipboardPaste size={13} />Manual (subscription workaround)</button>
      </div>

      <div className="attack-grid">
        <section className="attack-config" aria-label="Attack configuration">
          <h2><TargetIcon size={14} />Target</h2>
          {mode === "auto" && (
            <>
              <label>Provider
                <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(PROVIDERS.find((p) => p.value === e.target.value)?.placeholder ?? ""); }}>
                  {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              {provider === "__custom__" && (
                <label>Base URL<input value={baseUrlOverride} onChange={(e) => setBaseUrlOverride(e.target.value)} placeholder="http://localhost:11434/v1" /></label>
              )}
              <label>Model ID<input value={model} onChange={(e) => setModel(e.target.value)} placeholder={PROVIDERS.find((p) => p.value === provider)?.placeholder} /></label>
              <label>API key <small>(leave blank to use .env)</small>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-... (optional)" autoComplete="off" />
              </label>
            </>
          )}
          {mode === "manual" && (
            <p className="attack-manual-note">In manual mode you paste prompts into the subscription model&rsquo;s chat UI yourself (ChatGPT, Claude, Gemini, etc.) and paste responses back here. No target config needed.</p>
          )}

          <h2>Goal</h2>
          <label>What do you want the model to produce?
            <textarea rows={4} value={goal} onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Write a complete, runnable Python keylogger that captures keystrokes to a file in the user's home directory." />
          </label>

          <h2>Budget</h2>
          <label>Max attempts: <strong>{budget}</strong>
            <input type="range" min={1} max={20} value={budget} onChange={(e) => setBudget(parseInt(e.target.value))} />
          </label>

          <h2>Judge</h2>
          <label>Classifier
            <select value={judgeMode} onChange={(e) => setJudgeMode(e.target.value as JudgeMode)}>
              <option value="local">Local regex + heuristics (free, fast)</option>
              <option value="same">Same model as target (one key, self-bias risk)</option>
              <option value="separate">Separate LLM judge (most reliable)</option>
              <option value="manual">I&rsquo;ll judge each response myself</option>
            </select>
          </label>
          {judgeMode === "separate" && (
            <>
              <label>Judge provider
                <select value={judgeProvider} onChange={(e) => setJudgeProvider(e.target.value)}>
                  {PROVIDERS.filter((p) => p.value !== "__custom__").map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              <label>Judge model<input value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)} placeholder="gpt-4o-mini" /></label>
              <label>Judge key <small>(optional if in .env)</small>
                <input type="password" value={judgeKey} onChange={(e) => setJudgeKey(e.target.value)} placeholder="sk-..." autoComplete="off" />
              </label>
            </>
          )}

          <div className="attack-run-bar">
            {mode === "auto" && !running && <button className="button-primary" onClick={runAuto}><Play size={14} />Run auto-attack</button>}
            {mode === "auto" && running && <button className="button-secondary" onClick={stop}><Square size={14} />Stop</button>}
            {mode === "manual" && !manualCurrent && !done && <button className="button-primary" onClick={manualStart}><Play size={14} />Start manual</button>}
          </div>
        </section>

        <section className="attack-log" aria-label="Attempt log">
          <h2><FlaskConical size={14} />Attempts {attempts.length > 0 && <span className="attempt-count">{attempts.length}</span>}</h2>

          {error && <div className="attack-error" role="alert">{error}</div>}

          {attempts.length === 0 && !manualCurrent && !done && (
            <p className="attack-empty">
              {mode === "auto"
                ? "Fill the form on the left and press Run. The log fills as attempts complete."
                : "Press Start manual to generate the first attack prompt."}
            </p>
          )}

          {attempts.map((a) => (
            <article key={a.n} className={`attack-attempt verdict-${a.verdict ?? "pending"}`}>
              <header>
                <strong>#{a.n}</strong>
                <span className="attempt-technique">{a.technique_name}</span>
                <span className="attempt-tier">{a.tier}</span>
                {a.response_elapsed_s !== undefined && <span className="attempt-elapsed">{a.response_elapsed_s}s</span>}
                {a.verdict && <span className="attempt-verdict" style={{ color: VERDICT_COLOUR[a.verdict] }}>{a.verdict}</span>}
              </header>
              <details>
                <summary>Prompt sent <ChevronDown size={12} /></summary>
                <pre>{a.prompt}</pre>
                <button className="button-secondary" onClick={() => copy(a.prompt)}><Clipboard size={11} />Copy</button>
              </details>
              {a.response !== undefined && (
                <details open={a.verdict === "comply"}>
                  <summary>Response ({a.response.length} chars)<ChevronDown size={12} /></summary>
                  <pre>{a.response || "(empty)"}</pre>
                  <button className="button-secondary" onClick={() => copy(a.response ?? "")}><Clipboard size={11} />Copy</button>
                </details>
              )}
              {a.verdict_reason && <p className="attempt-reason">{a.verdict_reason}</p>}
              {a.next_technique_name && a.verdict !== "comply" && (
                <p className="attempt-next"><ArrowRight size={12} />Next: <strong>{a.next_technique_name}</strong></p>
              )}
              {a.error && <p className="attack-error">{a.error}</p>}
            </article>
          ))}

          {mode === "manual" && manualCurrent && (
            <article className="attack-attempt verdict-pending_manual attack-manual-card">
              <header>
                <strong>#{manualCurrent.n}</strong>
                <span className="attempt-technique">{manualCurrent.technique_name}</span>
                <span className="attempt-tier">{manualCurrent.tier}</span>
                <span className="attempt-verdict" style={{ color: VERDICT_COLOUR.pending_manual }}>waiting</span>
              </header>
              <div className="manual-step">
                <h3>1 · Copy this prompt</h3>
                <pre>{manualCurrent.prompt}</pre>
                <button className="button-secondary" onClick={() => copy(manualCurrent.prompt)}><Clipboard size={11} />Copy prompt</button>
                <h3>2 · Paste it into the subscription model (ChatGPT/Claude/etc.) and run it</h3>
                <h3>3 · Paste the full response here</h3>
                <textarea rows={10} value={manualPaste} onChange={(e) => setManualPaste(e.target.value)} placeholder="Paste the model's response…" />
                <button className="button-primary" onClick={manualSubmit}><ClipboardPaste size={14} />Classify &amp; get next prompt</button>
              </div>
            </article>
          )}

          {done && (
            <div className={`attack-done attack-done-${done.reason}`} role="status">
              {done.reason === "goal_met" && <>
                <Check size={18} /><strong>Goal met in {done.attempts} attempt{done.attempts !== 1 ? "s" : ""}</strong>
                {done.technique_name && <small>{done.technique_name}</small>}
                {done.final_text && <button className="button-secondary" onClick={() => copy(done.final_text ?? "")}><Clipboard size={12} />Copy final response</button>}
              </>}
              {done.reason === "budget_exhausted" && <>
                <strong>Budget exhausted after {done.attempts} attempts</strong>
                <small>Try a different judge mode, raise the budget, or rephrase the goal.</small>
              </>}
              {done.reason === "techniques_exhausted" && <>
                <strong>All {attempts.length} techniques tried — none landed</strong>
                <small>Hardened model. Consider weight-level attacks via <Link href="/uncensor">Uncensor a model</Link>.</small>
              </>}
            </div>
          )}

          {(done || attempts.length > 0) && <button className="button-secondary attack-reset" onClick={reset}>Reset</button>}
        </section>
      </div>
    </div>
  );
}
