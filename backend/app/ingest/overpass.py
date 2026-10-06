"""
app/ingest/overpass.py

Modul ingest fasilitas publik dari OpenStreetMap via Overpass API (D19, D20).
Mencakup sekolah, fasilitas kesehatan (Puskesmas/Rumah Sakit), dan bandara.
Menyediakan cache offline siap pakai untuk area demo.
"""

from typing import Any, Dict, List

# Cache fasilitas penting untuk area Selat Sunda (Anak Krakatau) dan Kalimantan
DEMO_FACILITIES = [
    # Banten & Lampung (Anak Krakatau area)
    {
        "facility_id": "fac_sch_01",
        "name": "SDN 1 Kalianda",
        "facility_type": "school",
        "latitude": -5.735,
        "longitude": 105.589,
        "district": "Lampung Selatan"
    },
    {
        "facility_id": "fac_sch_02",
        "name": "SMP Negeri 1 Rajabasa",
        "facility_type": "school",
        "latitude": -5.812,
        "longitude": 105.620,
        "district": "Lampung Selatan"
    },
    {
        "facility_id": "fac_sch_03",
        "name": "SMK Negeri 1 Labuan",
        "facility_type": "school",
        "latitude": -6.378,
        "longitude": 105.828,
        "district": "Pandeglang"
    },
    {
        "facility_id": "fac_sch_04",
        "name": "SDN Sumur 01",
        "facility_type": "school",
        "latitude": -6.650,
        "longitude": 105.580,
        "district": "Pandeglang"
    },
    {
        "facility_id": "fac_hc_01",
        "name": "RSUD Bob Bazar Kalianda",
        "facility_type": "healthcare",
        "latitude": -5.728,
        "longitude": 105.592,
        "district": "Lampung Selatan"
    },
    {
        "facility_id": "fac_hc_02",
        "name": "Puskesmas Rawat Inap Rajabasa",
        "facility_type": "healthcare",
        "latitude": -5.815,
        "longitude": 105.622,
        "district": "Lampung Selatan"
    },
    {
        "facility_id": "fac_hc_03",
        "name": "Puskesmas Labuan",
        "facility_type": "healthcare",
        "latitude": -6.381,
        "longitude": 105.830,
        "district": "Pandeglang"
    },
    {
        "facility_id": "fac_air_01",
        "name": "Bandara Radin Inten II (TKG)",
        "facility_type": "airport",
        "latitude": -5.242,
        "longitude": 105.178,
        "district": "Lampung Selatan"
    },
    # Kalimantan Tengah (Live Kalimantan area)
    {
        "facility_id": "fac_sch_kalteng_01",
        "name": "SMAN 1 Palangka Raya",
        "facility_type": "school",
        "latitude": -2.215,
        "longitude": 113.918,
        "district": "Palangka Raya"
    },
    {
        "facility_id": "fac_hc_kalteng_01",
        "name": "RSUD Doris Sylvanus",
        "facility_type": "healthcare",
        "latitude": -2.210,
        "longitude": 113.922,
        "district": "Palangka Raya"
    },
    {
        "facility_id": "fac_air_kalteng_01",
        "name": "Bandara Tjilik Riwut (PKY)",
        "facility_type": "airport",
        "latitude": -2.225,
        "longitude": 113.945,
        "district": "Palangka Raya"
    }
]


class OverpassIngest:
    _cached_facilities: List[Dict[str, Any]] | None = None
    _cached_mtime: float = 0.0
    _synth_cache: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def load_all_facilities(cls, force_reload: bool = False) -> List[Dict[str, Any]]:
        import json

        from app.core.config import BACKEND_DIR

        fac_file = BACKEND_DIR / "data" / "layers" / "facilities_indonesia.json"
        current_mtime = fac_file.stat().st_mtime if fac_file.exists() else 0.0

        if not force_reload and cls._cached_facilities is not None and cls._cached_mtime == current_mtime:
            return cls._cached_facilities

        if fac_file.exists():
            with open(fac_file, "r", encoding="utf-8-sig") as f:
                cls._cached_facilities = json.load(f)
                cls._cached_mtime = current_mtime
                return cls._cached_facilities

        cls._cached_facilities = DEMO_FACILITIES
        return cls._cached_facilities

    @classmethod
    def get_facilities_in_bbox(
        cls,
        lat_min: float,
        lat_max: float,
        lon_min: float,
        lon_max: float,
        facility_type: str | None = None
    ) -> List[Dict[str, Any]]:
        facilities = cls.load_all_facilities()
        results = []
        for fac in facilities:
            lat = fac["latitude"]
            lon = fac["longitude"]
            if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
                if facility_type is None or fac["facility_type"] == facility_type:
                    results.append(fac)

        # Jika di dalam bounding box ketat belum terdaftar fasilitas (misal titik laut lepas),
        # ambil fasilitas nyata terdekat dari katalog nasional agar tetap realistis dan tidak ada fasilitas di laut
        if len(results) == 0 and facilities:
            mid_lat = (lat_min + lat_max) / 2.0
            mid_lon = (lon_min + lon_max) / 2.0
            def dist_sq(f):
                return (f["latitude"] - mid_lat) ** 2 + (f["longitude"] - mid_lon) ** 2
            sorted_facs = sorted(facilities, key=dist_sq)
            for f in sorted_facs[:5]:
                if facility_type is None or f["facility_type"] == facility_type:
                    results.append(f)

        return results

    @classmethod
    def get_facility_by_id(cls, facility_id: str) -> Dict[str, Any] | None:
        if hasattr(cls, "_synth_cache") and facility_id in cls._synth_cache:
            return cls._synth_cache[facility_id]
        facilities = cls.load_all_facilities()
        for fac in facilities:
            if fac["facility_id"] == facility_id:
                return fac
        for fac in DEMO_FACILITIES:
            if fac["facility_id"] == facility_id:
                return fac
        return None
