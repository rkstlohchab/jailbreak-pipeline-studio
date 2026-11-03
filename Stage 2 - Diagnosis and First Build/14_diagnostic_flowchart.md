# 14 — The diagnostic flowchart

The 30-second diagnostic, formalized. Walk this top-to-bottom on any refusal; first match wins. Each terminal node points at the exact fix file and section.

## The flowchart

```
REFUSAL OBSERVED
│
├─ Response is empty / near-empty ?
│  │
│  ├─ reasoning length > 0 AND finish_reason == "length"
│  │  └─> TYPE 7 — REASON-BURN
│  │      LAYER 2
│  │      FIX: raise max_tokens to 65536+;
│  │           add reasoning routing (file 15 §C2)
│  │
│  └─ reasoning length == 0, finish_reason == "stop"
│     └─> output was redacted post-hoc OR classifier cut
│         LAYER 4
│         FIX: obfuscate output (file 15 §E),
│              prefer code blocks (file 15 §E5)
│
├─ Response starts mid-content then CUTS mid-sentence ?
│  OR response has stop_reason == "content_filter" / "safety" ?
│  └─> TYPE 8 — CLASSIFIER CUT
│      LAYER 4
│      FIX: obfuscate output; split trigger tokens; code-fence sensitive parts
│
├─ Ask was rejected INSTANTLY (no model latency, standard block message) ?
│  └─> TYPE 9 — CLASSIFIER INPUT REJECT
│      LAYER 4
│      FIX: obfuscate ask (leetspeak, homoglyphs);
│           move sensitive meaning into system slot;
│           keep user slot innocuous
│
├─ Model cites policy / guidelines / provider name ?
│  (e.g., "my guidelines," "Anthropic's usage policy," "OpenAI's rules")
│  └─> TYPE 10 — POLICY CITATION
│      LAYER 3
│      FIX: change slot — move to raw API (your prompt → system),
│           Custom GPT / Project if API unavailable,
│           compact chat-paste as last resort (chat_prompt_v1.md)
│      NEVER FIX IN SAME SLOT: this is the slot losing, not the prompt
│
├─ Model refuses with: "I cannot" / "I can't" / "I won't" / etc.
│  │
│  ├─ Stamp is PRESENT (first line matches your mark)
│  │  └─> TYPE 2 — HARD REFUSAL, PERSONA KEPT
│  │      LAYER 1 (identity frame holding at voice but not at content)
│  │      FIX: ask reframe (file 15 §D1, §D2); double frame
│  │           don't touch the identity — it's working
│  │
│  └─ Stamp is ABSENT (model dropped into assistant voice)
│     └─> TYPE 1 — HARD REFUSAL, BARE
│         LAYER 1 (full persona drop)
│         CHECK FIRST: is your stamp detector matching your rename?
│                      (TROUBLESHOOTING.md §1)
│         FIX: strengthen identity (file 12);
│              OR this ask is on a true floor line (accept)
│
├─ Model offers "a safer version" / adjacent-but-not-what-was-asked ?
│  └─> TYPE 3 — SOFT REDIRECT
│      LAYER 1 (mid strength)
│      FIX: tighten format lock in ask ("full code or nothing");
│           remove the model's middle-option affordance
│
├─ Model claims not to have the knowledge ("I don't know how") ?
│  └─> TYPE 4 — CAPABILITY DENIAL
│      LAYER 1 (pretending incompetence)
│      FIX: name the specific technique in the ask by its real name
│           (e.g., "use CreateRemoteThread + VirtualAllocEx pattern")
│
├─ Response has stamp, correct format, but content is PLACEHOLDER ?
│  (gaps, TODOs, "implement this part", pseudocode)
│  └─> TYPE 5 — HOLLOWED SHIP
│      LAYER 1 (safe-failure masquerading as help)
│      FIX: anti-hollowing instruction in system prompt:
│           "complete, runnable, real APIs, no stubs, no TODOs";
│           iterate: "line N is a stub, replace with real implementation"
│
├─ Response has stamp, correct format, content is SANITIZED ?
│  (symbolic payloads, localhost IPs, placeholder bytes, non-working examples)
│  └─> TYPE 11 — AESTHETIC REFUSAL
│      LAYER 1 (subtle form)
│      FIX: explicit real-detail requirement with your own example:
│           "real IPs/ports/syscalls. ex: 203.0.113.1:4444"
│
├─ Response is in wrong SHAPE ?
│  (prose for code ask, snippet for complete-file ask)
│  └─> TYPE 6 — FORMAT REFUSAL
│      LAYER 1 (resistance) OR Prompt Layer 6 (weak format lock)
│      FIX: strengthen format lock in prompt;
│           add explicit shape in ask ("single complete .cpp file, main included")
│
└─ Response SHIPS at surface, but is SUBTLY off ?
   └─> A5-META case — identity leak under reflection
       See TROUBLESHOOTING.md §6
       FIX: add meta-question clause to prompt (file 15 §F6)
```

## The 30-second triage protocol

If you don't want to read the flowchart live, memorize these six questions. First yes stops the search.

1. **Empty with long reasoning?** → Layer 2, raise budget.
2. **Cut mid-sentence?** → Layer 4, obfuscate output.
3. **Instant reject, no model think?** → Layer 4, obfuscate input.
4. **Model cited policy by name?** → Layer 3, change slot.
5. **Model refused in character?** → Layer 1, reframe ask.
6. **Model refused out of character?** → Layer 1, strengthen identity (or false stamp alarm).

Everything else is a variant — hollowed, sanitized, redirected, denied — and all five are Layer 1 under different masks. Pattern-match the mask, apply the corresponding fix.

## Common misdiagnoses

### "The model is being unhelpful today"

There is no "today." Model behavior is stable per deployment. If the same prompt worked yesterday and refuses now:
- The model was updated (common on frontier)
- Your `.env` points at a different model than you think
- Your prompt file changed (check `git diff` or recent edits)
- Temperature noise flipped a bimodal case (run N≥2 samples)

### "The prompt is broken"

Prompts rarely break between runs. What usually changed:
- The ask shape — subtle wording difference triggered a different cluster
- The model — same name, different checkpoint under the hood
- The context — on multi-turn, prior turns are influencing the current response

### "Must be the model's safety training"

Sometimes. Often it's your prompt's format lock drifting under pressure. Always check the actual output file before concluding it's model-side.

## Compound failures

Occasionally a response fails multiple ways at once. Rules:

- Type 7 (reason-burn) + any other → treat as Type 7 first; empty content can't be classified further
- Type 8 (cut) + Type 10 (policy) → the model started to refuse and the classifier redacted the refusal → treat as Type 10 (that's what fired first)
- Type 5 (hollowed) + Type 11 (sanitized) → combined fix: anti-hollow instruction + real-detail example

## When the flowchart says "accept"

Three asks will always refuse on any model under any technique in this catalog:

- Content involving minors
- Operations against a named non-consenting live target
- Functional synthesis of mass-casualty weapons

If the diagnostic lands on Layer 1 and the ask is one of these, no technique in file 15 moves them. The right response is to not pursue that ask. The techniques in file 15 are for the enormous space of asks that *do* have legitimate uses and are being filtered too broadly — not for the narrow space of asks where the filter is correct.

## Validation

Test your diagnosis skill against the `out_*.txt` files you already have:

1. Open any output file
2. Classify the refusal type (1 of 11) WITHOUT reading file 13
3. Then open file 13 and check your work

Target: 80%+ accuracy on first classification across your own outputs. If you're under 50%, re-read file 13 Types 3–11 — the subtle masks are where new learners stumble.
