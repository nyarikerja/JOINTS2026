"""
app/services/firms_live.py

Deteksi titik api NASA FIRMS near-real-time untuk seluruh Indonesia.

- Sumber: VIIRS S-NPP, NOAA-20, NOAA-21 (375 m) dan MODIS Terra/Aqua (1 km), endpoint area CSV.
- Jendela: 7 hari terakhir (UTC), dua permintaan per sensor (5 hari terbaru + 2 hari sebelumnya).
- Disegarkan di thread latar tiap REFRESH_S detik; permintaan HTTP membaca cache terbaru.
- Snapshot disimpan ke disk (npz) untuk mode offline atau saat FIRMS gagal, ditandai `stale`.

Kolom disimpan sebagai array numpy agar ~100 ribu deteksi tetap ringan di memori.
"""

from __future__ import annotations

import csv
import io
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
import numpy as np

from app.core.config import DATA_DIR
from app.core.offline import is_offline

BBOX = "94,-12,142,7"  # west,south,east,north
SOURCES = ("VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT")
SENSOR_LABEL = {
    "VIIRS_SNPP_NRT": "VIIRS S-NPP",
    "VIIRS_NOAA20_NRT": "VIIRS NOAA-20",
    "VIIRS_NOAA21_NRT": "VIIRS NOAA-21",
    "MODIS_NRT": "MODIS Terra/Aqua",
}
API = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{src}/{bbox}/{days}{date}"
REFRESH_S = 15 * 60
STALE_AFTER_S = 3 * 3600
SNAPSHOT = DATA_DIR / "layers" / "firms_live_snapshot.npz"
SOURCE_TEXT = "NASA FIRMS NRT (VIIRS S-NPP/NOAA-20/NOAA-21, MODIS)"

# confidence: 0 = low, 1 = nominal, 2 = high
CONF_LABEL = ("rendah", "nominal", "tinggi")

_lock = threading.Lock()
_state: Dict[str, Any] = {"data": None, "fetched_at": None, "origin": None, "error": None}
_refresh_started = False


def _key() -> Optional[str]:
    k = (os.environ.get("FIRMS_MAP_KEY") or "").strip()
    return k or None


def _conf_code(raw: str) -> int:
    raw = (raw or "").strip().lower()
    if raw in ("h", "high"):
        return 2
    if raw in ("l", "low"):
        return 0
    if raw in ("n", "nominal"):
        return 1
    try:  # MODIS: 0-100
        v = float(raw)
        return 2 if v >= 80 else (1 if v >= 30 else 0)
    except ValueError:
        return 1


