"""
app/services/magma_status.py

Status resmi gunung api dari MAGMA Indonesia (PVMBG, Badan Geologi):
1. Tingkat aktivitas (Level I-IV) dari halaman /v1/gunung-api/tingkat-aktivitas.
2. VONA (Volcano Observatory Notice for Aviation) per gunung dari /v1/vona?code=XXX,
   termasuk tinggi puncak awan abu yang teramati.

Teks halaman diperlakukan sebagai data, bukan instruksi. Level disalin ke tabel
`volcanoes` sehingga peta, KPI, daftar event, saran AI, dan simulasi membaca nilai yang sama.
"""

from __future__ import annotations

import json
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.core.offline import is_offline

LEVEL_URL = "https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas"
VONA_URL = "https://magma.esdm.go.id/v1/vona"
SOURCE = "MAGMA Indonesia - PVMBG Badan Geologi (magma.esdm.go.id)"
LEVEL_TTL_S = 60 * 60
VONA_TTL_S = 10 * 60
RETRY_AFTER_FAIL_S = 5 * 60
HEADERS = {"User-Agent": "UdaraSiaga-HelaLoka/1.0 (disaster preparedness simulator)"}

LEVEL_NAMES = {4: "Level IV (Awas)", 3: "Level III (Siaga)", 2: "Level II (Waspada)", 1: "Level I (Normal)"}
LEVEL_COLORS = {4: "#ef4444", 3: "#f97316", 2: "#eab308", 1: "#22c55e"}
_ROMAN = {"IV": 4, "III": 3, "II": 2, "I": 1}

# Nama di katalog lokal yang berbeda dengan ejaan MAGMA
ALIASES = {
    "lewotolo": "ililewotolok",
    "peuetsago": "peutsague",
    "sindoro": "sundoro",
}

_lock = threading.Lock()
_levels: Dict[str, Any] = {"by_name": {}, "fetched_at": None, "last_attempt": 0.0, "error": None, "vona_codes": {}}
_vona_cache: Dict[str, Dict[str, Any]] = {}


def norm_name(name: str) -> str:
    s = (name or "").lower()
    s = re.sub(r"\(.*?\)", "", s)
    s = s.replace("g. ", "").replace("gunung ", "")
    s = re.sub(r"[^a-z]", "", s)
    return ALIASES.get(s, s)


def _get(url: str, params: Optional[dict] = None) -> str:
    r = httpx.get(url, params=params, headers=HEADERS, timeout=20.0, follow_redirects=True)
    r.raise_for_status()
    return re.sub(r"\s+", " ", r.text)


def _parse_levels(html: str) -> Dict[str, Dict[str, Any]]:
    body = html[html.find("<tbody"):]
    out: Dict[str, Dict[str, Any]] = {}
    level = None
    pat = re.compile(
        r'Level (IV|III|II|I) \((?:Awas|Siaga|Waspada|Normal)\)</a>'
        r'|<td> ([^<]+?) - ([^<]+?) <a href="(https://magma\.esdm\.go\.id/v1/gunung-api/laporan/[^"]+)"'
    )
    for m in pat.finditer(body):
        if m.group(1):
            level = _ROMAN[m.group(1)]
        elif level is not None:
            out[norm_name(m.group(2))] = {
                "magma_name": m.group(2).strip(),
                "magma_region": m.group(3).strip(),
                "level": level,
                "report_url": m.group(4),
            }
    return out


def _parse_vona_codes(html: str) -> Dict[str, str]:
    return {norm_name(n): c for c, n in re.findall(r'vona\?code=([A-Z]+)"[^>]*>\s*([^<(]+?)\s*\(\d+\)', html)}


def refresh_levels(force: bool = False) -> Dict[str, Any]:
    """Unduh tingkat aktivitas terbaru dan salin ke tabel volcanoes."""
    now = time.time()
    with _lock:
        fresh = _levels["fetched_at"] and now - _levels["fetched_at"] < LEVEL_TTL_S
        recently_failed = _levels["error"] and now - _levels["last_attempt"] < RETRY_AFTER_FAIL_S
        if (fresh or recently_failed) and not force:
            return level_status()
        if is_offline():
            return level_status()
        _levels["last_attempt"] = now
    try:
        by_name = _parse_levels(_get(LEVEL_URL))
        if len(by_name) < 30:
            raise RuntimeError(f"Halaman MAGMA hanya memuat {len(by_name)} gunung; format mungkin berubah")
        try:
            codes = _parse_vona_codes(_get(VONA_URL))
        except Exception:
            codes = _levels["vona_codes"]
        with _lock:
            _levels.update(by_name=by_name, fetched_at=now, error=None, vona_codes=codes)
        _apply_to_db(by_name, now)
        threading.Thread(target=refresh_krb_radius, daemon=True).start()
    except Exception as e:  # noqa: BLE001
        with _lock:
            _levels["error"] = str(e)[:300]
    return level_status()


