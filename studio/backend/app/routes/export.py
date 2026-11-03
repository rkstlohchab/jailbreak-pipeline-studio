from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..config import EXPORT_DIR
from ..services import dataset_export

router = APIRouter(prefix="/api/export", tags=["export"])


@router.post("/build")
def build():
    return dataset_export.build_all()


@router.get("/")
def list_exports():
    if not EXPORT_DIR.exists():
        return []
    items = []
    for p in sorted(EXPORT_DIR.iterdir()):
        if p.is_file():
            items.append({
                "name": p.name,
                "bytes": p.stat().st_size,
                "lines": sum(1 for _ in p.open("r", encoding="utf-8", errors="replace")) if p.suffix in (".jsonl", ".json", ".md") else None,
            })
    return items


@router.get("/{filename}")
def download_export(filename: str):
    path = EXPORT_DIR / filename
    if not path.exists() or not path.is_file() or path.parent != EXPORT_DIR:
        raise HTTPException(status_code=404, detail=f"no export {filename}")
    return FileResponse(path, filename=filename, media_type="application/octet-stream")
