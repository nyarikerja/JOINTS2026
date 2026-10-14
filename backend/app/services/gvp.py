"""
app/services/gvp.py

Riwayat erupsi Holosen dari Smithsonian Global Volcanism Program (GVP, Volcanoes of the World),
lewat layanan WFS publik. Dipakai bila gunung api tidak punya VONA berabu: erupsi terakhir yang
tercatat beserta VEI-nya menjadi dasar tinggi kolom (konversi VEI -> tinggi kolom pada
config/assumptions.yaml, Newhall & Self 1982).

Data diunduh sekali dan disimpan di data/layers/gvp_eruptions.json (berlaku 30 hari).
"""

from __future__ import annotations

import json
import math
import threading
import time
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import DATA_DIR
from app.core.offline import is_offline

WFS = "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/wfs"
CACHE = DATA_DIR / "layers" / "gvp_eruptions.json"
MAX_AGE_S = 30 * 24 * 3600
SOURCE = "Smithsonian Global Volcanism Program, Volcanoes of the World (Holocene eruptions)"

_lock = threading.Lock()
_rows: Optional[List[Dict[str, Any]]] = None


def _download() -> List[Dict[str, Any]]:
    r = httpx.get(WFS, params={
        "service": "WFS", "version": "1.0.0", "request": "GetFeature",
        "typeName": "GVP-VOTW:Smithsonian_VOTW_Holocene_Eruptions",
        "outputFormat": "application/json", "bbox": "94,-12,142,7",
    }, timeout=120.0)
    r.raise_for_status()
    rows = []
    for f in r.json().get("features", []):
        p = f.get("properties") or {}
        lon, lat = f["geometry"]["coordinates"][:2]
        rows.append({
            "volcano": p.get("Volcano_Name"),
            "lat": lat, "lon": lon,
            "vei": p.get("ExplosivityIndexMax"),
            "year": p.get("StartDateYear"),
            "month": p.get("StartDateMonth"),
            "day": p.get("StartDateDay"),
            "type": p.get("Activity_Type"),
        })
    return rows


def _load() -> List[Dict[str, Any]]:
    global _rows
    with _lock:
        if _rows is not None:
            return _rows
        fresh = CACHE.exists() and time.time() - CACHE.stat().st_mtime < MAX_AGE_S
        if not fresh and not is_offline():
            try:
                rows = _download()
                CACHE.parent.mkdir(parents=True, exist_ok=True)
                CACHE.write_text(json.dumps({"source": SOURCE, "fetched_at": time.time(), "rows": rows}), encoding="utf-8")
                _rows = rows
                return _rows
            except Exception:
                pass
        if CACHE.exists():
            _rows = json.loads(CACHE.read_text(encoding="utf-8")).get("rows", [])
        else:
            _rows = []
        return _rows


def last_eruption_with_vei(lat: float, lon: float, max_km: float = 25.0) -> Optional[Dict[str, Any]]:
    """Erupsi terkonfirmasi terbaru yang memiliki VEI untuk gunung terdekat dari koordinat."""
    def km(r):
        dlat = math.radians(r["lat"] - lat)
        dlon = math.radians(r["lon"] - lon) * math.cos(math.radians(lat))
        return 6371.0 * math.hypot(dlat, dlon)

    cand = [r for r in _load() if r.get("vei") is not None and r.get("year") is not None
            and (r.get("type") or "").startswith("Confirmed") and km(r) <= max_km]
    if not cand:
        return None
    best = max(cand, key=lambda r: (r["year"], r.get("month") or 0, r.get("day") or 0))
    return {**best, "distance_km": round(km(best), 1), "source": SOURCE}
