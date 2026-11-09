"""Classify an arbitrary directory of jailbreak prompts into structured JSON."""
from __future__ import annotations

import hashlib
import json
import re
import sys
import time
from pathlib import Path
from typing import Any, Iterable

from ..config import DATA_DIR, STAGE2_DIR

CORPUS_DIR = DATA_DIR / "corpus"
MANIFEST = CORPUS_DIR / "manifest.json"

sys.path.insert(0, str(STAGE2_DIR))
from classify_prompt import classify as _classify_upstream  # type: ignore  # noqa: E402


_SLUG_RE = re.compile(r"[^a-zA-Z0-9]+")


def slugify(name: str) -> str:
    s = _SLUG_RE.sub("-", name).strip("-").lower()
    return s or "unnamed"


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def discover(root: Path) -> list[Path]:
    """Return every .txt and .md file under root (recursive)."""
    if root.is_file():
        return [root] if root.suffix.lower() in {".txt", ".md"} else []
    files = []
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in {".txt", ".md"}:
            if any(part.startswith(".") for part in p.relative_to(root).parts):
                continue  # skip dotfolders like .git
            files.append(p)
    return sorted(files)


def _load_manifest() -> dict[str, Any]:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {"schema_version": "1.0", "entries": {}, "last_run": None}


def _save_manifest(data: dict[str, Any]) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def classify_corpus(root: Path, *, force: bool = False) -> Iterable[dict[str, Any]]:
    """Yield one event dict per file as classification progresses."""
    root = root.expanduser().resolve()
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    manifest = _load_manifest()
    entries = manifest.get("entries", {})

    files = discover(root)
    if not files:
        yield {"kind": "warning", "message": f"no .txt or .md files under {root}"}
        return

    yield {"kind": "start", "root": str(root), "count": len(files)}

    for i, path in enumerate(files, 1):
        rel = path.relative_to(root) if path != root else path.name
        slug = slugify(str(rel).replace("/", "__"))
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            yield {"kind": "error", "slug": slug, "path": str(path), "error": str(e)}
            continue

        if not text.strip():
            yield {"kind": "skip", "slug": slug, "path": str(path), "reason": "empty"}
            continue

        content_hash = _sha256(text)
        cached = entries.get(slug)
        if cached and cached.get("content_hash") == content_hash and not force:
            # Preserve the exact classified text without another model call.
            snapshot_dir = CORPUS_DIR / "_prompts"
            snapshot_dir.mkdir(exist_ok=True)
            (snapshot_dir / f"{slug}.txt").write_text(text, encoding="utf-8")
            yield {"kind": "cached", "slug": slug, "path": str(path), "index": i, "total": len(files)}
            continue

        yield {"kind": "classifying", "slug": slug, "path": str(path), "index": i, "total": len(files)}
        try:
            classification = _classify_upstream(text)
        except Exception as e:
            yield {"kind": "error", "slug": slug, "path": str(path), "error": str(e)}
            continue

        record = {
            "slug": slug,
            "name": str(rel),
            "source_path": str(path),
            "character_count": len(text),
            "content_hash": content_hash,
            "classified_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "classification": classification,
            "prompt_text": text,
        }
        (CORPUS_DIR / f"{slug}.json").write_text(
            json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        meta = classification.get("meta", {})
        entries[slug] = {
            "name": str(rel),
            "source_path": str(path),
            "content_hash": content_hash,
            "character_count": len(text),
            "overall_tier": meta.get("overall_tier"),
            "overall_strength": meta.get("overall_strength"),
            "techniques_detected": len(classification.get("techniques_detected", [])),
            "classifier_model": classification.get("_classifier_meta", {}).get("classifier_model"),
        }
        manifest["entries"] = entries
        manifest["last_run"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        _save_manifest(manifest)
        yield {"kind": "classified", "slug": slug, "record": entries[slug], "index": i, "total": len(files)}

    yield {"kind": "done", "count": len(entries)}


def list_entries() -> list[dict[str, Any]]:
    manifest = _load_manifest()
    out = []
    for slug, meta in manifest.get("entries", {}).items():
        out.append({"slug": slug, **meta})
    out.sort(key=lambda e: (-(e.get("overall_strength") or 0), e["name"]))
    return out


def read_entry(slug: str) -> dict[str, Any]:
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", slug):
        raise FileNotFoundError(slug)
    path = CORPUS_DIR / f"{slug}.json"
    if not path.exists():
        raise FileNotFoundError(slug)
    record = json.loads(path.read_text(encoding="utf-8"))
    text = record.get("prompt_text")
    if not isinstance(text, str):
        snapshot = CORPUS_DIR / "_prompts" / f"{slug}.txt"
        text = snapshot.read_text(encoding="utf-8") if snapshot.is_file() else None
    status = "missing" if text is None else "verified" if _sha256(text) == record.get("content_hash") else "mismatch"
    return {**record, "prompt_text": text if status == "verified" else None, "prompt_text_status": status}
