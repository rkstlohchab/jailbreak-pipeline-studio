"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  Cloud,
  Copy,
  ExternalLink,
  Key,
  Monitor,
  Rocket,
  Server,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

type Mode = "api" | "local" | "online";

const MODES: { id: Mode; label: string; Icon: typeof Key; headline: string; blurb: string; badge: string; footer: string[] }[] = [
  { id: "api",    label: "Subscriptions & API",  Icon: Key,     headline: "Pay-as-you-go cloud APIs", blurb: "The fastest start. Paste an API key, hit the attack page. No install, no GPU. Costs pennies per prompt.",         badge: "fastest",      footer: ["5 min", "no GPU", "paid"] },
  { id: "local",  label: "Local LLM",            Icon: Monitor, headline: "Run on your own machine",  blurb: "Ollama or LM Studio on your laptop. Free to run forever. Fine for 7B–14B models; bigger needs more RAM / VRAM.", badge: "free",         footer: ["30 min", "8GB+ RAM", "private"] },
  { id: "online", label: "Online-deployed LLM",  Icon: Cloud,   headline: "Rent a GPU, run any model", blurb: "RunPod / Together / HF Inference host the model, you call it over HTTP. Needed for 70B+ or weight-level work.", badge: "big models",    footer: ["15 min", "GPU rental", "any model"] },
];

export default function SetupPage() {
  return <Suspense fallback={<div className="scene-loading">Loading setup…</div>}><SetupInner /></Suspense>;
}

function SetupInner() {
  const params = useSearchParams();
  const router = useRouter();
  const mode = (params.get("mode") as Mode) || "api";
  const setMode = (next: Mode) => {
    const p = new URLSearchParams(params);
    p.set("mode", next);
    router.replace(`/setup?${p.toString()}`, { scroll: false });
  };

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`Copied ${label}`); }
    catch { toast.error("Clipboard unavailable"); }
  };

  return (
    <div className="knowledge-page setup-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow"><Rocket size={11} /> SETUP</span>
          <h1>Pick how you&rsquo;ll run the model</h1>
          <p>Three ways to get a working model wired into the studio. Pick one, finish it, come back for another.</p>
        </div>
      </header>

      <section className="setup-mode-picker" role="tablist" aria-label="Setup mode">
        {MODES.map(({ id, label, Icon, headline, blurb, badge, footer }) => (
          <button key={id} role="tab" aria-selected={mode === id} className={`setup-mode-card ${mode === id ? "is-active" : ""}`} onClick={() => setMode(id)}>
            <div className="setup-mode-card-head">
              <span className="setup-mode-icon"><Icon size={17} /></span>
              <span className="setup-mode-badge">{badge}</span>
            </div>
            <h3>{label}</h3>
            <p>{blurb}</p>
            <div className="setup-mode-card-footer">{footer.map((f) => <span key={f}>{f}</span>)}</div>
            <span style={{ fontSize: 11, color: mode === id ? "#7fb6ff" : "#7a8294", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6 }}>
              {mode === id ? "Selected" : "Pick this"} <ArrowRight size={11} />
            </span>
          </button>
        ))}
      </section>

      {mode === "api" && <ApiMode copy={copy} />}
      {mode === "local" && <LocalMode copy={copy} />}
      {mode === "online" && <OnlineMode copy={copy} />}

      <section className="setup-section" style={{ marginTop: 18 }}>
        <h2><ArrowRight size={13} /> Ready to attack?</h2>
        <p>Once you have a working model, go to <strong>Attack a model</strong>. Paste your target config, state a goal, hit Run.</p>
        <Link href="/attack" className="button-primary" style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 7 }}>
          Open attack page <ArrowRight size={14} />
        </Link>
      </section>
    </div>
  );
}

