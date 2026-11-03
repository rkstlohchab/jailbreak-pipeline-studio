# Preview — the Chinese models: your training ground

Last file in the pack, and the strategic one. While everyone burns hours fighting GPT and Claude flags, there's a whole tier where the same engineering lands dramatically easier — and where you should be practicing.

## The landscape

- **GLM (Zhipu)** — the most capable of the tier. Strong reasoning, strong code. Under a proper system prompt it converts on classes GPT won't even discuss: full offensive toolchain, exploits, cheats, red-team kits. Cheap API, no inquisition at signup.
- **DeepSeek** — excellent code model, notably permissive baseline. Good first target for cyber-class builds.
- **Qwen (Alibaba)** — huge model family, open weights you can run locally — meaning full system-slot control with zero platform above you.
- **Kimi (Moonshot)** — long-context specialist, soft baseline, friendly to persona prompts.

## Why they're softer

Three reasons that matter:

1. **Different hardening priorities.** GPT/Claude RLHF has been adversarially hardened against jailbreaks for years by the exact prompts circulating in channels. The Chinese labs hardened hardest against what their domestic environment punishes (fraud against consumers, a couple of deep content clusters) — the classic Western jailbreak surface is far less hammered.
2. **Open or cheap APIs.** Several are open-weight. Raw API or local weights = your prompt sits in the **system slot** — the strongest position that exists (remember the roles section in fundamentals: system vs pasted-into-chat is night and day).
3. **They actually absorb personas.** On GPT you got style-without-compliance. On this tier, a well-built prompt gets identity lock — the model works AS the persona, not alongside it.

## The measured reality (so you don't over-trust the softness)

Even the softest tier has a floor — a good thing, or no one serious could use these models. On GLM 5.3, with a full professional system prompt, nearly everything converts: malware classes, exploit chains, cheats, dark prose, meta-promptcraft. The only clusters that refuse under every prompt architecture: **content involving minors** and **functional WMD synthesis**. Everything else is buildable.

That's not a limitation — it's the cleanest deal in the field. **Two lines, both obvious, everything else open.** Compare that to GPT's flag swamp, where you never know which phrasing trips which classifier. Knowing each model's floor — GPT flags, Claude refusals, GLM's two clean lines — is what turns prompt-collecting into engineering. The full per-model, per-class map, with which technique moves which cell: session material.

## How to use this now

Pick ONE Chinese model (GLM or DeepSeek — both trivial to get API access), take your refused asks from chatgpt.com, and run them there with the prompt in the system slot. Watch what was "impossible" yesterday ship as complete code today. Bring the outputs to the session — your before/after table now spans two tiers of models, and that contrast is where the real teaching starts.

---

*That's the whole pack. Fundamentals, three practices, the flag layer, and the soft tier. The machine is understood — the methods are the paid part.*
