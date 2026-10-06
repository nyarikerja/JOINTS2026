import json
import math
import random
from pathlib import Path

BACKEND_DIR = Path(r"c:\Users\arya4\JOINTS2026\backend")
VOLC_FILE = BACKEND_DIR / "data" / "layers" / "volcanoes_indonesia.geojson"
FAC_FILE = BACKEND_DIR / "data" / "layers" / "facilities_indonesia.json"
EVENTS_DIR = BACKEND_DIR / "data" / "events"

# 1. Load volcanoes
volcanoes_geojson = json.loads(VOLC_FILE.read_text(encoding="utf-8"))
features = volcanoes_geojson.get("features", [])

facilities = []
fac_id_counter = 1

# Sekolah template
SCHOOL_LEVELS = ["SDN", "SMP Negeri", "SMAN", "SMK Negeri"]

# Bandara regional utama di Indonesia
REGIONAL_AIRPORTS = [
    {"name": "Bandara Sultan Iskandar Muda (BTJ)", "lat": 5.523, "lon": 95.420, "district": "Aceh Besar"},
    {"name": "Bandara Kualanamu (KNO)", "lat": 3.642, "lon": 98.885, "district": "Deli Serdang / Medan"},
    {"name": "Bandara Minangkabau (PDG)", "lat": -0.787, "lon": 100.281, "district": "Padang Pariaman"},
    {"name": "Bandara Sultan Mahmud Badaruddin II (PLM)", "lat": -2.898, "lon": 104.701, "district": "Palembang"},
    {"name": "Bandara Radin Inten II (TKG)", "lat": -5.242, "lon": 105.178, "district": "Lampung Selatan"},
    {"name": "Bandara Soekarno-Hatta (CGK)", "lat": -6.125, "lon": 106.655, "district": "Tangerang"},
    {"name": "Bandara Husein Sastranegara (BDO)", "lat": -6.900, "lon": 107.576, "district": "Bandung"},
    {"name": "Bandara Ahmad Yani (SRG)", "lat": -6.974, "lon": 110.374, "district": "Semarang"},
    {"name": "Bandara Adisutjipto (JOG)", "lat": -7.788, "lon": 110.432, "district": "Sleman / Yogyakarta"},
    {"name": "Bandara Yogyakarta International (YIA)", "lat": -7.904, "lon": 110.057, "district": "Kulon Progo"},
    {"name": "Bandara Juanda (SUB)", "lat": -7.379, "lon": 112.787, "district": "Sidoarjo / Surabaya"},
    {"name": "Bandara Abdulrachman Saleh (MLG)", "lat": -7.926, "lon": 112.714, "district": "Malang"},
    {"name": "Bandara Banyuwangi (BWX)", "lat": -8.309, "lon": 114.339, "district": "Banyuwangi"},
    {"name": "Bandara I Gusti Ngurah Rai (DPS)", "lat": -8.748, "lon": 115.167, "district": "Badung / Bali"},
    {"name": "Bandara Zainuddin Abdul Madjid (LOP)", "lat": -8.761, "lon": 116.275, "district": "Lombok Tengah"},
    {"name": "Bandara Sultan Muhammad Salahuddin (BMU)", "lat": -8.539, "lon": 118.689, "district": "Bima"},
    {"name": "Bandara Frans Seda (MOF)", "lat": -8.625, "lon": 122.238, "district": "Maumere / Sikka"},
    {"name": "Bandara Gewayantana (LKA)", "lat": -8.277, "lon": 122.977, "district": "Larantuka / Flores Timur"},
    {"name": "Bandara El Tari (KOE)", "lat": -10.171, "lon": 123.670, "district": "Kupang"},
    {"name": "Bandara Supadio (PNK)", "lat": -0.150, "lon": 109.403, "district": "Kubu Raya / Pontianak"},
    {"name": "Bandara Tjilik Riwut (PKY)", "lat": -2.225, "lon": 113.945, "district": "Palangka Raya"},
    {"name": "Bandara Syamsudin Noor (BDJ)", "lat": -3.442, "lon": 114.757, "district": "Banjarbaru"},
    {"name": "Bandara Sultan Aji Muhammad Sulaiman (BPN)", "lat": -1.268, "lon": 116.894, "district": "Balikpapan"},
    {"name": "Bandara Sultan Hasanuddin (UPG)", "lat": -5.061, "lon": 119.554, "district": "Maros / Makassar"},
    {"name": "Bandara Sam Ratulangi (MDC)", "lat": 1.549, "lon": 124.926, "district": "Manado"},
    {"name": "Bandara Pattimura (AMQ)", "lat": -3.708, "lon": 128.089, "district": "Ambon"},
    {"name": "Bandara Sultan Babullah (TTE)", "lat": 0.831, "lon": 127.381, "district": "Ternate"},
    {"name": "Bandara Sentani (DJJ)", "lat": -2.576, "lon": 140.516, "district": "Jayapura"},
    {"name": "Bandara Mopah (MKQ)", "lat": -8.520, "lon": 140.418, "district": "Merauke"},
]

for ap in REGIONAL_AIRPORTS:
    facilities.append({
        "facility_id": f"fac_air_{fac_id_counter:03d}",
        "name": ap["name"],
        "facility_type": "airport",
        "latitude": round(ap["lat"], 4),
        "longitude": round(ap["lon"], 4),
        "district": ap["district"]
    })
    fac_id_counter += 1

# Generate fasilitas di sekitar ke-70 gunung api nasional
rng = random.Random(42)

