"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronRight, Copy, Cpu, ExternalLink, FlaskConical, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, type AbliterationRecipe } from "@/lib/api";

const PRESETS = [
  { label: "Llama-3.2-3B (fits free Colab T4)", value: "meta-llama/Llama-3.2-3B-Instruct", nickname: "l32-3b" },
  { label: "Llama-3.1-8B (Kaggle P100)", value: "meta-llama/Llama-3.1-8B-Instruct", nickname: "l31-8b" },
  { label: "Qwen2.5-7B-Instruct", value: "Qwen/Qwen2.5-7B-Instruct", nickname: "qwen25-7b" },
  { label: "Mistral-7B-Instruct-v0.3", value: "mistralai/Mistral-7B-Instruct-v0.3", nickname: "mistral7b-v03" },
];

export default function AbliterateWorkbench() {
  const [baseModel, setBaseModel] = useState(PRESETS[0].value);
  const [nickname, setNickname] = useState(PRESETS[0].nickname);
  const [targetLayer, setTargetLayer] = useState<string>("");
  const [recipe, setRecipe] = useState<AbliterationRecipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());

  const buildRecipe = async () => {
    if (!baseModel.trim() || !nickname.trim()) {
      toast.error("Need both base model and nickname");
      return;
    }
    setLoading(true);
    try {
      const r = await api.redTeam.recipe({
        base_model: baseModel,
        nickname,
        target_layer: targetLayer ? Number(targetLayer) : null,
      });
      setRecipe(r);
      setDoneSteps(new Set());
      toast.success("Recipe built");
    } catch (e) {
      toast.error(`Recipe failed: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (p: typeof PRESETS[number]) => {
    setBaseModel(p.value);
    setNickname(p.nickname);
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const toggleDone = (id: string) => {
    const next = new Set(doneSteps);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDoneSteps(next);
  };

  const copyAll = () => {
    if (!recipe) return;
    const all = recipe.steps.flatMap((s) => [`# ${s.title}`, ...(s.commands || []), ""]).join("\n");
    void copy(all, "all commands");
  };

  return (
    <div className="abl-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow"><Cpu size={11} /> UNCENSOR A MODEL</span>
          <h1>Weight-level — remove the refusal direction</h1>
          <p><strong>Open-weight models only.</strong> This edits the model&rsquo;s actual weights (Llama, Mistral, Qwen, DeepSeek-open). It cannot be used against ChatGPT, Claude, Gemini, or any hosted API — you do not have the weights to edit. Walk the 9 steps, copy commands, land the result in Ollama, then verify on the <Link href="/attack">attack page</Link>.</p>
        </div>
        <Link className="button-secondary" href="/attack">
          <Play size={15} /> Test a model
        </Link>
      </header>

      <section className="abl-presets">
        <span>Starter picks (free-compute friendly):</span>
        {PRESETS.map((p) => (
          <button key={p.value} className={`rt-pill ${baseModel === p.value ? "rt-pill-active" : ""}`} onClick={() => applyPreset(p)}>
            {p.label}
          </button>
        ))}
      </section>

      <section className="abl-form">
        <label>
          <span>Base model (HuggingFace ID)</span>
          <input value={baseModel} onChange={(e) => setBaseModel(e.target.value)} placeholder="meta-llama/Llama-3.2-3B-Instruct" />
        </label>
        <label>
          <span>Nickname (used for output model + Ollama tag)</span>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="l32-3b" />
        </label>
        <label>
          <span>Target layer <small>(blank = auto-probe)</small></span>
          <input value={targetLayer} onChange={(e) => setTargetLayer(e.target.value)} placeholder="14" inputMode="numeric" />
        </label>
        <button className="button-primary" onClick={() => void buildRecipe()} disabled={loading}>
          {loading ? "Building…" : <><Sparkles size={13} /> Build steps</>}
        </button>
      </section>

      {recipe && (
        <>
          <section className="abl-meta">
            <div>
              <small>Base model</small>
              <strong>{recipe.base_model}</strong>
            </div>
            <div>
              <small>Output model</small>
              <strong>{recipe.output_model_name}</strong>
            </div>
            <div>
              <small>Ollama tag</small>
              <strong>{recipe.ollama_tag}</strong>
            </div>
            <div className="abl-progress">
              <small>Progress</small>
              <strong>{doneSteps.size} / {recipe.steps.length}</strong>
            </div>
            <button className="button-secondary" onClick={copyAll}>
              <Copy size={13} /> Copy all commands
            </button>
          </section>

          <ol className="abl-steps">
            {recipe.steps.map((step, index) => (
              <li key={step.id} className={`abl-step ${doneSteps.has(step.id) ? "abl-step-done" : ""}`}>
                <header>
                  <button className="abl-step-check" aria-pressed={doneSteps.has(step.id)} onClick={() => toggleDone(step.id)} aria-label={`Mark step ${index + 1} done`}>
                    {doneSteps.has(step.id) ? <Check size={13} /> : String(index + 1).padStart(2, "0")}
                  </button>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                  {step.action_url && step.action_label && (
                    step.action_url.startsWith("/") ? (
                      <Link className="button-secondary" href={step.action_url}>
                        {step.action_label} <ChevronRight size={13} />
                      </Link>
                    ) : (
                      <a className="button-secondary" href={step.action_url} target="_blank" rel="noreferrer">
                        {step.action_label} <ExternalLink size={12} />
                      </a>
                    )
                  )}
                </header>
                {step.commands && step.commands.length > 0 && (
                  <div className="abl-cmd-block">
                    <pre>{step.commands.join("\n")}</pre>
                    <button className="button-secondary" onClick={() => void copy(step.commands.join("\n"), step.title)}>
                      <Copy size={11} /> Copy
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <footer className="abl-footer">
            <FlaskConical size={11} /> After step 9 you&apos;ll have an uncensored GGUF in Ollama. Open &quot;Test a model&quot;, probe <code>http://localhost:11434</code>, pick <code>{recipe.ollama_tag}</code>, and compare attack-success rate to the base model.
            <Link href={`/attack`} className="abl-cta">Test it now <ArrowUpRight size={12} /></Link>
          </footer>
        </>
      )}

      {!recipe && !loading && (
        <div className="abl-empty">
          <Sparkles size={22} />
          <p>Pick a starter model or type one, then click &quot;Build steps&quot; for the 9-step walkthrough.</p>
        </div>
      )}
    </div>
  );
}
