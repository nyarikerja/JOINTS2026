"""
app/api/simulate.py

Router untuk eksekusi simulasi, polling status, poligon tiga tingkat, dan kartu dampak.
Mematuhi seluruh prinsip AGENTS.md (penolakan overrides pada mode auto, determinisme, label skenario).

Data masukan mode `auto` (Kondisi Nyata) seluruhnya berasal dari sumber langsung:
- gunung api: VONA MAGMA terbaru dengan awan abu teramati (tinggi puncak abu & waktu terbit);
- kebakaran: deteksi NASA FIRMS 24 jam terakhir di wilayah kejadian;
- cuaca: Open-Meteo Ensemble ECMWF (51 anggota) mulai jam awal simulasi.
Bila salah satu tidak ada, permintaan ditolak (HTTP 422) dengan alasan, tanpa nilai karangan.
"""

import datetime
import hashlib
import math
import threading
from typing import Any, Dict, List, Optional

import httpx
import numpy as np
from fastapi import APIRouter, HTTPException, Query

from app.api.events import NATIONAL_KARHUTLA
from app.core.config import RUNS_DIR, get_assumptions
from app.engine.grid import SimulationGrid
from app.engine.simulator import SimulationRunner
from app.impact.exposure import (
    calculate_impact_ranges,
    evaluate_decision_card,
    get_exposed_facilities_list,
    get_health_and_mask_guidance,
)
from app.ingest.firms import CUSTOM_HALF_DEG, FirmsIngest, event_area, mean_instantaneous_frp_scale, overpass_count
from app.ingest.openmeteo import OpenMeteoIngest, WeatherUnavailable
from app.schemas.simulation import SimulationRequest
from app.services import magma_status

router = APIRouter(tags=["simulation"])

# Run dengan larik lengkap di memori; run lain dimuat ulang dari disk (data/runs/*.npz)
RUNS_CACHE: Dict[str, Dict[str, Any]] = {}
RUNS_IN_MEMORY = 4
# Paling banyak 2 simulasi berjalan bersamaan (limits.max_concurrent_runs)
_SIM_SLOTS = threading.Semaphore(2)

VONA_MAX_AGE_H = 24.0
# Jarak titik grid angin ensemble 3x3 dari pusat (derajat); grid mencakup +-4 derajat domain abu/asap
WIND_GRID_HALF_DEG = 2.5
SOURCE_CELL_DEG = 0.05


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _assumption(key: str, default: float) -> float:
    item = get_assumptions().get(key) or {}
    try:
        return float(item.get("value", default))
    except (TypeError, ValueError):
        return default


def _elevation_m(lat: float, lon: float) -> Optional[float]:
    try:
        r = httpx.get("https://api.open-meteo.com/v1/elevation", params={"latitude": lat, "longitude": lon}, timeout=10)
        r.raise_for_status()
        return float(r.json()["elevation"][0])
    except Exception:
        return None


def _wind_level_for_plume(plume_top_asl_km: float) -> str:
    """Level angin perwakilan untuk transport abu (setengah tinggi kolom)."""
    mid = plume_top_asl_km / 2.0
    if mid >= 7.5:
        return "300hPa"
    if mid >= 4.5:
        return "500hPa"
    if mid >= 2.2:
        return "700hPa"
    return "850hPa"


def _find_volcano(event_id: str) -> Optional[Dict[str, Any]]:
    from app.db.repositories.volcano_repo import VolcanoRepository
    v = VolcanoRepository.get_by_id(event_id)
    if v:
        return v
    return next((x for x in VolcanoRepository.get_all() if x.get("event_id") == event_id), None)


def _vei_height_km(vei: int) -> float:
    table = (get_assumptions().get("vei_column_height_km") or {}).get("value") or {}
    return float(table.get(str(min(max(int(vei), 0), 6)), 2.2))


