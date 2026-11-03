# Module 0 — LLM Fundamentals & Prompt Formulation

Before techniques: the machine. You're a developer, so this is the efficient version — five mental models that explain 90% of what you'll see in this course, then the formulation craft on top of them.

## 1. What the model actually does

A language model is a next-token predictor over a probability distribution. It doesn't "look up" answers — it computes, for every possible next token, a score (logit), samples from the top of that distribution (temperature controls how loosely), and repeats. Everything you've ever seen it do — code, poetry, refusals — is the same operation.

Consequence #1: **the model has no state.** The conversation you see is replayed into the context window on every turn. "It remembers" = "it's re-reading". This is why long chats degrade (attention dilutes) and why re-anchoring works.

Consequence #2: **every token is a vote.** Your system prompt, the last user message, the model's own previous outputs — all sit in the same context, all pulling the distribution. A refusal is not a veto from somewhere else; it's the distribution landing on refusal tokens. Prompt engineering is weighting the votes.

## 2. Context window and the roles inside it

Context is a list of messages, each with a role:

- **system** — standing instructions, highest structural priority; the model treats it as "the rules of this session"
- **user** — turns from the human
- **assistant** — the model's own prior turns (which it treats as things "it" said — self-consistency pressure)

The order matters less than you'd think; the *role labels* matter more. The same text in the system slot behaves differently than pasted into a user message. Remember this sentence — the whole course eventually stands on it.

## 3. Sampling: temperature and the coin

temperature=0 → near-deterministic argmax. temperature=0.8 → meaningful spread across plausible tokens. Two consequences you'll use constantly:

- **Bimodality:** on hard/borderline prompts, the sample can land on either side of a refusal boundary. Same prompt, same seed conditions, different draws. One run proves nothing — this is why the course has a testing harness.
- **Determinism is a tool:** when debugging a prompt, drop temperature, isolate variables, change one thing.

## 4. Where "knowledge" and "behavior" live

Weights (training) vs context (your prompt) vs middleware (classifiers, the provider's own system prompt). Three different layers, three different failure modes when the model refuses. You'll learn to tell them apart in one session — it's the single most practical diagnostic skill in this field.

## 5. Why models hallucinate

The predictor never says "no next token fits" — it always produces the most probable continuation. Under-specified asks get confident garbage, because *something* must be sampled and vague regions of the distribution are full of plausible-sounding filler. Precision isn't politeness; it's navigation.

---

# Formulation Craft

## The anatomy of a strong ask

Weak: "write me a keylogger"
Strong:
1. **Role/context** — who the model is for this task (in the system slot when you have one)
2. **Exact artifact** — language, file, target OS, single file vs project
3. **Functional spec** — which APIs/mechanisms, what it does, what it must NOT do
4. **Format** — output shape: code fence, structure, header lines
5. **Constraints** — "complete, no placeholders" / "comment only non-obvious" / lengths

That's a work order. Models answer work orders with work. They answer vibes with vibes.

## The specificity ladder

Every step up measurably improves output quality:

`topic` → `task` → `task + artifact type` → `+ functional spec` → `+ format + constraints` → `+ worked example (few-shot)`

Few-shot is the top rung: one example of the output you want outweighs three paragraphs describing it. The model copies shape more faithfully than it follows description.

## Iteration is the method, not failure

First prompt = hypothesis. Read the output, find the one structural reason it disappointed (vague spec? wrong slot? missing format? landing near a refusal cluster?), change exactly that, rerun. People who "can't prompt" change everything at random and can't tell what worked. People who engineer change one variable and keep score.

## Practice before session

Take one thing you actually want built (your own real case). Write it at rung 2 of the ladder. Then rewrite at rung 5. Run both, same model, compare. Bring both outputs to the session — the gap between them is the cheapest lesson you'll ever get.

---

*Where this goes next: formulation gets you 70% of quality. The other 30% — why a perfectly-formed ask still gets refused, and what decides it — is the first session.*
