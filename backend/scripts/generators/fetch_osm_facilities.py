"""
scripts/generators/fetch_osm_facilities.py

Prefetch fasilitas publik nyata (OSM) untuk seluruh tile 1x1 derajat berpenduduk di Indonesia.
Tile dipilih dari raster WorldPop (populasi > 0), diurutkan dari yang terpadat.
Tile yang sudah ada di cache dan belum kedaluwarsa dilewati, jadi aman dijalankan ulang.

    python scripts/generators/fetch_osm_facilities.py
"""

import math
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")

import numpy as np  # noqa: E402
import rasterio  # noqa: E402

from app.ingest.population import WORLDPOP_FILE  # noqa: E402
from app.services import osm_facilities as osm  # noqa: E402


def populated_tiles(min_pop: float = 2000.0):
    with rasterio.open(WORLDPOP_FILE) as src:
        arr = src.read(1)
        arr = np.where(arr == src.nodata, 0.0, arr)
        t = src.transform
    rows, cols = np.nonzero(arr > 0)
    lats = t.f + (rows + 0.5) * t.e
    lons = t.c + (cols + 0.5) * t.a
    keys = {}
    for la, lo, p in zip(np.floor(lats).astype(int), np.floor(lons).astype(int), arr[rows, cols]):
        keys[(int(la), int(lo))] = keys.get((int(la), int(lo)), 0.0) + float(p)
    return sorted((k for k, v in keys.items() if v >= min_pop), key=lambda k: -keys[k])


def priority_tiles():
    """Tile di sekitar (radius 1 tile) gunung api dan kawasan hutan katalog: wilayah yang paling sering disimulasikan."""
    import json

    from app.core.config import BACKEND_DIR
    from app.db.repositories.volcano_repo import VolcanoRepository
    pts = [(v["latitude"], v["longitude"]) for v in VolcanoRepository.get_all()]
    forests = json.loads((BACKEND_DIR / "data/layers/forests_indonesia.json").read_text(encoding="utf-8-sig"))
    pts += [(f["lat"], f["lon"]) for f in forests]
    out = []
    for la, lo in pts:
        for di in (0, -1, 1):
            for dj in (0, -1, 1):
                t = (math.floor(la) + di, math.floor(lo) + dj)
                if t not in out:
                    out.append(t)
    return out


def main():
    pop = populated_tiles()
    pri = [t for t in priority_tiles() if t in set(pop)]
    tiles = pri + [t for t in pop if t not in set(pri)]
    print(f"{len(pri)} tile prioritas (sekitar gunung/hutan katalog)", flush=True)
    print(f"{len(tiles)} tile berpenduduk", flush=True)
    osm.airports(refresh=not osm.AIRPORTS_FILE.exists())
    print(f"bandara: {len(osm.airports())}", flush=True)
    done = 0
    for i, t in enumerate(tiles, 1):
        p = osm._tile_path(t)
        if p.exists() and time.time() - p.stat().st_mtime < osm.TILE_MAX_AGE_S:
            done += 1
            continue
        for attempt in range(4):
            try:
                recs = osm.fetch_tile(t)
                done += 1
                print(f"[{i}/{len(tiles)}] tile {t}: {len(recs)} fasilitas", flush=True)
                break
            except Exception as e:  # noqa: BLE001
                wait = 15 * (attempt + 1)
                print(f"[{i}/{len(tiles)}] tile {t} gagal ({e}); coba lagi {wait}s", flush=True)
                time.sleep(wait)
        time.sleep(2)
    print(f"selesai: {done}/{len(tiles)} tile tersedia", flush=True)


if __name__ == "__main__":
    main()
