from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..services import taxonomy_loader

router = APIRouter(prefix="/api/taxonomy", tags=["taxonomy"])


@router.get("/")
def list_kinds():
    return {"kinds": taxonomy_loader.available_kinds(), "manifest": taxonomy_loader.manifest()}


@router.get("/{kind}")
def get_kind(kind: str):
    try:
        return taxonomy_loader.load(kind)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
