"""Konfigurasi pytest: pembatas laju dimatikan agar test bisa memanggil endpoint berulang."""

import os

os.environ.setdefault("RATE_LIMIT_SIMULATE", "0")
os.environ.setdefault("RATE_LIMIT_AI", "0")
os.environ.setdefault("RATE_LIMIT_SYNC", "0")


import pytest


def _online() -> bool:
    if os.getenv("UDARASIAGA_OFFLINE") == "1":
        return False
    try:
        import httpx
        httpx.get("https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&hourly=temperature_2m&forecast_days=1", timeout=5)
        return True
    except Exception:
        return False


def pytest_configure(config):
    config.addinivalue_line("markers", "network: test yang membutuhkan sumber data langsung (internet)")


def pytest_collection_modifyitems(config, items):
    if _online():
        return
    skip = pytest.mark.skip(reason="Tanpa koneksi ke sumber data langsung")
    for item in items:
        if "network" in item.keywords:
            item.add_marker(skip)
