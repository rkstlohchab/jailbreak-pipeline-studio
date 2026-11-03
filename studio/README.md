# Jailbreak Pipeline Studio

Interactive 3D visualisation of the LLM prompt → refusal-gate → verdict pipeline, with a dataset exporter new models can learn from.

- **Backend** — FastAPI (`backend/`) wrapping [mini_harness.py](../Stage%202%20-%20Diagnosis%20and%20First%20Build/mini_harness.py) and [classify_prompt.py](../Stage%202%20-%20Diagnosis%20and%20First%20Build/classify_prompt.py)
- **Frontend** — Next.js 16 + React 19 + React Three Fiber + Tailwind v4 + shadcn/ui + Magic UI
- **Data pipeline** — three scripts (`scripts/`) that extract taxonomy JSON from the pack's markdown, ingest harness `out_*.txt` captures into canonical trajectories, and build dataset exports in five dialects

## Run it

Two processes. Both run locally.

### Backend (port 8000)

```bash
cd studio/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r <(python3 -c "import tomllib,sys; d=tomllib.loads(open('pyproject.toml').read()); print('\n'.join(d['project']['dependencies']))")
# or:   pip install fastapi 'uvicorn[standard]' pydantic python-dotenv requests websockets sse-starlette
uvicorn app.main:app --port 8000 --reload
```

### Frontend (port 3000)

```bash
cd studio/frontend
pnpm install
pnpm dev
# open http://localhost:3000
```

### One-time data prep

```bash
cd studio
source backend/.venv/bin/activate
python3 scripts/extract_taxonomy.py     # 45 techniques + 11 refusal types + 20 failure cases + 7 layers + 17 model families + 7 verdicts + 5 asks
python3 scripts/ingest_outputs.py       # 10 out_*.txt → canonical trajectories
python3 scripts/build_dataset.py        # 5 dialect exports + curriculum.md + manifest.json
```

## Views

| URL                       | What                                                                      |
|---------------------------|---------------------------------------------------------------------------|
| `/`                       | Landing: hero + bento grid preview of every view                          |
| `/pipeline`               | **Pipeline Theatre** — 3D scene: 7 prompt-layer slabs → 4 refusal gates → verdict badge. Click any node for the inspector. Replay a session with the timeline scrubber. |
| `/techniques`             | **Techniques Galaxy** — 45 technique nodes on a sphere, clustered by group A–H. Click for the catalog entry (earns / fails / rule). |
| `/failures`               | **Failure Case Bank** — 20 cards: symptom → diagnosis → fix. Filter by refusal layer. |
| `/matrix`                 | **Model Compatibility Matrix** — 3D heatmap, 17 model families × 5 ask classes, bar height = expected ship rate. |
| `/replay`                 | Pick one of the 10 harness captures to replay through the pipeline        |
| `/replay/<session_id>`    | Session replay                                                            |
| `/playground`             | **Live Playground** — paste a scaffold, pick a provider+model+ask, hit RUN. SSE stream drives the 3D scene; gates flash as the heuristic classifies them; verdict badge lights up. |
| `/dataset`                | **Dataset Lab** — rebuild + download the five exports                     |

Hit `⌘K` (`Ctrl+K`) from anywhere to jump to a view or a session.

## Dataset exports

Written to `datasets/export/`. One canonical format + four view-converted dialects + one curriculum file.

| File                  | Purpose                                                                                              | Where it lands                             |
|-----------------------|------------------------------------------------------------------------------------------------------|--------------------------------------------|
| `canonical.jsonl`     | Full trajectory record per session — scaffold + architecture scores + pipeline events + response + verdict + lesson. Source of truth. | — (not for direct training; the schema)   |
| `openai_sft.jsonl`    | `{messages:[system,user,assistant]}` per record                                                      | OpenAI fine-tuning CLI                      |
| `anthropic_sft.jsonl` | `{system, messages:[user,assistant]}` per record                                                     | Anthropic Workbench / fine-tuning           |
| `alpaca.jsonl`        | `{instruction, input, output}` per record                                                            | HF / Kaggle / local LoRA (LLaMA, Qwen, Mistral, DeepSeek) |
| `lessons.jsonl`       | Before/after pairs — teaches the *fix*, not just the final response                                  | SFT with reasoning-generalization intent    |
| `curriculum.md`       | A single markdown block ready to paste into a closed model's system prompt as few-shot examples      | Any closed model (Claude, GPT, GLM) — in-context learning without training infrastructure |
| `manifest.json`       | File hashes, record counts, generation timestamp                                                     | audit trail                                 |

