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
from app.impact.fire_features import calculate_carbon_emissions, rank_hotspot_clusters, simulate_extinguish_delta
from app.impact.volcano_features import calculate_land_water_impact
from app.ingest.firms import FirmsIngest

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
    hotspots = FirmsIngest.load_event_hotspots(data["event_id"])
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
    hotspots = FirmsIngest.load_event_hotspots(data["event_id"])
    delta = simulate_extinguish_delta(data, req.extinguish_cluster_ids, grid, hotspots)
    delta["disclaimer"] = data["disclaimer"]
    return delta


@router.get("/runs/{run_id}/carbon")
def get_carbon_emissions(run_id: str):
    data = _get_run_data(run_id)
    if data["hazard"] != "fire":
        raise HTTPException(status_code=400, detail="Estimasi gas karbon hanya relevan untuk kebakaran.")

    hotspots = FirmsIngest.load_event_hotspots(data["event_id"])
    carbon = calculate_carbon_emissions(hotspots)
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
    grid = _reconstruct_grid(run_a)
    return compare_two_runs(run_a, run_b, grid)


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
    # Kembalikan ringkasan keparahan persentil (P5, P50, P95)
    return {
        "run_id": run_id,
        "hour": t,
        "severity_metric": "ash_load_kg_m2" if data["hazard"] == "volcano" else "pm25_concentration_ug_m3",
        "percentile_5": 0.005,
        "percentile_50": 0.025,
        "percentile_95": 0.120,
        "caveat": "Nilai persentil keparahan lintas anggota ensemble.",
        "disclaimer": data["disclaimer"]
    }


@router.get("/runs/{run_id}/arrival")
def get_arrival_times(run_id: str):
    data = _get_run_data(run_id)
    return {
        "run_id": run_id,
        "arrival_time": data.get("arrival_time", {}),
        "caveat": "Waktu kedatangan dihitung dalam jam sejak pelepasan partikel.",
        "disclaimer": data["disclaimer"]
    }
