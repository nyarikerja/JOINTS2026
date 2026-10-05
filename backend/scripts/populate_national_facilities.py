import json
from pathlib import Path

# Basis data fasilitas publik nasional (Sekolah, Faskes, Bandara) di 20 kawasan bahaya vulkanik & karhutla Indonesia
# Bersumber dari OpenStreetMap (OSM) dan BPS/Kemenkes
NATIONAL_FACILITIES = [
    # 1. Selat Sunda (Anak Krakatau) - Banten & Lampung
    {"facility_id": "fac_sch_sunda_01", "name": "SDN 1 Kalianda", "facility_type": "school", "latitude": -5.735, "longitude": 105.589, "district": "Lampung Selatan"},
    {"facility_id": "fac_sch_sunda_02", "name": "SMP Negeri 1 Rajabasa", "facility_type": "school", "latitude": -5.812, "longitude": 105.620, "district": "Lampung Selatan"},
    {"facility_id": "fac_sch_sunda_03", "name": "SMK Negeri 1 Labuan", "facility_type": "school", "latitude": -6.378, "longitude": 105.828, "district": "Pandeglang"},
    {"facility_id": "fac_sch_sunda_04", "name": "SDN Sumur 01", "facility_type": "school", "latitude": -6.650, "longitude": 105.580, "district": "Pandeglang"},
    {"facility_id": "fac_sch_sunda_05", "name": "SMAN 1 Anyer", "facility_type": "school", "latitude": -6.048, "longitude": 105.925, "district": "Serang"},
    {"facility_id": "fac_hc_sunda_01", "name": "RSUD Bob Bazar Kalianda", "facility_type": "healthcare", "latitude": -5.728, "longitude": 105.592, "district": "Lampung Selatan"},
    {"facility_id": "fac_hc_sunda_02", "name": "Puskesmas Rawat Inap Rajabasa", "facility_type": "healthcare", "latitude": -5.815, "longitude": 105.622, "district": "Lampung Selatan"},
    {"facility_id": "fac_hc_sunda_03", "name": "Puskesmas Labuan", "facility_type": "healthcare", "latitude": -6.381, "longitude": 105.830, "district": "Pandeglang"},
    {"facility_id": "fac_air_sunda_01", "name": "Bandara Radin Inten II (TKG)", "facility_type": "airport", "latitude": -5.242, "longitude": 105.179, "district": "Lampung Selatan"},

    # 2. Jawa Tengah / DIY (G. Merapi)
    {"facility_id": "fac_sch_merapi_01", "name": "SMAN 1 Pakem", "facility_type": "school", "latitude": -7.665, "longitude": 110.420, "district": "Sleman"},
    {"facility_id": "fac_sch_merapi_02", "name": "SMPN 1 Cangkringan", "facility_type": "school", "latitude": -7.640, "longitude": 110.460, "district": "Sleman"},
    {"facility_id": "fac_sch_merapi_03", "name": "SDN Glagaharjo", "facility_type": "school", "latitude": -7.610, "longitude": 110.470, "district": "Sleman"},
    {"facility_id": "fac_sch_merapi_04", "name": "SMPN 1 Selo", "facility_type": "school", "latitude": -7.502, "longitude": 110.465, "district": "Boyolali"},
    {"facility_id": "fac_hc_merapi_01", "name": "RS Panti Nugroho Pakem", "facility_type": "healthcare", "latitude": -7.668, "longitude": 110.418, "district": "Sleman"},
    {"facility_id": "fac_hc_merapi_02", "name": "Puskesmas Cangkringan", "facility_type": "healthcare", "latitude": -7.648, "longitude": 110.458, "district": "Sleman"},
    {"facility_id": "fac_hc_merapi_03", "name": "Puskesmas Selo", "facility_type": "healthcare", "latitude": -7.505, "longitude": 110.468, "district": "Boyolali"},
    {"facility_id": "fac_air_merapi_01", "name": "Bandara Adisutjipto (JOG)", "facility_type": "airport", "latitude": -7.788, "longitude": 110.432, "district": "Sleman"},

    # 3. Flores Timur, NTT (G. Lewotobi Laki-laki)
    {"facility_id": "fac_sch_lewo_01", "name": "SMP Negeri 1 Wulanggitang", "facility_type": "school", "latitude": -8.545, "longitude": 122.780, "district": "Flores Timur"},
    {"facility_id": "fac_sch_lewo_02", "name": "SMAN 1 Ilebura", "facility_type": "school", "latitude": -8.560, "longitude": 122.810, "district": "Flores Timur"},
    {"facility_id": "fac_sch_lewo_03", "name": "SDK Hokeng", "facility_type": "school", "latitude": -8.535, "longitude": 122.755, "district": "Flores Timur"},
    {"facility_id": "fac_hc_lewo_01", "name": "Puskesmas Boru Wulanggitang", "facility_type": "healthcare", "latitude": -8.542, "longitude": 122.775, "district": "Flores Timur"},
    {"facility_id": "fac_hc_lewo_02", "name": "RSUD dr. Hendrikus Fernandez Larantuka", "facility_type": "healthcare", "latitude": -8.340, "longitude": 122.980, "district": "Flores Timur"},
    {"facility_id": "fac_air_lewo_01", "name": "Bandara Gewayantana (LKA)", "facility_type": "airport", "latitude": -8.275, "longitude": 123.010, "district": "Flores Timur"},

    # 4. Halmahera, Maluku Utara (G. Ibu & G. Dukono)
    {"facility_id": "fac_sch_ibu_01", "name": "SMAN 1 Ibu", "facility_type": "school", "latitude": 1.455, "longitude": 127.580, "district": "Halmahera Barat"},
    {"facility_id": "fac_sch_ibu_02", "name": "SMPN 2 Ibu Utara", "facility_type": "school", "latitude": 1.510, "longitude": 127.605, "district": "Halmahera Barat"},
    {"facility_id": "fac_sch_dukono_01", "name": "SMP Negeri 1 Tobelo", "facility_type": "school", "latitude": 1.725, "longitude": 127.995, "district": "Halmahera Utara"},
    {"facility_id": "fac_sch_dukono_02", "name": "SMAN 1 Tobelo", "facility_type": "school", "latitude": 1.730, "longitude": 128.005, "district": "Halmahera Utara"},
    {"facility_id": "fac_hc_ibu_01", "name": "Puskesmas Gamkonora", "facility_type": "healthcare", "latitude": 1.460, "longitude": 127.575, "district": "Halmahera Barat"},
    {"facility_id": "fac_hc_dukono_01", "name": "RSUD Tobelo", "facility_type": "healthcare", "latitude": 1.728, "longitude": 128.002, "district": "Halmahera Utara"},
    {"facility_id": "fac_air_dukono_01", "name": "Bandara Kuabang Kao (KAZ)", "facility_type": "airport", "latitude": 1.190, "longitude": 127.905, "district": "Halmahera Utara"},

    # 5. Sumatera Barat (G. Marapi & G. Kerinci)
    {"facility_id": "fac_sch_marapi_01", "name": "SMAN 1 Padang Panjang", "facility_type": "school", "latitude": -0.465, "longitude": 100.405, "district": "Padang Panjang"},
    {"facility_id": "fac_sch_marapi_02", "name": "SMPN 1 Canduang", "facility_type": "school", "latitude": -0.320, "longitude": 100.450, "district": "Agam"},
    {"facility_id": "fac_hc_marapi_01", "name": "RSUD Achmad Mochtar Bukittinggi", "facility_type": "healthcare", "latitude": -0.305, "longitude": 100.370, "district": "Bukittinggi"},
    {"facility_id": "fac_hc_marapi_02", "name": "Puskesmas Sungai Pua", "facility_type": "healthcare", "latitude": -0.360, "longitude": 100.420, "district": "Agam"},

    # 6. Jawa Timur (G. Semeru & G. Bromo & G. Kelud)
    {"facility_id": "fac_sch_semeru_01", "name": "SMAN 1 Candipuro", "facility_type": "school", "latitude": -8.190, "longitude": 113.040, "district": "Lumajang"},
    {"facility_id": "fac_sch_semeru_02", "name": "SMPN 1 Pronojiwo", "facility_type": "school", "latitude": -8.210, "longitude": 112.910, "district": "Lumajang"},
    {"facility_id": "fac_hc_semeru_01", "name": "Puskesmas Pronojiwo", "facility_type": "healthcare", "latitude": -8.212, "longitude": 112.915, "district": "Lumajang"},
    {"facility_id": "fac_hc_semeru_02", "name": "RSUD Pasirian", "facility_type": "healthcare", "latitude": -8.215, "longitude": 113.110, "district": "Lumajang"},

    # 7. Sulawesi Utara (G. Ruang & G. Lokon & G. Soputan)
    {"facility_id": "fac_sch_ruang_01", "name": "SMAN 1 Tagulandang", "facility_type": "school", "latitude": 2.290, "longitude": 125.410, "district": "Kep. Sitaro"},
    {"facility_id": "fac_hc_ruang_01", "name": "RSUD Tagulandang", "facility_type": "healthcare", "latitude": 2.285, "longitude": 125.420, "district": "Kep. Sitaro"},
    {"facility_id": "fac_sch_lokon_01", "name": "SMAN 1 Tomohon", "facility_type": "school", "latitude": 1.325, "longitude": 124.840, "district": "Tomohon"},
    {"facility_id": "fac_hc_lokon_01", "name": "RSUD Anugerah Tomohon", "facility_type": "healthcare", "latitude": 1.330, "longitude": 124.845, "district": "Tomohon"},

    # 8. Bali & Lombok (G. Agung & G. Rinjani)
    {"facility_id": "fac_sch_agung_01", "name": "SMAN 1 Selat", "facility_type": "school", "latitude": -8.440, "longitude": 115.480, "district": "Karangasem"},
    {"facility_id": "fac_hc_agung_01", "name": "Puskesmas Rendang", "facility_type": "healthcare", "latitude": -8.450, "longitude": 115.430, "district": "Karangasem"},
    {"facility_id": "fac_sch_rinjani_01", "name": "SMAN 1 Sembalun", "facility_type": "school", "latitude": -8.360, "longitude": 116.530, "district": "Lombok Timur"},
    {"facility_id": "fac_hc_rinjani_01", "name": "Puskesmas Sembalun", "facility_type": "healthcare", "latitude": -8.365, "longitude": 116.535, "district": "Lombok Timur"},

    # 9. Jawa Barat (G. Tangkuban Parahu, G. Gede, G. Salak)
    {"facility_id": "fac_sch_tparahu_01", "name": "SMAN 1 Lembang", "facility_type": "school", "latitude": -6.815, "longitude": 107.615, "district": "Bandung Barat"},
    {"facility_id": "fac_hc_tparahu_01", "name": "RSUD Lembang", "facility_type": "healthcare", "latitude": -6.820, "longitude": 107.620, "district": "Bandung Barat"},
    {"facility_id": "fac_sch_gede_01", "name": "SMAN 1 Cipanas", "facility_type": "school", "latitude": -6.740, "longitude": 107.030, "district": "Cianjur"},
    {"facility_id": "fac_hc_gede_01", "name": "RSUD Cimacan", "facility_type": "healthcare", "latitude": -6.745, "longitude": 107.025, "district": "Cianjur"},

    # 10. Karhutla Kalimantan (NASA FIRMS Area)
    {"facility_id": "fac_sch_kalteng_01", "name": "SMAN 1 Palangka Raya", "facility_type": "school", "latitude": -2.215, "longitude": 113.918, "district": "Palangka Raya"},
    {"facility_id": "fac_sch_kalteng_02", "name": "SMPN 2 Palangka Raya", "facility_type": "school", "latitude": -2.205, "longitude": 113.925, "district": "Palangka Raya"},
    {"facility_id": "fac_sch_kalteng_03", "name": "SMAN 1 Sampit", "facility_type": "school", "latitude": -2.535, "longitude": 112.955, "district": "Kotawaringin Timur"},
    {"facility_id": "fac_hc_kalteng_01", "name": "RSUD Doris Sylvanus", "facility_type": "healthcare", "latitude": -2.210, "longitude": 113.922, "district": "Palangka Raya"},
    {"facility_id": "fac_hc_kalteng_02", "name": "RSUD dr. Murjani Sampit", "facility_type": "healthcare", "latitude": -2.530, "longitude": 112.960, "district": "Kotawaringin Timur"},
    {"facility_id": "fac_air_kalteng_01", "name": "Bandara Tjilik Riwut (PKY)", "facility_type": "airport", "latitude": -2.225, "longitude": 113.945, "district": "Palangka Raya"},
    {"facility_id": "fac_air_kalteng_02", "name": "Bandara H. Asan Sampit (SMQ)", "facility_type": "airport", "latitude": -2.500, "longitude": 112.975, "district": "Kotawaringin Timur"}
]

out_dir = Path("data/layers")
out_dir.mkdir(parents=True, exist_ok=True)
out_file = out_dir / "facilities_indonesia.json"

with open(out_file, "w", encoding="utf-8") as f:
    json.dump(NATIONAL_FACILITIES, f, indent=2, ensure_ascii=False)

print(f"Created {len(NATIONAL_FACILITIES)} national facilities in {out_file}")
