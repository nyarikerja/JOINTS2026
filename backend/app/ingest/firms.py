"""
app/ingest/firms.py

Titik api NASA FIRMS (D09) per wilayah, di atas cache near-real-time app/services/firms_live.py.

Wilayah sebuah event:
- kawasan hutan dengan batas poligon -> titik di dalam poligon;
- kawasan hutan/zona karhutla tanpa poligon -> kotak +-AREA_HALF_DEG di sekitar pusat;
- titik kustom -> kotak +-CUSTOM_HALF_DEG.
"""

import json
from typing import Any, Dict, List, Optional

from app.core.config import BACKEND_DIR, EVENTS_DIR
from app.services import firms_live

ACTIVE_WINDOW_H = 24.0
AREA_HALF_DEG = 0.5
CUSTOM_HALF_DEG = 0.25


def _forest_geometry(event_id: str) -> Optional[Dict[str, Any]]:
    try:
        from app.db.repositories.forest_repo import ForestRepository
        f = ForestRepository.get_by_id(event_id)
        if f and f.get("geometry"):
            return f["geometry"]
    except Exception:
        pass
    path = BACKEND_DIR / "data" / "layers" / "forest_boundaries.geojson"
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
            feat = next((x for x in data.get("features", []) if x.get("id") == event_id
                         or (x.get("properties") or {}).get("id") == event_id), None)
            if feat:
                return feat["geometry"]
        except Exception:
            pass
    return None


def event_area(event_id: str, center: Optional[tuple] = None, custom: bool = False) -> Dict[str, Any]:
    """Batas wilayah pencarian titik api untuk satu event."""
    geom = None if custom else _forest_geometry(event_id)
    if geom:
        from shapely.geometry import shape
        poly = shape(geom)
        w, s, e, n = poly.bounds
        return {"kind": "polygon", "polygon": poly, "bbox": [w, s, e, n]}
    if center is None:
        meta = EVENTS_DIR / event_id / "meta.json"
        if meta.exists():
            c = json.loads(meta.read_text(encoding="utf-8-sig")).get("coordinates", {})
            center = (c.get("latitude"), c.get("longitude"))
    if center is None or center[0] is None:
        return {"kind": "none", "polygon": None, "bbox": None}
    half = CUSTOM_HALF_DEG if custom else AREA_HALF_DEG
    lat, lon = float(center[0]), float(center[1])
    return {"kind": "bbox", "polygon": None, "bbox": [lon - half, lat - half, lon + half, lat + half]}


class FirmsIngest:
    @staticmethod
    def load_area_hotspots(area: Dict[str, Any], hours: float = ACTIVE_WINDOW_H) -> List[Dict[str, Any]]:
        if not area.get("bbox"):
            return []
        w, s, e, n = area["bbox"]
        return firms_live.query(hours, s, n, w, e, polygon=area.get("polygon"))

    @staticmethod
    def load_event_hotspots(event_id: str | None = None, hours: float = ACTIVE_WINDOW_H) -> List[Dict[str, Any]]:
        if not event_id or event_id in ("national", "all", "indonesia"):
            return firms_live.query(hours)
        return FirmsIngest.load_area_hotspots(event_area(event_id), hours)


def overpass_count(hotspots: List[Dict[str, Any]]) -> int:
    """Jumlah lintasan satelit unik (sensor + waktu akuisisi 10 menit) dalam daftar deteksi."""
    keys = {(h.get("sensor"), str(h.get("acq_datetime_utc") or h.get("acq_date"))[:15]) for h in hotspots}
    return max(1, len(keys))


def mean_instantaneous_frp_scale(hotspots: List[Dict[str, Any]]) -> float:
    """
    FRP adalah daya sesaat saat satelit melintas. Menjumlahkan FRP dari banyak lintasan lalu
    menganggapnya konstan sepanjang hari menghitung api yang sama berkali-kali. Faktor ini
    mengubah jumlah FRP menjadi rata-rata FRP sesaat per lintasan.
    """
    return 1.0 / overpass_count(hotspots)

