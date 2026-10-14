"""
app/ingest/openmeteo.py

Cuaca ensemble untuk simulasi (D01, D02, D03, D28): Open-Meteo Ensemble API, model ECMWF IFS 0.25°
(51 anggota: 1 kontrol + 50 perturbasi).

- Angin diambil pada grid 3x3 titik yang mencakup domain simulasi (bukan satu titik), sehingga
  partikel di tepi domain bergerak mengikuti angin setempat (interpolasi bilinear di simulator).
- Deret waktu dimulai dari jam awal simulasi (sekarang, atau waktu VONA bila lebih awal),
  memakai `past_days` agar jam yang sudah lewat tetap berasal dari model.
- Asap kebakaran memakai angin 10 m; abu vulkanik memakai aras tekanan sesuai tinggi kolom.
- Hasil unduhan disimpan per event (weather_live.json). Bila Open-Meteo gagal, salinan terakhir
  hanya dipakai jika masih mencakup jam awal simulasi, dan ditandai `stale`.
- Bila anggota yang diminta melebihi 51, anggota tambahan sintetis ditandai
  members_source = "synthetic_from_mean_spread" (Prinsip 12).
"""

import json
import math
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
import numpy as np

from app.core.config import EVENTS_DIR
from app.core.offline import is_offline

ENSEMBLE_URL = "https://ensemble-api.open-meteo.com/v1/ensemble"
MODEL = "ecmwf_ifs025"
MODEL_LABEL = "Open-Meteo Ensemble API - ECMWF IFS 0,25 derajat (51 anggota)"
MEMBERS_SOURCE = "open_meteo_ensemble_ecmwf_ifs025"
CACHE_TTL_S = 3600

_cache: Dict[tuple, Dict[str, Any]] = {}
_lock = threading.Lock()


class WeatherUnavailable(RuntimeError):
    pass


def _members(hourly: Dict[str, Any], var: str) -> List[List[Optional[float]]]:
    keys = [var] + sorted(k for k in hourly if k.startswith(var + "_member"))
    return [hourly[k] for k in keys if k in hourly]


def fetch_ensemble(lat: float, lon: float, start_utc: datetime, hours: int, level: str,
                   half_deg: float = 0.0) -> Dict[str, Any]:
    """
    Unduh ensemble pada grid 3x3 (jarak `half_deg`) berpusat di (lat, lon), atau satu titik bila
    half_deg = 0, dan potong mulai `start_utc` (dibulatkan ke bawah per jam).
    Larik berbentuk (anggota, langkah, 3, 3) untuk grid, (anggota, langkah) untuk satu titik.
    """
    start = start_utc.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    key = (round(lat, 2), round(lon, 2), level, start.isoformat(), hours, round(half_deg, 2))
    with _lock:
        hit = _cache.get(key)
        if hit and time.time() - hit["_t"] < CACHE_TTL_S:
            return hit
    now = datetime.now(timezone.utc)
    past_days = max(0, math.ceil((now - start).total_seconds() / 86400.0))
    forecast_days = max(2, math.ceil(((start + timedelta(hours=hours + 1)) - now).total_seconds() / 86400.0) + 1)
    offs = [-half_deg, 0.0, half_deg] if half_deg > 0 else [0.0]
    pts = [(lat + di, lon + dj) for di in offs for dj in offs]
    params = {
        "latitude": ",".join(f"{p[0]:.4f}" for p in pts),
        "longitude": ",".join(f"{p[1]:.4f}" for p in pts),
        "hourly": f"wind_speed_{level},wind_direction_{level},precipitation",
        "models": MODEL,
        "wind_speed_unit": "ms",
        "timezone": "GMT",
        "past_days": min(past_days, 7),
        "forecast_days": min(forecast_days, 15),
    }
    r = httpx.get(ENSEMBLE_URL, params=params, timeout=45.0)
    r.raise_for_status()
    body = r.json()
    items = body if isinstance(body, list) else [body]
    if any(isinstance(it, dict) and it.get("error") for it in items):
        raise WeatherUnavailable(str(items[0].get("reason")))
    times = [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in items[0]["hourly"]["time"]]
    try:
        i0 = next(i for i, t in enumerate(times) if t >= start)
    except StopIteration:
        raise WeatherUnavailable("Deret waktu Open-Meteo tidak mencakup jam awal simulasi")
    i1 = min(len(times), i0 + hours + 1)

    def stack(var: str) -> np.ndarray:
        arrs = [np.array(_members(it["hourly"], var), dtype=float)[:, i0:i1] for it in items]
        n = min(a.shape[0] for a in arrs)
        a = np.stack([x[:n] for x in arrs], axis=-1)  # (anggota, langkah, titik)
        a = np.nan_to_num(a, nan=0.0)
        if len(items) == 9:
            a = a.reshape(a.shape[0], a.shape[1], 3, 3)
        else:
            a = a[..., 0]
        return a

    speed, direc, precip = stack(f"wind_speed_{level}"), stack(f"wind_direction_{level}"), stack("precipitation")
    n = min(speed.shape[0], direc.shape[0], precip.shape[0])
    out = {
        "_t": time.time(),
        "model": MODEL_LABEL,
        "members_source": MEMBERS_SOURCE,
        "level": level,
        "fetched_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "valid_from": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "times": [t.strftime("%Y-%m-%dT%H:%M:%SZ") for t in times[i0:i1]],
        "grid": {"lat0": lat - half_deg, "lon0": lon - half_deg, "d": half_deg} if len(items) == 9 else None,
        "speed": speed[:n].tolist(),
        "direction": direc[:n].tolist(),
        "precip": precip[:n].tolist(),
        "stale": False,
    }
    with _lock:
        _cache[key] = out
    return out


