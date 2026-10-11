"""
app/services/air_quality.py

Kualitas udara PM2.5 dari dua sumber langsung, dikonversi ke kategori ISPU (Permen LHK P.14/2020,
rentang 24 jam di config/assumptions.yaml: ispu_pm25_24h_ugm3):

1. Model CAMS (Copernicus Atmosphere Monitoring Service) lewat Open-Meteo Air Quality API.
   Tersedia untuk titik mana pun dan sudah memasukkan emisi kebakaran (GFAS).
2. Stasiun OpenAQ v3 (pengukuran lapangan) bila ada dalam radius tertentu.

Kategori ISPU dari model HelaLoka sendiri tetap tidak dihitung selama faktor emisi PM2.5 masih
placeholder (Prinsip 11); kategori di sini berasal dari CAMS dan stasiun, dan diberi label sumbernya.
"""

from __future__ import annotations

import math
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import get_assumptions
from app.core.offline import is_offline

CAMS_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
OPENAQ_URL = "https://api.openaq.org/v3"
CAMS_SOURCE = "Copernicus CAMS lewat Open-Meteo Air Quality API"
OPENAQ_SOURCE = "Stasiun OpenAQ (pengukuran lapangan)"
TTL_S = 15 * 60

_cache: Dict[tuple, tuple] = {}


def _cached(key, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < TTL_S:
        return hit[1]
    val = fn()
    if len(_cache) > 300:
        _cache.clear()
    _cache[key] = (time.time(), val)
    return val


def ispu_category(pm25_24h: Optional[float]) -> Optional[str]:
    if pm25_24h is None:
        return None
    bins = (get_assumptions().get("ispu_pm25_24h_ugm3") or {}).get("value") or {}
    v = round(float(pm25_24h), 1)
    for name in ("baik", "sedang", "tidak_sehat", "sangat_tidak_sehat"):
        lo_hi = bins.get(name)
        if lo_hi and v <= float(lo_hi[1]):
            return name
    return "berbahaya"


def cams_points(points: List[tuple], start_utc: Optional[datetime] = None, hours: int = 48) -> List[Dict[str, Any]]:
    """
    PM2.5 CAMS per titik: rata-rata 24 jam terakhir (dasar kategori ISPU saat ini) dan
    rata-rata 24 jam maksimum dalam `hours` jam ke depan (prakiraan).
    """
    if is_offline() or not points:
        return []
    key = ("cams", tuple((round(a, 2), round(b, 2)) for a, b in points), hours)

    def fetch():
        r = httpx.get(CAMS_URL, params={
            "latitude": ",".join(f"{p[0]:.3f}" for p in points),
            "longitude": ",".join(f"{p[1]:.3f}" for p in points),
            "hourly": "pm2_5", "past_days": 1, "forecast_days": 3, "timezone": "GMT",
        }, timeout=30.0)
        r.raise_for_status()
        body = r.json()
        items = body if isinstance(body, list) else [body]
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        out = []
        for (lat, lon), it in zip(points, items):
            h = it.get("hourly") or {}
            times = [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in h.get("time", [])]
            vals = h.get("pm2_5", [])
            past = [v for t, v in zip(times, vals) if v is not None and now - timedelta(hours=24) < t <= now]
            fut = [(t, v) for t, v in zip(times, vals) if v is not None and now < t <= now + timedelta(hours=hours)]
            mean_past = sum(past) / len(past) if past else None
            roll = []
            for i in range(0, max(0, len(fut) - 23)):
                win = [v for _, v in fut[i:i + 24]]
                roll.append(sum(win) / 24.0)
            max_fut = max(roll) if roll else None
            out.append({
                "latitude": lat, "longitude": lon,
                "pm25_24h_now": round(mean_past, 1) if mean_past is not None else None,
                "ispu_now": ispu_category(mean_past),
                "pm25_24h_max_forecast": round(max_fut, 1) if max_fut is not None else None,
                "ispu_max_forecast": ispu_category(max_fut),
            })
        return out

    try:
        return _cached(key, fetch)
    except Exception:
        return []


def openaq_nearby(lat: float, lon: float, radius_km: float = 25.0, limit: int = 5) -> List[Dict[str, Any]]:
    """Stasiun OpenAQ dengan PM2.5 dalam radius (maks 25 km, batas API), nilai terbaru."""
    key_env = (os.environ.get("OPENAQ_API_KEY") or "").strip()
    if is_offline() or not key_env:
        return []
    headers = {"X-API-Key": key_env}
    ck = ("oaq", round(lat, 2), round(lon, 2), radius_km)

    def fetch():
        r = httpx.get(f"{OPENAQ_URL}/locations", params={
            "coordinates": f"{lat:.4f},{lon:.4f}", "radius": int(min(radius_km, 25) * 1000),
            "parameters_id": 2, "limit": limit,
        }, headers=headers, timeout=20.0)
        r.raise_for_status()
        out = []
        for loc in r.json().get("results", []):
            last = (loc.get("datetimeLast") or {}).get("utc")
            if not last:
                continue
            age_h = (datetime.now(timezone.utc) - datetime.fromisoformat(last.replace("Z", "+00:00"))).total_seconds() / 3600
            if age_h > 48:
                continue
            sensor = next((s for s in loc.get("sensors", []) if (s.get("parameter") or {}).get("name") == "pm25"), None)
            if not sensor:
                continue
            m = httpx.get(f"{OPENAQ_URL}/sensors/{sensor['id']}/hours", params={
                "datetime_from": (datetime.now(timezone.utc) - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "limit": 48,
            }, headers=headers, timeout=20.0)
            vals = [x.get("value") for x in (m.json().get("results", []) if m.status_code == 200 else []) if x.get("value") is not None]
            if not vals:
                continue
            mean24 = sum(vals) / len(vals)
            c = loc["coordinates"]
            dist = 6371.0 * math.hypot(math.radians(c["latitude"] - lat), math.radians(c["longitude"] - lon) * math.cos(math.radians(lat)))
            out.append({
                "name": loc.get("name"), "provider": (loc.get("provider") or {}).get("name"),
                "latitude": c["latitude"], "longitude": c["longitude"], "distance_km": round(dist, 1),
                "pm25_24h": round(mean24, 1), "n_hours": len(vals), "ispu": ispu_category(mean24),
                "last_utc": last,
            })
        return sorted(out, key=lambda x: x["distance_km"])

    try:
        return _cached(ck, fetch)
    except Exception:
        return []


def at_location(lat: float, lon: float) -> Dict[str, Any]:
    cams = cams_points([(lat, lon)])
    return {
        "cams": cams[0] if cams else None,
        "stations": openaq_nearby(lat, lon),
        "sources": {"model": CAMS_SOURCE, "stations": OPENAQ_SOURCE},
    }
