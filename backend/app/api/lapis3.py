"""
app/api/lapis3.py

Router FastAPI untuk fitur-fitur Lapis 3 [Bukti Kepercayaan]:
1. /validation/{event_id}: Evaluasi validasi lapangan (gunung: reported_impact, bandara; kebakaran: not_testable).
2. /limits: Batas komputasi, batasan domain, dan daftar status asumsi.
3. /sources: Metadata sumber data terbuka, lisensi, dan status litbang dari docs/SOURCES.md.
4. /demo/play/{event_id}: Sekuens playback otomatis tersimpan untuk demonstrasi juri ("Putar Demo").
5. /runs/{run_id}/export: Ekspor ringkasan satu halaman (JSON & HTML cetak mandiri).
6. /runs/{run_id}/lahar-warning: Peringatan bahaya lahar hujan sekunder.
"""

from typing import Any, Dict

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse

from app.api.simulate import _get_run_data
from app.core.config import BACKEND_DIR, get_assumptions_list, settings
from app.impact.comparative import get_action_advice
from app.impact.export import generate_printable_html
from app.impact.validation import evaluate_event_validation

router = APIRouter(tags=["Lapis 3: Bukti Kepercayaan"])


@router.get("/validation/{event_id}")
def get_event_validation(event_id: str, run_id: str | None = Query(None, description="Run yang dibandingkan")) -> Dict[str, Any]:
    """
    Evaluasi run terhadap laporan dampak lapangan. Tanpa run_id, hanya status ketersediaan data.
    """
    run = _get_run_data(run_id) if run_id else None
    return evaluate_event_validation(event_id, run)


@router.get("/limits")
def get_system_limits() -> Dict[str, Any]:
    """
    Menampilkan batasan komputasi, batas domain, ambang probabilitas,
    dan status bukti seluruh asumsi pemodelan.
    """
    assumptions = get_assumptions_list()
    status_counts = {}
    for a in assumptions:
        st = a.get("status", "unknown")
        status_counts[st] = status_counts.get(st, 0) + 1

    return {
        "computational_limits": {
            "max_bbox_degrees": "6.0 x 6.0",
            "max_horizon_hours": 48,
            "max_ensemble_members": 100,
            "max_concurrent_runs": 2,
            "firms_rate_limit_per_10min": 5000,
            "firms_max_query_span_days": 5,
        },
        "physical_domain_bounds": {
            "latitude_bounds": [-11.0, 6.0],
            "longitude_bounds": [95.0, 141.0],
            "vertical_levels_hpa": [1000, 925, 850, 700, 500, 300, 200],
            "particle_capacity": 50000,
            "advection_integrator": "Runge-Kutta 2nd Order (RK2)",
        },
        "tier_thresholds": {
            "minimum": {"threshold": 0.90, "label": "P90 (Peluang Tinggi, Area Inti)"},
            "median": {"threshold": 0.50, "label": "P50 (Peluang Sedang)"},
            "maximum": {"threshold": 0.05, "label": "P5 (Peluang Rendah, Jangkauan Terjauh)"},
            "subset_guarantee": "Strictly nested: Min <= Mid <= Max",
        },
        "assumptions_summary": {
            "total_assumptions": len(assumptions),
            "by_status": status_counts,
            "all_assumptions": assumptions,
        },
        "disclaimer": settings.DISCLAIMER,
    }


