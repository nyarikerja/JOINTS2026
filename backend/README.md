# UdaraSiaga: Backend Simulator Sebaran Abu Vulkanik & Asap Karhutla

Simulator sebaran abu gunung meletus dan asap kebakaran hutan untuk Hackathon JOINTS UGM 2026.

> **PENTING / DISCLAIMER:**
> Aplikasi ini adalah simulasi ilmiah untuk membantu warga, sekolah, dan pemangku kebijakan dalam **kesiapsiagaan dan pembelajaran**. Aplikasi ini **BUKAN PERINGATAN RESMI**. Untuk keputusan nyata dan mitigasi bencana, selalu rujuk informasi resmi dari **PVMBG**, **BMKG**, dan **BPBD**.

---

## Menjalankan Backend dengan Satu Perintah

```bash
# Jalankan server backend (FastAPI + Uvicorn)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Dokumentasi API interaktif**: Buka [http://localhost:8000/docs](http://localhost:8000/docs)
- **Frontend Dummy UI**: Buka [http://localhost:8000/dummy](http://localhost:8000/dummy) (atau buka file `frontend-dummy/index.html` langsung di peramban).

---

## Menjalankan Pengujian & Linter

```bash
# Jalankan seluruh rangkaian tes otomatis
pytest

# Jalankan ruff linter
ruff check .
```

---

## Struktur Folder Proyek

```
backend/
  AGENTS.md              # Aturan kerja utama & prinsip data integrity
  app/
    api/                 # Endpoint REST API (health, events, simulate, layers, attributions)
    core/                # Konfigurasi, offline guard, RNG deterministik
    engine/              # Mesin partikel Lagrangian, adveksi RK2, scavenging, agregasi
    impact/              # Estimasi dampak penduduk & faskes dalam rentang {min, median, max}
    ingest/              # Ingest Open-Meteo, FIRMS, WorldPop, OSM
    schemas/             # Validasi Pydantic v2
  config/
    assumptions.yaml     # Transparansi asumsi ilmiah & status verifikasi
    hazards.yaml         # Parameter fisik bahaya gunung & kebakaran
  data/
    events/              # Kejadian siap pakai (Anak Krakatau 2026-09, Live Kalimantan)
    runs/                # Riwayat run simulasi
  docs/
    SOURCES.md           # Laporan verifikasi sumber nyata
    SPEC.md              # Spesifikasi teknis v3
  frontend-dummy/        # Antarmuka GIS pengujian offline (Leaflet lokal)
  scripts/               # check_sources.py, snapshot_ensemble.py, download_firms.py
  tests/                 # Pengujian unit, skema, dan fisika simulasi
```
