import pytest
"""
tests/test_database.py

pytestmark = pytest.mark.network

Pengujian unit dan performa untuk basis data spasial terpadu UdaraSiaga
(SQLite + R*Tree Spatial Engine + Repository Layer).
"""

import time

from fastapi.testclient import TestClient

from app.db.repositories.forest_repo import ForestRepository
from app.db.repositories.volcano_repo import VolcanoRepository
from app.db.session import DB_PATH, get_db_connection
from app.main import app

client = TestClient(app)


def test_database_tables_and_rtree_exist():
    """Memverifikasi bahwa database dan seluruh tabel virtual R*Tree terpasang sempurna."""
    assert DB_PATH.exists(), "File database udarasiaga.db harus ada"
    conn = get_db_connection()
    try:
        tables = [row["name"] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        assert "volcanoes" in tables
        assert "forests" in tables
        assert "facilities" in tables
        assert "hotspots" in tables
        assert "facilities_rtree" in tables
        assert "volcanoes_rtree" in tables
        assert "forests_rtree" in tables
        assert "hotspots_rtree" in tables
    finally:
        conn.close()


def test_volcano_repository_counts():
    """Memverifikasi seluruh 70 gunung api aktif PVMBG tersimpan di database."""
    volcs = VolcanoRepository.get_all()
    assert len(volcs) == 70, f"Harus ada 70 gunung api di database, didapat {len(volcs)}"
    assert VolcanoRepository.count_all() == 70

    # Test get_by_id
    merapi = VolcanoRepository.get_by_id("merapi") or VolcanoRepository.get_by_id("lewotobi_laki_laki")
    assert merapi is not None
    assert "name" in merapi
    assert "elevation_m" in merapi


def test_forest_repository_and_boundaries():
    """Memverifikasi 36 kawasan hutan dan poligon batas riil tersedia di database."""
    forests = ForestRepository.get_all()
    assert len(forests) >= 36, f"Harus ada minimal 36 hutan di database, didapat {len(forests)}"

    boundaries = ForestRepository.get_all_boundaries_geojson()
    assert boundaries["type"] == "FeatureCollection"
    assert len(boundaries["features"]) > 0


def test_osm_facilities_bbox_from_tile_cache():
    """
    Fasilitas berasal dari cache tile OpenStreetMap (bukan tabel sintetis) dan kueri bbox
    pada tile yang sudah tersimpan berjalan cepat.
    """
    from app.ingest.overpass import OverpassIngest

    OverpassIngest.get_facilities_with_coverage(-7.0, -6.5, 106.0, 107.0)  # pemanasan cache memori
    t0 = time.perf_counter()
    facs, missing = OverpassIngest.get_facilities_with_coverage(-7.5, -6.0, 105.0, 108.5)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    if missing and not facs:
        pytest.skip("Tile OSM Jawa Barat belum terunduh")
    assert all(f["facility_id"].startswith("osm_") for f in facs if f["facility_type"] != "airport")
    assert elapsed_ms < 500.0, f"Kueri cache tile harus < 500 ms, didapat {elapsed_ms:.2f} ms"


def test_facilities_endpoint_lod_and_zoom():
    """Memverifikasi endpoint /layers/facilities mendukung zoom LOD dan limit."""
    # 1. Zoom jauh (skala nasional) -> Hanya bandara dan RS
    res_zoom_low = client.get("/layers/facilities?bbox=106.0,-7.0,108.0,-6.0&zoom=6&limit=100")
    assert res_zoom_low.status_code == 200
    data_low = res_zoom_low.json()
    types_low = {f["properties"]["facility_type"] for f in data_low["features"]}
    assert "school" not in types_low, "Pada zoom rendah (skala nasional) sekolah disembunyikan agar peta tidak penuh"

    # 2. Zoom dekat (skala lokal) -> Sekolah muncul
    res_zoom_high = client.get("/layers/facilities?bbox=106.0,-7.0,108.0,-6.0&zoom=12&limit=100")
    assert res_zoom_high.status_code == 200
    data_high = res_zoom_high.json()
    types_high = {f["properties"]["facility_type"] for f in data_high["features"]}
    assert "school" in types_high, "Pada zoom tinggi sekolah harus muncul"


def test_firms_live_national_query():
    """Titik api nasional berasal dari cache FIRMS near-real-time dengan waktu akuisisi 24 jam terakhir."""
    from app.services import firms_live

    hotspots = firms_live.query(24.0)
    if not firms_live.status()["available"]:
        pytest.skip("FIRMS belum tersedia (tanpa jaringan dan tanpa snapshot)")
    assert len(hotspots) > 0
    h = hotspots[0]
    assert {"latitude", "longitude", "frp", "confidence", "acq_datetime_utc", "sensor"} <= set(h)