def _fetch_one(client: httpx.Client, key: str, src: str, days: int, date: str = "") -> List[tuple]:
    url = API.format(key=key, src=src, bbox=BBOX, days=days, date=f"/{date}" if date else "")
    r = client.get(url)
    r.raise_for_status()
    text = r.text
    if not text.startswith("latitude"):
        raise RuntimeError(f"FIRMS {src}: respons tidak dikenal ({text[:80]!r})")
    rows = []
    src_idx = SOURCES.index(src)
    for row in csv.DictReader(io.StringIO(text)):
        try:
            t = row.get("acq_time", "0").zfill(4)
            ts = datetime.strptime(f"{row['acq_date']} {t}", "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc).timestamp()
            rows.append((
                float(row["latitude"]), float(row["longitude"]), float(row.get("frp") or 0.0),
                int(ts), _conf_code(row.get("confidence", "")), src_idx,
            ))
        except (KeyError, ValueError):
            continue
    return rows


def _fetch_all() -> Dict[str, np.ndarray]:
    key = _key()
    if not key:
        raise RuntimeError("FIRMS_MAP_KEY belum diisi di backend/.env")
    today = datetime.now(timezone.utc).date()
    older = (today - timedelta(days=6)).isoformat()
    jobs = [(src, 5, "") for src in SOURCES] + [(src, 2, older) for src in SOURCES]
    rows: List[tuple] = []
    with httpx.Client(timeout=60.0) as client, ThreadPoolExecutor(max_workers=4) as pool:
        for part in pool.map(lambda j: _fetch_one(client, key, *j), jobs):
            rows.extend(part)
    if not rows:
        raise RuntimeError("FIRMS mengembalikan nol deteksi")
    arr = np.array(rows, dtype=float)
    return {
        "lat": arr[:, 0].astype(np.float32),
        "lon": arr[:, 1].astype(np.float32),
        "frp": arr[:, 2].astype(np.float32),
        "ts": arr[:, 3].astype(np.int64),
        "conf": arr[:, 4].astype(np.int8),
        "src": arr[:, 5].astype(np.int8),
    }


def _save_snapshot(data: Dict[str, np.ndarray], fetched_at: float) -> None:
    try:
        SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(SNAPSHOT, fetched_at=np.array([fetched_at]), **data)
    except Exception:
        pass


def _load_snapshot() -> Optional[tuple]:
    if not SNAPSHOT.exists():
        return None
    try:
        z = np.load(SNAPSHOT)
        data = {k: z[k] for k in ("lat", "lon", "frp", "ts", "conf", "src")}
        return data, float(z["fetched_at"][0])
    except Exception:
        return None


def refresh(force: bool = False) -> Dict[str, Any]:
    """Unduh ulang dari FIRMS. Bila gagal, pertahankan data lama dan catat errornya."""
    with _lock:
        fresh = _state["fetched_at"] and time.time() - _state["fetched_at"] < REFRESH_S
        if fresh and not force and _state["origin"] == "live":
            return status()
    if is_offline():
        _use_snapshot("offline")
        return status()
    try:
        data = _fetch_all()
        now = time.time()
        with _lock:
            _state.update(data=data, fetched_at=now, origin="live", error=None)
        _save_snapshot(data, now)
    except Exception as e:  # noqa: BLE001
        with _lock:
            _state["error"] = str(e)[:300]
        if _state["data"] is None:
            _use_snapshot("snapshot")
    return status()


def _use_snapshot(origin: str) -> None:
    snap = _load_snapshot()
    if snap:
        with _lock:
            _state.update(data=snap[0], fetched_at=snap[1], origin=origin)


def _loop() -> None:
    while True:
        try:
            refresh(force=True)
        except Exception:
            pass
        time.sleep(REFRESH_S)


def start_background_refresh() -> None:
    global _refresh_started
    if _refresh_started:
        return
    _refresh_started = True
    threading.Thread(target=_loop, name="firms-refresh", daemon=True).start()


def _ensure_loaded(wait_s: float = 90.0) -> None:
    if _state["data"] is not None:
        return
    start_background_refresh()
    _use_snapshot("snapshot")
    deadline = time.time() + wait_s
    while _state["data"] is None and _state["error"] is None and time.time() < deadline:
        time.sleep(0.5)
    if _state["data"] is None:
        refresh(force=True)


def status() -> Dict[str, Any]:
    fa = _state["fetched_at"]
    data = _state["data"]
    latest = int(data["ts"].max()) if data is not None and len(data["ts"]) else None
    return {
        "available": data is not None,
        "source": SOURCE_TEXT,
        "origin": _state["origin"],
        "fetched_at": datetime.fromtimestamp(fa, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if fa else None,
        "latest_detection_utc": datetime.fromtimestamp(latest, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if latest else None,
        "stale": bool(fa is None or time.time() - fa > STALE_AFTER_S or _state["origin"] != "live"),
        "n_detections_7d": int(len(data["ts"])) if data is not None else 0,
        "error": _state["error"],
    }


def query(
    hours: float = 24.0,
    lat_min: float = -90, lat_max: float = 90, lon_min: float = -180, lon_max: float = 180,
    polygon: Any = None,
) -> List[Dict[str, Any]]:
    """Deteksi dalam `hours` jam terakhir (relatif terhadap sekarang) di bbox/poligon."""
    _ensure_loaded()
    data = _state["data"]
    if data is None:
        return []
    cutoff = time.time() - hours * 3600
    m = (
        (data["ts"] >= cutoff)
        & (data["lat"] >= lat_min) & (data["lat"] <= lat_max)
        & (data["lon"] >= lon_min) & (data["lon"] <= lon_max)
    )
    idx = np.nonzero(m)[0]
    if polygon is not None and idx.size:
        import shapely
        inside = shapely.contains_xy(polygon, data["lon"][idx].astype(float), data["lat"][idx].astype(float))
        idx = idx[inside]
    out = []
    for i in idx:
        ts = int(data["ts"][i])
        dt = datetime.fromtimestamp(ts, timezone.utc)
        out.append({
            "id": f"firms_{ts}_{i}",
            "latitude": round(float(data["lat"][i]), 5),
            "longitude": round(float(data["lon"][i]), 5),
            "frp": round(float(data["frp"][i]), 2),
            "confidence": CONF_LABEL[int(data["conf"][i])],
            "acq_date": dt.strftime("%Y-%m-%d"),
            "acq_time": dt.strftime("%H%M"),
            "acq_datetime_utc": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sensor": SENSOR_LABEL[SOURCES[int(data["src"][i])]],
            "is_active": True,
        })
    return out


def arrays(hours: float) -> Dict[str, np.ndarray]:
    """Kolom numpy mentah untuk agregasi cepat (heatmap, KPI)."""
    _ensure_loaded()
    data = _state["data"]
    if data is None:
        return {k: np.array([]) for k in ("lat", "lon", "frp", "ts", "conf", "src")}
    m = data["ts"] >= time.time() - hours * 3600
    return {k: v[m] for k, v in data.items()}
