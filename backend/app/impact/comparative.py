"""
app/impact/comparative.py

Fitur komparasi, analisis efek hujan, sensitivitas skenario, dan saran tindakan (Lapis 2).
Mematuhi batasan bahwa saran tindakan abu HANYA mencantumkan entri terverifikasi (D16).
"""

from typing import Any, Dict

from app.engine.grid import SimulationGrid
from app.impact.exposure import calculate_impact_ranges


def calculate_rain_effect(
    run_output: Dict[str, Any],
    grid: SimulationGrid
) -> Dict[str, Any]:
    """
    Pengaruh hujan prakiraan pada partikel: fraksi massa yang tercuci hujan selama simulasi
    (keluaran model per anggota ensemble) dan ringkasan hujan prakiraan di sumber.
    """
    hazard = run_output["hazard"]
    ws = run_output.get("weather_summary") or {}
    if not ws.get("scavenged_mass_fraction"):
        return {"run_id": run_output["run_id"], "hazard": hazard, "available": False,
                "reason": "Run ini tidak menyimpan ringkasan hujan; jalankan ulang simulasi."}

    frac = ws["scavenged_mass_fraction"]
    if hazard == "volcano":
        caveat_text = (
            "Hujan mempercepat jatuhnya abu lebih dekat ke kawah. Abu basah jauh lebih berat di atap "
            "dan endapan di lereng dapat terbawa hujan menjadi lahar."
        )
    else:
        caveat_text = (
            "Hujan hanya membersihkan partikel asap di udara sementara. Api gambut di bawah permukaan "
            "memerlukan hujan lebat berkepanjangan agar padam."
        )
    return {
        "run_id": run_output["run_id"],
        "hazard": hazard,
        "available": True,
        "scavenged_mass_pct": {k: round(v * 100.0, 1) for k, v in frac.items()},
        "precip_max_mm_h": ws.get("precip_max_mm_h"),
        "precip_total_mm": ws.get("precip_total_mm"),
        "weather_model": ws.get("model"),
        "hazard_specific_warning": caveat_text,
        "scenario_label": run_output["scenario_label"],
        "disclaimer": run_output["disclaimer"]
    }


def compare_two_runs(
    run1: Dict[str, Any],
    run2: Dict[str, Any],
    grid: SimulationGrid = None,
    grid2: SimulationGrid = None
) -> Dict[str, Any]:
    """
    Membandingkan dua simulasi secara berdampingan (side-by-side comparison).
    Masing-masing run dievaluasi dengan geometrinya sendiri agar terbebas dari dimension mismatch.
    """
    if grid is None and "grid" in run1:
        g1 = run1["grid"]
        grid = SimulationGrid(g1["lat_min"], g1["lat_max"], g1["lon_min"], g1["lon_max"], g1["resolution_deg"])
    if grid2 is None:
        if "grid" in run2:
            g2 = run2["grid"]
            grid2 = SimulationGrid(g2["lat_min"], g2["lat_max"], g2["lon_min"], g2["lon_max"], g2["resolution_deg"])
        else:
            grid2 = grid

    imp1 = calculate_impact_ranges(run1, grid)
    imp2 = calculate_impact_ranges(run2, grid2)

    def diff_metric(m1: Dict[str, float], m2: Dict[str, float]) -> Dict[str, float]:
        return {
            "min_diff": round(m2["min"] - m1["min"], 1),
            "median_diff": round(m2["median"] - m1["median"], 1),
            "max_diff": round(m2["max"] - m1["max"], 1),
        }

    return {
        "run_a": {
            "run_id": run1["run_id"],
            "mode": run1["mode"],
            "scenario_label": run1["scenario_label"],
            "impact": imp1
        },
        "run_b": {
            "run_id": run2["run_id"],
            "mode": run2["mode"],
            "scenario_label": run2["scenario_label"],
            "impact": imp2
        },
        "deltas": {
            "population_exposed_diff": diff_metric(imp1["population_exposed"], imp2["population_exposed"]),
            "area_exposed_diff_km2": diff_metric(imp1["area_exposed_km2"], imp2["area_exposed_km2"]),
            "schools_exposed_diff": diff_metric(imp1["schools_exposed"], imp2["schools_exposed"]),
        },
        "disclaimer": run1["disclaimer"]
    }


def run_parameter_sensitivity(
    base_run_output: Dict[str, Any],
    param_name: str,
    grid: SimulationGrid
) -> Dict[str, Any]:
    """Kurva sensitivitas membutuhkan simulasi ulang per nilai parameter; belum dijalankan otomatis."""
    return {
        "run_id": base_run_output["run_id"],
        "parameter_swept": param_name,
        "available": False,
        "reason": (
            "Kurva sensitivitas tidak diperkirakan dengan rumus skala. Jalankan mode Uji Skenario dengan nilai "
            "parameter berbeda lalu bandingkan hasilnya lewat POST /runs/compare."
        ),
        "sensitivity_curve": [],
        "disclaimer": base_run_output["disclaimer"],
    }


def get_action_advice(run_output: Dict[str, Any]) -> Dict[str, Any]:
    """
    D16: Saran tindakan terverifikasi.
    Abu: Hanya entri bersumber (Badan Geologi 7 Sept), selebihnya available: false.
    Asap: Indeks paparan relatif.
    """
    hazard = run_output["hazard"]
    disclaimer = run_output["disclaimer"]

    if hazard == "volcano":
        return {
            "hazard": "volcano",
            "sourced_advice": [
                {
                    "action": "Mengurangi aktivitas luar rumah dan memakai masker penutup hidung dan mulut",
                    "target_audience": "Masyarakat di wilayah terdampak hujan abu lebat",
                    "status": "sourced",
                    "source": "Laporan Badan Geologi Kementerian ESDM tanggal 7 September 2026",
                    "source_url": "https://geologi.esdm.go.id/media-center/perkembangan-erupsi-gunungapi-anak-krakatau-tanggal-7-september-2026",
                    "verified_on": "2026-10-05"
                }
            ],
            "additional_guidance": {
                "available": False,
                "reason": "Saran tindakan mitigasi lanjutan (evakuasi, penutupan bandara) memerlukan arahan otoritas resmi BPBD/PVMBG dan tidak digeneralisasi otomatis oleh simulasi."
            },
            "disclaimer": disclaimer
        }
    else:
        return {
            "hazard": "fire",
            "sourced_advice": [
                {
                    "action": "Membatasi aktivitas luar ruang untuk kelompok sensitif (anak-anak dan lansia)",
                    "target_audience": "Wilayah dengan perkiraan paparan asap pekat",
                    "status": "sourced_secondary",
                    "source": "Pedoman Kualitas Udara ISPU KLHK (Permen LHK P.14/2020)",
                    "verified_on": "2026-10-05"
                }
            ],
            "additional_guidance": {
                "available": False,
                "reason": "Kategori ISPU definitif menunggu tersedianya faktor emisi PM2.5 berstatus sourced* (Prinsip 11 AGENTS.md)."
            },
            "disclaimer": disclaimer
        }
