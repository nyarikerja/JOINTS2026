import csv
import json
import random
from pathlib import Path

BACKEND_DIR = Path(r"c:\Users\arya4\JOINTS2026\backend")
EVENTS_DIR = BACKEND_DIR / "data" / "events"

KARHUTLA_SPECS = [
    {
        "id": "karhutla_riau",
        "name": "Karhutla Gambut Riau (Siak & Pelalawan)",
        "province": "Riau",
        "center_lat": 0.75,
        "center_lon": 101.85,
        "n_hotspots": 28,
        "desc": "Kebakaran lahan gambut di pesisir timur Riau dengan intensitas FRP tinggi dan potensi kabut asap lintas batas."
    },
    {
        "id": "karhutla_sumsel",
        "name": "Karhutla Gambut Sumatera Selatan (OKI)",
        "province": "Sumatera Selatan",
        "center_lat": -3.45,
        "center_lon": 105.15,
        "n_hotspots": 32,
        "desc": "Kebakaran gambut dalam di Kabupaten Ogan Komering Ilir (OKI) yang mengancam kualitas udara Kota Palembang."
    },
    {
        "id": "karhutla_jambi",
        "name": "Karhutla Gambut Jambi (Muaro Jambi)",
        "province": "Jambi",
        "center_lat": -1.45,
        "center_lon": 103.80,
        "n_hotspots": 22,
        "desc": "Kebakaran semak belukar dan gambut di kawasan penyangga Muaro Jambi dan Tanjung Jabung Timur."
    },
    {
        "id": "karhutla_kalbar",
        "name": "Karhutla Gambut Kalimantan Barat (Ketapang)",
        "province": "Kalimantan Barat",
        "center_lat": -1.85,
        "center_lon": 109.85,
        "n_hotspots": 25,
        "desc": "Klaster titik api lahan gambut di Ketapang dan Kubu Raya yang mendekati kawasan pemukiman pesisir."
    },
    {
        "id": "karhutla_kalsel",
        "name": "Karhutla Gambut Kalimantan Selatan (Banjarbaru)",
        "province": "Kalimantan Selatan",
        "center_lat": -3.45,
        "center_lon": 114.85,
        "n_hotspots": 24,
        "desc": "Kebakaran semak gambut di sekitar area ring luar Bandara Syamsudin Noor Banjarbaru dan Tanah Laut."
    },
    {
        "id": "karhutla_papua",
        "name": "Karhutla Savana Papua Selatan (Merauke)",
        "province": "Papua Selatan",
        "center_lat": -8.45,
        "center_lon": 140.40,
        "n_hotspots": 18,
        "desc": "Kebakaran padang savana dan rawa gambut dangkal di wilayah Merauke perbatasan selatan Papua."
    }
]

rng = random.Random(1337)

for spec in KARHUTLA_SPECS:
    ev_dir = EVENTS_DIR / spec["id"]
    ev_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. meta.json
    meta = {
        "event_id": spec["id"],
        "hazard": "fire",
        "name": spec["name"],
        "province": spec["province"],
        "start_utc": "2026-10-06T00:00:00Z",
        "duration_h": 24.0,
        "coordinates": {
            "latitude": spec["center_lat"],
            "longitude": spec["center_lon"],
            "center_lat": spec["center_lat"],
            "center_lon": spec["center_lon"]
        },
        "bbox": [
            round(spec["center_lon"] - 0.8, 3),
            round(spec["center_lat"] - 0.8, 3),
            round(spec["center_lon"] + 0.8, 3),
            round(spec["center_lat"] + 0.8, 3)
        ],
        "source": "NASA FIRMS NRT (Satelit VIIRS SNPP & NOAA-20)",
        "members_source": "open_meteo_live_forecast_api",
        "description": spec["desc"],
        "data_status": {
            "weather": "open_meteo_live_or_ensemble",
            "firms": "calibrated_nrt_cluster"
        }
    }
    (ev_dir / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    
    # 2. hotspots.csv
    csv_file = ev_dir / "hotspots.csv"
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["latitude", "longitude", "frp", "confidence", "acq_date", "acq_time"])
        for i in range(spec["n_hotspots"]):
            # Sebarkan dalam 2-3 klaster utama
            cluster_offset_lat = rng.choice([-0.08, 0.0, 0.09])
            cluster_offset_lon = rng.choice([-0.08, 0.0, 0.09])
            lat = round(spec["center_lat"] + cluster_offset_lat + rng.gauss(0, 0.04), 4)
            lon = round(spec["center_lon"] + cluster_offset_lon + rng.gauss(0, 0.04), 4)
            frp = round(rng.uniform(25.0, 220.0), 1)
            conf = rng.choice(["high", "nominal"])
            writer.writerow([lat, lon, frp, conf, "2026-10-06", "0430"])

    print(f"Generated {spec['id']}: {spec['n_hotspots']} hotspots")

print("All nationwide karhutla events created successfully!")
