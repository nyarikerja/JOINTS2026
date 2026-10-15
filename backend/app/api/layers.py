# pyright: reportMissingImports=false
"""
app/api/layers.py

Router untuk lapisan peta pendukung (hotspots, facilities, coastline offline fallback).
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.ingest.firms import FirmsIngest
from app.ingest.overpass import OverpassIngest

router = APIRouter(tags=["layers"])


@router.get("/layers/{name}")
def get_layer(
    name: str,
    bbox: Optional[str] = Query(None, description="west,south,east,north"),
    event_id: Optional[str] = Query("live_kalimantan", description="ID event untuk data titik api"),
    limit: Optional[int] = Query(None, description="Batas jumlah fitur"),
    zoom: Optional[int] = Query(None, description="Level zoom peta untuk LOD"),
    facility_type: Optional[str] = Query(None, description="Filter jenis fasilitas (school, healthcare, airport)"),
    hours: Optional[float] = Query(24, ge=1, le=168, description="Jendela waktu deteksi titik api (jam)")
):
    if bbox:
        parts = [float(p.strip()) for p in bbox.split(",")]
        w, s, e, n = parts[0], parts[1], parts[2], parts[3]
    else:
        # Cakupan Penuh Wilayah Kedaulatan Republik Indonesia (Sabang s.d. Merauke: 94° - 142° BT)
        w, s, e, n = 94.0, -12.0, 142.0, 7.0

    if name in ["facilities", "facilities-national"]:
        from app.services import osm_facilities
        if not bbox:
            if facility_type not in (None, "airport"):
                raise HTTPException(400, "Fasilitas sekolah/kesehatan memerlukan parameter bbox (data OSM per wilayah).")
            facs, missing = osm_facilities.airports(), []
        else:
            if (n - s) * (e - w) > 9.0:
                try:
                    from app.db.repositories.facility_repo import FacilityRepository
                    facs = FacilityRepository.get_by_bbox(s, n, w, e, facility_type=facility_type, limit=limit or 300, zoom=zoom)
                    missing = []
                except Exception:
                    facs, missing = osm_facilities.airports(), []
            else:
                facs, missing = OverpassIngest.get_facilities_with_coverage(
                    s, n, w, e, facility_type=facility_type, fetch_missing=True, max_fetch=2
                )
        if zoom is not None and zoom < 11:
            # LOD: pada skala jauh hanya rumah sakit dan bandara agar peta tidak penuh
            facs = [f for f in facs if f["facility_type"] == "airport" or f.get("subtype") == "hospital"]
        if limit:
            facs = facs[:limit]
        features = [{
            "type": "Feature",
            "properties": {
                "facility_id": f["facility_id"], "name": f["name"], "facility_type": f["facility_type"],
                "subtype": f.get("subtype"), "district": f.get("district", "-"), "province": f.get("province", "-"),
            },
            "geometry": {"type": "Point", "coordinates": [f["longitude"], f["latitude"]]},
        } for f in facs]
        return {
            "type": "FeatureCollection",
            "metadata": {"source": osm_facilities.SOURCE, "missing_tiles": [list(t) for t in missing]},
            "features": features,
        }

    elif name == "hotspots":
        from app.ingest.firms import event_area
        from app.services import firms_live
        target_event = event_id if event_id and event_id not in ["all", "national", "indonesia"] else "national"
        hrs = float(hours or 24)
        if target_event == "national":
            hotspots = firms_live.query(hrs, s, n, w, e)
            if not hotspots and bbox and hrs < 168:
                # Bila 24 jam terakhir kosong di viewport yang di-zoom, fallback ke jendela 7 hari
                hotspots = firms_live.query(168.0, s, n, w, e)
        else:
            hotspots = FirmsIngest.load_event_hotspots(target_event, hours=hrs)
            if not hotspots:
                # Fallback ke jendela 7 hari untuk kawasan event
                area = event_area(target_event)
                week = FirmsIngest.load_area_hotspots(area, hours=7 * 24)
                if week:
                    last_day = max(h["acq_date"] for h in week)
                    hotspots = [h for h in week if h["acq_date"] == last_day]
                if not hotspots and area.get("bbox"):
                    try:
                        from app.services import firms_history
                        hist = firms_history.last_fire(area["bbox"], area.get("polygon"))
                        if hist and hist.get("hotspots"):
                            hotspots = hist["hotspots"]
                    except Exception:
                        pass
            if not hotspots and bbox:
                hotspots = firms_live.query(168.0, s, n, w, e)

        features = [{
            "type": "Feature",
            "properties": {
                "id": h.get("id"),
                "frp": h.get("frp", 25.0),
                "confidence": h.get("confidence", "nominal"),
                "acq_date": h.get("acq_date"),
                "acq_time": h.get("acq_time"),
                "acq_datetime_utc": h.get("acq_datetime_utc"),
                "sensor": h.get("sensor", "NASA FIRMS (VIIRS)")
            },
            "geometry": {"type": "Point", "coordinates": [float(h["longitude"]), float(h["latitude"])]},
        } for h in hotspots if h.get("latitude") is not None and h.get("longitude") is not None]
        return {"type": "FeatureCollection", "metadata": {**firms_live.status(), "window_hours": hrs}, "features": features}

    elif name == "coastline":
        import json

        from app.core.config import BACKEND_DIR
        coast_path = BACKEND_DIR / "data" / "layers" / "indonesia_coastline.geojson"
        if coast_path.exists():
            try:
                return json.loads(coast_path.read_text(encoding="utf-8-sig"))
            except Exception:
                pass

        # Fallback garis pantai sederhana Selat Sunda
        sunda_coast = [
            [[105.8, -6.0], [105.9, -6.3], [105.8, -6.5], [105.5, -6.8], [105.2, -6.9]],
            [[105.2, -5.4], [105.5, -5.6], [105.7, -5.8], [105.8, -5.9]]
        ]
        features = []
        for line in sunda_coast:
            features.append({
                "type": "Feature",
                "properties": {"type": "coastline"},
                "geometry": {
                    "type": "LineString",
                    "coordinates": line
                }
            })
        return {"type": "FeatureCollection", "features": features}

    elif name in ["volcanoes-national", "volcanoes"]:
        try:
            from app.db.repositories.volcano_repo import VolcanoRepository
            volcs = VolcanoRepository.get_all(
                lat_min=s if bbox else None,
                lat_max=n if bbox else None,
                lon_min=w if bbox else None,
                lon_max=e if bbox else None
            )
            if volcs:
                return VolcanoRepository.to_geojson_collection(volcs)
        except Exception:
            pass

        import json

        from app.core.config import BACKEND_DIR
        volc_path = BACKEND_DIR / "data" / "layers" / "volcanoes_indonesia.geojson"
        if volc_path.exists():
            try:
                with open(volc_path, "r", encoding="utf-8-sig") as f:
                    return json.load(f)
            except Exception:
                pass
        return {"type": "FeatureCollection", "features": []}

    elif name in ["forests", "forests-national"]:
        import json

        from app.core.config import BACKEND_DIR
        from app.ingest.firms import event_area
        forests_data = []
        try:
            from app.db.repositories.forest_repo import ForestRepository
            forests_data = ForestRepository.get_all(
                lat_min=s if bbox else None, lat_max=n if bbox else None,
                lon_min=w if bbox else None, lon_max=e if bbox else None,
            ) or []
        except Exception:
            forests_data = []
        if not forests_data:
            forest_path = BACKEND_DIR / "data" / "layers" / "forests_indonesia.json"
            if forest_path.exists():
                try:
                    forests_data = json.loads(forest_path.read_text(encoding="utf-8-sig"))
                except Exception:
                    forests_data = []
        # Jumlah titik api & level status = deteksi FIRMS 24 jam terakhir (diselaraskan dengan sistem Level 1-4)
        for item in forests_data:
            area = event_area(item["id"], center=(item.get("lat"), item.get("lon")))
            n_hot = len(FirmsIngest.load_area_hotspots(area, 24.0))
            item["n_hotspots"] = n_hot
            item["n_hotspots_window_h"] = 24
            item["n_hotspots_area"] = area["kind"]
            if n_hot >= 100:
                item["level"] = 4
                item["level_name"] = "Level IV (Awas)"
                item["risk_status"] = "Sangat Rawan"
            elif n_hot >= 10:
                item["level"] = 3
                item["level_name"] = "Level III (Siaga)"
                item["risk_status"] = "Rawan"
            elif n_hot >= 1:
                item["level"] = 2
                item["level_name"] = "Level II (Waspada)"
                item["risk_status"] = "Waspada"
            else:
                item["level"] = 1
                item["level_name"] = "Level I (Normal)"
                item["risk_status"] = "Normal"
        return forests_data

    elif name in ["forest-boundaries", "forests-boundaries", "forest_boundaries"]:
        try:
            from app.db.repositories.forest_repo import ForestRepository
            boundaries = ForestRepository.get_all_boundaries_geojson()
            if boundaries.get("features"):
                return boundaries
        except Exception:
            pass

        import json

        from app.core.config import BACKEND_DIR
        bound_path = BACKEND_DIR / "data" / "layers" / "forest_boundaries.geojson"
        if bound_path.exists():
            try:
                with open(bound_path, "r", encoding="utf-8-sig") as f:
                    return json.load(f)
            except Exception:
                pass
        return {"type": "FeatureCollection", "features": []}

    elif name == "summary-kpi":
        return _summary_kpi()

    else:
        raise HTTPException(status_code=404, detail=f"Layer '{name}' tidak dikenali. Pilih: facilities, hotspots, coastline, volcanoes-national, summary-kpi.")


def _summary_kpi():
    import datetime

    import numpy as np

    from app.db.repositories.volcano_repo import VolcanoRepository
    from app.services import firms_live, magma_status
    from app.services.map_modes import CELL_DEG

    volcs = VolcanoRepository.get_all()
    lv = [v.get("level", 1) for v in volcs]
    arr = firms_live.arrays(24.0)
    n_hot = int(len(arr["ts"]))
    high = int(np.sum(arr["conf"] == 2)) if n_hot else 0
    clusters = 0
    if n_hot:
        keys = np.stack([np.floor(arr["lat"] / CELL_DEG), np.floor(arr["lon"] / CELL_DEG)], axis=1)
        _, counts = np.unique(keys, axis=0, return_counts=True)
        clusters = int(np.sum(counts >= 5))
    fst = firms_live.status()
    mst = magma_status.level_status()
    return {
        "volcanoes": {
            "level_4_awas": lv.count(4),
            "level_3_siaga": lv.count(3),
            "level_2_waspada": lv.count(2),
            "level_1_normal": lv.count(1),
            "total_active_monitored": len(volcs),
            "source": mst["source"],
            "fetched_at": mst["fetched_at"],
            "stale": mst["stale"],
        },
        "wildfire_hotspots": {
            "active_24h_firms": n_hot,
            "high_confidence_pct": round(high / n_hot * 100, 1) if n_hot else 0.0,
            "clusters_24h": clusters,
            "cluster_definition": f"sel {CELL_DEG} derajat dengan >= 5 deteksi",
            "source": fst["source"],
            "fetched_at": fst["fetched_at"],
            "latest_detection_utc": fst["latest_detection_utc"],
            "stale": fst["stale"],
        },
        "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


@router.post("/layers/sync-live")
def trigger_live_sync():
    """Segarkan paksa FIRMS, MAGMA, dan grid angin Open-Meteo; laporkan status nyata tiap sumber."""
    import datetime
    import time

    from app.services import firms_live, magma_status, weather_grid

    out = {}
    t0 = time.perf_counter()
    out["nasa_firms"] = {**firms_live.refresh(force=True), "latency_ms": round((time.perf_counter() - t0) * 1000)}
    t0 = time.perf_counter()
    out["magma_pvmbg"] = {**magma_status.refresh_levels(force=True), "latency_ms": round((time.perf_counter() - t0) * 1000)}
    t0 = time.perf_counter()
    data, origin = weather_grid.get_grid(force=True)
    out["open_meteo_wind_grid"] = {
        "available": data is not None,
        "origin": origin,
        "fetched_at": data.get("fetched_at") if data else None,
        "latency_ms": round((time.perf_counter() - t0) * 1000),
    }
    ok = sum(1 for k in ("nasa_firms", "magma_pvmbg") if not out[k].get("error")) + int(origin == "live")
    return {
        "status": "synchronized" if ok == 3 else ("partial" if ok else "failed"),
        "timestamp_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": out,
        "kpi": _summary_kpi(),
    }
