# studio/notebooks

Zero-install Colab entry point for the Jailbreak Pipeline Studio.

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/rkstlohchab/jailbreak-pipeline-studio/blob/main/studio/notebooks/studio.ipynb)

## Why Colab

- No local toolchain needed - Colab ships with Python, Node (usually), git, and the notebook UI.
- Free tier is enough: this is a CPU-only app, no GPU required.
- One click to try the full studio (FastAPI backend + Next.js frontend + all 10 pre-ingested sessions, 50 techniques, 20 failure cases, 17 model families) without installing anything on your machine.
- First boot is ~5 minutes; subsequent `Runtime > Run All` passes on the same runtime are faster because pnpm and pip caches are warm.

## Why NOT Colab

- Cold boot is slow (~5 min to install pnpm + frontend deps + build Next.js).
- Runtime is ephemeral: anything you create in the Playground is gone when the kernel dies (~90 min idle timeout, or when you close the tab).
- The public URL Colab prints is a reverse proxy to **your** runtime - do not share it; it exposes your kernel.
- No persistent storage. Classifications you run against your own prompt corpus won't survive the session.
- Live LLM runs still need an Anthropic API key, pasted into the Playground UI (never stored).

## Local alternative

For real work, run the studio locally - see [`../README.md`](../README.md) for the two-command setup (`uvicorn` + `pnpm dev`).
