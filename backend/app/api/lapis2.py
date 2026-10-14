"""
app/api/lapis2.py

Router untuk endpoint fitur pembeda Lapis 2:
- /runs/{run_id}/ranking
- /fire/extinguish
- /runs/{run_id}/carbon
- /runs/{run_id}/land-water
- /runs/{run_id}/rain-effect
- /runs/compare
- /runs/sensitivity
- /runs/{run_id}/advice
- /runs/{run_id}/severity
- /runs/{run_id}/arrival
"""

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.simulate import _get_run_data
from app.engine.grid import SimulationGrid
from app.impact.comparative import calculate_rain_effect, compare_two_runs, get_action_advice, run_parameter_sensitivity
from app.impact.volcano_features import calculate_land_water_impact
from app.impact.fire_features import calculate_carbon_emissions, rank_hotspot_clusters, simulate_extinguish_delta

router = APIRouter(tags=["lapis2"])


class ExtinguishRequest(BaseModel):
    run_id: str
    extinguish_cluster_ids: List[int] = Field(..., description="Daftar ID klaster titik api yang dipadamkan")


class CompareRequest(BaseModel):
    run_id_a: str
    run_id_b: str


class SensitivityRequest(BaseModel):
    run_id: str
    parameter_name: str = Field("column_height_km", description="Nama parameter yang disapu (column_height_km atau rain_intensity_mm_h)")


