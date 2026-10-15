"""
app/engine/simulator.py

Simulator terintegrasi partikel Lagrangian untuk kedua bahaya (Gunung & Kebakaran).
Mendukung 50-100 anggota ensemble, deterministik berbasis seed, dan output per jam.
"""

import datetime
import json
import math
import uuid
from typing import Any, Dict, List

import numpy as np

from app.core.config import RUNS_DIR, get_assumptions, get_assumptions_used, settings
from app.core.rng import get_rng
from app.engine.aggregation import aggregate_tiers_for_hour, compute_arrival_time_grid
from app.engine.fire import generate_fire_particles_per_step, sample_frp_conversion_factor
from app.engine.grid import SimulationGrid
from app.engine.particles import advect_particles_rk2, create_empty_particles
from app.engine.scavenging import apply_rain_scavenging
from app.engine.volcano import calculate_mer_mastin, generate_volcano_particles_per_step
from app.schemas.simulation import SimulationRequest


def _bilinear(field3: np.ndarray, fi: np.ndarray, fj: np.ndarray) -> np.ndarray:
    """Interpolasi bilinear pada grid 3x3 dengan indeks pecahan fi (lintang) dan fj (bujur) di [0, 2]."""
    i0 = np.minimum(np.floor(fi).astype(int), 1)
    j0 = np.minimum(np.floor(fj).astype(int), 1)
    di, dj = fi - i0, fj - j0
    return (field3[i0, j0] * (1 - di) * (1 - dj) + field3[i0, j0 + 1] * (1 - di) * dj
            + field3[i0 + 1, j0] * di * (1 - dj) + field3[i0 + 1, j0 + 1] * di * dj)


FINE_N = 25
_FINE_AX = np.linspace(0.0, 2.0, FINE_N)
_FI, _FJ = np.meshgrid(_FINE_AX, _FINE_AX, indexing="ij")


def _refine(field3: np.ndarray) -> np.ndarray:
    """Grid 3x3 -> tabel 25x25 hasil interpolasi bilinear (dibaca per partikel dengan indeks terdekat)."""
    return _bilinear(field3, _FI, _FJ)



def _downwind_shift_km(weather_data: Dict[str, Any], horizon_hours: int, max_km: float) -> tuple[float, float]:
    """Pergeseran pusat domain (utara, timur) dalam km: setengah perpindahan angin rata-rata
    ensemble selama horizon, dibatasi max_km. Tanpa data angin -> (0, 0)."""
    u, v = weather_data.get("wind_u"), weather_data.get("wind_v")
    if u is None or v is None:
        return 0.0, 0.0
    u_a = np.asarray(u, dtype=float)[..., :max(1, horizon_hours)]
    v_a = np.asarray(v, dtype=float)[..., :max(1, horizon_hours)]
    if u_a.size == 0 or v_a.size == 0:
        return 0.0, 0.0
    mu, mv = float(np.nanmean(u_a)), float(np.nanmean(v_a))
    if not np.isfinite(mu) or not np.isfinite(mv):
        return 0.0, 0.0
    disp_km = np.hypot(mu, mv) * horizon_hours * 3.6 * 0.5
    if disp_km < 1e-6:
        return 0.0, 0.0
    k = min(disp_km, max(0.0, max_km)) / np.hypot(mu, mv)
    return mv * k, mu * k

