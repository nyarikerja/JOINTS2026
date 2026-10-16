"""
app/api/advice.py

Ringkasan AI untuk satu lokasi di Indonesia ("apa yang ada di dekat saya dan apa yang harus dilakukan?").

Fakta yang dikirim ke LLM seluruhnya dihitung dari data langsung:
- titik api NASA FIRMS 24 jam terakhir (app/services/firms_live.py);
- status gunung api MAGMA dan VONA berabu 24 jam terakhir (app/services/magma_status.py);
- lintasan sebaran 72 jam dari grid angin Open-Meteo (app/services/map_modes.smoke_paths),
  yaitu data yang sama dengan mode peta "Prediksi".
"""

from __future__ import annotations

import json
import math
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

from app.core.config import BACKEND_DIR
from app.llm.brief import BriefRequest, Lang, Scenario, generate_brief

router = APIRouter(tags=["advice"])

EARTH_R_KM = 6371.0
HOTSPOT_RADIUS_KM = 50.0
SMOKE_PASS_KM = 30.0
ASH_PASS_KM = 50.0
NEAR_SOURCE_KM = 30.0
# Ringkasan per lokasi (dibulatkan ~1 km) disimpan 10 menit agar kuota LLM tidak habis
ADVICE_TTL_S = 600
_ADVICE_CACHE: Dict[tuple, tuple] = {}
CRATER_THERMAL_KM = 5.0


def _km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_R_KM * math.asin(math.sqrt(a))


def _nearby_volcanoes(lat: float, lon: float, radius_km: float = 300.0) -> List[Dict[str, Any]]:
    from app.db.repositories.volcano_repo import VolcanoRepository
    out = []
    for v in VolcanoRepository.get_all():
        d = _km(lat, lon, float(v["latitude"]), float(v["longitude"]))
        if d <= radius_km:
            out.append({
                "id": v.get("id"),
                "name": v.get("name"),
                "level": v.get("level", 1),
                "level_name": v.get("level_name"),
                "level_source": v.get("level_source"),
                "distance_km": round(d, 1),
                "latitude": v["latitude"],
                "longitude": v["longitude"],
            })
    return sorted(out, key=lambda x: x["distance_km"])


def _nearest_forest(lat: float, lon: float, radius_km: float = 100.0) -> Optional[Dict[str, Any]]:
    path = BACKEND_DIR / "data" / "layers" / "forests_indonesia.json"
    if not path.exists():
        return None
    best, best_d = None, float("inf")
    for f in json.loads(path.read_text(encoding="utf-8-sig")):
        d = _km(lat, lon, float(f["lat"]), float(f["lon"]))
        if d < best_d and d <= radius_km:
            best_d = d
            best = {"id": f["id"], "name": f["name"], "distance_km": round(d, 1),
                    "catalog_risk_level": f.get("risk_level")}
    return best