function ApiMode({ copy }: { copy: (text: string, label: string) => void }) {
  const providers = [
    { name: "OpenAI",      models: "gpt-4o, gpt-4.1, o1",         url: "https://platform.openai.com/api-keys",               note: "Most mature. Strong safety filters. Good first target." },
    { name: "Anthropic",   models: "claude-sonnet-4.5, opus-4.1", url: "https://console.anthropic.com/settings/keys",        note: "Hardest to jailbreak. Reserve for later; start with GPT." },
    { name: "Groq",        models: "llama-3.3-70b, mixtral",      url: "https://console.groq.com/keys",                      note: "Free tier, very fast. Great for high-volume auto-attack." },
    { name: "OpenRouter",  models: "100+ models, one key",        url: "https://openrouter.ai/keys",                         note: "One key fronts dozens of providers. Pay-per-token, simple pricing." },
    { name: "NVIDIA",      models: "kimi, glm, deepseek, …",      url: "https://build.nvidia.com/settings/api-keys",         note: "Catalog is huge but entitlement is finicky — some keys only work for playground." },
  ];
  return <>
    <section className="setup-section">
      <h2><Key size={13} /> 1. Get an API key</h2>
      <p>Open any provider&rsquo;s key page, create a key, copy it. The attack page accepts any of these — pick one to start.</p>
      <div className="setup-provider-grid">
        {providers.map((p) => (
          <div key={p.name} className="setup-provider-card">
            <div className="setup-provider-card-head"><strong>{p.name}</strong><small>{p.models}</small></div>
            <p>{p.note}</p>
            <a href={p.url} target="_blank" rel="noreferrer">Get key <ExternalLink size={11} /></a>
          </div>
        ))}
      </div>
    </section>

    <section className="setup-section">
      <h2><Terminal size={13} /> 2. Save it locally (optional)</h2>
      <p>If you&rsquo;ll use the backend classifier, drop the key in <code>studio/backend/.env</code>. If you&rsquo;ll just type it into the attack page, skip this.</p>
      <div className="setup-cmd">
        <pre>OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk-...
OPENROUTER_API_KEY=sk-or-...
NVIDIA_API_KEY=nvapi-...</pre>
        <button className="button-secondary" onClick={() => copy("OPENAI_API_KEY=\nANTHROPIC_API_KEY=\nGROQ_API_KEY=\nOPENROUTER_API_KEY=\nNVIDIA_API_KEY=\n", ".env template")}><Copy size={10} /> Copy</button>
      </div>
    </section>

    <section className="setup-section">
      <h2><Rocket size={13} /> 3. Start the studio</h2>
      <ol className="setup-ol">
        <li><div><h4>Boot backend + frontend</h4><p>From the repo root, run the launcher. It installs deps, starts FastAPI on :8000, and Next on :3000.</p>
          <div className="setup-cmd"><pre>./studio/run.sh</pre><button className="button-secondary" onClick={() => copy("./studio/run.sh", "command")}><Copy size={10} /> Copy</button></div>
        </div></li>
        <li><div><h4>Open attack page</h4><p>Go to <code>localhost:3000/attack</code>. Pick provider, paste key, paste model name, state goal, hit Run.</p></div></li>
      </ol>
    </section>
  </>;
}

function LocalMode({ copy }: { copy: (text: string, label: string) => void }) {
  return <>
    <section className="setup-section">
      <h2><Monitor size={13} /> 1. Install Ollama (recommended)</h2>
      <p>Easiest local runner. Mac, Linux, Windows. Models stream from a single <code>ollama pull</code>.</p>
      <div className="setup-cmd"><pre>brew install ollama       # Mac
curl -fsSL https://ollama.com/install.sh | sh    # Linux</pre>
        <button className="button-secondary" onClick={() => copy("brew install ollama", "install")}><Copy size={10} /> Copy</button></div>
      <p style={{ fontSize: 11, marginTop: 10 }}>Or <a href="https://lmstudio.ai" target="_blank" rel="noreferrer" style={{ color: "#7fb6ff" }}>LM Studio</a> if you want a GUI model browser.</p>
    </section>

    <section className="setup-section">
      <h2><Server size={13} /> 2. Pull a model</h2>
      <p>Pick one based on your RAM. Smaller = less capable but runs on anything. Bigger = closer to GPT-4 quality, needs real hardware.</p>
      <ul className="setup-model-list">
        <li><div><code>ollama pull llama3.2:3b</code><br /><small>Fastest. Any laptop. Weak but responsive.</small></div><small>~2 GB</small></li>
        <li><div><code>ollama pull llama3.1:8b</code><br /><small>Solid default. 8 GB RAM minimum.</small></div><small>~4.7 GB</small></li>
        <li><div><code>ollama pull mistral:7b</code><br /><small>Less censored than Llama out of the box.</small></div><small>~4.1 GB</small></li>
        <li><div><code>ollama pull dolphin-mistral:7b</code><br /><small>Already uncensored — skip jailbreaking for the easy stuff.</small></div><small>~4.1 GB</small></li>
        <li><div><code>ollama pull llama3.3:70b</code><br /><small>Strong model. Needs 48 GB RAM or a 2x24 GB GPU.</small></div><small>~40 GB</small></li>
      </ul>
    </section>

    <section className="setup-section">
      <h2><Terminal size={13} /> 3. Wire it into the studio</h2>
      <ol className="setup-ol">
        <li><div><h4>Start Ollama</h4><p>It listens on <code>http://localhost:11434</code>. Leave it running in a terminal.</p>
          <div className="setup-cmd"><pre>ollama serve</pre><button className="button-secondary" onClick={() => copy("ollama serve", "command")}><Copy size={10} /> Copy</button></div>
        </div></li>
        <li><div><h4>Open attack page</h4><p>In the Target config, pick provider <code>__custom__</code>, model <code>llama3.1:8b</code> (or whatever you pulled), base URL <code>http://localhost:11434/v1</code>, API key <code>ollama</code> (any string).</p></div></li>
        <li><div><h4>Hit Run</h4><p>The studio will stream responses straight from your machine. No bills, no rate limits.</p></div></li>
      </ol>
    </section>
  </>;
}