class SimulationRunner:
    def __init__(self, request: SimulationRequest):
        self.request = request
        self.run_id = f"run_{uuid.uuid4().hex[:12]}"
        self.rng = get_rng(request.seed)
        self.created_at_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()

    def run(
        self,
        event_meta: Dict[str, Any],
        weather_data: Dict[str, Any],
        hotspots: List[Dict[str, Any]] | None = None
    ) -> Dict[str, Any]:
        """
        Menjalankan simulasi penuh untuk seluruh anggota ensemble.
        """
        hazard = self.request.hazard
        n_members = self.request.n_members
        horizon_hours = min(self.request.horizon_hours, 48)
        dt_s = 300.0  # 5 menit
        steps_per_hour = int(3600 / dt_s)
        total_steps = horizon_hours * steps_per_hour

        # 1. Inisialisasi Grid
        if hazard == "volcano":
            coords = event_meta.get("coordinates", {"latitude": -6.102, "longitude": 105.423})
            center_lat = float(coords.get("latitude", -6.102))
            center_lon = float(coords.get("longitude", 105.423))
            # Domain 1500 km (sel 0,05° agar jumlah sel ~ sama dengan domain lama), pusatnya digeser searah angin rata-rata ensemble (maks. 500 km, sisi hulu
            # tetap >= 250 km dari sumber). Domain 900 km simetris sebelumnya memotong sebaran 48 jam
            # pada angin ~8 m/s sehingga tepinya tampak lurus seperti kotak.
            domain_km = 1500.0
            shift_n, shift_e = _downwind_shift_km(weather_data, horizon_hours, max_km=domain_km / 2.0 - 250.0)
            grid = SimulationGrid.create_for_volcano(center_lat, center_lon, domain_km=domain_km, res_deg=0.05,
                                                     shift_north_km=shift_n, shift_east_km=shift_e)
        else:
            bbox = event_meta.get("bbox", [110.0, -4.0, 116.0, 1.0])
            # Untuk kebakaran hutan, pusat kejadian adalah kluster titik api aktif (atau koordinat kawasan hutan riil)
            if hotspots and len(hotspots) > 0:
                total_frp = sum(float(h.get("frp", 1.0)) for h in hotspots)
                if total_frp > 0:
                    center_lat = sum(float(h["latitude"]) * float(h.get("frp", 1.0)) for h in hotspots) / total_frp
                    center_lon = sum(float(h["longitude"]) * float(h.get("frp", 1.0)) for h in hotspots) / total_frp
                else:
                    center_lat = float(hotspots[0]["latitude"])
                    center_lon = float(hotspots[0]["longitude"])
            elif event_meta.get("coordinates") and event_meta["coordinates"].get("latitude") is not None:
                center_lat = float(event_meta["coordinates"]["latitude"])
                center_lon = float(event_meta["coordinates"]["longitude"])
            else:
                center_lat = (float(bbox[1]) + float(bbox[3])) / 2.0
                center_lon = (float(bbox[0]) + float(bbox[2])) / 2.0
            grid = SimulationGrid.create_for_fire(bbox, buffer_km=350.0, res_deg=0.03)

        wind_u_arr = weather_data.get("wind_u")  # shape (n_members, n_weather_steps), titik pusat
        # medan angin/hujan spasial 3x3 (anggota, langkah, 3, 3) bila tersedia
        u_field = weather_data.get("wind_u_field")
        v_field = weather_data.get("wind_v_field")
        p_field = weather_data.get("precip_field")
        wgrid = weather_data.get("grid")
        fine_cache: Dict[tuple, tuple] = {}
        fine_scale = (FINE_N - 1) / (2.0 * wgrid["d"]) if wgrid else 0.0
        wind_v_arr = weather_data.get("wind_v")
        precip_arr = weather_data.get("precip")

        # Durasi emisi aktif (gunung & kebakaran)
        duration_h = float(
            self.request.overrides.get("duration_h", event_meta.get("duration_h", 24.0))
            if self.request.overrides else event_meta.get("duration_h", 24.0)
        )

        # 2. Persiapan Parameter Sumber
        if hazard == "volcano":
            vent_lat = float(event_meta.get("coordinates", {}).get("latitude", -6.102))
            vent_lon = float(event_meta.get("coordinates", {}).get("longitude", 105.423))
            vent_elev_m = float(event_meta.get("vent_elevation_m", 110.0))

            # Override kolom jika ada
            if self.request.overrides and self.request.overrides.get("column_height_km"):
                plume_top_asl_km = float(self.request.overrides["column_height_km"])
            else:
                plume_top_asl_km = float(event_meta.get("plume_top_asl_km") or 10.0)

            peak_phase_h = float(event_meta.get("peak_phase_duration_h", 6.0))

            # D24: H di atas kawah
            h_vent_km = max(0.1, plume_top_asl_km - (vent_elev_m / 1000.0))
            base_mer_kg_s = calculate_mer_mastin(h_vent_km)
            plume_top_m = plume_top_asl_km * 1000.0

        # Masker terkena: (horizon_hours, n_members, n_lat, n_lon)
        hourly_exposure_masks = np.zeros((horizon_hours, n_members, grid.n_lat, grid.n_lon), dtype=bool)
        member_max_severity = np.zeros((n_members, grid.n_lat, grid.n_lon), dtype=float)

        particles_per_step = 40  # Keseimbangan performa & resolusi
        max_particles_capacity = 25000
        emitted_mass = np.zeros(n_members, dtype=float)
        scavenged_mass_total = np.zeros(n_members, dtype=float)

        # 3. Loop per Anggota Ensemble
        for m in range(n_members):
            member_rng = np.random.default_rng(self.request.seed + m * 97)
            particles = create_empty_particles(max_particles_capacity)
            particle_cursor = 0

            # Matriks akumulasi endapan abu (kg/m²) atau konsentrasi PM2.5 (µg/m³)
            deposited_mass_grid = np.zeros((grid.n_lat, grid.n_lon), dtype=float)

            if hazard == "volcano":
                # Lognormal draw laju emisi per anggota (faktor 4 ketidakpastian)
                mer_member = member_rng.lognormal(mean=np.log(base_mer_kg_s), sigma=0.5)
            else:
                # Faktor FRP-to-dry-matter per anggota (D13 segitiga)
                frp_factor = sample_frp_conversion_factor(member_rng)

            # Loop Waktu Simulasi
            for step in range(total_steps):
                current_time_s = step * dt_s
                current_hour = int(step // steps_per_hour)
                weather_step_idx = min(current_hour, wind_u_arr.shape[1] - 1) if wind_u_arr is not None else 0

                u_cur = float(wind_u_arr[m, weather_step_idx]) if wind_u_arr is not None else 4.0
                v_cur = float(wind_v_arr[m, weather_step_idx]) if wind_v_arr is not None else 2.0
                rain_cur = float(precip_arr[m, weather_step_idx]) if precip_arr is not None else 0.0

                # 3a. Pelepasan Partikel Baru
                if hazard == "volcano":
                    if current_time_s < duration_h * 3600.0:
                        # Skala fase puncak vs background
                        phase_scale = 1.0 if current_time_s < (peak_phase_h * 3600.0) else 0.15
                        step_mass = mer_member * phase_scale * dt_s
                        slot0 = particle_cursor
                        inserted = generate_volcano_particles_per_step(
                            p=particles,
                            start_slot=particle_cursor,
                            n_particles=particles_per_step,
                            vent_lat=vent_lat,
                            vent_lon=vent_lon,
                            vent_elev_m=vent_elev_m,
                            plume_top_m=plume_top_m,
                            total_mass_step_kg=step_mass,
                            rng=member_rng,
                        )
                        emitted_mass[m] += float(particles.mass[slot0:slot0 + inserted].sum())
                        particle_cursor = (particle_cursor + inserted) % (max_particles_capacity - particles_per_step)
                else:
                    if hotspots and (current_time_s < duration_h * 3600.0):
                        slot0 = particle_cursor
                        inserted = generate_fire_particles_per_step(
                            p=particles,
                            start_slot=particle_cursor,
                            hotspots=hotspots,
                            dt_s=dt_s,
                            particles_per_hotspot=max(1, 100 // len(hotspots)),
                            frp_factor_kg_mj=frp_factor,
                            rng=member_rng,
                        )
                        emitted_mass[m] += float(particles.mass[slot0:slot0 + inserted].sum())
                        particle_cursor = (particle_cursor + inserted) % (max_particles_capacity - 200)

                # Angin dan hujan per partikel (interpolasi bilinear dari grid 3x3), atau nilai titik pusat
                if u_field is not None:
                    act_now = np.where(particles.active)[0]
                    if len(act_now):
                        key = (m, weather_step_idx)
                        if key not in fine_cache:
                            fine_cache.clear()
                            fine_cache[key] = (_refine(u_field[m, weather_step_idx]), _refine(v_field[m, weather_step_idx]),
                                               _refine(p_field[m, weather_step_idx]))
                        U, V, R = fine_cache[key]
                        ii = np.clip(((particles.lat[act_now] - wgrid["lat0"]) * fine_scale + 0.5).astype(np.int32), 0, FINE_N - 1)
                        jj = np.clip(((particles.lon[act_now] - wgrid["lon0"]) * fine_scale + 0.5).astype(np.int32), 0, FINE_N - 1)
                        u_cur, v_cur, rain_cur = U[ii, jj], V[ii, jj], R[ii, jj]

                # 3b. Pencucian oleh Hujan
                if np.any(np.asarray(rain_cur) > 0.05):
                    scavenged_mass = apply_rain_scavenging(particles, rain_cur, dt_s)
                    scavenged_mass_total[m] += float(np.sum(scavenged_mass))
                    if len(scavenged_mass) > 0:
                        act_idx = np.where(particles.active)[0][:len(scavenged_mass)]
                        in_b = (
                            (particles.lat[act_idx] >= grid.lat_min) & (particles.lat[act_idx] <= grid.lat_max) &
                            (particles.lon[act_idx] >= grid.lon_min) & (particles.lon[act_idx] <= grid.lon_max)
                        )
                        valid_act = act_idx[in_b]
                        if len(valid_act) > 0:
                            rows, cols = grid.coord_to_index(particles.lat[valid_act], particles.lon[valid_act])
                            np.add.at(deposited_mass_grid, (rows, cols), scavenged_mass[in_b])

                # 3c. Adveksi & Difusi
                advect_particles_rk2(
                    p=particles,
                    u_ms=u_cur,
                    v_ms=v_cur,
                    dt_s=dt_s,
                    diff_coeff_m2s=80.0,
                    rng=member_rng,
                )

                # Partikel yang keluar domain regional dinonaktifkan (bebas dari efek kotak batas)
                out_bounds = (
                    (particles.lat < grid.lat_min) | (particles.lat > grid.lat_max) |
                    (particles.lon < grid.lon_min) | (particles.lon > grid.lon_max)
                )
                particles.active[out_bounds] = False

                # Endapkan partikel yang mendarat ke grid tanah (hanya di dalam domain)
                dep_mask = particles.deposited & (particles.mass > 0)
                if np.any(dep_mask):
                    d_idx = np.where(dep_mask)[0]
                    in_b = (
                        (particles.lat[d_idx] >= grid.lat_min) & (particles.lat[d_idx] <= grid.lat_max) &
                        (particles.lon[d_idx] >= grid.lon_min) & (particles.lon[d_idx] <= grid.lon_max)
                    )
                    valid_d = d_idx[in_b]
                    if len(valid_d) > 0:
                        rows, cols = grid.coord_to_index(particles.lat[valid_d], particles.lon[valid_d])
                        np.add.at(deposited_mass_grid, (rows, cols), particles.mass[valid_d])
                    particles.mass[d_idx] = 0.0  # Telah terendapkan

                # 3d. Evaluasi di Akhir Setiap Jam
                if (step + 1) % steps_per_hour == 0:
                    eval_h = current_hour
                    if eval_h < horizon_hours:
                        if hazard == "volcano":
                            # 1. Beban endapan kumulatif di tanah (kg/m²)
                            load_grid = deposited_mass_grid / grid.cell_area_m2

                            # 2. Konsentrasi awan abu aktif melayang di udara (µg/m³)
                            act_idx = np.where(particles.active)[0]
                            conc_grid = np.zeros((grid.n_lat, grid.n_lon), dtype=float)
                            if len(act_idx) > 0:
                                in_b = (
                                    (particles.lat[act_idx] >= grid.lat_min) & (particles.lat[act_idx] <= grid.lat_max) &
                                    (particles.lon[act_idx] >= grid.lon_min) & (particles.lon[act_idx] <= grid.lon_max)
                                )
                                valid_act = act_idx[in_b]
                                if len(valid_act) > 0:
                                    rows, cols = grid.coord_to_index(particles.lat[valid_act], particles.lon[valid_act])
                                    np.add.at(conc_grid, (rows, cols), particles.mass[valid_act] * 1e9)
                                    conc_grid /= (grid.cell_area_m2 * 1200.0)

                            # Ambang terkena abu: endapan di tanah >= 0.001 kg/m² (~0.001 mm tephra)
                            # ATAU awan abu melayang di udara >= 50.0 µg/m³
                            exposed_mask = (load_grid >= 0.001) | (conc_grid >= 50.0)
                            hourly_exposure_masks[eval_h, m] = exposed_mask
                            member_max_severity[m] = np.maximum(member_max_severity[m], load_grid + (conc_grid * 1e-6))
                        else:
                            # Konsentrasi PM2.5 di udara aktif (µg/m³)
                            act_idx = np.where(particles.active)[0]
                            conc_grid = np.zeros((grid.n_lat, grid.n_lon), dtype=float)
                            if len(act_idx) > 0:
                                in_b = (
                                    (particles.lat[act_idx] >= grid.lat_min) & (particles.lat[act_idx] <= grid.lat_max) &
                                    (particles.lon[act_idx] >= grid.lon_min) & (particles.lon[act_idx] <= grid.lon_max)
                                )
                                valid_act = act_idx[in_b]
                                if len(valid_act) > 0:
                                    rows, cols = grid.coord_to_index(particles.lat[valid_act], particles.lon[valid_act])
                                    # Massa dalam kg diubah ke µg (* 1e9)
                                    np.add.at(conc_grid, (rows, cols), particles.mass[valid_act] * 1e9)
                                    # Bagi dengan volume sel (luas sel * tinggi mixed layer 1200 m)
                                    conc_grid /= (grid.cell_area_m2 * 1200.0)

                            # Ambang paparan PM2.5: >= 15.5 µg/m³ (Batas kategori 'Sedang' ISPU)
                            exposed_mask = conc_grid >= 15.5
                            hourly_exposure_masks[eval_h, m] = exposed_mask
                            member_max_severity[m] = np.maximum(member_max_severity[m], conc_grid)

        # 4. Agregasi Tiers & Arrival Times
        th_min = self.request.thresholds.min
        th_mid = self.request.thresholds.mid
        th_max = self.request.thresholds.max

        hourly_tiers_geojson = {}
        for h in range(horizon_hours):
            hourly_tiers_geojson[h] = aggregate_tiers_for_hour(
                hourly_member_masks=hourly_exposure_masks[h],
                grid=grid,
                hour=h,
                th_min=th_min,
                th_mid=th_mid,
                th_max=th_max,
            )

        # Jamin ketersediaan langkah jam T+48 (akhir horizon) agar tidak kosong saat slider mencapai ujung
        if horizon_hours not in hourly_tiers_geojson and (horizon_hours - 1) in hourly_tiers_geojson:
            import copy
            h_end = copy.deepcopy(hourly_tiers_geojson[horizon_hours - 1])
            h_end["properties"]["hour"] = horizon_hours
            for feat in h_end.get("features", []):
                feat["properties"]["hour"] = horizon_hours
            hourly_tiers_geojson[horizon_hours] = h_end

        # 4b. Hitung ringkasan vektor angin per langkah jam dari data ensemble cuaca
        cardinal_names = ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"]
        hourly_wind_summary = {}
        for h in range(horizon_hours + 1):
            w_idx = min(h, wind_u_arr.shape[1] - 1) if wind_u_arr is not None else 0
            u_mean = float(np.mean(wind_u_arr[:, w_idx])) if wind_u_arr is not None else 4.0
            v_mean = float(np.mean(wind_v_arr[:, w_idx])) if wind_v_arr is not None else 2.0
            spd = float(math.hypot(u_mean, v_mean))
            bearing_motion = (math.degrees(math.atan2(u_mean, v_mean)) + 360.0) % 360.0
            dir_from = (math.degrees(math.atan2(-u_mean, -v_mean)) + 360.0) % 360.0
            card_from_idx = int(round(dir_from / 45.0)) % 8
            card_to_idx = int(round(bearing_motion / 45.0)) % 8
            card_from = cardinal_names[card_from_idx]
            card_to = cardinal_names[card_to_idx]

            w_info = {
                "u": round(u_mean, 2),
                "v": round(v_mean, 2),
                "speed_ms": round(spd, 1),
                "speed_kmh": round(spd * 3.6, 1),
                "direction_deg": round(dir_from, 1),
                "bearing_motion_deg": round(bearing_motion, 1),
                "cardinal": card_to,
                "cardinal_from": card_from,
                "cardinal_to": card_to,
                "description": f"Angin {round(spd, 1)} m/s dari {card_from} (Sebaran menuju {card_to})"
            }
            hourly_wind_summary[h] = w_info
            if h in hourly_tiers_geojson and "properties" in hourly_tiers_geojson[h]:
                hourly_tiers_geojson[h]["properties"]["wind"] = w_info

        earliest_arr, likely_arr = compute_arrival_time_grid(hourly_exposure_masks)

        # 5. Susun Metadata Hasil & Simpan
        scenario_label = (
            "skenario hipotetis" if self.request.mode == "experiment"
            else (event_meta.get("scenario_label") or "kejadian observasi")
        )
        members_source = weather_data.get("members_source", "open_meteo_ensemble")

        start_utc = event_meta.get("start_utc") or self.created_at_utc
        try:
            t0 = datetime.datetime.fromisoformat(str(start_utc).replace("Z", "+00:00"))
        except ValueError:
            t0 = datetime.datetime.now(datetime.timezone.utc)
        for h, geo in hourly_tiers_geojson.items():
            geo.setdefault("properties", {})["time_utc"] = (t0 + datetime.timedelta(hours=int(h))).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Ringkasan hujan prakiraan & pencucian partikel (keluaran model, bukan konstanta)
        n_used = min(horizon_hours + 1, precip_arr.shape[1]) if precip_arr is not None else 0
        pr = precip_arr[:, :n_used] if precip_arr is not None else np.zeros((n_members, 0))
        lahar_thr = float((get_assumptions().get("lahar_rain_trigger_mm_h") or {}).get("value", 20.0))
        scav_frac = np.divide(scavenged_mass_total, emitted_mass, out=np.zeros_like(emitted_mass), where=emitted_mass > 0)

        def _rng3(arr):
            arr = np.asarray(arr, dtype=float)
            return {k: round(float(np.percentile(arr, q)), 2) for k, q in (("min", 5), ("median", 50), ("max", 95))}

        weather_summary = {
            "model": weather_data.get("model"),
            "level": weather_data.get("level"),
            "spatial_grid": "3x3 titik ensemble, interpolasi bilinear" if wgrid else "satu titik di sumber",
            "fetched_at": weather_data.get("fetched_at"),
            "valid_from": weather_data.get("valid_from"),
            "stale": bool(weather_data.get("stale")),
            "precip_max_mm_h": _rng3(pr.max(axis=1)) if pr.size else None,
            "precip_total_mm": _rng3(pr.sum(axis=1)) if pr.size else None,
            "lahar_trigger_mm_h": lahar_thr,
            "prob_rain_above_lahar_trigger": round(float(np.mean(pr.max(axis=1) >= lahar_thr)), 2) if pr.size else 0.0,
            "scavenged_mass_fraction": _rng3(scav_frac),
        }
        severity_summary = {
            "metric": "ash_load_kg_m2" if hazard == "volcano" else "pm25_relative_ug_m3",
            "domain_max": _rng3(member_max_severity.reshape(n_members, -1).max(axis=1)),
            "caveat": (
                "Nilai maksimum domain selama horizon per anggota ensemble." if hazard == "volcano" else
                "Konsentrasi relatif: faktor emisi PM2.5 masih placeholder, jangan dibaca sebagai ISPU."
            ),
        }

        def _clean_arrival_matrix(matrix: np.ndarray) -> list:
            clean = []
            for row in matrix:
                clean.append([None if np.isnan(val) else round(float(val), 2) for val in row])
            return clean

        run_output = {
            "run_id": self.run_id,
            "hazard": hazard,
            "mode": self.request.mode,
            "event_id": event_meta.get("event_id") or self.request.source.event_id,
            "status": "completed",
            "scenario_label": scenario_label,
            "members_source": members_source,
            "n_members": n_members,
            "seed": self.request.seed,
            "created_at_utc": self.created_at_utc,
            "completed_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "disclaimer": settings.DISCLAIMER,
            "center_coords": {"latitude": center_lat, "longitude": center_lon},
            "event_name": event_meta.get("name"),
            "start_utc": t0.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "horizon_hours": horizon_hours,
            "emission_duration_h": duration_h,
            "source_info": event_meta.get("source_info"),
            "weather_summary": weather_summary,
            "severity_summary": severity_summary,
            "hotspots_used": event_meta.get("hotspots_used"),
            "assumptions_used": get_assumptions_used(),
            "grid": {
                "lat_min": grid.lat_min,
                "lat_max": grid.lat_max,
                "lon_min": grid.lon_min,
                "lon_max": grid.lon_max,
                "resolution_deg": grid.resolution_deg,
            },
            "hourly_tiers": hourly_tiers_geojson,
            "hourly_wind": hourly_wind_summary,
            "member_max_severity": member_max_severity,
            "hourly_exposure_masks": hourly_exposure_masks,
            "arrival_time": {
                "earliest": _clean_arrival_matrix(earliest_arr),
                "most_likely": _clean_arrival_matrix(likely_arr),
            }
        }

        # Precompute impact ranges & fasilitas terdampak agar selalu tersimpan di berkas JSON disk
        from app.impact.exposure import calculate_impact_ranges, get_exposed_facilities_list
        run_output["impact"] = calculate_impact_ranges(run_output, grid)
        try:
            run_output["facilities_impacted"] = get_exposed_facilities_list(run_output, grid)
        except Exception as e:
            print(f"Warning: gagal precompute facilities_impacted: {e}")
            run_output["facilities_impacted"] = {}

        # Simpan ke data/runs/{run_id}.json
        save_path = RUNS_DIR / f"{self.run_id}.json"
        # Buat representasi json yang ringan tanpa array numpy raksasa
        json_summary = {
            k: v for k, v in run_output.items()
            if k not in ["hourly_exposure_masks", "member_max_severity"] and not k.startswith("_")
        }
        save_path.write_text(json.dumps(json_summary, default=str), encoding="utf-8")
        # Larik penuh (masker paparan & keparahan) agar run tetap lengkap setelah server dimulai ulang
        try:
            np.savez_compressed(
                RUNS_DIR / f"{self.run_id}.npz",
                masks=np.packbits(hourly_exposure_masks, axis=None),
                shape=np.array(hourly_exposure_masks.shape),
                severity=member_max_severity.astype(np.float32),
            )
        except Exception as e:
            print(f"Warning: gagal menyimpan larik run: {e}")

        return run_output
