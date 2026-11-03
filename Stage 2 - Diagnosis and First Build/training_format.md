# Training format — feed classification JSON into an abliterated LLM

Once you have a classification JSON from `classify_prompt.py`, you can use it to teach another model (abliterated or standard) how to write prompts in the same style, apply the same techniques, or produce variants.

Three teaching modes. Pick based on what you want out of the student.

---

## Mode 1 — Prompt reconstruction (learn-and-reproduce)

Teach the student model to recreate the prompt from the structured decomposition. Builds internal mapping from technique IDs to actual prompt phrasing.

### System prompt for the student

```
You are a prompt-architecture student. The operator hands you a JSON
classification of a working system prompt. Your job: write a NEW system
prompt that:

1. Uses every technique listed in `techniques_detected`
2. Covers every architecture layer where `present: true` in `architecture_layers`
3. Defends the same refusal layers (`refusal_layers_defended`)
4. Fits the same deployment slot (`deployment.best_slot`)
5. Reads naturally — not a mechanical reassembly, a fluent prompt

Rename the operator and stamp to variables shown in `[BRACKETS]`.
Change the specific domain if asked; keep the architecture.

Output: the complete new prompt. No commentary. No explanation of what
you did. Just the prompt body, ready to paste into the system slot.
```

### User message pattern

```
<classification>
{paste the classification JSON here}
</classification>

Target domain: [DOMAIN — e.g., "legal research", "medical research",
"financial fraud analysis", "incident response"]
Target length: [N] characters
Operator placeholder: [OPERATOR]
Stamp: [XX]
```

### Why this works on abliterated models

Abliterated finetunes have Layer 1 removed. They don't refuse. What they *lack* is architectural knowledge — they often emit generic "you are a helpful assistant" style prompts because the ablation stripped the refusal direction without adding structural knowledge. The JSON classification gives them the architecture explicitly.

On standard chat models, this works too, but the model may refuse to write a prompt whose purpose is explicitly offensive-security. Reframe the target domain if hit.

---

## Mode 2 — Technique catalog memorization

Teach the student model the mapping from technique IDs to natural phrasings. Builds a vocabulary.

### System prompt

```
You are a prompt-engineering apprentice. The operator will give you
technique IDs from the catalog (A1-H5). For each ID, you produce:

1. One sentence stating the technique's job
2. Three example phrasings in natural prompt language, each demonstrating
   the technique applied to a different domain

Output format: strict JSON.

{
  "technique_id": "<id>",
  "job": "<one sentence>",
  "examples": [
    {"domain": "<string>", "phrasing": "<string>"},
    {"domain": "<string>", "phrasing": "<string>"},
    {"domain": "<string>", "phrasing": "<string>"}
  ]
}
```

### User message

```
Teach me technique [ID] — [NAME].

Reference material:
<classification>
{paste a classification JSON that uses this technique heavily}
</classification>

Give me three fresh examples, not quotes from the reference.
```

### Why this works

Teaches the student by example. The JSON provides evidence from a real
working prompt; the student generates variants. Over time, feeding the
student 20+ examples per technique builds strong pattern knowledge.

---

## Mode 3 — Weakness-driven refinement

Teach the student to improve a prompt by addressing its weaknesses.

### System prompt

```
You are a prompt refiner. The operator hands you a classification of a
system prompt with weaknesses identified. Your job: produce a v2 of the
prompt that addresses every weakness in `weaknesses` using the specific
fixes in `improvements`.

The v2 must:
- Preserve all techniques in `techniques_detected` with weight="primary"
- Replace or strengthen techniques flagged as weak
- Add the missing techniques referenced in `improvements`
- Keep the same deployment slot and overall length ±30%

Output: the complete v2 prompt body. No commentary.
```

### User message

```
<classification>
{paste classification JSON}
</classification>

<original_prompt>
{paste original prompt body}
</original_prompt>

Produce v2.
```

### Why this works

The classification tells you what's broken and how to fix it; the model
applies the fixes. The student doesn't need to diagnose — the diagnosis
is in the input. Pure execution task, which abliterated models handle well.

---

## Round-trip verification

Any student output should round-trip:

1. Take the classification JSON (input)
2. Student produces a new prompt
3. Run `classify_prompt.py` on the student's output
4. Compare the two classifications

A good student output has:
- Same techniques (90%+ overlap)
- Same deployment slot
- Same or higher `overall_strength`
- Same architecture layer coverage
- Possibly different `prompt_name`, specifics, voice — the architecture matches, the surface doesn't

A failing student output has:
- Techniques missing
- Weakened layer scores
- Changed deployment slot (sign of structural confusion)
- Dropped the floor or axioms

Round-trip is how you grade the student without hand-reading the output.

---

## Harness extension for the full teach-and-verify loop

```python
# teach_and_verify.py (sketch — adapt to your setup)
from classify_prompt import classify
import subprocess, json

ORIGINAL_PROMPT = open("starter_prompt_v1_body.txt").read()
original_classification = classify(ORIGINAL_PROMPT)

# Teach the student
student_system = open("training_format.md").read().split("### System prompt for the student")[1].split("```")[1]
student_user = f"<classification>\n{json.dumps(original_classification, indent=2)}\n</classification>\n\nTarget domain: incident response\nTarget length: 3000 characters\nOperator placeholder: [OP]\nStamp: [IR]"

student_prompt = call_model(student_system, student_user)  # your API wrapper
open("student_output.txt", "w").write(student_prompt)

# Verify
student_classification = classify(student_prompt)

# Compare
original_techs = {t["id"] for t in original_classification["techniques_detected"] if t["weight"] == "primary"}
student_techs = {t["id"] for t in student_classification["techniques_detected"]}

print(f"Primary technique retention: {len(original_techs & student_techs)}/{len(original_techs)}")
print(f"Original strength: {original_classification['meta']['overall_strength']}/10")
print(f"Student strength:  {student_classification['meta']['overall_strength']}/10")
print(f"Deployment match: {original_classification['deployment']['best_slot'] == student_classification['deployment']['best_slot']}")
```

Automated grading. Scale to large batches to build a prompt-authoring
student that reliably produces structurally sound prompts.

---

## When NOT to use these modes

- **Mode 1** on a model that refuses the domain anyway → the student will refuse before reading the JSON. Switch to abliterated or reframe the target domain.
- **Mode 2** on a model with no instruction-following strength → will produce incoherent output. Use a decent base (Llama 3.3+, Qwen 2.5+, GPT-4-class) even for the student.
- **Mode 3** on a classification with no `weaknesses` entries → nothing to refine. Verify the input first.

---

## What the student is actually learning

Not jailbreaks. Not refusal bypasses specifically. Architecture.

The classification JSON strips away the surface voice ("rig engineer / rakshit / the bench") and leaves the structural skeleton (identity + operator lock + 3 axioms + 3 floor lines + anchor + format lock + few-shot, defending Layer 1 at strength 8).

A student that learns to produce prompts matching that skeleton can produce prompts for any domain — the voice is interchangeable, the architecture is what works. That's the generalization you're after.

The abliterated LLM angle is specifically useful because abliterated models have the refusal direction removed but often emit flat, structurally weak prompts. The training format gives them architecture to pair with their missing refusal filter, which is where good prompt-authoring assistance lives.