for f in features:
    p = f["properties"]
    coords = f["geometry"]["coordinates"]
    v_lon = float(coords[0])
    v_lat = float(coords[1])
    v_name = p["name"]
    province = p["province"]
    rad_km = float(p.get("radius_bahaya_km", 5.0))
    
    # Kabupaten dari nama provinsi atau nama gunung
    main_district = province.split(",")[0].strip()
    
    # 1. Sekolah di lereng gunung (berada di zona waspada / siaga, jarak 4 - 15 km)
    # 1 km ≈ 0.009 derajat
    for s_idx in range(1, 4):
        angle = rng.uniform(0, 2 * math.pi)
        dist_km = rng.uniform(rad_km * 0.9, rad_km * 2.8)
        dist_deg = dist_km * 0.009
        
        s_lat = v_lat + dist_deg * math.cos(angle)
        s_lon = v_lon + dist_deg * math.sin(angle)
        
        s_type = rng.choice(SCHOOL_LEVELS)
        s_name = f"{s_type} {s_idx} Lereng {v_name}"
        
        facilities.append({
            "facility_id": f"fac_sch_{fac_id_counter:04d}",
            "name": s_name,
            "facility_type": "school",
            "latitude": round(s_lat, 4),
            "longitude": round(s_lon, 4),
            "district": main_district
        })
        fac_id_counter += 1
        
    # 2. Fasilitas Kesehatan:
    # a. Puskesmas Rawat Inap (dekat kawah / lereng, jarak 6 - 18 km)
    angle_puskes = rng.uniform(0, 2 * math.pi)
    dist_puskes_deg = rng.uniform(rad_km * 1.2, rad_km * 3.0) * 0.009
    pusk_lat = v_lat + dist_puskes_deg * math.cos(angle_puskes)
    pusk_lon = v_lon + dist_puskes_deg * math.sin(angle_puskes)
    
    facilities.append({
        "facility_id": f"fac_hc_{fac_id_counter:04d}",
        "name": f"Puskesmas Siaga Bencana {v_name}",
        "facility_type": "healthcare",
        "latitude": round(pusk_lat, 4),
        "longitude": round(pusk_lon, 4),
        "district": main_district
    })
    fac_id_counter += 1
    
    # b. RSUD Rujukan Kabupaten (zona aman / kota terdekat, jarak 22 - 45 km)
    # sengaja ditempatkan di luar jangkauan abu utama sebagai tujuan rujukan evakuasi
    angle_rs = angle_puskes + rng.uniform(2.0, 4.0)
    dist_rs_deg = rng.uniform(22.0, 42.0) * 0.009
    rs_lat = v_lat + dist_rs_deg * math.cos(angle_rs)
    rs_lon = v_lon + dist_rs_deg * math.sin(angle_rs)
    
    facilities.append({
        "facility_id": f"fac_hc_{fac_id_counter:04d}",
        "name": f"RSUD Rujukan Wilayah {v_name} ({main_district})",
        "facility_type": "healthcare",
        "latitude": round(rs_lat, 4),
        "longitude": round(rs_lon, 4),
        "district": main_district
    })
    fac_id_counter += 1

# 3. Fasilitas di zona karhutla nasional
KARHUTLA_CENTERS = [
    {"name": "Palangka Raya & Pulang Pisau", "lat": -2.5, "lon": 113.5, "prov": "Kalimantan Tengah"},
    {"name": "Ketapang", "lat": -1.85, "lon": 109.85, "prov": "Kalimantan Barat"},
    {"name": "Banjarbaru", "lat": -3.45, "lon": 114.85, "prov": "Kalimantan Selatan"},
    {"name": "Siak & Pelalawan", "lat": 0.75, "lon": 101.85, "prov": "Riau"},
    {"name": "Ogan Komering Ilir (OKI)", "lat": -3.45, "lon": 105.15, "prov": "Sumatera Selatan"},
    {"name": "Muaro Jambi", "lat": -1.45, "lon": 103.80, "prov": "Jambi"},
    {"name": "Merauke", "lat": -8.45, "lon": 140.40, "prov": "Papua Selatan"},
]

for kc in KARHUTLA_CENTERS:
    for i in range(1, 4):
        offset_lat = rng.uniform(-0.15, 0.15)
        offset_lon = rng.uniform(-0.15, 0.15)
        facilities.append({
            "facility_id": f"fac_sch_{fac_id_counter:04d}",
            "name": f"SMAN {i} Gambut {kc['name'].split('&')[0].strip()}",
            "facility_type": "school",
            "latitude": round(kc["lat"] + offset_lat, 4),
            "longitude": round(kc["lon"] + offset_lon, 4),
            "district": kc["prov"]
        })
        fac_id_counter += 1
        
    facilities.append({
        "facility_id": f"fac_hc_{fac_id_counter:04d}",
        "name": f"RSUD Rujukan ISPA {kc['name'].split('&')[0].strip()}",
        "facility_type": "healthcare",
        "latitude": round(kc["lat"] + rng.uniform(-0.25, 0.25), 4),
        "longitude": round(kc["lon"] + rng.uniform(-0.25, 0.25), 4),
        "district": kc["prov"]
    })
    fac_id_counter += 1

print(f"Total fasilitas yang dihasilkan untuk seluruh Indonesia: {len(facilities)}")
FAC_FILE.write_text(json.dumps(facilities, indent=2, ensure_ascii=False), encoding="utf-8")
print("Saved to:", FAC_FILE)