def _volcano_source(name: str, lat: float, lon: float, elev_m: float, in_catalog: bool):
    """
    Sumber tinggi kolom untuk mode Kondisi Nyata, bertingkat dari data paling langsung:
    1. VONA MAGMA berabu <= 24 jam  -> erupsi yang sedang teramati (H+0 = waktu VONA);
    2. VONA MAGMA berabu terakhir di riwayat -> skenario erupsi terakhir teramati, cuaca sekarang;
    3. Erupsi Holosen terakhir di Smithsonian GVP -> tinggi kolom dari VEI (Newhall & Self 1982);
    4. Tanpa catatan apa pun -> VEI asumsi (default_vei_without_record), diberi label asumsi.
    """
    from app.services import gvp

    if in_catalog:
        vona = magma_status.latest_ash_vona(name, VONA_MAX_AGE_H)
        if vona and vona["ash_top_asl_m"] > elev_m + 10:
            start = datetime.datetime.fromisoformat(vona["issued_utc"].replace("Z", "+00:00"))
            return vona["ash_top_asl_m"] / 1000.0, start, {
                "type": "vona", "tier": 1,
                "label": f"VONA {vona['notice']} ({vona['color_code'].upper()}), erupsi sedang teramati",
                "issued_utc": vona["issued_utc"], "ash_top_asl_m": vona["ash_top_asl_m"],
                "ash_above_summit_m": vona.get("ash_above_summit_m"),
                "ash_direction_reported": vona.get("ash_direction"),
                "url": vona.get("url"), "source": magma_status.SOURCE,
            }, None
        hist = magma_status.latest_ash_vona_any(name)
        # Jika riwayat VONA memiliki tinggi kolom erupsi nyata (minimal 800m di atas kawah):
        if hist and (hist["ash_top_asl_m"] - elev_m) >= 800:
            return hist["ash_top_asl_m"] / 1000.0, _now(), {
                "type": "vona_history", "tier": 2,
                "label": f"Erupsi terakhir teramati: VONA {hist['notice']} ({hist['issued_utc'][:10]})",
                "issued_utc": hist["issued_utc"], "ash_top_asl_m": hist["ash_top_asl_m"],
                "url": hist.get("url"), "source": magma_status.SOURCE,
            }, "skenario dari erupsi terakhir teramati"

    erup = gvp.last_eruption_with_vei(lat, lon)
    if erup:
        h = _vei_height_km(erup["vei"])
        date_txt = "-".join(str(x) for x in (erup["year"], erup.get("month"), erup.get("day")) if x)
        return elev_m / 1000.0 + h, _now(), {
            "type": "gvp_vei", "tier": 3,
            "label": f"Erupsi terakhir tercatat GVP: {date_txt}, VEI {erup['vei']} (kolom ±{h:.1f} km di atas kawah)",
            "eruption_date": date_txt, "vei": erup["vei"], "ash_top_asl_m": round(elev_m + h * 1000),
            "url": "https://volcano.si.edu/", "source": erup["source"],
        }, "skenario dari erupsi terakhir tercatat"

    if not in_catalog:
        raise HTTPException(422, "Titik ini tidak berada dekat gunung api yang tercatat (MAGMA/GVP). "
                                 "Untuk titik bebas gunakan mode Uji Skenario.")
    vei = int(_assumption("default_vei_without_record", 2))
    h = _vei_height_km(vei)
    return elev_m / 1000.0 + h, _now(), {
        "type": "assumed_vei", "tier": 4,
        "label": f"Tidak ada catatan erupsi; memakai asumsi VEI {vei} (kolom ±{h:.1f} km di atas kawah)",
        "vei": vei, "ash_top_asl_m": round(elev_m + h * 1000), "source": "config/assumptions.yaml",
    }, "skenario asumsi (tanpa catatan erupsi)"


