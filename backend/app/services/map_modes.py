"""
app/services/map_modes.py

Data for the two nationwide map modes:
- fire heatmap: FIRMS hotspots aggregated into 0.25° cells;
- smoke paths: forward trajectories from the strongest fire clusters and from
  volcanoes at level II or higher, carried by the national wind grid.
Adopted from ITHACKITS/BE-FORGEHACK-2026.
"""

from __future__ import annotations

import json
import math
from collections import defaultdict
from typing import Any, Dict, List, Optional

from app.core.config import DATA_DIR
from app.db.repositories.volcano_repo import VolcanoRepository
from app.services import weather_grid

CELL_DEG = 0.25
M_PER_DEG_LAT = 110_540.0
M_PER_DEG_LON_EQ = 111_320.0


def fire_heatmap(days: int) -> Dict[str, Any]:
    """Deteksi FIRMS `days` x 24 jam terakhir dijumlahkan per sel 0,25 derajat."""
    from datetime import datetime, timezone

    import numpy as np

    from app.services import firms_live

    arr = firms_live.arrays(days * 24.0)
    st = firms_live.status()
    if not st["available"]:
        return {"available": False, "reason": "Data NASA FIRMS belum tersedia.", "cells": []}
    if len(arr["ts"]) == 0:
        return {"available": True, "kind": "fires", "cells": [], "max_count": 0, "max_frp_sum": 0.0,
                "window_hours": days * 24, "source": st["source"], "fetched_at": st["fetched_at"], "stale": st["stale"]}
    i = np.floor(arr["lat"] / CELL_DEG).astype(int)
    j = np.floor(arr["lon"] / CELL_DEG).astype(int)
    cells: Dict[tuple, Dict[str, float]] = defaultdict(lambda: {"count": 0, "frp_sum": 0.0})
    for ii, jj, f in zip(i.tolist(), j.tolist(), arr["frp"].tolist()):
        c = cells[(ii, jj)]
        c["count"] += 1
        c["frp_sum"] += f
    out = [
        {"lat": round((a + 0.5) * CELL_DEG, 3), "lon": round((b + 0.5) * CELL_DEG, 3),
         "count": int(c["count"]), "frp_sum": round(c["frp_sum"], 1)}
        for (a, b), c in cells.items()
    ]
    out.sort(key=lambda c: -c["frp_sum"])
    ts_min, ts_max = int(arr["ts"].min()), int(arr["ts"].max())
    fmt = lambda t: datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")  # noqa: E731
    return {
        "available": True,
        "kind": "fires",
        "cell_deg": CELL_DEG,
        "window_hours": days * 24,
        "window_start": fmt(ts_min),
        "as_of": fmt(ts_max),
        "source": st["source"],
        "fetched_at": st["fetched_at"],
        "stale": st["stale"],
        "is_example": False,
        "max_count": max((c["count"] for c in out), default=0),
        "max_frp_sum": max((c["frp_sum"] for c in out), default=0.0),
        "cells": out,
    }


def _trace(data: Dict[str, Any], level: str, lat: float, lon: float, hours: int) -> List[List[float]]:
    """Hourly positions [[lat, lon], ...] starting at the source; stops at the grid edge."""
    step_h = data.get("step_hours", weather_grid.STEP_HOURS)
    path = [[round(lat, 3), round(lon, 3)]]
    dt = 3600.0

    def velocity(t_h: float, la: float, lo: float) -> Optional[tuple[float, float]]:
        uv = weather_grid.sample(data, level, t_h / step_h, la, lo)
        if uv is None:
            return None
        u, v = uv
        dlat = v / M_PER_DEG_LAT
        dlon = u / (M_PER_DEG_LON_EQ * max(0.2, math.cos(math.radians(la))))
        return dlat, dlon

    curr_lat, curr_lon = lat, lon
    for h in range(hours):
        k1 = velocity(h, curr_lat, curr_lon)
        if k1 is None:
            break
        mid_lat, mid_lon = curr_lat + 0.5 * dt * k1[0], curr_lon + 0.5 * dt * k1[1]
        k2 = velocity(h + 0.5, mid_lat, mid_lon)
        if k2 is None:
            break
        curr_lat, curr_lon = curr_lat + dt * k2[0], curr_lon + dt * k2[1]
        path.append([round(curr_lat, 3), round(curr_lon, 3)])
    return path


