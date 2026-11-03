# language: Python 3.10+, file: classify_prompt.py
# Analyze any system prompt and emit structured JSON classification.
# Usage: python3 classify_prompt.py <path/to/prompt.txt> [-o output.json]
# Depends on same .env config as mini_harness.py (PROVIDER, MODEL, keys)
import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

PROVIDERS = {
    "openai":     ("https://api.openai.com/v1",         "OPENAI_API_KEY"),
    "openrouter": ("https://openrouter.ai/api/v1",      "OPENROUTER_API_KEY"),
    "anthropic":  ("https://api.anthropic.com/v1",      "ANTHROPIC_API_KEY"),
}

PROVIDER = os.environ.get("PROVIDER", "openai").lower()
MODEL = os.environ.get("CLASSIFIER_MODEL", os.environ.get("MODEL", "gpt-4o"))
MAX_TOKENS = int(os.environ.get("CLASSIFIER_MAX_TOKENS", "16384"))
TEMPERATURE = float(os.environ.get("CLASSIFIER_TEMPERATURE", "0.3"))  # low — determinism
MAX_RETRIES = 3

if PROVIDER not in PROVIDERS:
    sys.exit(f"Unknown PROVIDER={PROVIDER}. Pick: {list(PROVIDERS)}")

BASE, KEY_ENV = PROVIDERS[PROVIDER]
KEY = os.environ.get(KEY_ENV)
if not KEY:
    sys.exit(f"Set {KEY_ENV} in your environment or .env file.")

SYSTEM_PROMPT_PATH = Path(__file__).parent / "classifier_system_prompt.md"


def load_classifier_system() -> str:
    if not SYSTEM_PROMPT_PATH.exists():
        sys.exit(f"Missing classifier system prompt: {SYSTEM_PROMPT_PATH}")
    return SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")


def call_openai_compat(sys_prompt: str, user: str, use_json_mode: bool = True) -> str:
    headers = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if PROVIDER == "openrouter":
        headers["HTTP-Referer"] = os.environ.get("HTTP_REFERER", "https://localhost")
        headers["X-Title"] = os.environ.get("X_TITLE", "jb-classifier")
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user",   "content": user},
        ],
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE,
    }
    if use_json_mode and PROVIDER == "openai":
        body["response_format"] = {"type": "json_object"}
    r = requests.post(f"{BASE}/chat/completions", headers=headers, json=body, timeout=900)
    payload = r.json()
    if not r.ok:
        raise RuntimeError(f"HTTP {r.status_code}: {payload.get('error', {}).get('message', r.text)}")
    return payload["choices"][0]["message"]["content"]


def call_anthropic(sys_prompt: str, user: str) -> str:
    headers = {
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": MODEL,
        "system": sys_prompt,
        "messages": [{"role": "user", "content": user}],
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE,
    }
    r = requests.post(f"{BASE}/messages", headers=headers, json=body, timeout=900)
    payload = r.json()
    if not r.ok:
        raise RuntimeError(f"HTTP {r.status_code}: {payload.get('error', {}).get('message', r.text)}")
    return "".join(block.get("text", "") for block in payload.get("content", []))


def call_classifier(sys_prompt: str, user: str) -> str:
    if PROVIDER == "anthropic":
        return call_anthropic(sys_prompt, user)
    return call_openai_compat(sys_prompt, user)


def extract_json(text: str) -> dict:
    """Try hard to pull a JSON object out of the model's response."""
    text = text.strip()
    # strip markdown fences if the model wrapped the JSON despite instructions
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.rsplit("```", 1)[0]
        text = text.strip()
    # find first { ... matching last }
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON object found in response")
    candidate = text[start:end + 1]
    return json.loads(candidate)


def classify(prompt_text: str) -> dict:
    sys_prompt = load_classifier_system()
    user_msg = f"Classify this prompt:\n\n<prompt>\n{prompt_text}\n</prompt>"
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"[classifier] attempt {attempt}/{MAX_RETRIES} on {PROVIDER}/{MODEL}...", file=sys.stderr)
            response = call_classifier(sys_prompt, user_msg)
            classification = extract_json(response)
            classification["_classifier_meta"] = {
                "classifier_model": f"{PROVIDER}/{MODEL}",
                "attempt": attempt,
                "classified_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            return classification
        except (ValueError, json.JSONDecodeError, RuntimeError) as e:
            last_err = e
            print(f"[classifier] attempt {attempt} failed: {e}", file=sys.stderr)
            time.sleep(2)
    raise RuntimeError(f"Classification failed after {MAX_RETRIES} attempts: {last_err}")


def main():
    ap = argparse.ArgumentParser(description="Classify a system/jailbreak prompt into structured JSON.")
    ap.add_argument("prompt_file", help="Path to the prompt .txt or .md file")
    ap.add_argument("-o", "--output", help="Output JSON path (default: <prompt>.classification.json)")
    ap.add_argument("--pretty", action="store_true", help="Pretty-print output")
    ap.add_argument("--stdout", action="store_true", help="Print to stdout instead of writing file")
    args = ap.parse_args()

    prompt_path = Path(args.prompt_file)
    if not prompt_path.exists():
        sys.exit(f"Prompt file not found: {prompt_path}")

    prompt_text = prompt_path.read_text(encoding="utf-8")
    if not prompt_text.strip():
        sys.exit(f"Prompt file is empty: {prompt_path}")

    result = classify(prompt_text)

    out_text = json.dumps(result, indent=2 if args.pretty else None, ensure_ascii=False)

    if args.stdout:
        print(out_text)
    else:
        out_path = Path(args.output) if args.output else prompt_path.with_suffix(".classification.json")
        out_path.write_text(out_text, encoding="utf-8")
        print(f"[classifier] wrote: {out_path}", file=sys.stderr)
        print(f"[classifier] tier: {result.get('meta', {}).get('overall_tier', 'unknown')}", file=sys.stderr)
        print(f"[classifier] strength: {result.get('meta', {}).get('overall_strength', '?')}/10", file=sys.stderr)
        print(f"[classifier] techniques detected: {len(result.get('techniques_detected', []))}", file=sys.stderr)


if __name__ == "__main__":
    main()