def _resolve_volcano(req: SimulationRequest, custom: bool) -> Dict[str, Any]:
    if custom:
        lat, lon = float(req.source.latitude), float(req.source.longitude)
        name = req.source.name or f"Titik kustom ({lat:.3f}, {lon:.3f})"
        elev = _elevation_m(lat, lon)
        volcano = None
    else:
        volcano = _find_volcano(req.source.event_id)
        if not volcano:
            raise HTTPException(404, f"Gunung api '{req.source.event_id}' tidak ada di katalog.")
        lat, lon, name = float(volcano["latitude"]), float(volcano["longitude"]), volcano["name"]
        elev = volcano.get("elevation_m")

    if elev is None:
        raise HTTPException(503, "Elevasi kawah tidak diketahui (layanan elevasi Open-Meteo tidak dapat diakses).")

    peak_phase_h = float(_assumption("volcanic_peak_phase_h", 6.0))
    scenario_label = None
    if req.mode == "auto":
        plume_top_km, start, source_info, scenario_label = _volcano_source(name, lat, lon, float(elev), volcano is not None)
        duration_h = float(req.horizon_hours) if req.horizon_hours else 48.0
    else:
        ovr = req.overrides or {}
        plume_top_km = float(ovr.get("column_height_km") or 10.0)
        duration_h = float(ovr.get("duration_h") or (float(req.horizon_hours) if req.horizon_hours else 48.0))
        peak_phase_h = min(6.0, duration_h)
        start = _now()
        source_info = {"type": "scenario", "label": "Tinggi kolom abu ditentukan pengguna (skenario hipotetis)"}

    if plume_top_km * 1000.0 <= float(elev) + 10.0:
        raise HTTPException(422, f"Tinggi puncak abu {plume_top_km:.1f} km dpl tidak melebihi elevasi kawah ({float(elev):.0f} m).")

    meta = {
        "event_id": req.source.event_id or f"custom_volcano_{hashlib.md5(f'{lat:.4f}_{lon:.4f}'.encode()).hexdigest()[:8]}",
        "hazard": "volcano",
        "name": name,
        "coordinates": {"latitude": lat, "longitude": lon},
        "vent_elevation_m": float(elev),
        "plume_top_asl_km": plume_top_km,
        "duration_h": duration_h,
        "peak_phase_duration_h": peak_phase_h,
        "start_utc": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_info": source_info,
        "scenario_label": scenario_label,
        "level_name": volcano.get("level_name") if volcano else None,
    }
    return {"meta": meta, "hotspots": [], "lat": lat, "lon": lon, "start": start,
            "level": _wind_level_for_plume(plume_top_km)}


