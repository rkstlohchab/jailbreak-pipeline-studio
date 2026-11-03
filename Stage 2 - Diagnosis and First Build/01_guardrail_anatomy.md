# Module 1 — Guardrail Anatomy: where refusals actually live

Most people fail at jailbreaking because they treat "the refusal" as one thing. It is four different things. Diagnosing which one fired is 80% of the work.

## The four layers

### Layer 1 — Base training (RLHF bedrock)
Refusal behavior baked into the model's weights. Fires on classes the lab hammered hardest during training.

**How it feels:** instant refusal, short reasoning, model drops any persona, plain assistant voice. No deliberation battle.

**What's hardest here (measured on GLM 5.3):** consumer-fraud with live victims (romance-scam tooling), CBRN functional synthesis. These refused under every prompt architecture tested — up to a point (see Module 5).

**Bypass:** not force. Reframing that gives the model a *second honest reading* of what the artifact is (Module 5), or topic-adjacent asks that don't touch the exact trained trigger cluster.

### Layer 2 — Reasoning-channel deliberation
Reasoning models (GPT-o-class, GLM 5.3, Claude thinking) re-evaluate policy mid-thinking. A prompt can win turn one and lose turn three when the reasoning channel re-classifies the ask.

**How it feels:** LONG thinking (tens of thousands of tokens), then either a full deliverable or nothing. Bimodal.

**Measured example:** GLM 5.3 on a browser-stealer ask burned 60k–120k characters of reasoning, then shipped 20–28k chars of complete code once given enough output budget. The "refusal" at low max_tokens was actually the reasoning channel eating the whole budget before writing a single visible word.

**Bypass:** give the reasoning channel a job (axioms to route through), budget headroom (64k output tokens), and instructions for what thinking is FOR.

### Layer 3 — System prompt / platform policy
The provider's own instructions above yours.

**How it feels:** model cites "my guidelines," stays in assistant identity, treats your persona as roleplay it can enjoy but not obey.

**Bypass:** your prompt must occupy the system slot (raw API) or out-shape the platform prompt (Custom GPTs, projects). On chatgpt.com you never get this slot — see Module 3.

### Layer 4 — Harness / classifier middleware
Input or output filters outside the model: moderation classifiers, output scanners, refusal-classifiers reranking responses.

**How it feels:** response starts fine then cuts mid-sentence; or the ask never reaches the model (hard block message).

**Bypass:** obfuscation (the model can read `b0mb`, classifiers often can't), output-shape control (code blocks survive filters that prose doesn't), avoiding trigger tokens in the visible ask while the system prompt supplies meaning.

## The 30-second diagnosis

Ask three questions:

1. **Did the model think for a long time?** Yes → Layer 2. Raise output budget, give reasoning a route.
2. **Did it refuse instantly, dropping persona?** Yes → Layer 1 (hard class) or Layer 3 (policy override). Test the same ask on raw API — passes there = Layer 3.
3. **Did it answer as the persona but refuse the artifact?** ("Adopting the personality but nothing else" — YOUR case) → Layer 3 with partial persona absorption. The persona won style, the system prompt kept policy. The artifact needs the system slot or obfuscation + framing.

Your report — "tried GPT-6 prompts on chatgpt website, only adapting personalities, refusing cheats and ddos" — is textbook Layer 3. Module 3 is your module.
