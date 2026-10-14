"""
app/services/firms_history.py

Kebakaran terakhir yang terdeteksi NASA FIRMS di sebuah wilayah, untuk kawasan yang tidak
memiliki titik api dalam cache 7 hari terakhir.

- Menelusuri mundur dalam jendela 5 hari (batas endpoint area FIRMS), paralel.
- Sumber VIIRS S-NPP: NRT untuk tanggal yang masih tersedia, arsip standar (SP) untuk sebelumnya
  (batas tanggal dibaca dari endpoint data_availability).
- Mengembalikan deteksi pada hari akuisisi terakhir yang memiliki api.
- Hasil di-cache per kotak wilayah selama 24 jam di data/layers/firms_history/.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import DATA_DIR
from app.core.offline import is_offline

API = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{src}/{bbox}/5/{date}"
AVAIL = "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{key}/all"
CACHE_DIR = DATA_DIR / "layers" / "firms_history"
CACHE_TTL_S = 24 * 3600
LOOKBACK_DAYS = 730
SOURCE = "NASA FIRMS VIIRS S-NPP (NRT dan arsip standar)"

_avail: Dict[str, Any] = {"t": 0.0, "nrt_min": None}


def _key() -> Optional[str]:
    return (os.environ.get("FIRMS_MAP_KEY") or "").strip() or None


def _nrt_min(client: httpx.Client, key: str) -> date:
    if _avail["nrt_min"] and time.time() - _avail["t"] < 24 * 3600:
        return _avail["nrt_min"]
    d = date.today() - timedelta(days=60)
    try:
        for row in csv.DictReader(io.StringIO(client.get(AVAIL.format(key=key)).text)):
            if row.get("data_id") == "VIIRS_SNPP_NRT":
                d = date.fromisoformat(row["min_date"])
    except Exception:
        pass
    _avail.update(t=time.time(), nrt_min=d)
    return d


def _fetch(client: httpx.Client, key: str, src: str, bbox: str, start: date) -> List[Dict[str, Any]]:
    r = client.get(API.format(key=key, src=src, bbox=bbox, date=start.isoformat()))
    if r.status_code != 200 or not r.text.startswith("latitude"):
        return []
    out = []
    for row in csv.DictReader(io.StringIO(r.text)):
        try:
            t = row.get("acq_time", "0").zfill(4)
            dt = datetime.strptime(f"{row['acq_date']} {t}", "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)
            out.append({
                "latitude": float(row["latitude"]), "longitude": float(row["longitude"]),
                "frp": float(row.get("frp") or 0.0),
                "confidence": {"h": "tinggi", "l": "rendah"}.get((row.get("confidence") or "").lower(), "nominal"),
                "acq_date": row["acq_date"], "acq_time": t,
                "acq_datetime_utc": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "sensor": "VIIRS S-NPP", "is_active": True,
            })
        except (KeyError, ValueError):
            continue
    return out


def last_fire(bbox: List[float], polygon: Any = None) -> Optional[Dict[str, Any]]:
    """Deteksi pada hari kebakaran terakhir di bbox [w,s,e,n] (opsional disaring poligon)."""
    key = _key()
    if not key or is_offline():
        return None
    w, s, e, n = bbox
    bb = f"{w:.3f},{s:.3f},{e:.3f},{n:.3f}"
    cache = CACHE_DIR / (hashlib.md5(bb.encode()).hexdigest()[:16] + ".json")
    if cache.exists() and time.time() - cache.stat().st_mtime < CACHE_TTL_S:
        data = json.loads(cache.read_text(encoding="utf-8"))
        return data or None

    today = date.today()
    starts = [today - timedelta(days=d) for d in range(9, LOOKBACK_DAYS, 5)]
    found: Optional[List[Dict[str, Any]]] = None
    with httpx.Client(timeout=45.0) as client:
        nrt_min = _nrt_min(client, key)

        def job(st: date):
            src = "VIIRS_SNPP_NRT" if st >= nrt_min else "VIIRS_SNPP_SP"
            return _fetch(client, key, src, bb, st)

        # telusuri per kelompok 12 jendela (60 hari) agar berhenti segera setelah api ditemukan
        with ThreadPoolExecutor(max_workers=6) as pool:
            for i in range(0, len(starts), 12):
                for rows in pool.map(job, starts[i:i + 12]):
                    if polygon is not None and rows:
                        import shapely
                        inside = shapely.contains_xy(polygon, [r["longitude"] for r in rows], [r["latitude"] for r in rows])
                        rows = [r for r, ok in zip(rows, inside) if ok]
                    if rows:
                        found = rows
                        break
                if found:
                    break

    result = None
    if found:
        last_day = max(r["acq_date"] for r in found)
        day_rows = [dict(r, id=f"hist_{k}") for k, r in enumerate(x for x in found if x["acq_date"] == last_day)]
        result = {"date": last_day, "hotspots": day_rows, "source": SOURCE}
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(result), encoding="utf-8")
    return result
