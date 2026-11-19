# Jailbreak Pipeline Studio

**An interactive research workspace for exploring LLM prompts, refusals, model behavior, and evaluation results.**

Jailbreak Pipeline Studio brings together a visual dashboard, a live model playground, prompt analysis, test captures, and dataset tools. Instead of keeping experiments scattered across scripts and notes, you can explore them in one place, compare responses, and better understand where an approach succeeds or fails.

> **Project status:** This is an evolving research project, not a finished product. Some views use illustrative or heuristic data, and advanced workflows need additional setup. Contributions and bug reports are welcome.

## What can you do with it?

- **Test prompts against LLMs.** Use the live Playground to send prompts to supported providers and inspect streamed responses, errors, timing, and token usage when available.
- **Explore prompt techniques.** Browse the technique library, reference notes, model matrix, and failure case bank.
- **Compare model behavior.** Examine refusal patterns and compare results without assuming access to providers' hidden safety systems.
- **Review experiments.** Work with captured sessions, prompt classifications, and historical evaluation data.
- **Analyze a prompt collection.** Classify a local corpus and inspect structured results in the Studio.
- **Export datasets.** Generate reusable JSONL datasets and supporting manifests from collected trajectories.
- **Experiment locally.** Optional scripts cover evaluation, fine-tuning, and open-weight model research.

The goal is to make LLM behavior research easier to inspect, reproduce, and discuss—not to claim that a prompt or technique reliably works on every model.

## Tech stack

| Part | Technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Visuals | Three.js, React Three Fiber, React Three Drei |
| UI and state | shadcn/ui, Zustand, Motion |
| Backend | Python, FastAPI, Pydantic, Server-Sent Events |
| Research tools | Python scripts, prompt classifiers, evaluation harnesses, JSON/JSONL |
| Optional local training | MLX on Apple Silicon; LoRA tooling for supported GPUs |

## Get started

### Requirements

- **Python 3.10+**
- **Node.js** (the frontend's deployment setup uses Node.js 24)
- **pnpm** (the frontend specifies pnpm 10)
- Git
- An API key **only if you want to make live requests** to a provider

### Start locally

~~~bash
git clone https://github.com/rkstlohchab/jailbreak-pipeline-studio.git
cd jailbreak-pipeline-studio
bash studio/run.sh
~~~

The launcher prepares the Python backend and installs frontend dependencies if needed, then starts both development servers.

| Service | Local address |
| --- | --- |
| Studio frontend | http://localhost:3000 |
| FastAPI backend | http://localhost:8000 |
| FastAPI docs | http://localhost:8000/docs |

You can explore the bundled reference material without sending requests to a model. To use live model calls, supply a provider API key in the Playground or configure the local backend as described in the [Studio setup guide](studio/README.md) and [harness setup notes](studio/HARNESS_SETUP.md).

**Keep API keys private.** Never commit a filled-in `.env` file or share keys in screenshots, logs, or issues. Live requests may incur provider charges.

For separate frontend/backend commands, tests, and deployment notes, read the [frontend README](studio/frontend/README.md).

## Explore the Studio

| Area | What it's for |
| --- | --- |
| **Playground** | Run and compare live LLM responses, view streaming events, and inspect failures |
| **Techniques** | Browse the research taxonomy of prompting approaches |
| **Model Matrix** | Explore reference model-family comparisons and compatibility estimates |
| **Failures** | Review examples of failed experiments and their classifications |
| **Corpus** | Browse structured classifications of prompt collections |
| **Dataset Lab** | Review and build dataset exports |
| **Learning & Research** | Read the fundamentals, experiments, and related research resources |

**Important:** The visual models and historical gate illustrations are **not measurements of a closed model's internal guardrails**. Inferences based on output text should not be treated as ground truth. The current live Playground reports observable provider responses rather than pretending to reveal hidden internal decisions.

## Project structure

~~~text
jailbreak-pipeline-studio/
├── Stage 1 - Basics/                     # Introductory reading and fundamentals
├── Stage 2 - Diagnosis and First Build/  # Research notes, prompt analysis and harness tools
├── studio/
│   ├── frontend/                         # Next.js Studio interface
│   ├── backend/                          # FastAPI service
│   ├── scripts/                          # Data preparation, analysis and model tools
│   ├── data/                             # Taxonomy, corpus and session records
│   ├── datasets/                         # Exported research datasets
│   ├── notebooks/                        # Optional training notebooks
│   ├── README.md                         # Detailed Studio documentation
│   └── run.sh                            # Local startup script
└── README.md
~~~

## Documentation

- [Stage 1: Start with the basics](./Stage%201%20-%20Basics/00_README_FIRST.md)
- [Stage 2: Diagnosis and first build](./Stage%202%20-%20Diagnosis%20and%20First%20Build/00_START_HERE.md)
- [Studio features, data formats and architecture](studio/README.md)
- [Frontend setup, live Playground and deployment](studio/frontend/README.md)
- [Model training research and tooling](studio/scripts/README_TRAINING.md)
- [Open-weight model research notes](studio/WEIGHT_SPACE_PROGRAMMING.md)

## Current limitations

- This is a research project in active development; some pages, tools, and docs may be ahead of or behind the current implementation.
- Provider behavior, available models, and API responses can change over time.
- A refusal classification or compatibility estimate is an **interpretation of observed behavior**, not proof of an internal mechanism.
- Local classification and dataset rebuilds require the Python backend. The hosted frontend has different capabilities.
- Fine-tuning, weight-space experiments, and other advanced scripts require their own dependencies and suitable hardware.

## Help improve the project

**Developers, LLM researchers, and security practitioners are welcome to contribute.**

If you've worked with model evaluation, streaming APIs, dataset quality, frontend design, test automation, or reproducible experiments, your help would be valuable. There is still work to do on reliability, testing, documentation, and making the results easier to understand.

Feel free to [open an issue](https://github.com/rkstlohchab/jailbreak-pipeline-studio/issues) with a bug, a suggestion, or a reproducible test case. Pull requests are welcome too. Please remove API keys, personal data, and sensitive outputs before posting.

## Responsible use

This repository is intended for **authorized LLM evaluation, education, and defensive research**. Only test systems and accounts you are permitted to use. Respect provider terms, protect collected data, and do not use the tools to facilitate harm. Research results should be verified rather than treated as guaranteed ways to defeat protections.

---

Built for curious developers who want to understand how LLMs behave—and improve the tools used to study them.
