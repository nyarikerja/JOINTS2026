"""
app/impact/validation.py

Validasi model terhadap laporan dampak lapangan (SPEC.md Bagian 14).
Metrik hanya dihitung dari run nyata yang dibandingkan dengan data laporan; tanpa run atau tanpa
laporan lapangan, respons menyatakan status apa adanya (tidak ada skor tetap).
"""

import json
from typing import Any, Dict

from app.core.config import BACKEND_DIR


def _hazard(event_dir) -> str | None:
    meta = event_dir / "meta.json"
    if meta.exists():
        try:
            return json.loads(meta.read_text(encoding="utf-8-sig")).get("hazard")
        except Exception:
            return None
    return None


def evaluate_event_validation(event_id: str, run_output: Dict[str, Any] | None = None) -> Dict[str, Any]:
    event_dir = BACKEND_DIR / "data" / "events" / event_id
    reported_file = event_dir / "reported_impact.geojson"
    hazard = (run_output or {}).get("hazard") or _hazard(event_dir)
    if not reported_file.exists():
        return {
            "event_id": event_id,
            "hazard": hazard,
            "status": "not_testable",
            "accuracy_claim": "none",
            "reason": "Belum ada data dampak lapangan terverifikasi (reported_impact.geojson) untuk kejadian ini.",
        }

    reported = json.loads(reported_file.read_text(encoding="utf-8-sig"))
    districts = [f for f in reported.get("features", []) if not (f.get("properties") or {}).get("is_airport")]
    result: Dict[str, Any] = {
        "event_id": event_id,
        "hazard": hazard,
        "resolution": "district",
        "reported_districts_evaluated": [(f.get("properties") or {}).get("name") for f in districts],
        "accuracy_claim": "none",
    }
    if run_output is None or not run_output.get("hourly_tiers"):
        result.update(status="not_evaluated",
                      reason="Kirim run_id simulasi untuk membandingkan jejak sebaran dengan kabupaten yang dilaporkan.")
        return result

    from shapely.geometry import shape
    from shapely.ops import unary_union

    last = max(run_output["hourly_tiers"], key=lambda k: int(k))
    feats = run_output["hourly_tiers"][last].get("features", [])
    if not feats:
        result.update(status="evaluated", district_hit_rate=0.0, hits=[])
        return result
    footprint = unary_union([shape(f["geometry"]) for f in feats])
    hits = [
        (f.get("properties") or {}).get("name") for f in districts
        if f.get("geometry") and footprint.intersects(shape(f["geometry"]))
    ]
    result.update(
        status="evaluated",
        run_id=run_output.get("run_id"),
        district_hit_rate=round(len(hits) / max(len(districts), 1), 2),
        hits=hits,
        members_source=run_output.get("members_source"),
        note="Validasi kasar: irisan jejak sebaran terluar (P5) dengan poligon kabupaten yang dilaporkan.",
    )
    return result