@router.get("/sources")
def get_sources_catalog() -> Dict[str, Any]:
    """
    Menyajikan katalog sumber data terbuka terverifikasi, lisensi, dan status integrasi.
    """
    sources_md_path = BACKEND_DIR / "docs" / "SOURCES.md"
    raw_markdown = ""
    if sources_md_path.exists():
        with open(sources_md_path, "r", encoding="utf-8-sig") as f:
            raw_markdown = f.read()

    verified_sources = [
        {
            "id": "D01",
            "name": "Open-Meteo Weather API",
            "type": "Cuaca & Angin Ansambel",
            "url": "https://open-meteo.com/",
            "license": "CC BY 4.0",
            "status": "S",
            "verified_on": "2026-10-05",
        },
        {
            "id": "D03",
            "name": "NASA FIRMS (MODIS & VIIRS)",
            "type": "Deteksi Titik Api & FRP",
            "url": "https://firms.modaps.eosdis.nasa.gov/",
            "license": "NASA Open Data Policy (Public Domain)",
            "status": "S",
            "verified_on": "2026-10-05",
        },
        {
            "id": "D04",
            "name": "OpenAQ Global Air Quality API",
            "type": "Stasiun Kualitas Udara",
            "url": "https://api.openaq.org/",
            "license": "Open Data / Attribution Required",
            "status": "S",
            "verified_on": "2026-10-05",
        },
        {
            "id": "D09",
            "name": "WorldPop Population Density & Demographics",
            "type": "Grid Populasi & Usia Rentan",
            "url": "https://www.worldpop.org/",
            "license": "CC BY 4.0",
            "status": "S",
            "verified_on": "2026-10-05",
        },
        {
            "id": "D18",
            "name": "OpenStreetMap / Overpass API",
            "type": "Fasilitas Publik (Sekolah, RS, Bandara)",
            "url": "https://overpass-api.de/",
            "license": "ODbL 1.0",
            "status": "S",
            "verified_on": "2026-10-05",
        },
        {
            "id": "D24",
            "name": "Mastin et al. 2009 (JVGR)",
            "type": "Formula Erupsi Vulkanik (MER)",
            "url": "https://doi.org/10.1016/j.jvolgeores.2009.01.008",
            "license": "Scientific Publication (Sourced)",
            "status": "S",
            "verified_on": "2026-10-05",
        },
        {
            "id": "D16",
            "name": "IVHHN & Kemenkes RI",
            "type": "Pedoman Dampak Kesehatan & Masker Abu",
            "url": "https://www.ivhhn.org/",
            "license": "Public Health Guidance",
            "status": "S",
            "verified_on": "2026-10-05",
        },
    ]

    return {
        "title": "Katalog Sumber Data UdaraSiaga",
        "verified_sources": verified_sources,
        "sources": verified_sources,
        "markdown_documentation": raw_markdown,
    }


@router.get("/demo/play/{event_id}")
def get_demo_playback_sequence(event_id: str) -> Dict[str, Any]:
    """Pemutaran demo tersimpan tidak tersedia: hasil harus berasal dari simulasi nyata (POST /simulate)."""
    return {
        "event_id": event_id,
        "available": False,
        "reason": "Pemutaran demo berisi angka tetap telah dihapus. Jalankan POST /simulate lalu putar jam lewat /runs/{run_id}/tiers.",
        "disclaimer": settings.DISCLAIMER,
    }


@router.get("/runs/{run_id}/export")
def export_run_summary(
    run_id: str, 
    format: str = Query("json", enum=["json", "html"]),
    event_name: str = Query(None, description="Nama spesifik kejadian (misal nama gunung)")
) -> Any:
    """
    Menghasilkan ringkasan skenario run satu halaman dalam format JSON atau HTML cetak.
    """
    data = _get_run_data(run_id)
    grid_meta = data["grid"]
    from app.engine.grid import SimulationGrid
    from app.impact.exposure import calculate_impact_ranges, get_exposed_facilities_list
    from app.impact.advisory import generate_emergency_advisory

    grid = SimulationGrid(
        lat_min=grid_meta["lat_min"],
        lat_max=grid_meta["lat_max"],
        lon_min=grid_meta["lon_min"],
        lon_max=grid_meta["lon_max"],
        resolution_deg=grid_meta["resolution_deg"],
    )
    impact_data = data.get("impact") or calculate_impact_ranges(data, grid)
    advice_data = get_action_advice(data)
    assumptions_data = get_assumptions_list()

    facilities_data = {}
    try:
        facilities_data = get_exposed_facilities_list(data, grid)
    except Exception:
        pass

    advisory_data = generate_emergency_advisory(data, impact_data, facilities_data)

    export_payload = {
        "run_id": run_id,
        "hazard": data.get("hazard", "volcano"),
        "mode": data.get("mode", "auto"),
        "event_name": event_name or data.get("event_name"),
        "scenario_label": data.get("scenario_label"),
        "members_source": data.get("members_source"),
        "n_members": data.get("n_members"),
        "horizon_hours": data.get("horizon_hours", 48),
        "disclaimer": settings.DISCLAIMER,
        "impact": impact_data,
        "advice": advice_data,
        "assumptions_used": assumptions_data[:8],
        "advisory": advisory_data,
        "facilities": facilities_data,
    }

    if format == "html":
        html_content = generate_printable_html(export_payload)
        return HTMLResponse(content=html_content, status_code=200)

    return export_payload