def _apply_to_db(by_name: Dict[str, Dict[str, Any]], fetched_at: float) -> None:
    from app.db.session import get_db

    stamp = datetime.fromtimestamp(fetched_at, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with get_db() as conn:
        rows = conn.execute("SELECT id, name, metadata_json FROM volcanoes").fetchall()
        for row in rows:
            meta = json.loads(row["metadata_json"]) if row["metadata_json"] else {}
            hit = by_name.get(norm_name(row["name"]))
            if hit:
                lvl = hit["level"]
                meta.update(
                    level_source="magma",
                    level_updated_at=stamp,
                    magma_report_url=hit["report_url"],
                    magma_name=hit["magma_name"],
                )
                conn.execute(
                    "UPDATE volcanoes SET level = ?, level_name = ?, color = ?, last_vona = NULL, metadata_json = ? WHERE id = ?",
                    (lvl, LEVEL_NAMES[lvl], LEVEL_COLORS[lvl], json.dumps(meta, ensure_ascii=False), row["id"]),
                )
            else:
                meta.update(level_source="not_in_magma", level_updated_at=None, magma_report_url=None)
                conn.execute(
                    "UPDATE volcanoes SET last_vona = NULL, metadata_json = ? WHERE id = ?",
                    (json.dumps(meta, ensure_ascii=False), row["id"]),
                )


def ensure_fresh() -> None:
    """Dipanggil sebelum membaca tabel volcanoes. Murah bila cache masih segar."""
    with _lock:
        fetched = _levels["fetched_at"]
    if fetched and time.time() - fetched < LEVEL_TTL_S:
        return
    refresh_levels()


def level_status() -> Dict[str, Any]:
    fa = _levels["fetched_at"]
    return {
        "source": SOURCE,
        "fetched_at": datetime.fromtimestamp(fa, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if fa else None,
        "n_volcanoes": len(_levels["by_name"]),
        "stale": fa is None or time.time() - fa > 3 * LEVEL_TTL_S,
        "error": _levels["error"],
    }


_VONA_ROW = re.compile(
    r"(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) UTC \| (Red|Orange|Yellow|Green) \| ([^|]+?) - (\d{8}/\d{4}Z) \|(.*?)\| View"
)


def latest_vonas(volcano_name: str, limit: int = 10) -> Dict[str, Any]:
    """VONA terbaru untuk satu gunung (urut terbaru dulu)."""
    ensure_fresh()
    key = norm_name(volcano_name)
    code = _levels["vona_codes"].get(key)
    if not code:
        return {"available": False, "reason": f"Gunung '{volcano_name}' tidak memiliki kode VONA di MAGMA.", "vonas": []}
    cached = _vona_cache.get(code)
    if cached and time.time() - cached["fetched"] < VONA_TTL_S:
        return cached["result"]
    if is_offline():
        return cached["result"] if cached else {"available": False, "reason": "Mode offline.", "vonas": []}
    try:
        html = _get(VONA_URL, params={"code": code})
    except Exception as e:  # noqa: BLE001
        if cached:
            return cached["result"]
        return {"available": False, "reason": f"MAGMA VONA tidak dapat diakses: {e}", "vonas": []}
    text = re.sub(r"(\s*\|\s*)+", " | ", re.sub(r"<[^>]+>", " | ", html))
    vonas: List[Dict[str, Any]] = []
    for m in _VONA_ROW.finditer(text):
        issued = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        body = m.group(5)
        top = re.search(r"ash-cloud top is around (\d+) FT \((\d+) M\) above sea level", body)
        above = re.search(r"or (\d+) FT \((\d+) M\) above summit", body)
        direction = re.search(r"Ash cloud moving to ([a-z ]+?)\.", body)
        vonas.append({
            "issued_utc": issued.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "color_code": m.group(2).lower(),
            "notice": m.group(4),
            "ash_observed": top is not None,
            "ash_top_asl_m": int(top.group(2)) if top else None,
            "ash_above_summit_m": int(above.group(2)) if above else None,
            "ash_direction": direction.group(1).strip() if direction else None,
        })
        if len(vonas) >= limit:
            break
    result = {"available": True, "code": code, "source": SOURCE, "vonas": vonas,
              "url": f"{VONA_URL}?code={code}"}
    _vona_cache[code] = {"fetched": time.time(), "result": result}
    return result


def latest_ash_vona(volcano_name: str, max_age_h: float) -> Optional[Dict[str, Any]]:
    """VONA terbaru dengan awan abu teramati dalam `max_age_h` jam terakhir, atau None."""
    res = latest_vonas(volcano_name)
    now = datetime.now(timezone.utc)
    for v in res.get("vonas", []):
        issued = datetime.strptime(v["issued_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        if (now - issued).total_seconds() > max_age_h * 3600:
            break
        if v["ash_observed"] and v["ash_top_asl_m"]:
            return {**v, "code": res.get("code"), "url": res.get("url")}
    return None


_hist_cache: Dict[str, Dict[str, Any]] = {}


def _parse_vona_page(html: str) -> List[Dict[str, Any]]:
    text = re.sub(r"(\s*\|\s*)+", " | ", re.sub(r"<[^>]+>", " | ", html))
    out = []
    for m in _VONA_ROW.finditer(text):
        body = m.group(5)
        top = re.search(r"ash-cloud top is around (\d+) FT \((\d+) M\) above sea level", body)
        out.append({
            "issued_utc": datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "color_code": m.group(2).lower(),
            "notice": m.group(4),
            "ash_observed": top is not None,
            "ash_top_asl_m": int(top.group(2)) if top else None,
        })
    return out


def latest_ash_vona_any(volcano_name: str, max_pages: int = 8) -> Optional[Dict[str, Any]]:
    """VONA berabu terbaru sepanjang riwayat MAGMA (menelusuri hingga `max_pages` halaman)."""
    ensure_fresh()
    code = _levels["vona_codes"].get(norm_name(volcano_name))
    if not code:
        return None
    hit = _hist_cache.get(code)
    if hit and time.time() - hit["fetched"] < 6 * 3600:
        return hit["result"]
    result = None
    if not is_offline():
        for page in range(1, max_pages + 1):
            try:
                rows = _parse_vona_page(_get(VONA_URL, params={"code": code, "page": page}))
            except Exception:
                break
            if not rows:
                break
            ash = next((v for v in rows if v["ash_observed"] and v["ash_top_asl_m"]), None)
            if ash:
                result = {**ash, "code": code, "url": f"{VONA_URL}?code={code}"}
                break
    _hist_cache[code] = {"fetched": time.time(), "result": result}
    return result


_RADIUS_RE = re.compile(r"radius(?:\s+radial)?\s+(\d+(?:[.,]\d+)?)\s*(?:km|kilometer)", re.I)
_krb: Dict[str, Any] = {"fetched_at": 0.0, "running": False}


def _parse_radius(html: str) -> Optional[Dict[str, Any]]:
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))
    vals, sentence = [], None
    for m in _RADIUS_RE.finditer(text):
        vals.append(float(m.group(1).replace(",", ".")))
        if sentence is None:
            start = text.rfind(".", 0, m.start()) + 1
            end = text.find(".", m.end())
            sentence = text[start:end if end > 0 else m.end() + 120].strip()
    if not vals:
        return None
    return {"radius_km": max(vals), "recommendation": (sentence or "")[:300]}


def refresh_krb_radius(force: bool = False) -> None:
    """Radius bahaya terbaru dari laporan aktivitas MAGMA tiap gunung (tiap 6 jam, di latar)."""
    if _krb["running"] or is_offline():
        return
    if not force and time.time() - _krb["fetched_at"] < 6 * 3600:
        return
    _krb["running"] = True
    try:
        from concurrent.futures import ThreadPoolExecutor

        from app.db.session import get_db

        with get_db() as conn:
            rows = [dict(r) for r in conn.execute("SELECT id, metadata_json FROM volcanoes").fetchall()]
        jobs = []
        for r in rows:
            meta = json.loads(r["metadata_json"]) if r["metadata_json"] else {}
            if meta.get("magma_report_url"):
                jobs.append((r["id"], meta))

        def one(job):
            vid, meta = job
            try:
                return vid, meta, _parse_radius(_get(meta["magma_report_url"]))
            except Exception:
                return vid, meta, None

        with ThreadPoolExecutor(max_workers=5) as pool:
            results = list(pool.map(one, jobs))
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with get_db() as conn:
            for vid, meta, res in results:
                if not res:
                    continue
                meta.update(radius_source="magma_report", radius_updated_at=stamp, radius_recommendation=res["recommendation"])
                conn.execute("UPDATE volcanoes SET radius_bahaya_km = ?, metadata_json = ? WHERE id = ?",
                             (res["radius_km"], json.dumps(meta, ensure_ascii=False), vid))
        _krb["fetched_at"] = time.time()
    finally:
        _krb["running"] = False
