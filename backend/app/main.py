"""
app/main.py

Aplikasi utama FastAPI untuk Backend UdaraSiaga.
Menyediakan endpoint REST API, dokumentasi OpenAPI (/docs), dan frontend dummy (/dummy).
"""


import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.api import advice, attributions, events, health, lapis2, lapis3, layers, map_modes, simulate
from app.core.config import BACKEND_DIR, settings
from app.core.ratelimit import RateLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inisialisasi otomatis skema database saat startup
    try:
        from app.db.repositories.volcano_repo import VolcanoRepository
        from app.db.schema import init_db_schema
        from app.db.session import get_db_connection

        conn = get_db_connection()
        init_db_schema(conn)
        conn.close()

        if VolcanoRepository.count_all() == 0:
            from scripts.db.seed_database import seed_all
            seed_all()
    except Exception as e:
        print(f"Warning: Database auto-init error: {e}")

    # Sumber data langsung: FIRMS (thread latar) dan status MAGMA
    import threading

    from app.services import firms_live, magma_status
    firms_live.start_background_refresh()
    threading.Thread(target=magma_status.refresh_levels, daemon=True).start()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS: daftar asal dari ALLOWED_ORIGINS (dipisah koma). Tanpa variabel itu hanya localhost dan
# alamat jaringan lokal (pengembangan, uji di HP satu jaringan) yang diizinkan.
_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=None if _origins else r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

# Registrasi Router
app.include_router(health.router)
app.include_router(advice.router)
app.include_router(events.router)
app.include_router(simulate.router)
app.include_router(lapis2.router)
app.include_router(lapis3.router)
app.include_router(map_modes.router)
app.include_router(layers.router)
app.include_router(attributions.router)

# Mount frontend dummy jika foldernya ada
frontend_dummy_dir = BACKEND_DIR / "frontend-dummy"
if frontend_dummy_dir.exists():
    app.mount("/dummy", StaticFiles(directory=str(frontend_dummy_dir), html=True), name="dummy")



FAVICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0f172a"/>
  <polygon points="16,4 4,28 28,28" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5"/>
  <circle cx="16" cy="18" r="3.5" fill="#ef4444"/>
</svg>"""


@app.get("/favicon.ico", include_in_schema=False)
def get_favicon():
    return Response(content=FAVICON_SVG, media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "version": settings.VERSION,
        "docs": "/docs",
        "frontend_dummy": "/dummy",
        "disclaimer": settings.DISCLAIMER,
    }


# Produksi: sajikan hasil build frontend (landing, /app/, /loader/) dari origin yang sama dengan API.
# Lokasi diambil dari FRONTEND_DIST atau ../frontend/dist; harus dipasang paling akhir agar rute API menang.
_dist = Path(os.getenv("FRONTEND_DIST", str(BACKEND_DIR.parent / "frontend" / "dist")))
if (_dist / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="frontend")
else:
    @app.get("/")
    def root_info():
        return root()
