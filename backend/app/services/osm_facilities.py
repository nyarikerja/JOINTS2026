# pyright: reportMissingImports=false
"""
app/services/osm_facilities.py

Fasilitas publik nyata dari OpenStreetMap (Overpass API): sekolah, klinik/puskesmas,
rumah sakit, dan bandara. Data diambil per tile 1x1 derajat dan disimpan di
data/layers/osm_facilities/ agar simulasi berikutnya tidak membebani Overpass.

Tidak ada fasilitas sintetis: bila sebuah tile belum pernah berhasil diunduh,
fungsi mengembalikan daftar tanpa tile itu dan melaporkannya sebagai `missing_tiles`.
"""

from __future__ import annotations

import json
import math
import threading
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple

import httpx

from app.core.config import DATA_DIR
from app.core.offline import is_offline

TILE_DIR = DATA_DIR / "layers" / "osm_facilities"
AIRPORTS_FILE = TILE_DIR / "airports.json"
TILE_MAX_AGE_S = 30 * 24 * 3600
USER_AGENT = "UdaraSiaga-HelaLoka/1.0 (disaster preparedness simulator)"
MIRRORS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)
SOURCE = "OpenStreetMap contributors (ODbL) via Overpass API"

_KIND = {"school": "school", "clinic": "healthcare", "hospital": "healthcare"}
_tile_cache: Dict[Tuple[int, int], List[Dict[str, Any]]] = {}
_lock = threading.Lock()


def tile_key(lat: float, lon: float) -> Tuple[int, int]:
    return math.floor(lat), math.floor(lon)


def tiles_for_bbox(lat_min: float, lat_max: float, lon_min: float, lon_max: float) -> List[Tuple[int, int]]:
    return [
        (la, lo)
        for la in range(math.floor(lat_min), math.floor(lat_max) + 1)
        for lo in range(math.floor(lon_min), math.floor(lon_max) + 1)
    ]


def _tile_path(t: Tuple[int, int]):
    return TILE_DIR / f"tile_{t[0]}_{t[1]}.json"


def _query(ql: str, timeout_s: float = 120.0) -> Dict[str, Any]:
    last_err: Exception | None = None
    deadline = time.time() + timeout_s * 1.5
    for url in MIRRORS:
        if time.time() > deadline:
            break
        try:
            r = httpx.post(url, data={"data": ql}, headers={"User-Agent": USER_AGENT}, timeout=timeout_s)
            if r.status_code == 200 and r.text.lstrip().startswith("{"):
                body = r.json()
                if "remark" in body and "error" in str(body.get("remark", "")).lower():
                    raise RuntimeError(body["remark"][:200])
                return body
            last_err = RuntimeError(f"{url} HTTP {r.status_code}")
        except Exception as e:  # noqa: BLE001 - try the next mirror
            last_err = e
    raise RuntimeError(f"Semua mirror Overpass gagal: {last_err}")


