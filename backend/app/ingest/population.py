"""
app/ingest/population.py

Modul ingest populasi (D18 - WorldPop 2020, 1 km, UN-adjusted, Indonesia).
Raster asli dijumlahkan ke sel grid simulasi sehingga total jiwa per sel
berasal dari data WorldPop, bukan dari angka acak.

Proporsi anak (<15 th) dan lansia (>=65 th) memakai rasio nasional dari
config/assumptions.yaml (population_age_fractions); WorldPop 1 km tidak memuat struktur umur.
"""

from typing import Dict

import numpy as np

from app.core.config import DATA_DIR, get_assumptions

WORLDPOP_FILE = DATA_DIR / "layers" / "worldpop" / "idn_ppp_2020_1km_Aggregated_UNadj.tif"
WORLDPOP_URL = (
    "https://data.worldpop.org/GIS/Population/Global_2000_2020_1km_UNadj/2020/IDN/idn_ppp_2020_1km_Aggregated_UNadj.tif"
)
SOURCE = "WorldPop 2020 1 km UN-adjusted (CC BY 4.0), doi:10.5258/SOTON/WP00671"


def _age_fractions() -> tuple[float, float]:
    item = get_assumptions().get("population_age_fractions", {})
    val = item.get("value", {}) if isinstance(item, dict) else {}
    return float(val.get("children_under_15", 0.24)), float(val.get("elderly_65_plus", 0.065))


def _download_worldpop() -> None:
    """Unduh raster WorldPop Indonesia (~11 MB) sekali bila belum ada."""
    from app.core.offline import is_offline
    if is_offline():
        return
    import httpx
    WORLDPOP_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = WORLDPOP_FILE.with_suffix(".part")
    try:
        with httpx.stream("GET", WORLDPOP_URL, timeout=120.0, follow_redirects=True) as r:
            r.raise_for_status()
            with open(tmp, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
        tmp.replace(WORLDPOP_FILE)
    except Exception:
        tmp.unlink(missing_ok=True)


class PopulationIngest:
    _cache: Dict[tuple, Dict[str, np.ndarray]] = {}

    @staticmethod
    def get_population_grid(
        lat_min: float,
        lat_max: float,
        lon_min: float,
        lon_max: float,
        res_deg: float = 0.02,
        shape: tuple[int, int] | None = None
    ) -> Dict[str, np.ndarray]:
        """
        Total jiwa per sel grid simulasi (sel berpusat di lat_min + i*res_deg),
        dijumlahkan dari piksel WorldPop yang pusatnya jatuh di sel tersebut.
        """
        if shape is not None:
            n_lat, n_lon = shape
        else:
            n_lat = int(np.ceil((lat_max - lat_min) / res_deg)) + 1
            n_lon = int(np.ceil((lon_max - lon_min) / res_deg)) + 1

        key = (round(lat_min, 4), round(lat_max, 4), round(lon_min, 4), round(lon_max, 4), round(res_deg, 5), n_lat, n_lon)
        if key in PopulationIngest._cache:
            return PopulationIngest._cache[key]

        total = np.zeros((n_lat, n_lon), dtype=float)
        if not WORLDPOP_FILE.exists():
            _download_worldpop()
        if not WORLDPOP_FILE.exists():
            raise FileNotFoundError(
                f"Raster WorldPop tidak ditemukan di {WORLDPOP_FILE}. Unduh idn_ppp_2020_1km_Aggregated_UNadj.tif "
                "dari data.worldpop.org."
            )

        import rasterio
        from rasterio.windows import from_bounds

        half = res_deg / 2.0
        with rasterio.open(WORLDPOP_FILE) as src:
            win = from_bounds(lon_min - half, lat_min - half, lon_max + half, lat_max + half, transform=src.transform)
            win = win.round_offsets().round_lengths()
            arr = src.read(1, window=win, boundless=True, fill_value=0.0)
            t = src.window_transform(win)
            nodata = src.nodata
        if nodata is not None:
            arr = np.where(arr == nodata, 0.0, arr)
        arr = np.where(np.isfinite(arr) & (arr > 0), arr, 0.0)

        rows, cols = np.nonzero(arr)
        if rows.size:
            px_lat = t.f + (rows + 0.5) * t.e
            px_lon = t.c + (cols + 0.5) * t.a
            gi = np.round((px_lat - lat_min) / res_deg).astype(int)
            gj = np.round((px_lon - lon_min) / res_deg).astype(int)
            ok = (gi >= 0) & (gi < n_lat) & (gj >= 0) & (gj < n_lon)
            np.add.at(total, (gi[ok], gj[ok]), arr[rows[ok], cols[ok]])

        child_f, elder_f = _age_fractions()
        result = {
            "total": total,
            "children": total * child_f,
            "elderly": total * elder_f,
            "lat": np.linspace(lat_min, lat_max, n_lat),
            "lon": np.linspace(lon_min, lon_max, n_lon),
            "shape": (n_lat, n_lon),
            "source": SOURCE,
        }
        if len(PopulationIngest._cache) > 8:
            PopulationIngest._cache.clear()
        PopulationIngest._cache[key] = result
        return result