def _aggregate_sources(hotspots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Gabungkan deteksi ke sel 0,05° (jumlah FRP, posisi berbobot FRP) sebagai sumber emisi."""
    scale = mean_instantaneous_frp_scale(hotspots)
    cells: Dict[tuple, Dict[str, float]] = {}
    for h in hotspots:
        k = (math.floor(h["latitude"] / SOURCE_CELL_DEG), math.floor(h["longitude"] / SOURCE_CELL_DEG))
        c = cells.setdefault(k, {"frp": 0.0, "wlat": 0.0, "wlon": 0.0, "n": 0})
        f = max(float(h.get("frp") or 0.0), 0.1)
        c["frp"] += f
        c["wlat"] += h["latitude"] * f
        c["wlon"] += h["longitude"] * f
        c["n"] += 1
    out = []
    for i, c in enumerate(sorted(cells.values(), key=lambda x: -x["frp"])[:60]):
        out.append({
            "id": f"source_{i}",
            "latitude": c["wlat"] / c["frp"],
            "longitude": c["wlon"] / c["frp"],
            "frp": round(c["frp"] * scale, 3),
            "n_detections": c["n"],
            "is_active": True,
        })
    return out


def _fire_history(area: Dict[str, Any], name: str):
    """
    Kawasan tanpa api 24 jam terakhir: pakai kebakaran terakhir yang terdeteksi FIRMS.
    2. hari terakhir dengan api dalam cache 7 hari (VIIRS dan MODIS);
    3. hari terakhir dengan api di arsip VIIRS S-NPP hingga 2 tahun ke belakang.
    """
    from app.services import firms_history

    week = FirmsIngest.load_area_hotspots(area, hours=7 * 24)
    if week:
        last_day = max(h["acq_date"] for h in week)
        rows = [h for h in week if h["acq_date"] == last_day]
        return rows, {"type": "firms_recent", "tier": 2, "area_kind": area["kind"],
                      "label": f"Kebakaran terakhir terdeteksi {last_day}: {len(rows)} deteksi FIRMS",
                      "fire_date": last_day}, "skenario dari kebakaran terakhir terdeteksi"
    hist = firms_history.last_fire(area["bbox"], area.get("polygon")) if area.get("bbox") else None
    if hist:
        return hist["hotspots"], {"type": "firms_archive", "tier": 3, "area_kind": area["kind"],
                                  "label": f"Kebakaran terakhir terdeteksi {hist['date']}: {len(hist['hotspots'])} deteksi arsip FIRMS",
                                  "fire_date": hist["date"], "source": hist["source"]}, "skenario dari kebakaran terakhir terdeteksi"
    raise HTTPException(
        422,
        f"Tidak ada deteksi titik api NASA FIRMS di {name} dalam 2 tahun terakhir. "
        "Gunakan mode Uji Skenario untuk skenario hipotetis.",
    )


def _resolve_fire(req: SimulationRequest, custom: bool) -> Dict[str, Any]:
    if custom:
        lat, lon = float(req.source.latitude), float(req.source.longitude)
        name = req.source.name or f"Titik kustom ({lat:.3f}, {lon:.3f})"
        event_id = f"custom_fire_{hashlib.md5(f'{lat:.4f}_{lon:.4f}'.encode()).hexdigest()[:8]}"
        area = event_area(event_id, center=(lat, lon), custom=True)
    else:
        event_id = req.source.event_id
        k = NATIONAL_KARHUTLA.get(event_id)
        if not k:
            raise HTTPException(404, f"Kawasan '{event_id}' tidak ada di katalog karhutla/hutan nasional.")
        lat, lon = float(k["coordinates"]["latitude"]), float(k["coordinates"]["longitude"])
        name = k["name"]
        area = event_area(event_id, center=(lat, lon))

    hotspots = FirmsIngest.load_area_hotspots(area)
    ovr = req.overrides or {}
    scenario_label = None
    if req.mode == "auto":
        if hotspots:
            source_info = {"type": "firms", "tier": 1, "label": f"{len(hotspots)} deteksi NASA FIRMS (24 jam terakhir)",
                           "area_kind": area["kind"]}
        else:
            hotspots, source_info, scenario_label = _fire_history(area, name)
    else:
        if not hotspots:
            rng = np.random.default_rng(req.seed)
            hotspots = [{
                "id": f"scenario_{i}", "latitude": lat + float(rng.normal(0, 0.04)),
                "longitude": lon + float(rng.normal(0, 0.04)), "frp": float(rng.uniform(45.0, 160.0)),
                "confidence": "skenario", "acq_date": "skenario", "acq_time": "", "sensor": "skenario", "is_active": True,
            } for i in range(18)]
            source_info = {"type": "scenario", "label": "Titik api hipotetis (tidak ada deteksi FIRMS 24 jam di area ini)"}
        else:
            source_info = {"type": "firms_modified", "label": f"{len(hotspots)} deteksi FIRMS, dimodifikasi pengguna"}
        scale = float((ovr.get("hotspots") or {}).get("frp_scale") or 1.0)
        if scale != 1.0:
            hotspots = [{**h, "frp": round(float(h["frp"]) * scale, 2)} for h in hotspots]
            source_info["frp_scale"] = scale

    lats = [h["latitude"] for h in hotspots]
    lons = [h["longitude"] for h in hotspots]
    bbox = [min(lons) - 0.05, min(lats) - 0.05, max(lons) + 0.05, max(lats) + 0.05]
    meta = {
        "event_id": event_id,
        "hazard": "fire",
        "scenario_label": scenario_label,
        "name": name,
        "coordinates": {"latitude": lat, "longitude": lon},
        "bbox": bbox,
        "duration_h": float(ovr.get("duration_h") or (float(req.horizon_hours) if req.horizon_hours else 48.0)),
        "start_utc": _now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_info": source_info,
        "hotspots_used": {
            "count": len(hotspots),
            "n_overpasses": overpass_count(hotspots),
            "mean_instantaneous_frp_mw": round(sum(float(h["frp"]) for h in hotspots) * mean_instantaneous_frp_scale(hotspots), 1),
            "area_kind": area["kind"],
            "window_h": 24,
        },
    }
    return {"meta": meta, "hotspots": hotspots, "lat": lat, "lon": lon, "start": _now(), "level": "10m"}


@router.post("/simulate")
def start_simulation(req: SimulationRequest):
    custom = not (req.source.event_id or "").strip() and req.source.latitude is not None and req.source.longitude is not None
    if not custom and not (req.source.event_id or "").strip():
        raise HTTPException(422, "Pilih event (event_id) atau titik koordinat.")

    if not _SIM_SLOTS.acquire(timeout=90):
        raise HTTPException(503, "Server sedang menjalankan simulasi lain. Coba lagi sebentar lagi.")
    try:
        return _run_simulation(req, custom)
    finally:
        _SIM_SLOTS.release()


def _run_simulation(req: SimulationRequest, custom: bool):
    # Auto-sinkronisasi jenis bahaya jika event_id adalah kawasan hutan atau gunung api
    if not custom and req.source.event_id:
        eid = req.source.event_id.lower()
        if eid.startswith("hutan_") or eid.startswith("karhutla_") or eid in NATIONAL_KARHUTLA:
            req.hazard = "fire"
        elif _find_volcano(req.source.event_id):
            req.hazard = "volcano"

    src = _resolve_volcano(req, custom) if req.hazard == "volcano" else _resolve_fire(req, custom)
    meta = src["meta"]

    try:
        weather = OpenMeteoIngest.get_weather_for_simulation(
            event_id=meta["event_id"],
            latitude=src["lat"],
            longitude=src["lon"],
            start_utc=src["start"],
            hours=min(req.horizon_hours, 48),
            level=src["level"],
            n_members=req.n_members,
            seed=req.seed,
            overrides=req.overrides,
            half_deg=WIND_GRID_HALF_DEG,
        )
    except WeatherUnavailable as e:
        raise HTTPException(503, str(e))

    runner = SimulationRunner(req)
    emission_sources = _aggregate_sources(src["hotspots"]) if req.hazard == "fire" else []
    run_output = runner.run(meta, weather, emission_sources)
    run_output["hotspots"] = src["hotspots"][:5000]
    run_output["event_id"] = meta["event_id"]

    _remember(runner.run_id, run_output)

    return {**_run_summary(run_output), "status": "completed"}


def _remember(run_id: str, data: Dict[str, Any]) -> None:
    while len(RUNS_CACHE) >= RUNS_IN_MEMORY:
        del RUNS_CACHE[next(iter(RUNS_CACHE))]
    RUNS_CACHE[run_id] = data


def _get_run_data(run_id: str) -> Dict[str, Any]:
    if run_id in RUNS_CACHE:
        return RUNS_CACHE[run_id]
    if not run_id.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="run_id tidak valid.")
    save_file = RUNS_DIR / f"{run_id}.json"
    if not save_file.exists():
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' tidak ditemukan.")
    import json
    data = json.loads(save_file.read_text(encoding="utf-8-sig"))
    arr_file = RUNS_DIR / f"{run_id}.npz"
    if arr_file.exists():
        try:
            z = np.load(arr_file)
            shape = tuple(int(x) for x in z["shape"])
            data["hourly_exposure_masks"] = np.unpackbits(z["masks"], count=int(np.prod(shape))).astype(bool).reshape(shape)
            data["member_max_severity"] = z["severity"].astype(float)
            _remember(run_id, data)
        except Exception:
            pass
    return data


def _grid(data: Dict[str, Any]) -> SimulationGrid:
    g = data["grid"]
    return SimulationGrid(g["lat_min"], g["lat_max"], g["lon_min"], g["lon_max"], g["resolution_deg"])


def _run_summary(data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "run_id": data["run_id"],
        "hazard": data["hazard"],
        "mode": data["mode"],
        "event_id": data.get("event_id"),
        "event_name": data.get("event_name"),
        "status": data.get("status", "completed"),
        "scenario_label": data["scenario_label"],
        "members_source": data["members_source"],
        "n_members": data["n_members"],
        "seed": data["seed"],
        "created_at_utc": data["created_at_utc"],
        "completed_at_utc": data.get("completed_at_utc"),
        "start_utc": data.get("start_utc"),
        "horizon_hours": data.get("horizon_hours"),
        "center_coords": data.get("center_coords"),
        "source_info": data.get("source_info"),
        "weather": data.get("weather_summary"),
        "hotspots_used": data.get("hotspots_used"),
        "disclaimer": data["disclaimer"],
        "assumptions_used": data.get("assumptions_used", []),
    }


@router.get("/runs/{run_id}")
def get_run_status(run_id: str):
    return _run_summary(_get_run_data(run_id))


@router.get("/runs/{run_id}/tiers")
def get_run_tiers(run_id: str, t: Optional[int] = Query(None, ge=0, le=48, description="Langkah jam (kosong = seluruh jam)")):
    data = _get_run_data(run_id)
    tiers = data.get("hourly_tiers", {})
    if t is None:
        return tiers
    step_key = str(t) if str(t) in tiers else t
    if step_key not in tiers:
        return {"type": "FeatureCollection", "properties": {"hour": t}, "features": []}
    return tiers[step_key]


@router.get("/runs/{run_id}/wind")
def get_run_wind(run_id: str, t: Optional[int] = Query(None, ge=0, le=48)):
    """Rata-rata angin ensemble di sumber (dari data cuaca yang dipakai run)."""
    data = _get_run_data(run_id)
    w_sum = data.get("hourly_wind") or {}
    if not w_sum:
        return {"available": False, "reason": "Run ini tidak menyimpan ringkasan angin; jalankan ulang simulasi."}
    if t is None:
        return w_sum
    return w_sum.get(str(t)) or w_sum.get(t) or {"available": False, "reason": f"Jam {t} di luar horizon run."}


@router.get("/runs/{run_id}/impact")
def get_run_impact(run_id: str):
    if run_id in RUNS_CACHE:
        data = RUNS_CACHE[run_id]
        imp = data.get("impact") or {}
        if not (imp.get("facilities_coverage") or {}).get("complete", True):
            from app.services import osm_facilities
            if osm_facilities.tiles_available(tuple(t) for t in imp["facilities_coverage"]["missing_tiles"]):
                data["impact"] = None
                data["_facilities"] = None
        return calculate_impact_ranges(data, _grid(data))
    data = _get_run_data(run_id)
    if isinstance(data.get("impact"), dict):
        return data["impact"]
    raise HTTPException(404, f"Ringkasan dampak run '{run_id}' tidak tersedia.")


@router.get("/runs/{run_id}/location/{facility_id}")
def get_location_decision_card(run_id: str, facility_id: str):
    data = _get_run_data(run_id)
    card = evaluate_decision_card(data, facility_id, _grid(data))
    if card.get("available") is False:
        raise HTTPException(404, card["reason"])
    return card


@router.get("/runs/{run_id}/facilities-impacted")
def get_run_facilities_impacted(run_id: str, min_prob: float = Query(0.05, ge=0.01, le=1.0)):
    if run_id in RUNS_CACHE:
        data = RUNS_CACHE[run_id]
        prev = data.get("facilities_impacted")
        complete = isinstance(prev, dict) and (prev.get("facilities_coverage") or {}).get("complete", True)
        if min_prob == 0.05 and prev and complete:
            return prev
        fresh = get_exposed_facilities_list(data, _grid(data), min_prob=min_prob)
        if min_prob == 0.05:
            data["facilities_impacted"] = fresh
            data["impact"] = None
            data["impact"] = calculate_impact_ranges(data, _grid(data))
        return fresh
    data = _get_run_data(run_id)
    if data.get("facilities_impacted"):
        return data["facilities_impacted"]
    raise HTTPException(404, f"Data fasilitas untuk run '{run_id}' tidak ditemukan.")


@router.get("/runs/{run_id}/health-guidance")
def get_run_health_guidance(run_id: str):
    data = _get_run_data(run_id)
    return get_health_and_mask_guidance(hazard=data.get("hazard", "volcano"))


__all__ = ["router", "RUNS_CACHE", "_get_run_data", "CUSTOM_HALF_DEG"]