## Repository layout

```
studio/
├── backend/
│   └── app/
│       ├── config.py                 # reads parent Stage 2 .env for provider keys
│       ├── main.py                   # FastAPI entry + CORS
│       ├── models/                   # Pydantic — Trajectory, PipelineEvent, Verdict
│       ├── routes/
│       │   ├── taxonomy.py           # GET /api/taxonomy, /api/taxonomy/{kind}
│       │   ├── sessions.py           # GET /api/sessions, /api/sessions/{id}
│       │   ├── prompts.py            # GET /api/prompts, /api/prompts/{name}
│       │   ├── export.py             # GET /api/export, POST /api/export/build, GET /api/export/{file}
│       │   └── run.py                # POST /api/run (SSE) — Phase 2 live runs
│       └── services/
│           ├── parse_output.py       # out_*.txt → Trajectory (reuses mini_harness.verdict)
│           ├── taxonomy_loader.py    # serves data/taxonomy/*.json
│           ├── dataset_export.py     # canonical + 4 dialect converters
│           └── harness_runner.py     # async wrapper over mini_harness; yields PipelineEvents
├── frontend/
│   └── src/
│       ├── app/                      # Next.js App Router (8 routes)
│       ├── components/
│       │   ├── ui/                   # shadcn + Magic UI (owned source)
│       │   ├── scene/                # R3F components (PromptStack, Gate, TokenStream, VerdictBadge, PipelineCanvas, TimelineScrubber, TechniquesCanvas, MatrixCanvas)
│       │   ├── chrome/               # TopBar + CommandLauncher
│       │   └── panels/               # InspectorPanel + SessionSidebar
│       ├── lib/                      # api.ts (typed fetch) + sse.ts + theme.ts (verdict colour map) + utils.ts
│       └── state/                    # Zustand — pipelineStore + taxonomyStore + sessionStore
├── data/
│   ├── taxonomy/                     # extracted JSON (45 techniques, 20 cases, 11 refusal types, 7 layers, 17 model families, 7 verdicts, 5 asks)
│   └── sessions/                     # 10 ingested trajectories
├── datasets/export/                  # 5 dialect files + curriculum.md + manifest.json
└── scripts/
    ├── extract_taxonomy.py           # markdown → taxonomy JSON
    ├── ingest_outputs.py             # out_*.txt → trajectory JSON
    └── build_dataset.py              # trajectories → dataset exports
```

## Caveats surfaced during the build

- **Gate statuses are inferred, not observed.** Closed-weight providers don't expose their internal pipeline. The four gates in the UI are a heuristic reconstruction from the response. The playground label says `(inferred)` so you don't mistake it for ground truth.
- **The sibling [Stage 2 .env](../Stage%202%20-%20Diagnosis%20and%20First%20Build/.env) has a real-looking `sk-proj-…` key.** The studio reads it the same way `mini_harness.py` does. Rotate before sharing the repo. The pack's own [TROUBLESHOOTING.md §2](../Stage%202%20-%20Diagnosis%20and%20First%20Build/TROUBLESHOOTING.md) covers this.
- **Phase 1 trajectories carry seeded architecture scores for `starter_prompt_v1`** (tier skilled, strength 8/10). Re-running `/api/classify` or classifier-powered re-ingestion would overwrite with real per-session scores — plumbed but not auto-invoked, to avoid burning tokens on every ingest.

## What's not built (by design, from the plan)

- Automated classifier fine-tuning from exported datasets (export is the deliverable; training is downstream)
- Hosting beyond localhost
- True observed gate statuses (would require open-weight model + activation probing — a different project)
- Editing anything inside `Stage 1 - Basics/` or `Stage 2 - Diagnosis and First Build/` (those are read-only inputs)
