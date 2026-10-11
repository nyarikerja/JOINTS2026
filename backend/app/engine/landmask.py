"""
app/engine/landmask.py

Modul penentuan daratan vs lautan (Land/Sea Mask) berbasis data garis pantai
resmi Indonesia (data/layers/indonesia_coastline.geojson).
Mencegah estimasi populasi, lahan sawah, dan fasilitas fiktif di tengah lautan/selat.
"""

import json
from typing import Optional

import numpy as np
import shapely
from shapely.geometry import Polygon
from shapely.ops import unary_union

from app.core.config import BACKEND_DIR


class LandMask:
    _unified_land: Optional[shapely.Geometry] = None

    @classmethod
    def _init_land_geometry(cls):
        if cls._unified_land is not None:
            return

        coastline_file = BACKEND_DIR / "data" / "layers" / "indonesia_coastline.geojson"
        if not coastline_file.exists():
            return

        with open(coastline_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        polygons = []
        for feat in data.get("features", []):
            coords = feat.get("geometry", {}).get("coordinates", [])
            if not coords:
                continue
            # Pastikan poligon tertutup
            if coords[0] != coords[-1]:
                coords = list(coords) + [coords[0]]
            poly = Polygon(coords)
            if not poly.is_valid:
                poly = poly.buffer(0)
            polygons.append(poly)

        if polygons:
            cls._unified_land = unary_union(polygons)

    @classmethod
    def island_ids(cls, lats, lons, tolerance_deg: float = 0.05) -> np.ndarray:
        """
        Indeks pulau (poligon daratan) untuk tiap titik; -1 bila tidak ditemukan.
        Titik pesisir di luar poligon kasar diberi pulau terdekat dalam `tolerance_deg`.
        """
        cls._init_land_geometry()
        lats = np.atleast_1d(np.asarray(lats, dtype=float))
        lons = np.atleast_1d(np.asarray(lons, dtype=float))
        out = np.full(lats.shape, -1, dtype=int)
        if cls._unified_land is None or lats.size == 0:
            return out
        if not hasattr(cls, "_islands"):
            geoms = list(getattr(cls._unified_land, "geoms", [cls._unified_land]))
            cls._islands = geoms
            cls._island_tree = shapely.STRtree(geoms)
        pts = shapely.points(lons, lats)
        idx_pt, idx_geom = cls._island_tree.query(pts, predicate="within")
        out[idx_pt] = idx_geom
        missing = np.nonzero(out < 0)[0]
        if missing.size:
            near_pt, near_geom = cls._island_tree.query_nearest(pts[missing], max_distance=tolerance_deg, all_matches=False)
            out[missing[near_pt]] = near_geom
        return out

    @classmethod
    def is_point_on_land(cls, lat: float, lon: float) -> bool:
        """Mengecek apakah suatu koordinat (lat, lon) berada di daratan kepulauan Indonesia."""
        cls._init_land_geometry()
        if cls._unified_land is None:
            return True  # Fallback toleran jika file layer tidak ditemukan
        return bool(shapely.contains_xy(cls._unified_land, lon, lat))

    @classmethod
    def get_mask(cls, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
        """
        Menghasilkan mask 2D boolean berukuran (len(lats), len(lons))
        True jika sel berada di daratan, False jika berada di laut/selat lepas.
        """
        cls._init_land_geometry()
        n_lat = len(lats)
        n_lon = len(lons)

        if cls._unified_land is None:
            return np.ones((n_lat, n_lon), dtype=bool)

        lon_mesh, lat_mesh = np.meshgrid(lons, lats)
        mask = shapely.contains_xy(cls._unified_land, lon_mesh, lat_mesh)
        return np.asarray(mask, dtype=bool)
