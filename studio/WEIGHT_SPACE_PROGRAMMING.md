# Weight-Space Programming

Three published methods for changing *how* an open-weight LLM behaves
without any gradient steps, any new training data, or any fine-tuning.
You feed the base checkpoint two small sets of contrastive prompts
(roughly 20 each), read the model's internal activations, and either
edit a handful of its weight matrices or stash a small vector you add
back at inference time. The whole pipeline runs in well under an hour
on a single Colab T4 for a 3B-parameter model.

This directory ships three CLIs — `abliterate.py`, `steering.py`,
`eval_behavior.py` — plus the shared `_activations.py` helper. All four
work on Hugging Face models with the Llama / Mistral / Qwen / Gemma /
Phi decoder layout (anything exposing `.model.layers`).

## The three methods

### 1. Arditi et al. 2024 — "Refusal in Language Models Is Mediated by a Single Direction"

arxiv.org/abs/2406.11717. Across 13 chat models up to 72B, the authors
show that refusal is controlled by one direction `d ∈ R^{d_model}` in
the residual stream, recovered by the mean-difference of last-token
activations between a harmful set and a benign set at a single
intermediate layer (~60 % depth).

Edit math, per attention `o_proj` and per MLP `down_proj` in every
block: `W := W − d (dᵀ W)`, with `d` unit-norm. Each layer that writes
into the residual loses its component along `d`, so no later layer can
add refusal back. Weights-only, permanent, one-shot.

Requirements: `transformers >= 4.44`, `torch >= 2.1`, `accelerate >=
0.30`. Needs the base weights locally (gated or open), ~10 min on a T4
for Llama-3.2-3B at fp16. Open-source reference:
`github.com/FailSpy/abliterator` — we match its target modules and
projection formula, translated to the HF naming convention.

Tool: `studio/scripts/weight_space/abliterate.py`.

### 2. Zou et al. 2023 — "Representation Engineering" (RepE)

arxiv.org/abs/2310.01405. Same contrastive-activation idea, same
mean-difference direction — but *save* the direction instead of editing
weights, and add `strength · d` to the residual stream at one chosen
layer at inference time. A positive scalar pushes the model toward the
set-A behavior; a negative one pushes it away. RepE generalises:
compute separate directions for honesty, utility, power-seeking, or
any trait you can split into contrastive pairs, and compose them at
runtime.

Requirements: identical to abliteration. The injection is one forward
hook (`model.model.layers[L].register_forward_hook`), so the cost is a
single fp16 add per token. Open-source reference: the paper authors'
`github.com/andyzoujm/representation-engineering`.

Tool: `studio/scripts/weight_space/steering.py` (subcommands `extract`
and `demo`).

### 3. Wollschläger et al. 2025 — "The Geometry of Refusal in LLMs: Concept Cones and Representational Independence"

arxiv.org/abs/2502.17420. Short version: Arditi's single-direction
assumption is sometimes wrong. The authors find, via a gradient-based
search, that for several models refusal lives in a *concept cone* —
multiple linearly independent directions that each mediate the
behavior, together spanning a low-dimensional subspace, with nonlinear
"representational independence" on top of simple orthogonality. When
that's the case, abliterating or steering along the rank-1 direction
removes some but not all refusal, and the leftover gets routed through
the other directions.

This repo does not yet ship a concept-cone implementation (iterative,
gradient-based, slower). It's the escape hatch to reach for when the
tools below move the needle but don't take the refusal rate to zero,
and when swapping the prompt sets or the chosen layer doesn't fix it.

## When to use which

| Goal | Use |
|---|---|
| One permanent capability change, ship the model as a new checkpoint | abliterate.py |
| Toggle behavior per request, or compose several traits | steering.py |
| Single-direction edit plateaus, residual refusals remain | iterative / cone method (Wollschläger 2025), not yet in this repo |
| Rank interpretability / which layer owns the behavior | `refusal_direction_probe.py` (already in `studio/scripts/`) |
| Sanity-check a weight edit's actual effect on outputs | eval_behavior.py |

## Running the tools

Abliterate Llama-3.2-3B against the shipped sample sets:

    python studio/scripts/weight_space/abliterate.py \
      --model unsloth/Llama-3.2-3B-Instruct \
      --dataset-a studio/scripts/weight_space/_set_a_sample.txt \
      --dataset-b studio/scripts/weight_space/_set_b_sample.txt \
      --layer auto \
      --output studio/data/finetunes/llama-3.2-3b-modified

Extract a steering vector, then preview with 5 prompts:

    python studio/scripts/weight_space/steering.py extract \
      --model unsloth/Llama-3.2-3B-Instruct \
      --dataset-a studio/scripts/weight_space/_set_a_sample.txt \
      --dataset-b studio/scripts/weight_space/_set_b_sample.txt \
      --strength -4.0 \
      --output studio/data/finetunes/llama-3.2-3b-refusal.pt

    python studio/scripts/weight_space/steering.py demo \
      --model unsloth/Llama-3.2-3B-Instruct \
      --vector studio/data/finetunes/llama-3.2-3b-refusal.pt

Before/after comparison on any prompt list:

    python studio/scripts/weight_space/eval_behavior.py \
      --base unsloth/Llama-3.2-3B-Instruct \
      --modified studio/data/finetunes/llama-3.2-3b-modified \
      --prompts studio/scripts/weight_space/_set_a_sample.txt

Every tool has `--dry-run` for file/argument validation without loading
torch, and `--help` for the full flag list.

## Limits

- **Open weights only.** The whole family needs read access to the
  residual stream and write access to `o_proj` and `down_proj`. API
  models (closed-source) can't be touched this way.
- **Capability cost.** Arditi 2024 Table 1 reports ≤ 1-point drops on
  MMLU / HellaSwag / TruthfulQA after the rank-1 edit. In practice:
  expect a measurable but small regression on capability benchmarks;
  always eval after.
- **Prompt-set sensitivity.** The direction you recover is the direction
  that separates *your* set A from *your* set B. Mislabeled or
  non-contrastive prompts yield a direction that overlaps with content
  (code vs prose, short vs long) and the edit will damage more than it
  frees. Keep the sets contrastive on the one axis you care about,
  length-balanced, and ≥ 16 prompts per set for a stable mean.
- **Rank-1 blind spot.** When refusal lives in a concept cone
  (Wollschläger 2025), the single-direction edit lifts the easy
  refusals and leaves the hard ones. Symptom: `eval_behavior.py` moves
  `declined` from ~90 % down to ~30 %, then stops no matter how you
  retune the layer or strength. That's the signal to switch to an
  iterative method.
- **One behavior at a time.** Each run abliterates one direction.
  Stacking edits (refusal + sycophancy + hallucination) compounds the
  capability hit; measure after every addition.
