"""
app/ingest/overpass.py

Fasilitas publik nyata dari OpenStreetMap (D19, D20): sekolah, klinik/puskesmas, rumah sakit, bandara.
Delegasi ke app/services/osm_facilities.py (cache tile 1x1 derajat dari Overpass API).
Tidak ada fasilitas contoh atau sintetis; tile yang belum terunduh dilaporkan sebagai `missing_tiles`.
"""

from typing import Any, Dict, List, Tuple

from app.services import osm_facilities


class OverpassIngest:
    @staticmethod
    def get_facilities_in_bbox(
        lat_min: float,
        lat_max: float,
        lon_min: float,
        lon_max: float,
        facility_type: str | None = None,
        zoom: int | None = None,
        limit: int | None = None,
        fetch_missing: bool = False,
    ) -> List[Dict[str, Any]]:
        facs, _ = OverpassIngest.get_facilities_with_coverage(
            lat_min, lat_max, lon_min, lon_max, facility_type=facility_type, fetch_missing=fetch_missing
        )
        return facs[:limit] if limit else facs

    @staticmethod
    def get_facilities_with_coverage(
        lat_min: float,
        lat_max: float,
        lon_min: float,
        lon_max: float,
        facility_type: str | None = None,
        fetch_missing: bool = False,
        max_fetch: int = 6,
        budget_s: float = 30.0,
    ) -> Tuple[List[Dict[str, Any]], List[Tuple[int, int]]]:
        return osm_facilities.facilities_in_bbox(
            lat_min, lat_max, lon_min, lon_max,
            facility_type=facility_type, fetch_missing=fetch_missing, max_fetch=max_fetch, budget_s=budget_s,
        )

    @staticmethod
    def get_facility_by_id(facility_id: str) -> Dict[str, Any] | None:
        return osm_facilities.facility_by_id(facility_id)
