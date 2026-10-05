"""
app/api/events.py

Router untuk daftar kejadian siap pakai (Pre-configured Events).
"""

import json

from fastapi import APIRouter, HTTPException

from app.core.config import EVENTS_DIR

router = APIRouter(tags=["events"])


@router.get("/events")
def list_events():
    events_list = []
    if EVENTS_DIR.exists():
        for d in sorted(EVENTS_DIR.iterdir()):
            if d.is_dir():
                meta_file = d / "meta.json"
                if meta_file.exists():
                    try:
                        meta = json.loads(meta_file.read_text(encoding="utf-8"))
                        events_list.append({
                            "event_id": meta.get("event_id", d.name),
                            "hazard": meta.get("hazard"),
                            "name": meta.get("name"),
                            "start_utc": meta.get("start_utc"),
                            "end_utc": meta.get("end_utc"),
                            "members_source": meta.get("members_source"),
                            "n_members": meta.get("n_members"),
                            "data_status": meta.get("data_status"),
                        })
                    except Exception:
                        pass
    return {"events": events_list}


@router.get("/events/{event_id}")
def get_event_detail(event_id: str):
    meta_file = EVENTS_DIR / event_id / "meta.json"
    if not meta_file.exists():
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' tidak ditemukan.")
    return json.loads(meta_file.read_text(encoding="utf-8"))
