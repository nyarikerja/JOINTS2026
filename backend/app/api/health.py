"""
app/api/health.py

Status kesehatan sistem dan kesegaran tiap sumber data langsung.
"""

import os

from fastapi import APIRouter

from app.core.config import settings
from app.core.offline import is_offline

router = APIRouter(tags=["health"])


@router.get("/health")
def get_health():
    from app.services import firms_live, magma_status, osm_facilities, weather_grid

    wind = weather_grid._cache
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "offline_mode": is_offline(),
        "sources": {
            "nasa_firms": firms_live.status(),
            "magma_pvmbg": magma_status.level_status(),
            "open_meteo_wind_grid": {"cached": wind.get("data") is not None,
                                     "fetched_at": (wind.get("data") or {}).get("fetched_at")},
            "open_meteo_ensemble": {"model": "ecmwf_ifs025", "mode": "diunduh per simulasi"},
            "worldpop": {"dataset": "WorldPop 2020 1 km UN-adjusted"},
            "openstreetmap": osm_facilities.coverage_status(),
            "llm_featherless": {"configured": bool(os.getenv("FEATHERLESS_API_KEY"))},
        },
        "disclaimer": settings.DISCLAIMER,
    }