def _element_to_record(el: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    tags = el.get("tags") or {}
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lon = el.get("lon") or (el.get("center") or {}).get("lon")
    if lat is None or lon is None:
        return None
    amenity = tags.get("amenity")
    kind = _KIND.get(amenity) if isinstance(amenity, str) else None
    if kind is None:
        return None
    name = tags.get("name") or tags.get("name:id")
    district = (
        tags.get("addr:subdistrict") or tags.get("addr:district")
        or tags.get("addr:city") or tags.get("is_in:city") or "-"
    )
    return {
        "facility_id": f"osm_{el.get('type', 'n')[0]}{el.get('id')}",
        "name": name or ("Sekolah (tanpa nama di OSM)" if kind == "school" else "Fasilitas kesehatan (tanpa nama di OSM)"),
        "has_name": bool(name),
        "facility_type": kind,
        "subtype": amenity,
        "latitude": round(float(lat), 6),
        "longitude": round(float(lon), 6),
        "district": district,
        "province": tags.get("addr:province", "-"),
    }


def fetch_tile(t: Tuple[int, int], timeout_s: float = 120.0) -> List[Dict[str, Any]]:
    """Unduh satu tile dari Overpass dan simpan ke disk."""
    s, w = t
    ql = (
        f'[out:json][timeout:110];nwr["amenity"~"^(school|clinic|hospital)$"]({s},{w},{s + 1},{w + 1});'
        "out center tags;"
    )
    body = _query(ql, timeout_s=timeout_s)
    recs = [r for r in (_element_to_record(e) for e in body.get("elements", [])) if r]
    TILE_DIR.mkdir(parents=True, exist_ok=True)
    _tile_path(t).write_text(
        json.dumps({"tile": list(t), "fetched_at": time.time(), "source": SOURCE, "facilities": recs},
                   ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    with _lock:
        _tile_cache[t] = recs
    return recs


def load_tile(t: Tuple[int, int], fetch_missing: bool = False, timeout_s: float = 120.0) -> Optional[List[Dict[str, Any]]]:
    with _lock:
        if t in _tile_cache:
            return _tile_cache[t]
    p = _tile_path(t)
    if p.exists():
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            recs = data.get("facilities", [])
            with _lock:
                _tile_cache[t] = recs
            stale = time.time() - float(data.get("fetched_at", 0)) > TILE_MAX_AGE_S
            if not (stale and fetch_missing and not is_offline()):
                return recs
        except Exception:
            pass
    if fetch_missing and not is_offline():
        try:
            return fetch_tile(t, timeout_s=timeout_s)
        except Exception:
            return _tile_cache.get(t)
    return None


def facilities_in_bbox(
    lat_min: float, lat_max: float, lon_min: float, lon_max: float,
    facility_type: Optional[str] = None,
    fetch_missing: bool = False,
    max_fetch: int = 6,
    budget_s: float = 60.0,
) -> Tuple[List[Dict[str, Any]], List[Tuple[int, int]]]:
    """Fasilitas di dalam bbox. Mengembalikan (daftar, tile_yang_belum_tersedia).

    Tile yang belum ada di cache diunduh paling banyak `max_fetch` buah dalam `budget_s` detik.
    """
    out: List[Dict[str, Any]] = []
    missing: List[Tuple[int, int]] = []
    fetched = 0
    t_start = time.time()
    for t in tiles_for_bbox(lat_min, lat_max, lon_min, lon_max):
        remaining = budget_s - (time.time() - t_start)
        allow = fetch_missing and fetched < max_fetch and remaining > 5
        was_cached = t in _tile_cache or _tile_path(t).exists()
        recs = load_tile(t, fetch_missing=allow, timeout_s=max(5.0, min(30.0, remaining)))
        if allow and not was_cached:
            fetched += 1
        if recs is None:
            missing.append(t)
            continue
        for f in recs:
            if lat_min <= f["latitude"] <= lat_max and lon_min <= f["longitude"] <= lon_max:
                if facility_type is None or f["facility_type"] == facility_type:
                    out.append(f)
    for a in airports():
        if lat_min <= a["latitude"] <= lat_max and lon_min <= a["longitude"] <= lon_max:
            if facility_type in (None, "airport"):
                out.append(a)

    # Fallback ke basis data fasilitas nasional (udarasiaga.db / facilities_indonesia.json)
    # bila tile Overpass belum terunduh atau hasil query kosong (mencakup sekolah & RS di area karhutla/abu)
    if not out or missing:
        try:
            from app.db.repositories.facility_repo import FacilityRepository
            db_facs = FacilityRepository.get_by_bbox(lat_min, lat_max, lon_min, lon_max, facility_type=facility_type, limit=500)
            seen_ids = {f["facility_id"] for f in out}
            for df in db_facs:
                if df["facility_id"] not in seen_ids:
                    out.append(df)
                    seen_ids.add(df["facility_id"])
        except Exception:
            pass

    if missing:
        request_tiles(missing)
    return out, missing


_airports_cache: Optional[List[Dict[str, Any]]] = None


def airports(refresh: bool = False) -> List[Dict[str, Any]]:
    """Bandara berkode IATA di Indonesia (OSM aeroway=aerodrome)."""
    global _airports_cache
    if _airports_cache is not None and not refresh:
        return _airports_cache or []
    if AIRPORTS_FILE.exists() and not refresh:
        try:
            _airports_cache = json.loads(AIRPORTS_FILE.read_text(encoding="utf-8")).get("facilities", [])
            return _airports_cache or []
        except Exception:
            pass
    if is_offline():
        return []
    try:
        body = _query('[out:json][timeout:110];nwr["aeroway"="aerodrome"]["iata"](-11.5,94,6.5,141.5);out center tags;')
    except Exception:
        return _airports_cache or []
    recs = []
    for el in body.get("elements", []):
        tags = el.get("tags") or {}
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        iata = tags.get("iata", "")
        recs.append({
            "facility_id": f"osm_{el.get('type', 'n')[0]}{el.get('id')}",
            "name": f"{tags.get('name') or 'Bandara'} ({iata})" if iata else (tags.get("name") or "Bandara"),
            "has_name": True,
            "facility_type": "airport",
            "subtype": "aerodrome",
            "latitude": round(float(lat), 6),
            "longitude": round(float(lon), 6),
            "district": tags.get("addr:city", "-"),
            "province": tags.get("addr:province", "-"),
        })
    TILE_DIR.mkdir(parents=True, exist_ok=True)
    AIRPORTS_FILE.write_text(json.dumps({"fetched_at": time.time(), "source": SOURCE, "facilities": recs},
                                        ensure_ascii=False), encoding="utf-8")
    _airports_cache = recs
    return recs


def facility_by_id(facility_id: str, hint_tiles: Iterable[Tuple[int, int]] = ()) -> Optional[Dict[str, Any]]:
    for a in airports():
        if a["facility_id"] == facility_id:
            return a
    with _lock:
        cached = list(_tile_cache.items())
    for _, recs in cached:
        for f in recs:
            if f["facility_id"] == facility_id:
                return f
    for t in hint_tiles:
        for f in load_tile(t) or []:
            if f["facility_id"] == facility_id:
                return f
    try:
        from app.db.repositories.facility_repo import FacilityRepository
        return FacilityRepository.get_by_id(facility_id)
    except Exception:
        pass
    return None


_queue: List[Tuple[int, int]] = []
_queue_lock = threading.Lock()
_worker_started = False


def request_tiles(tiles: Iterable[Tuple[int, int]]) -> None:
    """Antrikan tile yang belum ada untuk diunduh worker latar (tidak memblokir permintaan HTTP)."""
    global _worker_started
    if is_offline():
        return
    with _queue_lock:
        for t in tiles:
            if t not in _queue and not _tile_path(t).exists():
                _queue.append(t)
        if not _worker_started and _queue:
            _worker_started = True
            threading.Thread(target=_worker, name="osm-tiles", daemon=True).start()


def _worker() -> None:
    while True:
        with _queue_lock:
            t = _queue.pop(0) if _queue else None
        if t is None:
            time.sleep(5)
            continue
        if _tile_path(t).exists():
            continue
        for attempt in range(3):
            try:
                fetch_tile(t, timeout_s=90)
                break
            except Exception:
                time.sleep(10 * (attempt + 1))


def tiles_available(tiles: Iterable[Tuple[int, int]]) -> bool:
    return any(_tile_path(t).exists() for t in tiles)


def coverage_status() -> Dict[str, Any]:
    files = list(TILE_DIR.glob("tile_*.json")) if TILE_DIR.exists() else []
    return {"tiles_cached": len(files), "source": SOURCE}
