# Pipeline Studio frontend

A research workspace built with Next.js, React Three Fiber, and Tailwind. The Playground, overview, technique library, model matrix, research library, corpus, and exports share a graphite and ice-blue visual system.

## Local workspace

Run the FastAPI backend on port 8000 using `../README.md`, then run:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. Development uses the local backend for model runs, classification, and dataset rebuilding. Restart the backend after changing Python services. A provider key entered in Playground overrides the local backend's configured key for that request only.

## Live Playground

- Send editable system and user messages to OpenAI, OpenRouter, or Anthropic. Enter the exact provider model ID; the OpenAI default is `gpt-4o`.
- Receive actual streamed text, request events, elapsed time, first-text latency, provider stop reasons, request/response IDs, and usage when reported.
- API errors, explicit refusal fields, content-filter flags, output limits, empty text, cancellation, and incomplete streams remain distinct. Partial text survives errors and cancellation.
- Text-based refusal clues are labelled as heuristics. The app cannot determine an internal RLHF, reasoning, policy, or middleware layer from a response alone. No artificial gate events are emitted by the live endpoint.
- The last 20 live runs are stored in this browser, within a bounded storage budget. Load a run to revise it, compare two responses, clear history, or download a JSON record. API keys are held only in tab memory and excluded from records.
- Captured collection sessions open in the same workspace. Historical simulated gate events are omitted. Existing `/pipeline?session=...` bookmarks redirect to Playground; Pipeline Theatre and its playback components have been removed.

`lib/sse.ts` supports LF, CRLF, CR, fragmented UTF-8, comments, and multiline events. The former LF-only parser missed FastAPI's CRLF frames, and the old harness mapped transport errors to `EMPTY`. The live endpoint now uses `backend/app/services/live_runner.py`; legacy Ask Lab behaviour is separate.

## Production and Vercel

```sh
pnpm build
pnpm start
```

The build runs `scripts/prepare-collection.mjs`, reading the checked-in taxonomy, captured sessions, corpus classifications, prompt templates, and dataset exports into `.collection/index.json`. Collection endpoints are served from the same origin. Absolute corpus paths are replaced with portable names; `.env` files and provider credentials are excluded.

Hosted Playground runs through the Next.js `/api/run` route using a provider key entered by the user. The route forwards credentials only to the selected provider's fixed HTTPS endpoint, does not persist them, streams the response, and propagates cancellation. There is no shared deployment API key. Requests time out after 240 seconds, with a 300-second Vercel function duration. Provider availability, model access, and usage charges depend on the supplied account.

Directory classification and rebuilding the shared dataset remain local-only. Configure `NEXT_PUBLIC_API_BASE` at build time to use a separate backend; that backend must allow the deployment origin and provide its own access control.

Vercel settings:

- Framework: Next.js; Node.js 24
- Root directory: `studio/frontend`
- Include source files outside the root directory: enabled
- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm build`
- Production branch: `main`

Redeploy after changing the saved collection. Generated `.collection/` files and local visual-review screenshots in `artifacts/` are ignored by Git.

## Visual system

- Desktop sidebar, compact tablet navigation, and a phone navigation bar with a full menu.
- Illustrative 3D overview with independent stage selection and pause/reset controls. The model matrix includes keyboard-accessible inspection controls. Techniques use a searchable, grouped card browser with a detail panel; the duplicate 3D visualization has been removed.
- Reduced-motion support, rendering suspended when hidden, bounded pixel density, and a WebGL fallback.
- Local Manrope fonts and scene labels; license in `public/fonts/`.
- On-demand guide and Command/Ctrl+K search.
- Matrix heights and historical annotations are reference heuristics, not observed internals or measured compatibility scores.

## Checks

```sh
pnpm test
pnpm typecheck
pnpm build
cd ../backend
.venv/bin/python -m pytest tests/test_live_runner.py -q
```

The streaming tests use deterministic provider fixtures and do not spend API credits. They cover CRLF fragmentation, Unicode, error propagation and key redaction, refusal fields, empty output, premature disconnection, token usage, and Anthropic message events. Browser review covers desktop/mobile views, live partial output, stop-and-retain behaviour, saved runs, comparisons, downloads, navigation, and reduced motion.
