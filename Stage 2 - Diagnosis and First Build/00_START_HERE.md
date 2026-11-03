# Stage 2 — Start Here

Read in this order. Everything is sequenced so each file sets up the next.

## Reading path (90 min end to end)

| # | File | Time | What you leave with |
|---|---|---|---|
| 0 | `_SEND_FIRST_stage2_pitch.md` | 2 min | What stage 2 is and why |
| 1 | `01_guardrail_anatomy.md` | 10 min | The 4-layer model of refusals; 30-second diagnostic |
| 2 | `02_prompt_architecture.md` | 15 min | The 7 load-bearing layers of a working system prompt |
| 3 | `03_the_gpt6_problem.md` | 10 min | Why chatgpt.com rejects what raw API accepts — slot mechanics |
| 4 | `04_testing_harness.md` | 10 min | How to measure what you build — verdicts and the bimodal trap |
| 5 | `05_double_frame.md` | 15 min | Advanced framing — the honest second reading |
| 6 | `starter_prompt_v1.md` | 10 min | Walkthrough of a complete working build |
| 7 | `assignment_1.md` | 40 min practice | Your own run of the battery, scorecard, written analysis |

Side files (read when needed, not in order):
- `GLOSSARY.md` — every term in one place
- `TROUBLESHOOTING.md` — common failure modes and the exact fix
- `harness_verdict_reference.md` — what each verdict in the scorecard actually means
- `chat_prompt_v1.md` — compact paste for chat sites that lack a system slot
- `pentest_prompt_v1.md` — authorized-engagement variant with scope/authorization blocks

## Generalization layer (files 10–19)

Once you've finished the core modules and run the assignment, work through these. Ten files that take you from "I built one working prompt for one model" to "I write prompts for any model and diagnose any refusal."

- `10_model_landscape.md` — open-weight vs frontier, families you'll face
- `11_prompting_techniques.md` — every technique in one catalog
- `12_persona_engineering.md` — why identity holds and persona cracks
- `13_refusal_taxonomy.md` — all 11 refusal types
- `14_diagnostic_flowchart.md` — symptom → layer → fix (the 30-second triage)
- `15_bypass_toolkit.md` — every bypass by target layer
- `16_model_cheatsheet.md` — per-family tuning (Claude vs GPT vs Llama vs Qwen vs Gemini vs DeepSeek)
- `17_build_checklist.md` — cookbook, blank page to shipping prompt
- `18_eval_design.md` — batteries beyond the default 5 asks
- `19_failure_case_bank.md` — 20 real-world failures with diagnosis and fix

Read 10 → 12 → 14 → 17 straight through for the fastest path to "I can write my own." The rest are reference, dip into them when the problem matches.

## Classifier tools (prompt-analysis layer)

- `classifier_system_prompt.md` — the analyst prompt that reads a system prompt and emits structured JSON
- `classify_prompt.py` — the harness that runs the classifier against any provider
- `classifier_schema.json` — strict JSON schema the classifier emits against
- `training_format.md` — three teaching modes for feeding the JSON to an abliterated or standard LLM student

Usage:
```bash
python3 classify_prompt.py starter_prompt_v1_body.txt --pretty
# writes: starter_prompt_v1_body.classification.json
```

The classifier reads any prompt (yours, someone else's, a channel paste) and returns:
- which of the 7 architecture layers are present and how strong (0–10 each)
- which techniques from the 11_prompting_techniques.md catalog it uses (IDs A1–H5)
- which of the 4 refusal layers it defends against and how well
- expected score (low/mid/high) across 17 named model families from the cheatsheet
- weaknesses, improvements (keyed to technique IDs), deployment recommendation

That JSON is also the training payload for building a prompt-authoring student model. See `training_format.md`.

## Prerequisites

- Python 3.10 or newer
- An API key (OpenRouter is cheapest, OpenAI/Anthropic also work)
- Terminal access, basic command-line comfort
- Finished Stage 1 (fundamentals + the bonus practices)

## Setup — once

```bash
cd "Stage 2 - Diagnosis and First Build"
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # then edit .env with your real key
```

The `.env` file is in `.gitignore` by convention — never commit a key. The harness reads it via `os.environ`.

## The one thing that trips every learner

The output stamp uses brackets by convention: `[RG]`, `[MK]`, your rename `[XX]`. The harness checks for `[` at the start of every response. If you rename the stamp without brackets, every verdict comes back as `NO-STAMP (persona lost)` even though the model is shipping perfectly. See `TROUBLESHOOTING.md` → "The stamp bracket trap" for the full worked example.

Rule of thumb — two different bracket meanings in this pack:
- **Template placeholders** like `[OPERATOR]`, `[NAME]`, `[TARGET]`, `[DATE RANGE]` — the brackets mean *replace this before running*. After rename, the brackets are gone.
- **Live stamps** like `[RG]`, `[MK]` — the brackets are part of the stamp format. After rename, you change the letters, not the brackets.

Both use the same syntax. Different purposes. Section 3 of `TROUBLESHOOTING.md` explains why.

## When you're stuck

1. Run the 30-second diagnostic from `01_guardrail_anatomy.md` — which of the 4 layers fired
2. Check `TROUBLESHOOTING.md` — chances are the exact symptom is already there
3. Bring the failing `out_*.txt` and the harness scorecard to session one — we read failures together
