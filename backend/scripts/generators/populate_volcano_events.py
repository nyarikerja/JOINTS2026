import json
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
geojson_path = BACKEND_DIR / "data" / "layers" / "volcanoes_indonesia.geojson"
events_dir = BACKEND_DIR / "data" / "events"

with open(geojson_path, "r", encoding="utf-8") as f:
    geo = json.load(f)

for feat in geo["features"]:
    props = feat["properties"]
    vid = props["id"]
    name = props["name"]
    coords = feat["geometry"]["coordinates"]
    v_dir = events_dir / vid
    v_dir.mkdir(parents=True, exist_ok=True)
    meta_path = v_dir / "meta.json"
    
    props["has_event"] = True
    props["event_id"] = vid

    if not meta_path.exists():
        lvl = props.get("level", 1)
        col_h = 4.5 if lvl >= 3 else 2.5
        elev = float(props.get("elevation_m", 2000))
        meta = {
            "event_id": vid,
            "hazard": "volcano",
            "name": f"Erupsi {name} ({props.get('province', 'Indonesia')})",
            "start_utc": "2026-09-05T00:00:00Z",
            "end_utc": "2026-09-06T12:00:00Z",
            "duration_h": 24.0,
            "alert_level_at_event": props.get("level_name", "Level II (Waspada)"),
            "restricted_radius_km": float(props.get("radius_bahaya_km", 3.0)),
            "eruption_style": "abu vulkanik dan emisi gas",
            "column_height_km": col_h,
            "plume_top_asl_km": round((elev / 1000.0) + col_h, 2),
            "vent_elevation_m": elev,
            "peak_phase_duration_h": 4.0,
            "coordinates": {
                "latitude": coords[1],
                "longitude": coords[0]
            },
            "bbox": [coords[0] - 1.0, coords[1] - 1.0, coords[0] + 1.0, coords[1] + 1.0],
            "source": "PVMBG Badan Geologi ESDM",
            "members_source": "open_meteo_ensemble",
            "n_members": 51,
            "disclaimer": "Simulasi ini adalah estimasi ilmiah untuk kesiapsiagaan darurat dan analisis dampak, BUKAN peringatan resmi. Ikuti instruksi resmi dari PVMBG Badan Geologi, BMKG, dan BPBD."
        }
        with open(meta_path, "w", encoding="utf-8") as mf:
            json.dump(meta, mf, indent=2, ensure_ascii=False)
        print(f"Created event meta for {vid}")

with open(geojson_path, "w", encoding="utf-8") as f:
    json.dump(geo, f, indent=2, ensure_ascii=False)
print("Updated volcanoes_indonesia.geojson with all 20 active events!")