def _run_hotspots(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Titik api yang benar-benar dipakai run ini (konsisten dengan sebaran di peta)."""
    hs = data.get("hotspots")
    if not hs:
        raise HTTPException(status_code=404, detail="Run ini tidak menyimpan daftar titik api; jalankan ulang simulasi.")
    return hs


def _peat_fraction(data: Dict[str, Any]):
    """Fraksi gambut dari jenis kawasan di katalog (gambut = 1, sabana/savana/karst = 0), selain itu asumsi 0,4."""
    from app.api.events import NATIONAL_KARHUTLA
    k = NATIONAL_KARHUTLA.get(data.get("event_id") or "", {})
    text = f"{k.get('forest_type', '')} {k.get('name', '')} {data.get('event_name') or ''}".lower()
    if "gambut" in text or "peat" in text:
        return 1.0, f"Kawasan gambut menurut katalog ({k.get('forest_type') or k.get('name')})"
    if any(w in text for w in ("sabana", "savana", "savanna", "karst")):
        return 0.0, f"Kawasan non-gambut menurut katalog ({k.get('forest_type') or k.get('name')})"
    return 0.4, "Jenis lahan tidak diketahui; fraksi gambut asumsi 40%"


def _reconstruct_grid(data: Dict[str, Any]) -> SimulationGrid:
    grid_meta = data["grid"]
    return SimulationGrid(
        lat_min=grid_meta["lat_min"],
        lat_max=grid_meta["lat_max"],
        lon_min=grid_meta["lon_min"],
        lon_max=grid_meta["lon_max"],
        resolution_deg=grid_meta["resolution_deg"],
    )


@router.get("/runs/{run_id}/ranking")
def get_hotspot_ranking(run_id: str):
    data = _get_run_data(run_id)
    if data["hazard"] != "fire":
        raise HTTPException(status_code=400, detail="Peringkat titik api hanya berlaku untuk bahaya kebakaran (fire).")

    grid = _reconstruct_grid(data)
    hotspots = _run_hotspots(data)
    ranked = rank_hotspot_clusters(hotspots, data, grid)
    return {
        "run_id": run_id,
        "hazard": "fire",
        "ranked_clusters": ranked,
        "disclaimer": data["disclaimer"]
    }


@router.post("/fire/extinguish")
def post_extinguish_clusters(req: ExtinguishRequest):
    data = _get_run_data(req.run_id)
    if data["hazard"] != "fire":
        raise HTTPException(status_code=400, detail="Fitur pemadaman hanya berlaku untuk kebakaran.")

    grid = _reconstruct_grid(data)
    hotspots = _run_hotspots(data)
    delta = simulate_extinguish_delta(data, req.extinguish_cluster_ids, grid, hotspots, peat_fraction=_peat_fraction(data)[0])
    delta["disclaimer"] = data["disclaimer"]
    return delta


@router.get("/runs/{run_id}/carbon")
def get_carbon_emissions(run_id: str):
    data = _get_run_data(run_id)
    if data["hazard"] != "fire":
        raise HTTPException(status_code=400, detail="Estimasi gas karbon hanya relevan untuk kebakaran.")

    hotspots = _run_hotspots(data)
    peat_fraction, basis = _peat_fraction(data)
    carbon = calculate_carbon_emissions(hotspots, duration_hours=float(data.get("emission_duration_h") or 24.0),
                                        peat_fraction=peat_fraction)
    carbon["peat_basis"] = basis
    carbon["run_id"] = run_id
    carbon["disclaimer"] = data["disclaimer"]
    return carbon


@router.get("/runs/{run_id}/land-water")
def get_land_water_impact(run_id: str):
    data = _get_run_data(run_id)
    if data["hazard"] != "volcano":
        raise HTTPException(status_code=400, detail="Dampak lahan dan air abu hanya untuk gunung berapi.")

    grid = _reconstruct_grid(data)
    return calculate_land_water_impact(data, grid)


@router.get("/runs/{run_id}/rain-effect")
def get_rain_effect(run_id: str):
    data = _get_run_data(run_id)
    grid = _reconstruct_grid(data)
    return calculate_rain_effect(data, grid)


@router.post("/runs/compare")
def post_compare_runs(req: CompareRequest):
    run_a = _get_run_data(req.run_id_a)
    run_b = _get_run_data(req.run_id_b)
    grid_a = _reconstruct_grid(run_a)
    grid_b = _reconstruct_grid(run_b)
    return compare_two_runs(run_a, run_b, grid_a, grid_b)



@router.post("/runs/sensitivity")
def post_sensitivity_sweep(req: SensitivityRequest):
    data = _get_run_data(req.run_id)
    grid = _reconstruct_grid(data)
    return run_parameter_sensitivity(data, req.parameter_name, grid)


@router.get("/runs/{run_id}/advice")
def get_advice(run_id: str):
    data = _get_run_data(run_id)
    return get_action_advice(data)


@router.get("/runs/{run_id}/severity")
def get_severity(run_id: str, t: int = Query(12, ge=0, le=48)):
    data = _get_run_data(run_id)
    summary = data.get("severity_summary")
    if not summary:
        return {"run_id": run_id, "available": False, "reason": "Run ini tidak menyimpan ringkasan keparahan."}
    return {
        "run_id": run_id,
        "available": True,
        "severity_metric": summary["metric"],
        "domain_max": summary["domain_max"],
        "caveat": summary["caveat"],
        "note": "Parameter t diabaikan: keparahan diringkas sebagai maksimum selama horizon.",
        "disclaimer": data["disclaimer"],
    }


@router.get("/runs/{run_id}/arrival")
def get_arrival_times(run_id: str):
    import math
    data = _get_run_data(run_id)
    raw_arrival = data.get("arrival_time", {})
    cleaned_arrival = {}
    for k, v in raw_arrival.items():
        if isinstance(v, list):
            cleaned_arrival[k] = [
                [None if (x is None or (isinstance(x, (float, int)) and (math.isnan(x) or math.isinf(x)))) else round(float(x), 2) for x in row]
                if isinstance(row, list) else row
                for row in v
            ]
        else:
            cleaned_arrival[k] = v

    return {
        "run_id": run_id,
        "arrival_time": cleaned_arrival,
        "caveat": "Waktu kedatangan dihitung dalam jam sejak pelepasan partikel.",
        "disclaimer": data["disclaimer"]
    }


@router.get("/runs/{run_id}/air-quality")
def get_run_air_quality(run_id: str):
    """
    ISPU PM2.5 nyata di sekitar run: model CAMS (grid 5x5 di atas jejak sebaran) dan stasiun OpenAQ.
    Untuk kebakaran, sebaran HelaLoka dibandingkan dengan sel CAMS (pembanding model, bukan validasi lapangan).
    """
    import numpy as np

    from app.services import air_quality as aq

    data = _get_run_data(run_id)
    grid = _reconstruct_grid(data)
    c = data.get("center_coords") or {}
    clat, clon = float(c.get("latitude", (grid.lat_min + grid.lat_max) / 2)), float(c.get("longitude", (grid.lon_min + grid.lon_max) / 2))

    masks = data.get("hourly_exposure_masks")
    prob = np.mean(np.any(masks, axis=0), axis=0) if masks is not None else None
    if prob is not None and (prob >= 0.05).any():
        rows, cols = np.nonzero(prob >= 0.05)
        lat_lo, lat_hi = float(grid.lats[rows.min()]), float(grid.lats[rows.max()])
        lon_lo, lon_hi = float(grid.lons[cols.min()]), float(grid.lons[cols.max()])
    else:
        lat_lo, lat_hi, lon_lo, lon_hi = clat - 0.5, clat + 0.5, clon - 0.5, clon + 0.5
    pad = 0.3
    lats = np.linspace(lat_lo - pad, lat_hi + pad, 5)
    lons = np.linspace(lon_lo - pad, lon_hi + pad, 5)
    pts = [(clat, clon)] + [(float(a), float(b)) for a in lats for b in lons]
    cams = aq.cams_points(pts, hours=int(data.get("horizon_hours") or 48))
    if not cams:
        return {"run_id": run_id, "available": False, "reason": "Data CAMS tidak dapat diunduh saat ini."}

    comparison = None
    if data.get("hazard") == "fire" and prob is not None:
        hit = miss = false_alarm = clear = 0
        cells = []
        for pt in cams[1:]:
            inside = grid.lat_min <= pt["latitude"] <= grid.lat_max and grid.lon_min <= pt["longitude"] <= grid.lon_max
            if not inside or pt["pm25_24h_max_forecast"] is None:
                continue
            r, cc = grid.coord_to_index(pt["latitude"], pt["longitude"])
            model_smoke = bool(prob[r, cc] >= 0.5)
            cams_smoke = pt["pm25_24h_max_forecast"] > 55.4
            hit += model_smoke and cams_smoke
            miss += (not model_smoke) and cams_smoke
            false_alarm += model_smoke and not cams_smoke
            clear += (not model_smoke) and not cams_smoke
            cells.append({**pt, "model_prob": round(float(prob[r, cc]), 2)})
        n = hit + miss + false_alarm + clear
        comparison = {
            "n_points": n,
            "agreement_pct": round((hit + clear) / n * 100) if n else None,
            "hits": hit, "misses": miss, "false_alarms": false_alarm, "both_clear": clear,
            "definition": "Model: peluang >= 50%. CAMS: rata-rata 24 jam prakiraan > 55,4 ug/m3 (ISPU tidak sehat).",
            "caveat": "CAMS juga memuat polusi latar dan kebakaran lain; ini pembanding antar-model, bukan validasi pengukuran.",
            "points": cells,
        }

    return {
        "run_id": run_id,
        "available": True,
        "center": cams[0],
        "stations": aq.openaq_nearby(clat, clon),
        "comparison": comparison,
        "sources": {"model": aq.CAMS_SOURCE, "stations": aq.OPENAQ_SOURCE},
        "note": "Kategori ISPU dihitung dari PM2.5 rata-rata 24 jam CAMS/stasiun, bukan dari model sebaran HelaLoka.",
    }