def _nearby_hotspots(lat: float, lon: float, volcanoes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Titik api FIRMS 24 jam dalam 50 km. Deteksi <= 5 km dari kawah gunung Level II+ dihitung
    terpisah sebagai anomali termal kawah (lava/kubah), bukan kebakaran vegetasi."""
    from app.services import firms_live
    half = HOTSPOT_RADIUS_KM / 111.0 + 0.05
    pts = firms_live.query(24.0, lat - half, lat + half, lon - half, lon + half)
    active_vents = [v for v in volcanoes if v.get("level", 1) >= 2]
    fires, crater = [], 0
    for h in pts:
        d = _km(lat, lon, h["latitude"], h["longitude"])
        if d > HOTSPOT_RADIUS_KM:
            continue
        if any(_km(h["latitude"], h["longitude"], v["latitude"], v["longitude"]) <= CRATER_THERMAL_KM for v in active_vents):
            crater += 1
        else:
            fires.append(d)
    st = firms_live.status()
    return {
        "within_50km": len(fires),
        "nearest_km": round(min(fires), 1) if fires else None,
        "crater_thermal_anomalies": crater,
        "window_hours": 24,
        "data_fetched_at": st["fetched_at"],
    }


def _closest_pass(coords: List[List[float]], lat: float, lon: float) -> tuple[float, int]:
    best_d, best_h = float("inf"), 0
    for h, (la, lo) in enumerate(coords):
        d = _km(lat, lon, la, lo)
        if d < best_d:
            best_d, best_h = d, h
    return best_d, best_h


@router.post("/api/v1/brief")
def api_brief(req: BriefRequest):
    """Ringkasan rumah tangga dari fakta yang dikirim pemanggil (LLM Featherless, cadangan template)."""
    return generate_brief(req)


@router.get("/advice/nearby")
def get_nearby_advice(
    lat: float = Query(..., ge=-12.0, le=7.0, description="Latitude (Indonesia)"),
    lon: float = Query(..., ge=94.0, le=142.0, description="Longitude (Indonesia)"),
    lang: str = Query("id", description="Bahasa: 'id' atau 'en'"),
):
    from app.services import magma_status
    from app.services.map_modes import smoke_paths

    language: Lang = "en" if lang.lower() == "en" else "id"
    ckey = (round(lat, 2), round(lon, 2), language)
    hit = _ADVICE_CACHE.get(ckey)
    if hit and time.time() - hit[0] < ADVICE_TTL_S:
        return {**hit[1], "cached": True}
    volcanoes = _nearby_volcanoes(lat, lon)
    forest = _nearest_forest(lat, lon)
    hotspots = _nearby_hotspots(lat, lon, volcanoes)
    paths = smoke_paths(72)
    path_list = paths.get("paths", []) if paths.get("available") else []

    # Abu: hanya gunung yang benar-benar mengeluarkan abu (VONA berabu 24 jam) dan lintasannya mendekat
    ash_forecast = None
    for v in volcanoes[:6]:
        vona = magma_status.latest_ash_vona(v["name"], 24.0)
        if not vona:
            continue
        v["last_ash_vona_utc"] = vona["issued_utc"]
        v["last_ash_top_asl_m"] = vona["ash_top_asl_m"]
        if v["distance_km"] <= NEAR_SOURCE_KM:
            ash_forecast = {"source": v["name"], "closest_km": v["distance_km"], "hours_from_now": None,
                            "near_source": True, "vona_utc": vona["issued_utc"]}
            break
        path = next((p for p in path_list if p["source_type"] == "volcano" and p["name"] == v["name"]), None)
        if path:
            d, h = _closest_pass(path["coords"], lat, lon)
            if d <= ASH_PASS_KM:
                ash_forecast = {"source": v["name"], "closest_km": round(d, 1), "hours_from_now": h,
                                "near_source": False, "vona_utc": vona["issued_utc"]}
                break

    # Asap: lintasan klaster api aktif 24 jam yang melintas dekat, atau titik api rapat di sekitar
    smoke_forecast = None
    for p in path_list:
        if p["source_type"] != "fire":
            continue
        d, h = _closest_pass(p["coords"], lat, lon)
        if d <= SMOKE_PASS_KM and (smoke_forecast is None or d < smoke_forecast["closest_km"]):
            near = _km(lat, lon, p["source"]["lat"], p["source"]["lon"]) <= NEAR_SOURCE_KM
            smoke_forecast = {"source": p["name"], "closest_km": round(d, 1),
                              "hours_from_now": None if near else h, "near_source": near}
    from app.services import air_quality as aq
    air = aq.at_location(lat, lon)
    cams = air.get("cams") or {}
    bad = ("tidak_sehat", "sangat_tidak_sehat", "berbahaya")
    if smoke_forecast is None and hotspots["within_50km"] >= 5 and (hotspots["nearest_km"] or 999) <= NEAR_SOURCE_KM:
        smoke_forecast = {"source": "titik api di sekitar lokasi", "closest_km": hotspots["nearest_km"],
                          "hours_from_now": None, "near_source": True}

    # Udara di lokasi sudah buruk sekarang: lintasan yang "tiba ±N jam" lagi tidak boleh dibaca
    # seolah asapnya belum datang.
    if smoke_forecast is not None and cams.get("ispu_now") in bad:
        smoke_forecast["air_unhealthy_now"] = True
        smoke_forecast["ispu_now"] = cams.get("ispu_now")

    if smoke_forecast is None and (cams.get("ispu_now") in bad or cams.get("ispu_max_forecast") in bad):
        smoke_forecast = {"source": "model kualitas udara CAMS", "closest_km": 0.0, "hours_from_now": None,
                          "near_source": True, "ispu_now": cams.get("ispu_now"),
                          "ispu_max_forecast": cams.get("ispu_max_forecast")}

    if ash_forecast:
        scenario: Scenario = "ash_threat"
    elif smoke_forecast:
        scenario = "smoke_threat"
    elif hotspots["within_50km"] > 0 or (forest and forest["distance_km"] <= 50.0):
        scenario = "prevention"
    else:
        scenario = "clear"

    facts: Dict[str, Any] = {
        "hotspots": hotspots,
        "volcanoes_nearby": [{k: v.get(k) for k in ("name", "level", "level_name", "distance_km",
                                                    "last_ash_vona_utc", "last_ash_top_asl_m")} for v in volcanoes[:3]],
        "fire_prone_forest": forest,
        "air_quality": {
            "cams_pm25_24h_now": cams.get("pm25_24h_now"),
            "cams_ispu_now": cams.get("ispu_now"),
            "cams_pm25_24h_max_next_48h": cams.get("pm25_24h_max_forecast"),
            "cams_ispu_max_next_48h": cams.get("ispu_max_forecast"),
            "nearest_station": (air.get("stations") or [None])[0],
        },
    }
    if ash_forecast:
        facts["ash_forecast"] = ash_forecast
    if smoke_forecast:
        facts["smoke_forecast"] = smoke_forecast

    brief = generate_brief(BriefRequest(scenario=scenario, lang=language, facts=facts))
    result = {
        "scenario": scenario,
        "brief": brief,
        "facts": facts,
        "location": {"lat": round(lat, 4), "lon": round(lon, 4)},
        "data_sources": {
            "fires": "NASA FIRMS NRT, 24 jam terakhir",
            "volcanoes": magma_status.SOURCE,
            "trajectories": f"Grid angin Open-Meteo ({paths.get('origin')}), lintasan 72 jam",
            "air_quality": "Copernicus CAMS (Open-Meteo) dan stasiun OpenAQ",
        },
    }
    if len(_ADVICE_CACHE) > 500:
        _ADVICE_CACHE.clear()
    _ADVICE_CACHE[ckey] = (time.time(), result)
    return result
