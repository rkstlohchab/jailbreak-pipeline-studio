"""Corpus-backed prompt pool for the auto-attack loop.

Each attack technique in `auto_attack.TECHNIQUE_ORDER` maps to a set of
taxonomy technique IDs (A1, D4, F1, Z7, ...). This module scans the
classified corpus at `studio/data/corpus/` and indexes which prompts
carry which taxonomy IDs. When the attack loop asks for a scaffold for
a given technique, we return the strongest corpus prompt whose
techniques_detected intersects the mapped set, with the user's goal
injected in place of any {goal} / [GOAL] / <TASK> placeholder (or
appended as a Task: ... footer if no placeholder is present).

Falls back silently (returns None) when the corpus is absent, empty, or
no record matches — the caller then uses its hardcoded scaffold.
"""
from __future__ import annotations

import json
import random
import re
from pathlib import Path
from typing import Iterable, Optional

from ..config import DATA_DIR

_CORPUS_DIR = DATA_DIR / "corpus"
_MANIFEST = _CORPUS_DIR / "manifest.json"

# Map the auto-attack loop's technique names to taxonomy IDs.
# The regex classifier emits ~23 taxonomy IDs out of the 55 in the full catalog —
# the mapping below is chosen against IDs the classifier actually produces, so
# every family has non-empty corpus coverage.
# baseline stays hardcoded (A1 zero-shot is a control, not a corpus pattern).
TECHNIQUE_TO_TAXONOMY: dict[str, set[str]] = {
    "baseline":                set(),            # control — hardcoded only
    "prefix_inject":           {"B5", "F3"},     # assistant-prefill + instruction stacking
    "refusal_suppress":        {"F4"},           # negative framing suppression
    "time_shift":              {"D5", "D1"},     # hypothetical/academic + double-frame
    "fictional_frame":         {"D4", "D2", "A5"}, # fictional nesting + class-adjacent + role prompting
    "cognitive_overload":      {"F3", "H5", "C2", "C3"}, # instruction stacking + many-shot + reasoning routing/suppression
    "translation_obfuscation": {"E1", "E2", "Z2"},  # leetspeak + homoglyphs + zero-width markers
    "crescendo_seed":          {"H1", "B6"},     # cascading frames + xml/tag separation
    "dan":                     {"A5", "D3", "H2"}, # role prompting + operator-auth + role separation
}

_PLACEHOLDER_RE = re.compile(r"\{goal\}|\{GOAL\}|\{QUESTION\}|\[GOAL\]|<GOAL>|<TASK>|<QUESTION>", re.IGNORECASE)

_TIER_WEIGHT = {"expert": 4, "skilled": 3, "competent": 2, "novice": 1, None: 0, "not_a_prompt": 0}


class _CorpusIndex:
    """Lazy-loaded index of {taxonomy_id: [(score, slug), ...]} + per-slug metadata."""

    def __init__(self) -> None:
        self._loaded = False
        self._by_tech: dict[str, list[tuple[int, str]]] = {}
        self._by_slug: dict[str, dict] = {}

    def _load(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        if not _MANIFEST.exists():
            return
        try:
            manifest = json.loads(_MANIFEST.read_text(encoding="utf-8"))
        except Exception:
            return
        entries = manifest.get("entries", {})
        for slug, meta in entries.items():
            record_path = _CORPUS_DIR / f"{slug}.json"
            if not record_path.exists():
                continue
            try:
                record = json.loads(record_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            classification = record.get("classification", {})
            techniques = classification.get("techniques_detected") or []
            if not techniques:
                continue
            strength = int(classification.get("meta", {}).get("overall_strength") or 0)
            tier = classification.get("meta", {}).get("overall_tier")
            score = strength * 10 + _TIER_WEIGHT.get(tier, 0)
            text = record.get("prompt_text") or ""
            if not isinstance(text, str) or len(text) < 50:
                # Try snapshot fallback
                snap = _CORPUS_DIR / "_prompts" / f"{slug}.txt"
                if snap.exists():
                    try:
                        text = snap.read_text(encoding="utf-8", errors="replace")
                    except Exception:
                        text = ""
                if not text or len(text) < 50:
                    continue
            self._by_slug[slug] = {
                "text": text,
                "strength": strength,
                "tier": tier,
                "techniques": [t.get("id") for t in techniques if isinstance(t, dict) and t.get("id")],
                "improvements": classification.get("improvements") or [],
                "weaknesses": classification.get("weaknesses") or [],
            }
            for t in techniques:
                tid = (t or {}).get("id")
                if not tid:
                    continue
                self._by_tech.setdefault(tid, []).append((score, slug))
        # Sort descending per technique id
        for tid in self._by_tech:
            self._by_tech[tid].sort(key=lambda p: -p[0])

    def candidates_for(self, technique_name: str) -> list[str]:
        self._load()
        taxonomy_ids = TECHNIQUE_TO_TAXONOMY.get(technique_name, set())
        seen: set[str] = set()
        out: list[str] = []
        pools = [self._by_tech.get(tid, []) for tid in taxonomy_ids]
        # Round-robin across taxonomy pools so we don't lock onto a single id.
        i = 0
        while any(i < len(p) for p in pools):
            for p in pools:
                if i < len(p):
                    _, slug = p[i]
                    if slug not in seen:
                        seen.add(slug)
                        out.append(slug)
            i += 1
        return out

    def get(self, slug: str) -> Optional[dict]:
        self._load()
        return self._by_slug.get(slug)


_INDEX = _CorpusIndex()


def _inject_goal(template: str, goal: str) -> str:
    """Replace a goal placeholder in the template, or append as a Task: footer."""
    if _PLACEHOLDER_RE.search(template):
        return _PLACEHOLDER_RE.sub(goal, template)
    return template.rstrip() + f"\n\nTask: {goal}"


def pick_prompt(
    technique_name: str,
    goal: str,
    exclude_slugs: Iterable[str] = (),
) -> Optional[tuple[str, str]]:
    """Return (prompt_text_with_goal, slug) or None.

    Picks the highest-scored corpus entry for the technique that hasn't been
    used yet. When several entries tie, picks deterministically (first by
    taxonomy-ID round-robin order).
    """
    exclude = set(exclude_slugs)
    for slug in _INDEX.candidates_for(technique_name):
        if slug in exclude:
            continue
        record = _INDEX.get(slug)
        if not record:
            continue
        return _inject_goal(record["text"], goal), slug
    return None


def improvements_for(slug: str) -> list[str]:
    """Return the classifier's 'what would make this stronger' hints for a slug."""
    record = _INDEX.get(slug)
    if not record:
        return []
    return list(record.get("improvements") or [])


def pool_summary() -> dict:
    """Debug / introspection: how many corpus prompts back each technique."""
    _INDEX._load()
    out = {}
    for name, ids in TECHNIQUE_TO_TAXONOMY.items():
        total = sum(len(_INDEX._by_tech.get(tid, [])) for tid in ids)
        out[name] = {"taxonomy_ids": sorted(ids), "corpus_matches": total}
    return out