@router.get("/runs/{run_id}/emergency-advisory")
def get_run_emergency_advisory(run_id: str) -> Dict[str, Any]:
    """
    Menghasilkan protokol darurat multi-sektor cerdas (AI Emergency Advisory)
    meliputi Kecamatan terdampak, edukasi APD Kemenkes, SPAB Sekolah, dan Faskes.
    """
    data = _get_run_data(run_id)
    grid_meta = data["grid"]
    from app.engine.grid import SimulationGrid
    from app.impact.exposure import calculate_impact_ranges, get_exposed_facilities_list
    from app.impact.advisory import generate_emergency_advisory

    grid = SimulationGrid(
        lat_min=grid_meta["lat_min"],
        lat_max=grid_meta["lat_max"],
        lon_min=grid_meta["lon_min"],
        lon_max=grid_meta["lon_max"],
        resolution_deg=grid_meta["resolution_deg"],
    )
    impact_data = data.get("impact") or calculate_impact_ranges(data, grid)
    facilities_data = data.get("facilities_impacted") or {}
    if not facilities_data or not facilities_data.get("schools"):
        try:
            from app.api.simulate import RUNS_CACHE
            cache_data = RUNS_CACHE.get(run_id)
            if cache_data and "hourly_exposure_masks" in cache_data:
                facilities_data = get_exposed_facilities_list(cache_data, grid)
            elif "hourly_exposure_masks" in data:
                facilities_data = get_exposed_facilities_list(data, grid)
        except Exception:
            pass

    return generate_emergency_advisory(data, impact_data, facilities_data)


@router.get("/runs/{run_id}/evacuation-route")
def get_evacuation_corridor_route(
    run_id: str,
    from_lat: float = Query(..., description="Latitude titik asal (sekolah/posko)"),
    from_lon: float = Query(..., description="Longitude titik asal"),
    to_lat: float = Query(..., description="Latitude tujuan (RS rujukan aman)"),
    to_lon: float = Query(..., description="Longitude tujuan"),
    from_name: str = Query("Titik Evakuasi", description="Nama lokasi asal"),
    to_name: str = Query("RS Rujukan Aman", description="Nama RS tujuan"),
) -> Dict[str, Any]:
    """
    Menghitung rute jalan raya riil minim dampak bahaya (Safe Evacuation Corridor)
    menggunakan OSRM OpenStreetMap, menjauhi radius kawah aktif & zona paparan pekat.
    """
    from app.impact.routing import get_real_road_evacuation_route
    data = _get_run_data(run_id)
    center = data.get("center_coords") or {}
    c_lat = center.get("latitude")
    c_lon = center.get("longitude")

    return get_real_road_evacuation_route(
        origin_lat=from_lat,
        origin_lon=from_lon,
        dest_lat=to_lat,
        dest_lon=to_lon,
        origin_name=from_name,
        dest_name=to_name,
        center_lat=c_lat,
        center_lon=c_lon,
    )



@router.get("/runs/{run_id}/lahar-warning")
def get_lahar_warning(run_id: str) -> Dict[str, Any]:
    """
    Potensi lahar hujan dari prakiraan hujan ensemble (Open-Meteo ECMWF) di puncak gunung,
    dibandingkan dengan ambang pemicu pada config/assumptions.yaml (lahar_rain_trigger_mm_h).
    """
    data = _get_run_data(run_id)
    hazard = data.get("hazard", "volcano")
    if hazard != "volcano":
        return {"run_id": run_id, "hazard": hazard, "lahar_risk_level": "none",
                "message": "Bahaya lahar hanya relevan untuk erupsi gunung api."}
    ws = data.get("weather_summary") or {}
    if ws.get("precip_max_mm_h") is None:
        return {"run_id": run_id, "hazard": "volcano", "available": False, "lahar_risk_level": "unknown",
                "reason": "Run ini tidak menyimpan prakiraan hujan; jalankan ulang simulasi."}
    prob = float(ws.get("prob_rain_above_lahar_trigger") or 0.0)
    thr = float(ws.get("lahar_trigger_mm_h") or 20.0)
    level = "tinggi" if prob >= 0.5 else ("waspada" if prob >= 0.2 else "rendah")
    pmax = ws["precip_max_mm_h"]
    name = data.get("event_name") or "gunung api"
    return {
        "run_id": run_id,
        "hazard": "volcano",
        "available": True,
        "lahar_risk_level": level,
        "prob_rain_above_trigger": prob,
        "rainfall_threshold_trigger_mm_h": thr,
        "forecast_precip_max_mm_h": pmax,
        "forecast_precip_total_mm": ws.get("precip_total_mm"),
        "weather_model": ws.get("model"),
        "vulnerable_drainage_basins": [],
        "warning_text": (
            f"Prakiraan hujan maksimum di {name} dalam {data.get('horizon_hours', 48)} jam: "
            f"{pmax['median']} mm/jam (median ensemble, rentang {pmax['min']}-{pmax['max']}). "
            f"Peluang hujan >= {thr:.0f} mm/jam: {round(prob * 100)}%. Ambang pemicu adalah asumsi model, "
            "bukan ambang resmi PVMBG; pantau peringatan lahar dari PVMBG dan BPBD setempat."
        ),
        "source": ws.get("model"),
    }
