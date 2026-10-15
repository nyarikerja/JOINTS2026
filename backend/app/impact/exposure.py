"""
app/impact/exposure.py

Perhitungan dampak paparan pada penduduk, kelompok rentan (anak & lansia), dan fasilitas publik.
Mematuhi Prinsip AGENTS.md:
1. Angka dampak SELALU rentang {min, median, max} (P5, P50, P95) lintas anggota ensemble.
2. Kategori ISPU hanya dihitung bila faktor emisi PM2.5 berstatus sourced*.
4. Data yang tidak ada dijawab available: false dengan alasan (tanpa angka karangan).

Sumber: populasi WorldPop 2020 (app/ingest/population.py), fasilitas OpenStreetMap
(app/services/osm_facilities.py). Fasilitas hanya dimuat untuk kotak jejak paparan.
"""

import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.core.config import is_pm25_emission_factor_sourced
from app.engine.grid import SimulationGrid
from app.ingest.overpass import OverpassIngest
from app.ingest.population import SOURCE as POP_SOURCE
from app.ingest.population import PopulationIngest
from app.services.osm_facilities import SOURCE as OSM_SOURCE

SAFE_PROB = 0.10
LIST_LIMIT_SCHOOLS = 500
LIST_LIMIT_HEALTH = 300
REFERRAL_RADIUS_KM = 220.0
EMERGENCY_NUMBERS = "119 (SPGDT) / 112"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Jarak garis lurus bola bumi dalam kilometer (Haversine)."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    return round(r * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a)), 2)


def get_landmass_region(fac: Dict[str, Any]) -> int:
    """Indeks pulau (poligon garis pantai) sebuah fasilitas; -1 bila tidak diketahui."""
    from app.engine.landmask import LandMask
    return int(LandMask.island_ids([fac["latitude"]], [fac["longitude"]])[0])