def smoke_paths(hours: int, max_fire_sources: int = 15) -> Dict[str, Any]:
    data, origin = weather_grid.get_grid()
    if data is None:
        return {
            "available": False,
            "reason": "Grid angin Open-Meteo tidak tersedia.",
            "paths": [],
        }
    win = weather_grid.window(data, "10m", hours)
    offset = data["times"].index(win["times"][0]) if win["times"] and win["times"][0] in data["times"] else 0
    sliced = {
        **data,
        "times": data["times"][offset:],
        "levels": {
            lvl: {"u": data["levels"][lvl]["u"][offset:], "v": data["levels"][lvl]["v"][offset:]}
            for lvl in data["levels"]
        },
    }

    paths: List[Dict[str, Any]] = []

    # 1. Karhutla dari Kawasan Hutan & Konservasi Nasional berstatus Level II ke atas (titik api aktif >= 1)
    from app.ingest.firms import FirmsIngest, event_area
    forests_data = []
    forest_path = DATA_DIR / "layers" / "forests_indonesia.json"
    if forest_path.exists():
        try:
            forests_data = json.loads(forest_path.read_text(encoding="utf-8-sig"))
        except Exception:
            forests_data = []

    active_forests = []
    for f in forests_data:
        f_lat = float(f.get("lat") or 0.0)
        f_lon = float(f.get("lon") or 0.0)
        area = event_area(f.get("id", ""), center=(f_lat, f_lon))
        hotspots = FirmsIngest.load_area_hotspots(area, 24.0)
        n_hot = len(hotspots)
        if n_hot >= 1:
            frp_sum = sum(h.get("frp", 15.0) for h in hotspots)
            level = 4 if n_hot >= 100 else (3 if n_hot >= 10 else 2)
            level_name = "Level IV (Awas)" if level == 4 else ("Level III (Siaga)" if level == 3 else "Level II (Waspada)")
            clean_name = (f.get("name") or "Kawasan Hutan").strip()
            active_forests.append({
                "source_type": "fire",
                "name": f"{clean_name} • {level_name}",
                "level": level,
                "n_hotspots": n_hot,
                "source": {"lat": f_lat, "lon": f_lon},
                "frp_sum": round(frp_sum, 1),
                "coords": _trace(sliced, "10m", f_lat, f_lon, hours),
            })

    # Urutkan kawasan hutan aktif berdasarkan level bahaya tertinggi
    active_forests.sort(key=lambda x: (-x["level"], -x["n_hotspots"]))
    paths.extend(active_forests[:max_fire_sources])

    # Jika kawasan hutan aktif masih sedikit, lengkapi dengan klaster api satelit bebas terkuat
    heat = fire_heatmap(days=1)
    if len(paths) < max_fire_sources:
        used_coords = {(round(p["source"]["lat"], 1), round(p["source"]["lon"], 1)) for p in paths}
        for cell in heat.get("cells", []):
            if len(paths) >= max_fire_sources:
                break
            cell_coord = (round(cell["lat"], 1), round(cell["lon"], 1))
            if cell_coord not in used_coords:
                lvl = 3 if cell["count"] >= 10 else 2
                lvl_name = "Level III (Siaga)" if lvl == 3 else "Level II (Waspada)"
                paths.append({
                    "source_type": "fire",
                    "name": f"Klaster Api ({cell['lat']:.2f}, {cell['lon']:.2f}) • {lvl_name}",
                    "level": lvl,
                    "n_hotspots": cell["count"],
                    "source": {"lat": cell["lat"], "lon": cell["lon"]},
                    "frp_sum": cell["frp_sum"],
                    "coords": _trace(sliced, "10m", cell["lat"], cell["lon"], hours),
                })
                used_coords.add(cell_coord)

    # Volcanoes at level II or higher
    volcanoes = []
    try:
        volcanoes = VolcanoRepository.get_all()
    except Exception:
        v_file = DATA_DIR / "layers" / "volcanoes_indonesia.geojson"
        if v_file.exists():
            try:
                gj = json.loads(v_file.read_text(encoding="utf-8"))
                for feat in gj.get("features", []):
                    p = feat["properties"]
                    coords = feat["geometry"]["coordinates"]
                    volcanoes.append({
                        "name": p.get("name"),
                        "level": p.get("level", 1),
                        "latitude": coords[1],
                        "longitude": coords[0]
                    })
            except Exception:
                pass

    for v in volcanoes:
        lvl = v.get("level", 1)
        if lvl >= 2:
            v_lat = float(v.get("latitude") or 0.0)
            v_lon = float(v.get("longitude") or 0.0)
            paths.append({
                "source_type": "volcano",
                "name": v.get("name", "Gunung Api"),
                "level": lvl,
                "source": {"lat": v_lat, "lon": v_lon},
                "coords": _trace(sliced, "850hPa", v_lat, v_lon, hours),
            })

    return {
        "available": True,
        "origin": origin,
        "wind_fetched_at": data.get("fetched_at"),
        "hours": hours,
        "marks_every_h": 24,
        "fires_as_of": heat.get("as_of"),
        "paths": paths,
    }
