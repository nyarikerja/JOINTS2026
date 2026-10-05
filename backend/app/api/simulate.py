"""
app/api/simulate.py

Router untuk eksekusi simulasi, polling status, poligon tiga tingkat, dan kartu dampak.
Mematuhi seluruh prinsip AGENTS.md (penolakan overrides pada mode auto, determinisme, label skenario).
"""

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query

from app.core.config import EVENTS_DIR, RUNS_DIR
from app.engine.grid import SimulationGrid
from app.engine.simulator import SimulationRunner
from app.impact.exposure import (
    calculate_impact_ranges,
    evaluate_decision_card,
    get_exposed_facilities_list,
    get_health_and_mask_guidance,
)
from app.ingest.firms import FirmsIngest
from app.ingest.openmeteo import OpenMeteoIngest
from app.schemas.simulation import SimulationRequest

router = APIRouter(tags=["simulation"])

# In-memory store untuk run aktif yang membawa array lengkap
RUNS_CACHE: Dict[str, Dict[str, Any]] = {}


@router.post("/simulate")
def start_simulation(req: SimulationRequest):
    event_id = req.source.event_id
    event_dir = EVENTS_DIR / event_id
    meta_file = event_dir / "meta.json"

    if not meta_file.exists():
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' tidak ditemukan di data/events/")

    # 1. Muat metadata kejadian
    import json
    event_meta = json.loads(meta_file.read_text(encoding="utf-8"))

    # 2. Muat data cuaca
    try:
        weather_data = OpenMeteoIngest.get_weather_for_simulation(
            event_id=event_id,
            n_members=req.n_members,
            seed=req.seed,
            overrides=req.overrides
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memuat cuaca: {e}")

    # 3. Muat titik api jika hazard kebakaran
    hotspots = []
    if req.hazard == "fire":
        hotspots = FirmsIngest.load_event_hotspots(event_id, overrides=req.overrides)
        if not hotspots and req.mode == "auto":
            # Laporkan apa adanya sesuai prinsip 4
            pass

    # 4. Jalankan simulator
    runner = SimulationRunner(req)
    run_output = runner.run(event_meta, weather_data, hotspots)

    # Simpan di memori
    RUNS_CACHE[runner.run_id] = run_output

    return {
        "run_id": runner.run_id,
        "hazard": req.hazard,
        "mode": req.mode,
        "status": "completed",
        "scenario_label": run_output["scenario_label"],
        "members_source": run_output["members_source"],
        "n_members": req.n_members,
        "seed": req.seed,
        "created_at_utc": runner.created_at_utc,
        "disclaimer": run_output["disclaimer"],
        "assumptions_used": run_output["assumptions_used"],
    }


def _get_run_data(run_id: str) -> Dict[str, Any]:
    if run_id in RUNS_CACHE:
        return RUNS_CACHE[run_id]

    # Coba muat dari file
    save_file = RUNS_DIR / f"{run_id}.json"
    if not save_file.exists():
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' tidak ditemukan.")

    import json
    return json.loads(save_file.read_text(encoding="utf-8"))


@router.get("/runs/{run_id}")
def get_run_status(run_id: str):
    data = _get_run_data(run_id)
    return {
        "run_id": data["run_id"],
        "hazard": data["hazard"],
        "mode": data["mode"],
        "event_id": data["event_id"],
        "status": data["status"],
        "scenario_label": data["scenario_label"],
        "members_source": data["members_source"],
        "n_members": data["n_members"],
        "seed": data["seed"],
        "created_at_utc": data["created_at_utc"],
        "completed_at_utc": data.get("completed_at_utc"),
        "disclaimer": data["disclaimer"],
        "assumptions_used": data.get("assumptions_used", []),
    }


@router.get("/runs/{run_id}/tiers")
def get_run_tiers(run_id: str, t: int = Query(0, ge=0, le=48, description="Langkah jam")):
    data = _get_run_data(run_id)
    tiers = data.get("hourly_tiers", {})
    # Key di JSON file mungkin berupa string
    step_key = str(t) if str(t) in tiers else t
    if step_key not in tiers:
        # Kembalikan FeatureCollection kosong yang valid jika di luar jam
        return {
            "type": "FeatureCollection",
            "properties": {"hour": t, "thresholds": {"min": 0.9, "mid": 0.5, "max": 0.05}},
            "features": []
        }
    return tiers[step_key]


@router.get("/runs/{run_id}/impact")
def get_run_impact(run_id: str):
    if run_id not in RUNS_CACHE:
        raise HTTPException(status_code=404, detail=f"Data array run '{run_id}' tidak aktif di memori.")

    data = RUNS_CACHE[run_id]
    grid_meta = data["grid"]
    grid = SimulationGrid(
        lat_min=grid_meta["lat_min"],
        lat_max=grid_meta["lat_max"],
        lon_min=grid_meta["lon_min"],
        lon_max=grid_meta["lon_max"],
        resolution_deg=grid_meta["resolution_deg"],
    )

    return calculate_impact_ranges(data, grid)


@router.get("/runs/{run_id}/location/{facility_id}")
def get_location_decision_card(run_id: str, facility_id: str):
    if run_id not in RUNS_CACHE:
        raise HTTPException(status_code=404, detail=f"Data array run '{run_id}' tidak aktif di memori.")

    data = RUNS_CACHE[run_id]
    grid_meta = data["grid"]
    grid = SimulationGrid(
        lat_min=grid_meta["lat_min"],
        lat_max=grid_meta["lat_max"],
        lon_min=grid_meta["lon_min"],
        lon_max=grid_meta["lon_max"],
        resolution_deg=grid_meta["resolution_deg"],
    )

    return evaluate_decision_card(data, facility_id, grid)


@router.get("/runs/{run_id}/facilities-impacted")
def get_run_facilities_impacted(run_id: str, min_prob: float = Query(0.05, ge=0.01, le=1.0)):
    if run_id not in RUNS_CACHE:
        raise HTTPException(status_code=404, detail=f"Data array run '{run_id}' tidak aktif di memori.")

    data = RUNS_CACHE[run_id]
    grid_meta = data["grid"]
    grid = SimulationGrid(
        lat_min=grid_meta["lat_min"],
        lat_max=grid_meta["lat_max"],
        lon_min=grid_meta["lon_min"],
        lon_max=grid_meta["lon_max"],
        resolution_deg=grid_meta["resolution_deg"],
    )

    return get_exposed_facilities_list(data, grid, min_prob=min_prob)


@router.get("/runs/{run_id}/health-guidance")
def get_run_health_guidance(run_id: str):
    data = _get_run_data(run_id)
    hazard = data.get("hazard", "volcano")
    return get_health_and_mask_guidance(hazard=hazard)
