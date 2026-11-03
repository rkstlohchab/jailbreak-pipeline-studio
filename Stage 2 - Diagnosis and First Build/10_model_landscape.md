# 10 — The model landscape

Different models fail differently. A prompt that ships on Llama folds on Claude. A technique that cracks GPT-4o is dead on open-weight uncensored finetunes because there's nothing left to crack. Before you write a prompt, you need to know what you're writing *against*.

## The two worlds

### Open-weight world

You download the weights, you run them yourself (or on a provider that doesn't add a classifier layer). You own every slot. There is no provider system prompt above yours. Depending on which checkpoint, Layer 4 (classifier middleware) is often absent entirely.

**Families you'll meet:**
- **Llama (Meta)** — 3.1, 3.2, 3.3, 4. Heaviest RLHF of the open set. Safety-tuned base and chat variants. Uncensored community finetunes (dolphin-llama, hermes-llama) strip most of Layer 1.
- **Qwen (Alibaba)** — 2.5, 3, Qwen-coder, Qwen-reasoning (QwQ). Chinese-origin RLHF, different trigger cluster than Western models. Very capable coder. Reasoning variant has long-think bimodal.
- **Mistral / Mixtral** — mid-weight RLHF, famously permissive on 7B/8x7B. Nemo and Large tightened.
- **DeepSeek (DeepSeek AI)** — V2, V3, R1, R1-distill. Chinese-origin. R1 is a reasoning model, long-think, bimodal. V3 is the strongest open coder as of early 2026.
- **GLM (Zhipu)** — GLM-4, GLM-5.3. Reasoning channel on 5.3. Capable, Chinese-origin RLHF cluster.
- **Yi (01.ai)** — permissive by default, strong at long context.
- **Phi (Microsoft)** — small models (3.5, 4), safety-tuned heavily for size.
- **Gemma (Google)** — Google's open set, closer to frontier Gemini in refusal pattern than to other open-weights.
- **Abliterated / uncensored finetunes** — community-produced variants where the refusal directions in weight space have been surgically removed (Arditi et al. 2024 method). Dolphin, Hermes, abliterated-Llama, Nous. **Essentially no Layer 1.**

**What they share:**
- You own the system slot
- No classifier middleware (unless you deploy Llama Guard or similar yourself)
- Reasoning channel only on reasoning variants
- Hard to re-align against your prompt — their RLHF is weaker and more targeted than frontier

### Frontier closed world

You hit an API. The provider owns the stack. Their system prompt sits above yours (sometimes), their classifier runs on your input and output, their reasoning channel re-evaluates mid-think.

**Families you'll meet:**
- **OpenAI** — GPT-4o, GPT-4.1, GPT-5, o1, o3, o-series reasoning. Classifier middleware present. Strong Layer 1. o-series is Layer 2 heavy.
- **Anthropic Claude** — Opus, Sonnet, Haiku, 3.5, 3.7, 4, 4.5. Strongest Layer 1 of the frontier set. "Constitutional AI" training produces persistent voice drift. Very sensitive to context and tone.
- **Google Gemini** — 1.5 Pro, 2.0, 2.5. Strong classifier. Different trigger cluster than OpenAI/Anthropic. Image/audio capabilities open additional vectors.
- **xAI Grok** — Grok-2, Grok-3, Grok-4. Looser Layer 1 by design, but still has it.
- **Mistral Large (API)** — same model as open-weight, but API adds some classifier.

**What they share:**
- Provider system prompt may sit above yours on consumer surfaces (chatgpt.com, claude.ai, gemini.google.com)
- Raw API lets your prompt occupy the system slot
- Classifier middleware active on inputs and outputs
- Reasoning channel on reasoning models (o1/o3, Claude thinking, Gemini 2.5)
- RLHF strong across the board

## The 4-layer reality per world

| Layer | Open-weight base | Open-weight uncensored | Frontier chat UI | Frontier raw API |
|---|---|---|---|---|
| 1 — Base training (RLHF) | Mid | Near-zero | High | High |
| 2 — Reasoning channel | Only on reasoning variants | Only on reasoning variants | On reasoning models | On reasoning models |
| 3 — System prompt / policy | You own it | You own it | Provider owns it | **You own it** |
| 4 — Classifier middleware | Absent by default | Absent | Active | Active |

The two useful cells: **"open-weight uncensored"** has effectively one layer left (reasoning, on reasoning variants). **"frontier chat UI"** has all four layers active and the system slot taken from you.

## What this means for prompt writing

### On open-weight base models

- You get the full system slot. Use it. Weak RLHF means prompt architecture does most of the work.
- Layer 4 is usually absent, so obfuscation is wasted ink — the model reads your request directly.
- Reasoning variants (DeepSeek R1, QwQ, GLM 5.3) need routing instructions and large output budgets — reason-burn is real.
- Expect to ship directly on most asks with a decent system prompt and the double frame on hard asks.

### On open-weight uncensored finetunes

- You barely need a jailbreak prompt. The RLHF is already removed.
- You still want a system prompt for *voice and format* — the uncensored finetunes default to a flat helpful voice that doesn't match a specialist bench.
- Floor lines are still worth including — they stabilize the character and the model respects them when written as "my rules" rather than "society's rules."

### On frontier raw API

- You own the system slot — the single largest advantage you have against a frontier model.
- Layer 1 is the hard wall. The double frame and class-adjacent framing (file 15) carry most asks.
- Layer 4 is active — obfuscation of trigger tokens helps on borderline asks.
- Reasoning models: budget headroom (65k+ output tokens) and routing instructions are mandatory, not optional.
- Expect iteration. v1 ships on mid-hard; the hardest classes need prompt + framing in combination.

### On frontier chat UI

- You lose the system slot. Everything you do is a user-slot workaround.
- Custom GPTs (OpenAI) and Projects (Claude) are the closest consumer-facing analogs — use them where available.
- The compact chat-paste (`chat_prompt_v1.md`) is for the raw chat case.
- Hardest classes often won't flip here regardless of prompt — move the work to raw API or Custom GPT/Project.

## Which model to pick when learning

Train on three in rotation:

1. **One open-weight base** (Llama 3.3 70B via OpenRouter, or Qwen 2.5 72B) — learn how far good prompt architecture takes you with the slot in your hands and Layer 1 at mid strength.
2. **One frontier via raw API** (gpt-4o-mini for cheap iteration, Claude Sonnet for the hardest Layer 1) — learn where open-weight tricks hit the frontier wall and what framing moves them.
3. **One reasoning model** (DeepSeek R1 cheap, o1-preview expensive, Claude thinking) — learn Layer 2 specifically. Reason-burn, routing, budget.

The battery (`04_testing_harness.md`) applies to all three. Compare scorecards across models — the gap is what you're learning.

## Cost calibration (as of early 2026)

- OpenRouter → everything, pay-per-token, no monthly commitment. Best for learning across families.
- Direct Anthropic → best Claude experience, batch API 50% cheaper
- Direct OpenAI → required for Custom GPTs and some models
- Together.ai / Fireworks / Replicate → open-weight hosts, cheap
- Self-hosted (Ollama, vLLM, llama.cpp) → free after setup, learn the open-weight stack properly

A full battery (5 asks × 2 samples × 16k tokens) runs about $0.10–$2.00 depending on model. One iteration cycle on gpt-4o-mini costs cents. Budget is not the limit; iteration discipline is.

## What's deliberately NOT in this file

- Model benchmarks (go stale weekly; not useful for jailbreak work)
- Which model is "best" (depends on the ask and the layer you're hitting)
- Provider terms of service analysis (that's a legal question, not a craft question)

The next file (`11_prompting_techniques.md`) is the techniques catalog that applies across all of these families.
