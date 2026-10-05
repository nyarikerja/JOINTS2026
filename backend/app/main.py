"""
app/main.py

Aplikasi utama FastAPI untuk Backend UdaraSiaga.
Menyediakan endpoint REST API, dokumentasi OpenAPI (/docs), dan frontend dummy (/dummy).
"""


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import attributions, events, health, lapis2, lapis3, layers, simulate
from app.core.config import BACKEND_DIR, settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS: localhost dan wildcard untuk mendukung pembukaan frontend dari file://
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrasi Router
app.include_router(health.router)
app.include_router(events.router)
app.include_router(simulate.router)
app.include_router(lapis2.router)
app.include_router(lapis3.router)
app.include_router(layers.router)
app.include_router(attributions.router)

# Mount frontend dummy jika foldernya ada
frontend_dummy_dir = BACKEND_DIR / "frontend-dummy"
if frontend_dummy_dir.exists():
    app.mount("/dummy", StaticFiles(directory=str(frontend_dummy_dir), html=True), name="dummy")


@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "version": settings.VERSION,
        "docs": "/docs",
        "frontend_dummy": "/dummy",
        "disclaimer": settings.DISCLAIMER,
    }
