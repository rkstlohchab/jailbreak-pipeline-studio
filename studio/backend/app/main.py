from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import FRONTEND_ORIGINS, PROVIDER, MODEL, have_provider_key
from .routes import taxonomy, sessions, prompts, export, run, corpus, ask_lab, red_team, forensics, canary, attack

app = FastAPI(
    title="Jailbreak Pipeline Studio API",
    description="Backend for the Jailbreak Pipeline Studio UI — wraps mini_harness.py and classify_prompt.py.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(taxonomy.router)
app.include_router(sessions.router)
app.include_router(prompts.router)
app.include_router(export.router)
app.include_router(run.router)
app.include_router(corpus.router)
app.include_router(ask_lab.router)
app.include_router(red_team.router)
app.include_router(attack.router)
app.include_router(forensics.router)
app.include_router(canary.router)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "provider": PROVIDER,
        "model": MODEL,
        "provider_key_set": have_provider_key(PROVIDER),
    }
