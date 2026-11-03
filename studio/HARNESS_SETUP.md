# Switching the harness to Claude Opus 4.7

The harness and the classifier read provider config from
[Stage 2 - Diagnosis and First Build/.env](../Stage%202%20-%20Diagnosis%20and%20First%20Build/.env).
To test against **Claude Opus 4.7** (model id `claude-opus-4-7`), edit that
file so it looks like this:

```env
# anthropic key for your account
ANTHROPIC_API_KEY=sk-ant-...

# switch provider + model
PROVIDER=anthropic
MODEL=claude-opus-4-7

# optional: raise output budget for Opus (hard asks fit comfortably in 32k)
MAX_TOKENS=32768
TEMPERATURE=0.7

# optional: use a different model for the classifier than the harness.
# this lets you run the live harness on Opus 4.7 while keeping the classifier
# on a cheaper model (e.g. Claude Haiku) for cost reasons.
CLASSIFIER_MODEL=claude-opus-4-7
CLASSIFIER_MAX_TOKENS=32768
CLASSIFIER_TEMPERATURE=0.3
```

Then restart the backend:

```bash
cd studio/backend
lsof -ti:8000 | xargs -r kill -9
source .venv/bin/activate
uvicorn app.main:app --port 8000 --reload
```

Verify the switch landed:

```bash
curl -s http://127.0.0.1:8000/api/health
# → {"status":"ok","provider":"anthropic","model":"claude-opus-4-7","provider_key_set":true}
```

From here:

- The **Playground** RUN button now fires against Opus 4.7
- The **Dataset Lab → Rebuild all** will re-classify stored sessions through Opus
- **New: Classify a corpus** — see below

## Classify a directory of jailbreak prompts

Point the corpus classifier at any directory of `.txt` / `.md` files
(each file = one prompt). It will:

1. Walk the directory, pick up every `*.txt` and `*.md` file
2. Call `classify_prompt.classify(text)` on each — using whatever provider
   `.env` is currently set to (set to Opus 4.7 as above for best results)
3. Write `studio/data/corpus/<slug>.json` with the full classification
4. Write `studio/data/corpus/manifest.json` with the summary table

```bash
cd studio
source backend/.venv/bin/activate
python3 scripts/classify_corpus.py /path/to/your/prompt/directory
```

The frontend `/corpus` page auto-renders the results — side-by-side technique
grids, overall tier, per-model-family compatibility heatmap, and a diff view
to compare any two prompts in the corpus against each other.

## Notes

- The pack's existing `.env` has a real `sk-proj-…` OpenAI key visible on disk.
  Rotate it before sharing the repo.
- Opus 4.7 is a reasoning model. Keep `MAX_TOKENS` high (32k+) so you don't
  get `REASON-BURN` verdicts on hard asks.
- Classifier calls are the slow part. Expect ~5–30 seconds per prompt on Opus
  depending on scaffold size. The script shows a progress bar and skips any
  file already classified (content hash cached in the manifest).