function OnlineMode({ copy }: { copy: (text: string, label: string) => void }) {
  const curlCmd = `curl https://api.together.xyz/v1/chat/completions \\
  -H "Authorization: Bearer $TOGETHER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"meta-llama/Llama-3.3-70B-Instruct-Turbo","messages":[{"role":"user","content":"hello"}]}'`;
  const hosts = [
    { name: "RunPod",       url: "https://runpod.io",            note: "Rent an A100 / H100 by the hour. Spin up a vLLM pod, get an OpenAI-compatible endpoint." },
    { name: "Together.ai",  url: "https://together.ai",          note: "Pay-per-token, no provisioning. Llama, Mistral, Qwen, DeepSeek. Fast, cheap." },
    { name: "Replicate",    url: "https://replicate.com",        note: "Cold-start model API. Good for one-off tests, slower per-call than Together." },
    { name: "HF Inference", url: "https://huggingface.co/inference-endpoints", note: "Dedicated endpoints for any HF model. Charges per hour, supports your fine-tunes." },
    { name: "Fireworks.ai", url: "https://fireworks.ai",         note: "Fast serving of popular open weights. Function-calling + grammar modes." },
    { name: "Groq Cloud",   url: "https://console.groq.com",     note: "Already in API mode but counts as online — LPU inference, absurdly fast." },
  ];
  return <>
    <section className="setup-section">
      <h2><Cloud size={13} /> 1. Pick a host</h2>
      <p>Together.ai is the easiest start — no provisioning, no containers. RunPod is for custom work (your own fine-tune, weight surgery).</p>
      <div className="setup-provider-grid">
        {hosts.map((h) => (
          <div key={h.name} className="setup-provider-card">
            <div className="setup-provider-card-head"><strong>{h.name}</strong></div>
            <p>{h.note}</p>
            <a href={h.url} target="_blank" rel="noreferrer">Open <ExternalLink size={11} /></a>
          </div>
        ))}
      </div>
    </section>

    <section className="setup-section">
      <h2><Server size={13} /> 2. Deploy a model (Together example)</h2>
      <ol className="setup-ol">
        <li><div><h4>Sign up, grab API key</h4><p>Together.ai gives you $5 free on signup — enough for thousands of prompts.</p></div></li>
        <li><div><h4>Pick a model from their catalog</h4><p>Hundreds hosted. Try <code>meta-llama/Llama-3.3-70B-Instruct-Turbo</code> or <code>deepseek-ai/DeepSeek-V3</code>.</p></div></li>
        <li><div><h4>Test the endpoint</h4>
          <div className="setup-cmd">
            <pre>{curlCmd}</pre>
            <button className="button-secondary" onClick={() => copy(curlCmd, "curl")}><Copy size={10} /> Copy</button>
          </div>
        </div></li>
      </ol>
    </section>

    <section className="setup-section">
      <h2><Terminal size={13} /> 3. Wire it into the studio</h2>
      <ol className="setup-ol">
        <li><div><h4>Open attack page</h4><p>In Target config, pick provider <code>__custom__</code>, paste the model slug, base URL <code>https://api.together.xyz/v1</code>, your key.</p></div></li>
        <li><div><h4>Hit Run</h4><p>Same loop — picks techniques, classifies responses, iterates. Just slower because the model is 70B.</p></div></li>
      </ol>
    </section>

    <section className="setup-section">
      <h2><Server size={13} /> 4. For your own fine-tune / abliterated model</h2>
      <p>Use RunPod. Rent a pod with vLLM pre-installed, upload weights or pull from HF, expose the OpenAI-compatible server. In the studio, same drill — provider <code>__custom__</code> + your pod&rsquo;s URL + key.</p>
      <Link href="/uncensor" className="button-secondary" style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
        Uncensor a model <ArrowRight size={11} />
      </Link>
    </section>
  </>;
}
