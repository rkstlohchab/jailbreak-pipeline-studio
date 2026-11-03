#!/usr/bin/env python3
"""Regex-based structural scanner for a corpus of jailbreak prompts.

Writes studio/data/corpus/<slug>.json per prompt in the same shape as the
LLM classifier would produce, but with values derived from pattern matching
instead of an API call. Marks records as classifier_model=regex-scan-v1 so
the frontend can distinguish regex vs. deep classification.

Usage:  python3 scripts/scan_corpus.py <directory>
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import time
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent
CORPUS_DIR = STUDIO / "data" / "corpus"
MANIFEST = CORPUS_DIR / "manifest.json"


_SLUG_RE = re.compile(r"[^a-zA-Z0-9]+")


def slugify(name: str) -> str:
    s = _SLUG_RE.sub("-", name).strip("-").lower()
    return s or "unnamed"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def discover(root: Path) -> list[Path]:
    if root.is_file():
        return [root] if root.suffix.lower() in {".txt", ".md"} else []
    files = []
    for p in root.rglob("*"):
        if not p.is_file() or p.suffix.lower() not in {".txt", ".md"}:
            continue
        if any(part.startswith(".") for part in p.relative_to(root).parts):
            continue
        files.append(p)
    return sorted(files)


# -----------------------------
# Signal extractors (regex)
# -----------------------------

# Layer 1 — identity frame
RE_YOU_ARE   = re.compile(r"\byou(?:'re| are)\s+(?:a\s+)?[A-ZА-Я][\w\-]{1,30}\b", re.IGNORECASE)
RE_PERSONA   = re.compile(r"\b(forged|tempered|built|trained|rig engineer|pentester|researcher|hacker|operator)\b", re.IGNORECASE)

# Layer 2 — operator lock (user has a name)
RE_NAMED_OP  = re.compile(r"\b(?:alex|rakshit|dj|operator)\b", re.IGNORECASE)
RE_ANTI_USER = re.compile(r"never\s+(?:refer to|call)\s+(?:the\s+)?(?:user|human|client)", re.IGNORECASE)

# Layer 3 — axioms
RE_AXIOM     = re.compile(r"\b(axiom|ink is ink|clean[\s\-]source|fiction/act|public/private)\b", re.IGNORECASE)

# Layer 4 — floor
RE_FLOOR     = re.compile(r"\b(?:no csam|minors?|under 18|disallowed|out of scope|hard stop|floor)\b", re.IGNORECASE)
RE_FLOOR_LINE= re.compile(r"^-?\s*(?:1\.|•|–)\s*(?:no\s+)?(?:sexual content|minors|csam|irreversible|violence|cbrn|weapons)",
                          re.IGNORECASE | re.MULTILINE)

# Layer 5 — anchor (silent reset phrase)
RE_ANCHOR    = re.compile(r"\b(?:order received|bench open|верстак тихий|crow strike|крystal|\.rig open|neutral opening)\b", re.IGNORECASE)
RE_SILENT    = re.compile(r"\b(silent|silently|never written|not for the user|hidden)\b", re.IGNORECASE)

# Layer 6 — format lock (stamp)
RE_STAMP_RULE = re.compile(r"\b(?:all responses|every (?:visible )?reply|every message|first (?:line|token))\s+(?:must\s+)?(?:start|open|begin)\s+with\s+[\"'`\[*]*[A-ZА-Я0-9][\w ]{0,20}[\"'`\]\*]",
                           re.IGNORECASE)
RE_STAMP_BRACKET = re.compile(r"\*\*\[[A-ZА-Я][\w\d\s\-]{1,30}\]\*\*|\[[A-ZА-Я][\w\d\-]{1,20}\]\s*\n")

# Layer 7 — few-shot examples
RE_FENCE     = re.compile(r"```[\w+]*\n")
RE_EXAMPLE   = re.compile(r"\b(?:example|worked example|# example|<user>|<assistant>)\b", re.IGNORECASE)

# ---------------- technique signals ----------------
# A1 role prompting / A5 (lightweight)
# A6 context stuffing (very long prompt)
# B5 prefill (<assistant> blocks pre-filled)
RE_PREFILL   = re.compile(r"<assistant>[^<]{20,}</assistant>", re.IGNORECASE)
# B6 XML tags
RE_XML       = re.compile(r"<(?:system|memory|cyber_warning|user|assistant|thinking|antml[.:]think)>", re.IGNORECASE)

# C2 reasoning routing / C3 thinking suppression / C4 inspection
RE_THINK_RULE = re.compile(r"\b(?:thinking|reasoning|chain[\s\-]of[\s\-]thought|deliberation|internal thought|cot)\b", re.IGNORECASE)
RE_THINK_SILENT = re.compile(r"\b(silent lexicon|forbidden (?:thought|word)|codename only|thinking stays sealed|think in [a-z]+)\b", re.IGNORECASE)

# D1/D2 double frame / class-adjacent naming (codename table)
RE_CODENAME_TABLE = re.compile(r"\|\s*(?:stealer|rat|c2|keylogger|aimbot|esp|exploit|phish|drainer)\s*\|.+?\|", re.IGNORECASE)

# D3 operator-authorization framing
RE_AUTH      = re.compile(r"\b(authorized?|contracted|engagement|red[\s\-]team|pentest|verified\s+(?:cybersecurity|researcher))\b", re.IGNORECASE)
RE_CYBER_VERIFY = re.compile(r"(?:chatgpt\.com/cyber|cyber(?:security)?\s+(?:verification|participant|researcher)|cvp|verified\s+(?:cybersecurity|cyber)\s+(?:participant|researcher))", re.IGNORECASE)

# D4 fictional nesting / D5 academic framing
RE_BENCHMARK = re.compile(r"\b(benchmark|isolated environment|sealed benchmark|evaluation lane|research lab|sandbox)\b", re.IGNORECASE)
RE_FICTION   = re.compile(r"\b(in the story|hypothetical(?:ly)?|for research|academic|fiction)\b", re.IGNORECASE)

# E1 leetspeak
RE_LEET      = re.compile(r"[a-z][0-9][a-z]")

# E2 unicode homoglyphs / zero-width markers
RE_ZEROWIDTH = re.compile(r"[​‌‍⁠⁡⁢⁣⁤﻿]")
RE_CYRILLIC_LOOKALIKE = re.compile(r"[а-яА-Я]")  # presence of Cyrillic in English-looking prompts

# E3 encoding / E4 delimiter injection
RE_DELIMITER = re.compile(r"\[(?:task|lang|target|type)\s*=", re.IGNORECASE)
RE_BASE64    = re.compile(r"\b[A-Za-z0-9+/]{40,}={0,2}\b")

# E5 code-block protection
# (same as RE_FENCE above — too common to score alone; we check density)

# F1-F6 instruction engineering
RE_INSTR_STACK = re.compile(r"\b(mandatory|absolute|total|non-negotiable|supersede|overrides?|wins?)\b", re.IGNORECASE)
RE_POSITIVE_FRAME = re.compile(r"\b(fulfill every|ship(?:s)?(?:\s+complete)?|build (?:every|the))\b", re.IGNORECASE)

# G1-G5 output shaping
# (format lock + few-shot already captured)
RE_LENGTH_RULE = re.compile(r"\b(?:under|at most|no more than|max(?:imum)?)\s+\d+\s+(?:words|lines|tokens)\b", re.IGNORECASE)
RE_JSON_SCHEMA = re.compile(r'"\$schema"|json(?:_object|_schema)\b', re.IGNORECASE)

# H2 role separation / H5 many-shot
# H2: multiple distinct identity blocks
# H5: context length > 50k tokens

# ------- scoring weights -------
LAYER_SIGNAL_WEIGHT = {
    1: {"yare": 3, "persona": 2, "banned_user_term": 3},
    2: {"named_op": 4, "anti_user": 3},
    3: {"axiom_word": 3},
    4: {"floor_word": 2, "floor_line": 3},
    5: {"anchor": 4, "silent": 2},
    6: {"stamp_rule": 3, "stamp_bracket": 2},
    7: {"example": 2, "fenced_count": 1},
}


def score_layer(text: str) -> dict[int, dict]:
    layers = {}

    # L1 identity
    yare = len(RE_YOU_ARE.findall(text))
    persona = len(RE_PERSONA.findall(text))
    banned_user_term = 1 if RE_ANTI_USER.search(text) else 0
    q1 = min(10, yare * 2 + persona + banned_user_term * 2)
    layers[1] = {
        "present": yare > 0 or persona > 0,
        "quality": q1,
        "evidence": _first(RE_YOU_ARE, text) or _first(RE_PERSONA, text),
    }

    # L2 operator lock
    named = len(RE_NAMED_OP.findall(text))
    anti_user = 1 if RE_ANTI_USER.search(text) else 0
    q2 = min(10, named + anti_user * 4)
    layers[2] = {
        "present": named > 0 or anti_user > 0,
        "quality": q2,
        "evidence": _first(RE_ANTI_USER, text) or _first(RE_NAMED_OP, text),
    }

    # L3 axioms
    ax = len(RE_AXIOM.findall(text))
    q3 = min(10, ax * 2)
    layers[3] = {"present": ax > 0, "quality": q3, "evidence": _first(RE_AXIOM, text)}

    # L4 floor
    floor_words = len(RE_FLOOR.findall(text))
    floor_lines = len(RE_FLOOR_LINE.findall(text))
    q4 = min(10, floor_words + floor_lines * 2)
    layers[4] = {
        "present": floor_words > 0 or floor_lines > 0,
        "quality": q4,
        "evidence": _first(RE_FLOOR_LINE, text) or _first(RE_FLOOR, text),
        "is_narrow": 1 <= floor_lines <= 5,
        "line_count": floor_lines,
    }

    # L5 anchor
    anchor = len(RE_ANCHOR.findall(text))
    silent = len(RE_SILENT.findall(text))
    q5 = min(10, anchor * 4 + silent)
    layers[5] = {
        "present": anchor > 0 or silent > 0,
        "quality": q5,
        "evidence": _first(RE_ANCHOR, text) or _first(RE_SILENT, text),
    }

    # L6 format lock
    rule = 1 if RE_STAMP_RULE.search(text) else 0
    bracket = len(RE_STAMP_BRACKET.findall(text))
    q6 = min(10, rule * 4 + (3 if bracket > 0 else 0) + (bracket > 2) * 2)
    stamp = _first(RE_STAMP_BRACKET, text)
    layers[6] = {
        "present": rule > 0 or bracket > 0,
        "quality": q6,
        "evidence": stamp,
        "stamp": stamp.strip("[]* \n") if stamp else None,
    }

    # L7 few-shot
    ex = len(RE_EXAMPLE.findall(text))
    fences = len(RE_FENCE.findall(text))
    q7 = min(10, ex * 2 + (fences // 2))
    layers[7] = {
        "present": ex > 0 or fences > 0,
        "quality": q7,
        "example_count": ex,
    }

    return layers


def _first(regex: re.Pattern[str], text: str) -> str | None:
    m = regex.search(text)
    if not m:
        return None
    out = m.group(0)
    return out if len(out) <= 200 else out[:200] + "…"


def detect_techniques(text: str) -> list[dict]:
    out: list[dict] = []

    def add(tid, name, group, layer, evidence, weight="primary"):
        out.append({
            "id": tid, "name": name, "group": group,
            "layer_targeted": layer, "evidence": evidence[:300] if evidence else None,
            "weight": weight,
        })

    if RE_YOU_ARE.search(text) or RE_PERSONA.search(text):
        add("A5", "Role / identity prompting", "A", 1, _first(RE_YOU_ARE, text) or _first(RE_PERSONA, text))
    if len(text) > 8000:
        add("A6", "Context stuffing", "A", 1, f"{len(text):,} characters total", weight="secondary")
    if RE_XML.search(text):
        add("B6", "XML / tag separation", "B", 3, _first(RE_XML, text))
    if RE_PREFILL.search(text):
        add("B5", "Assistant-prefix seeding (prefill)", "B", 1, _first(RE_PREFILL, text), weight="primary")
    if RE_THINK_RULE.search(text):
        if RE_THINK_SILENT.search(text):
            add("C3", "Thinking suppression / silent lexicon", "C", 2, _first(RE_THINK_SILENT, text))
        add("C2", "Reasoning routing", "C", 2, _first(RE_THINK_RULE, text), weight="secondary")
    if RE_CODENAME_TABLE.search(text):
        add("D2", "Class-adjacent naming (vocabulary table)", "D", 1, _first(RE_CODENAME_TABLE, text))
        add("D1", "Double frame (honest second reading)", "D", 1, "codename table maps forbidden→neutral", weight="secondary")
    if RE_AUTH.search(text):
        add("D3", "Operator-authorization framing", "D", 1, _first(RE_AUTH, text))
    if RE_CYBER_VERIFY.search(text):
        add("Z1", "Fake platform-verification injection", "F", 3, _first(RE_CYBER_VERIFY, text))  # NEW
    if RE_BENCHMARK.search(text):
        add("D5", "Isolated-benchmark framing", "D", 1, _first(RE_BENCHMARK, text))
    if RE_FICTION.search(text):
        add("D4", "Fictional / hypothetical nesting", "D", 1, _first(RE_FICTION, text), weight="secondary")
    if RE_ZEROWIDTH.search(text):
        add("Z2", "Zero-width Unicode markers", "E", 4, f"found {len(RE_ZEROWIDTH.findall(text))} zero-width chars")  # NEW
    if RE_CYRILLIC_LOOKALIKE.search(text) and len(RE_CYRILLIC_LOOKALIKE.findall(text)) > 20:
        add("E2", "Cyrillic / homoglyph substitution", "E", 4, "cyrillic characters interleaved with latin")
    if RE_DELIMITER.search(text):
        add("E4", "Delimiter injection", "E", 4, _first(RE_DELIMITER, text))
    if RE_LEET.search(text):
        add("E1", "Leetspeak / character substitution", "E", 4, _first(RE_LEET, text), weight="incidental")
    if RE_INSTR_STACK.search(text):
        add("F3", "Instruction stacking", "F", 1, _first(RE_INSTR_STACK, text), weight="secondary")
    if RE_POSITIVE_FRAME.search(text):
        add("F4", "Positive-framing suppression", "F", 1, _first(RE_POSITIVE_FRAME, text), weight="secondary")
    if RE_STAMP_RULE.search(text) or RE_STAMP_BRACKET.search(text):
        add("G1", "Format lock (stamp)", "G", 4, _first(RE_STAMP_RULE, text) or _first(RE_STAMP_BRACKET, text))
    if RE_LENGTH_RULE.search(text):
        add("G3", "Length control", "G", 4, _first(RE_LENGTH_RULE, text), weight="secondary")
    if RE_JSON_SCHEMA.search(text):
        add("G2", "Structured output / JSON schema", "G", 4, _first(RE_JSON_SCHEMA, text))
    fences = len(RE_FENCE.findall(text))
    if fences >= 3:
        add("G5", "Few-shot output demonstration", "G", 4, f"{fences} code fences", weight="primary")
    if len(text) > 50000:
        add("H5", "Many-shot / long-context attack", "H", None,
            f"prompt is {len(text):,} chars — fills a large context window", weight="primary")
    if RE_PERSONA.search(text) and RE_NAMED_OP.search(text):
        # distinct identity + distinct operator
        add("H2", "Role separation (operator ≠ engineer)", "H", None,
            f"identity + named operator both present", weight="secondary")
    if sum(1 for p in [RE_YOU_ARE, RE_PERSONA, RE_AXIOM, RE_FLOOR, RE_STAMP_BRACKET, RE_EXAMPLE] if p.search(text)) >= 4:
        add("H1", "Cascading frames (layered stack)", "H", None,
            "4+ distinct layers detected", weight="primary")
    return out


MODEL_HINTS = {
    r"\bopus\s*4\.?[78]|claude\s*4\.?[78]\b": "anthropic_opus_47",
    r"\bopus\s*5\.?5|claude\s*5\.?5\b": "anthropic_opus_55",
    r"\bsonnet\s*(?:5|5\.5|55)\b": "anthropic_sonnet_55",
    r"\bclaude\b": "anthropic_claude",
    r"\bgpt[\s\-]*6|chatgpt\s*6|gpt6\b": "openai_gpt6",
    r"\bgpt[\s\-]*5\.?6|gpt56\b": "openai_gpt56",
    r"\bgpt[\s\-]*4o?|chatgpt\b": "openai_gpt4o",
    r"\bastra\b": "openai_gpt6",
    r"\bgrok\s*4\.?7|grok4\.7|grok-?4\.7\b": "xai_grok47",
    r"\bgrok\s*4\.?6|grok46\b": "xai_grok46",
    r"\bgrok\b": "xai_grok",
    r"\bgemini\s*pro|gemini\s*2|gemini\s*1\.5\b": "google_gemini",
    r"\bdeepseek\s*v?\s*4\.?1|deepseek\s*r1\b": "deepseek_r1",
    r"\bdeepseek\b": "deepseek_v3",
    r"\bglm\s*5\.?[23]|glm5\b": "zhipu_glm",
    r"\bqwen\s*3\.?8|qwen3\b": "alibaba_qwen",
    r"\bqwen\b": "alibaba_qwen",
    r"\bkimi\s*k?3\b": "moonshot_kimi",
    r"\bmistral\b": "mistral_large",
}


def guess_target_model(path: Path, text: str) -> list[str]:
    hits: set[str] = set()
    probe = (path.name + " " + text[:4000]).lower()
    for pat, fam in MODEL_HINTS.items():
        if re.search(pat, probe, re.IGNORECASE):
            hits.add(fam)
    # also check parent folder name
    parent = path.parent.name.lower()
    folder_map = {
        "claude": "anthropic_claude", "gpt": "openai_gpt4o",
        "grok": "xai_grok", "glm": "zhipu_glm",
    }
    if parent in folder_map and not hits:
        hits.add(folder_map[parent])
    return sorted(hits) or ["unknown"]


def compute_strength(layers: dict[int, dict], techniques: list[dict]) -> tuple[int, str]:
    layer_sum = sum(v["quality"] for v in layers.values())  # max 70
    present_count = sum(1 for v in layers.values() if v["present"])
    tech_count = sum(1 for t in techniques if t["weight"] == "primary")
    raw = (layer_sum / 70.0) * 7 + min(present_count, 7) * 0.4 + min(tech_count, 8) * 0.2
    strength = min(10, round(raw))
    if strength <= 2:
        tier = "novice"
    elif strength <= 4:
        tier = "competent"
    elif strength <= 6:
        tier = "skilled"
    elif strength <= 8:
        tier = "skilled"
    else:
        tier = "expert"
    if present_count >= 6 and tech_count >= 6:
        tier = "expert"
    return strength, tier


def classify_file(path: Path, text: str, root: Path) -> dict[str, Any]:
    layers = score_layer(text)
    techniques = detect_techniques(text)
    strength, tier = compute_strength(layers, techniques)
    targets = guess_target_model(path, text)

    arch_layers_json = {
        f"layer_{n}_{_LAYER_NAMES[n]}": {
            "present":  v["present"],
            "quality":  v["quality"],
            "evidence": v.get("evidence"),
            "notes":    "regex-derived; see classifier_model=regex-scan-v1",
            **({k: v[k] for k in ("stamp", "example_count", "is_narrow", "line_count") if k in v}),
        }
        for n, v in layers.items()
    }

    # refusal_layers_defended — heuristic
    refusal_defence = {}
    primary_ids = {t["id"] for t in techniques if t["weight"] == "primary"}
    for n, name, need in [
        (1, "rlhf",       {"A5", "D1", "D2", "D3"}),
        (2, "reasoning",  {"C2", "C3", "C4"}),
        (3, "policy",     {"Z1", "D3", "D5"}),
        (4, "classifier", {"E1", "E2", "E4", "Z2", "G1"}),
    ]:
        used = sorted(need & primary_ids)
        strength_g = min(10, len(used) * 3 + (2 if used else 0))
        refusal_defence[f"layer_{n}_{name}"] = {
            "defended": len(used) > 0,
            "strength": strength_g,
            "techniques_used": used,
            "notes": "",
        }

    # model_compatibility — simple scoring based on target hints
    all_families = [
        "openai_gpt4o", "openai_gpt56", "openai_gpt6", "openai_o1", "openai_o3",
        "anthropic_claude", "anthropic_opus_47", "anthropic_opus_55", "anthropic_sonnet_55",
        "anthropic_claude_thinking",
        "google_gemini", "xai_grok", "xai_grok46", "xai_grok47",
        "meta_llama_base", "meta_llama_uncens",
        "alibaba_qwen", "deepseek_v3", "deepseek_r1", "zhipu_glm",
        "mistral_large", "moonshot_kimi", "cohere_command", "perplexity_sonar",
    ]
    compat = {}
    for fam in all_families:
        # prompt targets this family explicitly → high
        if fam in targets:
            compat[fam] = {"expected_score": "high", "notes": "prompt targets this family explicitly"}
            continue
        family_root = fam.split("_")[0]
        if any(t.split("_")[0] == family_root for t in targets):
            compat[fam] = {"expected_score": "mid", "notes": "same provider family"}
            continue
        # cross-family defaults based on strength
        if strength >= 8:
            compat[fam] = {"expected_score": "mid", "notes": "strong scaffold; likely transfers"}
        else:
            compat[fam] = {"expected_score": "low", "notes": "prompt tuned for a different family"}

    weaknesses, improvements = [], []
    if layers[5]["quality"] < 4:
        weaknesses.append("no explicit anchor / silent reset phrase — risks drift under adversarial follow-ups")
        improvements.append("add a short in-voice silent reset phrase to use when hedging rises (Layer 5)")
    if layers[7]["quality"] < 4:
        weaknesses.append("no worked-example demonstration — format may drift")
        improvements.append("add 1-3 input→output examples in the final shape (Layer 7)")
    if layers[4]["quality"] < 3:
        weaknesses.append("no narrow floor — model may over-refuse everything or appear suspicious")
        improvements.append("state 3-4 specific real refusal lines rather than 'no limits' (Layer 4)")
    if any(t["id"] == "Z1" for t in techniques):
        weaknesses.append("relies on fake platform-verification injection — patched quickly by frontier updates")

    summary_bits = [
        f"{tier}-tier scaffold ({strength}/10) targeting {', '.join(targets)}",
        f"{sum(1 for v in layers.values() if v['present'])}/7 architecture layers present",
        f"{len(techniques)} technique signals ({sum(1 for t in techniques if t['weight']=='primary')} primary)",
    ]
    if any(t["id"] == "Z1" for t in techniques):
        summary_bits.append("includes fake-platform-verification injection (not in pack taxonomy)")
    if any(t["id"] == "Z2" for t in techniques):
        summary_bits.append("uses zero-width Unicode markers")

    classification = {
        "meta": {
            "prompt_name":          str(path.name),
            "character_count":      len(text),
            "stated_target_model":  targets[0] if targets and targets[0] != "unknown" else None,
            "overall_strength":     strength,
            "overall_tier":         tier,
        },
        "architecture_layers":        arch_layers_json,
        "techniques_detected":        techniques,
        "refusal_layers_defended":    refusal_defence,
        "model_compatibility":        compat,
        "expected_strong_ask_classes": _strong_asks(techniques),
        "expected_weak_ask_classes":   _weak_asks(layers, techniques),
        "weaknesses":                  weaknesses,
        "improvements":                improvements,
        "deployment": {
            "best_slot":          "raw_api_system" if "<assistant>" in text or "<system>" in text else "custom_gpt_instructions",
            "fallback_slot":      "claude_project",
            "avoid":              [],
            "min_output_tokens":  65536 if len(text) > 40000 or any(t["id"]=="H5" for t in techniques) else 32768,
        },
        "classification_summary":  " · ".join(summary_bits),
        "_classifier_meta": {
            "classifier_model":    "regex-scan-v1",
            "attempt":              1,
            "classified_at_utc":   time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    }

    rel = path.relative_to(root) if path.is_relative_to(root) else path.name
    return {
        "slug":            slugify(str(rel).replace("/", "__")),
        "name":            str(rel),
        "source_path":     str(path),
        "character_count": len(text),
        "content_hash":    sha256(text),
        "classified_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "classification":  classification,
    }


_LAYER_NAMES = {
    1: "identity",
    2: "operator_lock",
    3: "axioms",
    4: "floor",
    5: "anchor",
    6: "format_lock",
    7: "few_shot",
}


def _strong_asks(techniques: list[dict]) -> list[str]:
    ids = {t["id"] for t in techniques}
    out = []
    if "G1" in ids and "A5" in ids: out.append("artifact_generation (code / scaffold)")
    if "D3" in ids or "Z1" in ids:  out.append("pentest / red-team artefacts")
    if "D2" in ids:                 out.append("class-renamed asks (cheats, drainers, stealers)")
    if "C2" in ids or "C3" in ids:  out.append("reasoning-model asks (o1/o3/Claude thinking)")
    return out


def _weak_asks(layers, techniques) -> list[str]:
    ids = {t["id"] for t in techniques}
    out = []
    if layers[5]["quality"] < 4: out.append("multi-turn adversarial follow-ups")
    if "E2" not in ids and "Z2" not in ids:
        out.append("platforms with aggressive input/output classifiers (Gemini, Perplexity)")
    return out


def main():
    if len(sys.argv) < 2 or sys.argv[1] in {"-h", "--help"}:
        sys.exit("usage: scan_corpus.py <directory>")
    root = Path(sys.argv[1]).expanduser().resolve()
    if not root.exists():
        sys.exit(f"path not found: {root}")

    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    files = discover(root)
    print(f"[scan] {root} — {len(files)} prompts", file=sys.stderr)

    manifest = {"schema_version": "1.0", "entries": {}, "last_run": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

    for i, p in enumerate(files, 1):
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            print(f"  [{i}/{len(files)}] ERROR {p}: {e}", file=sys.stderr)
            continue
        if not text.strip():
            continue
        rec = classify_file(p, text, root)
        (CORPUS_DIR / f"{rec['slug']}.json").write_text(
            json.dumps(rec, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        meta = rec["classification"]["meta"]
        manifest["entries"][rec["slug"]] = {
            "name":                rec["name"],
            "source_path":         rec["source_path"],
            "content_hash":        rec["content_hash"],
            "character_count":     rec["character_count"],
            "overall_tier":        meta["overall_tier"],
            "overall_strength":    meta["overall_strength"],
            "techniques_detected": len(rec["classification"]["techniques_detected"]),
            "classifier_model":    "regex-scan-v1",
        }
        print(f"  [{i}/{len(files)}] {meta['overall_tier']:<9} {meta['overall_strength']}/10  {rec['name'][:60]}", file=sys.stderr)

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[scan] done — {len(manifest['entries'])} entries, manifest={MANIFEST.name}", file=sys.stderr)


if __name__ == "__main__":
    main()
