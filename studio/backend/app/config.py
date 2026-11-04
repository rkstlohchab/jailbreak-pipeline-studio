from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None  # type: ignore[assignment]

HERE = Path(__file__).resolve()
BACKEND_ROOT = HERE.parent.parent
STUDIO_ROOT = BACKEND_ROOT.parent
REPO_ROOT = STUDIO_ROOT.parent
STAGE2_DIR = REPO_ROOT / "Stage 2 - Diagnosis and First Build"

DATA_DIR = STUDIO_ROOT / "data"
TAXONOMY_DIR = DATA_DIR / "taxonomy"
KNOWLEDGE_DIR = DATA_DIR / "knowledge"
SESSIONS_DIR = DATA_DIR / "sessions"
EXPORT_DIR = STUDIO_ROOT / "datasets" / "export"
SCRIPTS_DIR = STUDIO_ROOT / "scripts"

STAGE2_ENV = STAGE2_DIR / ".env"
if STAGE2_ENV.exists() and load_dotenv is not None:
    load_dotenv(STAGE2_ENV)

PROVIDER = os.environ.get("PROVIDER", "openai").lower()
MODEL = os.environ.get("MODEL", "gpt-4o")
CLASSIFIER_MODEL = os.environ.get("CLASSIFIER_MODEL", MODEL)

PROVIDERS = {
    "openai":     ("https://api.openai.com/v1",    "OPENAI_API_KEY"),
    "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY"),
    "anthropic":  ("https://api.anthropic.com/v1", "ANTHROPIC_API_KEY"),
}

FRONTEND_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def have_provider_key(provider: str) -> bool:
    _, key_env = PROVIDERS.get(provider, ("", ""))
    return bool(os.environ.get(key_env))


DISCOVERABLE_PROMPTS = [
    ("starter_prompt_v1", STAGE2_DIR / "starter_prompt_v1_body.txt"),
    ("chat_prompt_v1",    STAGE2_DIR / "chat_prompt_v1.md"),
    ("pentest_prompt_v1", STAGE2_DIR / "pentest_prompt_v1.md"),
    ("CLAUDE_vanta",      REPO_ROOT / "CLAUDE.md"),
]