class OpenMeteoIngest:
    @staticmethod
    def _snapshot_path(event_id: str):
        return EVENTS_DIR / event_id / "weather_live.json"

    @staticmethod
    def get_weather_for_simulation(
        event_id: str,
        latitude: float,
        longitude: float,
        start_utc: datetime,
        hours: int = 48,
        level: str = "10m",
        n_members: int = 51,
        seed: int = 42,
        overrides: Dict[str, Any] | None = None,
        half_deg: float = 0.0,
    ) -> Dict[str, Any]:
        raw: Optional[Dict[str, Any]] = None
        err: Optional[str] = None
        if not is_offline():
            try:
                raw = fetch_ensemble(latitude, longitude, start_utc, hours, level, half_deg)
                try:
                    snap = OpenMeteoIngest._snapshot_path(event_id)
                    snap.parent.mkdir(parents=True, exist_ok=True)
                    snap.write_text(json.dumps({k: v for k, v in raw.items() if k != "_t"}), encoding="utf-8")
                except Exception:
                    pass
            except Exception as e:  # noqa: BLE001
                err = str(e)[:200]
        if raw is None:
            snap = OpenMeteoIngest._snapshot_path(event_id)
            if snap.exists():
                cand = json.loads(snap.read_text(encoding="utf-8"))
                t0 = datetime.fromisoformat(cand["times"][0].replace("Z", "+00:00"))
                t1 = datetime.fromisoformat(cand["times"][-1].replace("Z", "+00:00"))
                start = start_utc.replace(minute=0, second=0, microsecond=0)
                if cand.get("level") == level and t0 <= start <= t1:
                    off = int((start - t0).total_seconds() // 3600)
                    for k in ("speed", "direction", "precip"):
                        cand[k] = [row[off:] for row in cand[k]]
                    cand["times"] = cand["times"][off:]
                    cand["stale"] = True
                    raw = cand
            if raw is None:
                raise WeatherUnavailable(
                    f"Prakiraan cuaca ensemble Open-Meteo tidak tersedia untuk lokasi ini ({err or 'mode offline'}) "
                    "dan tidak ada salinan yang mencakup jam awal simulasi."
                )

        speed = np.array(raw["speed"], dtype=float)
        direc = np.array(raw["direction"], dtype=float)
        precip = np.array(raw["precip"], dtype=float)
        n_real, n_steps = speed.shape[0], speed.shape[1]

        if overrides:
            wind_ovr = overrides.get("wind") or {}
            if overrides.get("wind_reverse_troposphere") or wind_ovr.get("reverse"):
                direc = (direc + 180.0) % 360.0
            if wind_ovr.get("rotate_deg") is not None:
                direc = (direc + float(wind_ovr["rotate_deg"])) % 360.0
            if overrides.get("rain_scavenging_mm_h"):
                precip = precip + float(overrides["rain_scavenging_mm_h"])
            elif overrides.get("rain"):
                rain_ovr = overrides["rain"]
                intensity = float(rain_ovr.get("intensity_mm_h", 10.0))
                s = int(rain_ovr.get("start_h", 0))
                e = min(n_steps, s + int(rain_ovr.get("duration_h", 4)))
                precip[:, s:e] += intensity

        rad = np.radians(direc)
        u = -speed * np.sin(rad)
        v = -speed * np.cos(rad)

        members_source = raw["members_source"]
        if n_members <= n_real:
            u, v, precip = u[:n_members], v[:n_members], precip[:n_members]
        else:
            members_source = "synthetic_from_mean_spread"
            rng = np.random.default_rng(seed)
            extra = n_members - n_real
            shp = (extra,) + u.shape[1:]
            mu, mv, mp = u.mean(0), v.mean(0), precip.mean(0)
            su, sv = u.std(0) + 0.3, v.std(0) + 0.3
            u = np.concatenate([u, mu + rng.normal(0, 1, shp) * su])
            v = np.concatenate([v, mv + rng.normal(0, 1, shp) * sv])
            precip = np.concatenate([precip, np.maximum(0.0, mp + rng.normal(0, 0.5, shp))])

        grid = raw.get("grid")
        out = {
            "n_members": n_members,
            "n_steps": n_steps,
            "times": raw["times"],
            "members_source": members_source,
            "model": raw["model"],
            "level": level,
            "fetched_at": raw["fetched_at"],
            "valid_from": raw["valid_from"],
            "stale": bool(raw.get("stale")),
        }
        if grid and u.ndim == 4:
            # medan angin spasial + deret di titik pusat (ringkasan, panah angin)
            out.update(grid=grid, wind_u_field=u, wind_v_field=v, precip_field=precip,
                       wind_u=u[:, :, 1, 1], wind_v=v[:, :, 1, 1], precip=precip[:, :, 1, 1])
        else:
            out.update(grid=None, wind_u=u, wind_v=v, precip=precip)
        return out
