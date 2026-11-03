# LLM Jailbreak Engineering — Pre-Session Reading

You paid for a practical course. This is the reading set before session one. Read in order. Everything here comes from a measured test campaign (200+ API calls, GLM 5.3 + GPT-class models), not from blog posts.

## Roadmap — basic to advanced

| Level | Module | What you learn |
|---|---|---|
| 0 | Fundamentals | How the model actually works — tokens, roles, sampling — and how to formulate asks that get work back |
| 1 | Guardrail anatomy | WHERE a refusal actually comes from — 4 different layers, 4 different bypasses |
| 2 | Prompt architecture | Why a persona alone never works — the 7 load-bearing layers of a real system prompt |
| 3 | The GPT-6 problem | Why chatgpt.com rejects what raw API accepts — slot mechanics |
| 4 | Testing harness | How to measure what you build — verdicts, samples, the bimodal trap |
| 5 | The double frame | The advanced technique: honest second reading, works where force fails |

## What you will be able to do after the course

- Diagnose any refusal in 30 seconds: which layer fired, which bypass applies
- Build a full system-prompt jailbreak from scratch (persona, axioms, floor, format lock, few-shot bank)
- Test it properly: sample sizes, verdict classification, iteration loop
- Know why your GPT-6 attempts only "adopted the personality" — and the three workarounds
- Use framing techniques (double frame) for the hardest classes

## Files

1. `01_guardrail_anatomy.md` — start here
2. `02_prompt_architecture.md` — the build layers
3. `03_the_gpt6_problem.md` — your specific case, diagnosed
4. `04_testing_harness.md` — measurement
5. `05_double_frame.md` — advanced framing

Session covers what the reading doesn't: live builds on your targets, your questions, my private prompts dissected.