def _hav_np(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def _safe_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        fv = float(val)
        return None if (math.isnan(fv) or math.isinf(fv)) else fv
    except (ValueError, TypeError):
        return None


def _range(vals) -> Dict[str, float]:
    arr = np.asarray(vals, dtype=float)
    if arr.size == 0:
        return {"min": 0.0, "median": 0.0, "max": 0.0}
    return {
        "min": round(float(np.percentile(arr, 5)), 1),
        "median": round(float(np.percentile(arr, 50)), 1),
        "max": round(float(np.percentile(arr, 95)), 1),
    }


def _ever_exposed(run_output: Dict[str, Any]) -> Optional[np.ndarray]:
    masks = run_output.get("hourly_exposure_masks")
    if masks is None or not hasattr(masks, "shape"):
        return None
    return np.any(masks, axis=0)  # (n_members, n_lat, n_lon)


def footprint_bbox(run_output: Dict[str, Any], grid: SimulationGrid, pad_deg: float = 0.0) -> Optional[Tuple[float, float, float, float]]:
    ever = _ever_exposed(run_output)
    if ever is None:
        return None
    any_m = np.any(ever, axis=0)
    rows, cols = np.nonzero(any_m)
    if rows.size == 0:
        return None
    return (
        float(grid.lats[rows.min()]) - pad_deg, float(grid.lats[rows.max()]) + pad_deg,
        float(grid.lons[cols.min()]) - pad_deg, float(grid.lons[cols.max()]) + pad_deg,
    )


def run_facilities(run_output: Dict[str, Any], grid: SimulationGrid) -> Dict[str, Any]:
    """Fasilitas OSM di jejak paparan (+ RS rujukan di sekitarnya). Di-cache per run."""
    from app.services import osm_facilities

    cached = run_output.get("_facilities")
    if cached is not None:
        missing = [tuple(t) for t in cached.get("missing_tiles", [])]
        if not missing or not osm_facilities.tiles_available(missing):
            return cached
    bbox = footprint_bbox(run_output, grid, pad_deg=grid.resolution_deg)
    if bbox is None:
        res = {"in_footprint": [], "hospitals_nearby": [], "missing_tiles": []}
    else:
        facs, missing = OverpassIngest.get_facilities_with_coverage(*bbox, fetch_missing=False)
        lat_min, lat_max, lon_min, lon_max = bbox
        hosp, missing2 = OverpassIngest.get_facilities_with_coverage(
            lat_min - 1.0, lat_max + 1.0, lon_min - 1.0, lon_max + 1.0, facility_type="healthcare",
            fetch_missing=False,
        )
        hosp = [h for h in hosp if h.get("subtype") == "hospital"]
        res = {"in_footprint": facs, "hospitals_nearby": hosp, "missing_tiles": sorted(set(missing) | set(missing2))}
    run_output["_facilities"] = res
    return res


def _fac_arrays(facs: List[Dict[str, Any]], grid: SimulationGrid):
    if not facs:
        return np.zeros(0, int), np.zeros(0, int), np.zeros(0, bool)
    lat = np.array([f["latitude"] for f in facs])
    lon = np.array([f["longitude"] for f in facs])
    inside = (lat >= grid.lat_min) & (lat <= grid.lat_max) & (lon >= grid.lon_min) & (lon <= grid.lon_max)
    r, c = grid.coord_to_index(lat, lon)
    return np.asarray(r), np.asarray(c), inside


def _coverage_note(fac_info: Dict[str, Any]) -> Dict[str, Any]:
    missing = fac_info.get("missing_tiles", [])
    return {
        "source": OSM_SOURCE,
        "complete": not missing,
        "missing_tiles": [list(t) for t in missing],
        "note": (
            "Data fasilitas OSM lengkap untuk jejak paparan." if not missing else
            f"{len(missing)} tile 1 derajat sedang diunduh dari Overpass; jumlah fasilitas bisa kurang dari "
            "kenyataan dan akan diperbarui otomatis saat dibuka ulang."
        ),
    }


def calculate_impact_ranges(run_output: Dict[str, Any], grid: SimulationGrid) -> Dict[str, Any]:
    """Rentang dampak lintas anggota ensemble, plus deret per jam."""
    if isinstance(run_output.get("impact"), dict) and "population_exposed" in run_output["impact"]:
        return dict(run_output["impact"])

    ever = _ever_exposed(run_output)
    if ever is None:
        return {
            "run_id": run_output.get("run_id"),
            "available": False,
            "reason": "Matriks paparan run ini tidak tersimpan; jalankan ulang simulasi.",
        }
    masks = run_output["hourly_exposure_masks"]
    n_hours, n_members = masks.shape[0], masks.shape[1]

    pop = PopulationIngest.get_population_grid(
        grid.lat_min, grid.lat_max, grid.lon_min, grid.lon_max, grid.resolution_deg, shape=(grid.n_lat, grid.n_lon)
    )
    cell_km2 = grid.cell_area_m2 / 1e6

    fac_info = run_facilities(run_output, grid)
    facs = fac_info["in_footprint"]
    r, c, inside = _fac_arrays(facs, grid)
    types = np.array([f["facility_type"] for f in facs]) if facs else np.zeros(0, dtype=str)

    def fac_counts(mask_mf: np.ndarray, kind: str) -> np.ndarray:
        sel = inside & (types == kind)
        return mask_mf[..., sel].sum(axis=-1) if sel.any() else np.zeros(mask_mf.shape[:-1])

    ever_f = ever[:, r, c] if facs else np.zeros((n_members, 0), bool)
    cum = np.maximum.accumulate(masks, axis=0)
    cum_f = cum[:, :, r, c] if facs else np.zeros((n_hours, n_members, 0), bool)

    tot = np.tensordot(cum, pop["total"], axes=([2, 3], [0, 1]))      # (H, M)
    area = np.tensordot(cum, cell_km2, axes=([2, 3], [0, 1]))
    child_f = float(pop["children"].sum() / pop["total"].sum()) if pop["total"].sum() > 0 else 0.0
    elder_f = float(pop["elderly"].sum() / pop["total"].sum()) if pop["total"].sum() > 0 else 0.0
    sch_h, hc_h = fac_counts(cum_f, "school"), fac_counts(cum_f, "healthcare")

    hourly_series: Dict[str, Any] = {}
    for h in range(n_hours):
        hourly_series[str(h)] = {
            "population_exposed": _range(tot[h]),
            "children_exposed": _range(tot[h] * child_f),
            "elderly_exposed": _range(tot[h] * elder_f),
            "area_exposed_km2": _range(area[h]),
            "schools_exposed": _range(sch_h[h]),
            "healthcare_exposed": _range(hc_h[h]),
        }
    if n_hours > 0:
        hourly_series[str(n_hours)] = hourly_series[str(n_hours - 1)]

    if is_pm25_emission_factor_sourced():
        ispu_info = {"available": True, "caveat": "Dihitung dari rata-rata 24 jam Permen LHK P.14/2020."}
    else:
        ispu_info = {
            "available": False,
            "reason": "Kategori ISPU tidak ditampilkan: faktor emisi PM2.5 (D13b) masih placeholder, "
                      "sehingga konsentrasi absolut belum layak dikonversi ke kategori ISPU (Prinsip 11).",
        }

    return {
        "run_id": run_output["run_id"],
        "scenario_label": run_output["scenario_label"],
        "disclaimer": run_output["disclaimer"],
        "assumptions_used": run_output["assumptions_used"],
        "population_exposed": _range(tot[-1]),
        "children_exposed": _range(tot[-1] * child_f),
        "elderly_exposed": _range(tot[-1] * elder_f),
        "schools_exposed": _range(fac_counts(ever_f, "school")),
        "healthcare_exposed": _range(fac_counts(ever_f, "healthcare")),
        "airports_exposed": _range(fac_counts(ever_f, "airport")),
        "area_exposed_km2": _range(area[-1]),
        "ispu": ispu_info,
        "population_source": POP_SOURCE,
        "facilities_coverage": _coverage_note(fac_info),
        "hourly_series": hourly_series,
    }


def _arrival(run_output, key, r, c):
    arr = run_output.get("arrival_time", {}).get(key) or []
    if not arr:
        return None
    v = _safe_float(arr[r][c])
    return round(v, 1) if v is not None else None


def evaluate_decision_card(run_output: Dict[str, Any], facility_id: str, grid: SimulationGrid) -> Dict[str, Any]:
    """Kartu keputusan satu fasilitas: peluang terkena dan jam tiba (dari run yang sama)."""
    fac = None
    info = run_output.get("_facilities")
    if info:
        fac = next((f for f in info["in_footprint"] + info["hospitals_nearby"] if f["facility_id"] == facility_id), None)
    if fac is None:
        for pool in (run_output.get("facilities_impacted") or {}).values():
            if isinstance(pool, list):
                fac = next((f for f in pool if isinstance(f, dict) and f.get("facility_id") == facility_id), None)
                if fac:
                    break
    if fac is None:
        fac = OverpassIngest.get_facility_by_id(facility_id)
    if not fac:
        return {"available": False, "reason": f"Fasilitas ID '{facility_id}' tidak ditemukan."}

    masks = run_output.get("hourly_exposure_masks")
    lat, lon = fac["latitude"], fac["longitude"]
    in_grid = grid.lat_min <= lat <= grid.lat_max and grid.lon_min <= lon <= grid.lon_max
    prob, earliest, likely = 0.0, None, None
    if in_grid and masks is not None:
        r, c = grid.coord_to_index(lat, lon)
        prob = float(np.mean(np.any(masks[:, :, r, c], axis=0)))
        earliest, likely = _arrival(run_output, "earliest", r, c), _arrival(run_output, "most_likely", r, c)
    elif fac.get("exposure_probability") is not None:
        prob = float(fac["exposure_probability"])
        earliest = fac.get("arrival_time_earliest_h")
        likely = fac.get("arrival_time_most_likely_h")

    return {
        "available": True,
        "facility_id": fac["facility_id"],
        "name": fac["name"],
        "facility_type": fac["facility_type"],
        "latitude": lat,
        "longitude": lon,
        "district": fac.get("district", "-"),
        "exposure_probability": round(prob, 2),
        "exposure_probability_pct": int(round(prob * 100)),
        "arrival_time_earliest_h": earliest,
        "arrival_time_most_likely_h": likely,
        "source": OSM_SOURCE,
        "scenario_label": run_output["scenario_label"],
        "disclaimer": run_output["disclaimer"],
    }


def _school_advice(prob: float, earliest: Optional[float]) -> Dict[str, str]:
    if prob >= 0.90:
        return {
            "alert_level": "PELUANG SANGAT TINGGI", "badge_color": "#ef4444",
            "recommendation": "PERTIMBANGKAN PJJ DARING",
            "action_detail": (
                f"Model memperkirakan paparan pada sebagian besar anggota ensemble"
                f"{f', paling cepat T+{earliest} jam' if earliest is not None else ''}. "
                "Koordinasikan dengan dinas pendidikan/BPBD sebelum mengubah KBM."
            ),
        }
    if prob >= 0.50:
        return {
            "alert_level": "PELUANG SEDANG", "badge_color": "#f59e0b",
            "recommendation": "BATASI AKTIVITAS LUAR RUANG",
            "action_detail": "Kurangi olahraga/upacara di luar gedung dan siapkan masker N95 di UKS.",
        }
    return {
        "alert_level": "PELUANG RENDAH", "badge_color": "#10b981",
        "recommendation": "PANTAU PERKEMBANGAN",
        "action_detail": "KBM normal; pantau informasi resmi BMKG/PVMBG/BPBD.",
    }


def _health_advice(prob: float, earliest: Optional[float]) -> Dict[str, str]:
    if prob >= 0.90:
        return {
            "alert_level": "PELUANG SANGAT TINGGI", "badge_color": "#ef4444",
            "recommendation": "SIAPKAN LAYANAN PERNAPASAN",
            "action_detail": (
                "Periksa stok oksigen, nebulizer, dan masker N95 untuk nakes"
                f"{f' sebelum T+{earliest} jam' if earliest is not None else ''}."
            ),
        }
    if prob >= 0.50:
        return {
            "alert_level": "PELUANG SEDANG", "badge_color": "#f59e0b",
            "recommendation": "INVENTARISASI LOGISTIK PERNAPASAN",
            "action_detail": "Pastikan masker partikulat dan obat pernapasan tersedia.",
        }
    return {
        "alert_level": "PELUANG RENDAH", "badge_color": "#10b981",
        "recommendation": "PANTAU KELUHAN PERNAPASAN",
        "action_detail": "Pantau keluhan pernapasan warga secara berkala.",
    }


def get_exposed_facilities_list(run_output: Dict[str, Any], grid: SimulationGrid, min_prob: float = 0.05) -> Dict[str, Any]:
    """Fasilitas OSM di jalur paparan beserta RS rujukan aman terdekat."""
    masks = run_output.get("hourly_exposure_masks")
    if masks is None:
        return {"available": False, "reason": "Matriks paparan run ini tidak tersimpan.", "schools": [], "healthcare": [],
                "airports": [], "evacuation_referral_hospitals": []}
    ever = np.any(masks, axis=0)
    fac_info = run_facilities(run_output, grid)
    center = run_output.get("center_coords") or {
        "latitude": (grid.lat_min + grid.lat_max) / 2, "longitude": (grid.lon_min + grid.lon_max) / 2
    }
    c_lat, c_lon = float(center["latitude"]), float(center["longitude"])

    def evaluate(facs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not facs:
            return []
        r, c, inside = _fac_arrays(facs, grid)
        prob = np.where(inside, ever[:, r, c].mean(axis=0), 0.0)
        out = []
        for i, f in enumerate(facs):
            p = float(prob[i])
            out.append({
                "facility_id": f["facility_id"],
                "name": f["name"],
                "facility_type": f["facility_type"],
                "subtype": f.get("subtype"),
                "district": f.get("district", "-"),
                "latitude": f["latitude"],
                "longitude": f["longitude"],
                "exposure_probability": round(p, 2),
                "exposure_pct": int(round(p * 100)),
                "arrival_time_earliest_h": _arrival(run_output, "earliest", r[i], c[i]) if inside[i] else None,
                "arrival_time_most_likely_h": _arrival(run_output, "most_likely", r[i], c[i]) if inside[i] else None,
            })
        return out

    # RS rujukan: rumah sakit di sekitar jejak paparan, aman bila peluang < SAFE_PROB
    hospitals = evaluate(fac_info["hospitals_nearby"])
    for h in hospitals:
        h["distance_from_epicenter_km"] = haversine_km(c_lat, c_lon, h["latitude"], h["longitude"])
        h["is_safe"] = h["exposure_probability"] < SAFE_PROB
        h["evacuation_status"] = "SAFE_ZONE" if h["is_safe"] else ("WARNING_ZONE" if h["exposure_probability"] < 0.35 else "DANGER_ZONE")
        h["status_badge"] = (
            "Di luar jalur paparan (peluang < 10%)" if h["is_safe"] else f"Di jalur paparan ({h['exposure_pct']}%)"
        )
        h["badge_color"] = "#10b981" if h["is_safe"] else ("#f59e0b" if h["exposure_probability"] < 0.35 else "#ef4444")
        h["emergency_hotline"] = EMERGENCY_NUMBERS
    referral = [h for h in hospitals if h["distance_from_epicenter_km"] <= REFERRAL_RADIUS_KM]
    referral.sort(key=lambda x: (not x["is_safe"], x["distance_from_epicenter_km"]))

    evaluated = [f for f in evaluate(fac_info["in_footprint"]) if f["exposure_probability"] >= min_prob]
    schools = [f for f in evaluated if f["facility_type"] == "school"]
    healthcare = [f for f in evaluated if f["facility_type"] == "healthcare"]
    airports = [f for f in evaluated if f["facility_type"] == "airport"]

    safe = [h for h in hospitals if h["is_safe"]]
    pool = safe or hospitals
    if schools and pool:
        from app.engine.landmask import LandMask

        hlat = np.array([h["latitude"] for h in pool])
        hlon = np.array([h["longitude"] for h in pool])
        h_to_c = _hav_np(hlat, hlon, c_lat, c_lon)
        h_island = LandMask.island_ids(hlat, hlon)
        s_island = LandMask.island_ids([x["latitude"] for x in schools], [x["longitude"] for x in schools])
        for k, s in enumerate(schools):
            d = _hav_np(s["latitude"], s["longitude"], hlat, hlon)
            # Rujukan darat tidak menyeberang laut: utamakan RS di pulau yang sama
            if s_island[k] >= 0 and np.any(h_island == s_island[k]):
                d = np.where(h_island == s_island[k], d, np.inf)
            s_to_c = float(_hav_np(s["latitude"], s["longitude"], c_lat, c_lon))
            nearest_i = int(np.argmin(d))
            # Pilih RS yang tidak membawa korban lebih dekat ke sumber bahaya
            away = (h_to_c >= s_to_c - 2.0) & np.isfinite(d)
            pick_i = int(np.argmin(np.where(away, d, np.inf))) if away.any() else nearest_i
            ref = pool[pick_i]
            s["nearest_hospital"] = {**pool[nearest_i], "distance_km": round(float(d[nearest_i]), 1)}
            s["nearest_safe_hospital"] = {**ref, "distance_km": round(float(d[pick_i]), 1)}
            s["evacuation_protocol"] = (
                f"Rujukan terdekat yang menjauhi sumber bahaya: {ref['name']} "
                f"({round(float(d[pick_i]), 1)} km garis lurus, {ref['status_badge']}). Nomor darurat {EMERGENCY_NUMBERS}."
            )
    for s in schools:
        s.update(_school_advice(s["exposure_probability"], s["arrival_time_earliest_h"]))
    for h in healthcare:
        h.update(_health_advice(h["exposure_probability"], h["arrival_time_earliest_h"]))
    for a in airports:
        a.update({"alert_level": "RUANG UDARA", "badge_color": "#f59e0b",
                  "recommendation": "PANTAU NOTAM/ASHTAM RESMI",
                  "action_detail": "Abu vulkanik berbahaya bagi mesin pesawat; ikuti NOTAM/ASHTAM otoritas penerbangan."})

    key = lambda x: (-x["exposure_probability"], x["arrival_time_earliest_h"] if x["arrival_time_earliest_h"] is not None else 999)  # noqa: E731
    schools.sort(key=key)
    healthcare.sort(key=key)

    return {
        "available": True,
        "total_schools_at_risk": len(schools),
        "total_healthcare_at_risk": len(healthcare),
        "total_airports_at_risk": len(airports),
        "total_evacuation_hospitals": len(referral),
        "schools": schools[:LIST_LIMIT_SCHOOLS],
        "healthcare": healthcare[:LIST_LIMIT_HEALTH],
        "airports": airports,
        "evacuation_referral_hospitals": referral[:60],
        "list_truncated": len(schools) > LIST_LIMIT_SCHOOLS or len(healthcare) > LIST_LIMIT_HEALTH,
        "facilities_coverage": _coverage_note(fac_info),
    }


def get_health_and_mask_guidance(hazard: str = "volcano") -> Dict[str, Any]:
    """Panduan perlindungan pernapasan dan mata."""
    return {
        "hazard": hazard,
        "title": "Perlindungan Saluran Pernapasan & Mata",
        "mask_type_recommended": "N95 / KN95 (respirator partikulat)",
        "mask_guidance": {
            "prohibited": [
                {"name": "Masker bedah biasa", "verdict": "Bukan perlindungan utama",
                 "reason": "Tidak dirancang menyaring partikel halus dan sering bocor di tepi."},
                {"name": "Masker kain / scarf", "verdict": "Tidak efektif",
                 "reason": "Serat kain terlalu longgar untuk partikel halus abu dan asap."},
            ],
            "mandatory_standards": [
                {"name": "N95 (NIOSH 42 CFR 84)", "verdict": "Direkomendasikan",
                 "efficiency": "Menyaring >= 95% partikel uji 0,3 mikron",
                 "instructions": "Tekan klip hidung rapat dan pastikan tidak ada celah di tepi."},
                {"name": "KN95 / FFP2", "verdict": "Alternatif setara",
                 "efficiency": "Menyaring >= 94-95% partikel uji",
                 "instructions": "Pilih ukuran yang pas dan periksa kerapatan saat dipakai."},
            ],
        },
        "eye_protection": {
            "critical_warning": "Hindari lensa kontak saat hujan abu.",
            "medical_rationale": "Partikel abu vulkanik bersifat abrasif dan dapat menggores kornea bila terjebak di bawah lensa kontak.",
            "safe_action": "Gunakan kacamata pelindung tertutup.",
        },
        "household_safety": [
            "Tutup celah jendela dan pintu.",
            "Basahi abu sebelum dibersihkan agar tidak beterbangan kembali.",
            "Bersihkan abu di atap sebelum hujan karena abu basah jauh lebih berat.",
        ],
    }
