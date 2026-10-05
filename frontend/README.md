# 🌋 UdaraSiaga Indonesia — Frontend (React + TypeScript + Vite)

Platform Komando Pemodelan Dispersi Atmosfer Erupsi Vulkanik & Karhutla untuk **JOINTS UGM 2026 Hackathon**.

---

## 🚀 Panduan Memulai Cepat (Quickstart)

### 1. Menjalankan Development Server Frontend
Masuk ke folder `frontend` lalu jalankan dev server:
```bash
cd frontend
npm run dev
```
Aplikasi akan aktif di **http://localhost:5173**.

### 2. Membangun Bundle Produksi (Build & Type-Check)
```bash
npm run build
```
Menjalankan `tsc -b` (pemeriksaan tipe data TypeScript) dan `vite build` untuk menghasilkan bundle teroptimasi di folder `dist/`.

---

## 🏗️ Arsitektur Spasial: 4-Zone Command Canvas

Frontend dibangun mengikuti **Grand Design UdaraSiaga Indonesia** dengan pemisahan 4 zona kanvas:

```text
+-----------------------------------------------------------------------------------+
| ZONA A: TACTICAL COMMAND HEADER (Brand, Live Telemetry KPI, WIB & UTC, Live Sync) |
+-----------------------------------------------------------------------------------+
| STRIP: [PROTOKOL RESMI] SISTEM PERINGATAN DINI & AKSI PENCEGAHAN BENCANA          |
+-------------------+-------------------------------------------+-------------------+
| ZONA B:           | ZONA C: INTERACTIVE GIS WORKSPACE         | ZONA D:           |
| FLOATING DOCK     |                                           | TABBED INSPECTION |
| (Kontrol Bahaya,  | - Peta Leaflet Dark Basemap               | DOCK (Laci Kanan) |
|  20 Gunung Api,   | - Poligon Dispersi 3 Tingkat (P90/P50/P5) |                   |
|  Mode Coba-coba,  | - Titik Hotspot NASA & Fasilitas Publik   | [Tab 1: Dampak]   |
|  Tombol Eksekusi) |                                           | [Tab 2: Sekolah]  |
|                   | +---------------------------------------+ | [Tab 3: Evakuasi] |
|                   | | TIMELINE PLAYER (T+0 s.d. T+48 Jam)   | | [Tab 4: Edukasi]  |
| (Dapat Diciutkan) | +---------------------------------------+ | [Tab 5: Audit]    |
+-------------------+-------------------------------------------+-------------------+
```

---

## 📁 Struktur Kode Proyek

```text
frontend/
├── src/
│   ├── types/
│   │   ├── api.ts              # Interface kontrak REST API FastAPI
│   │   └── geo.ts              # Interface spasial GeoJSON
│   ├── config/
│   │   └── constants.ts        # URL backend, warna tier P90/P50/P5, level PVMBG
│   ├── services/
│   │   └── api.ts              # Klien REST API terenkapsulasi & type-safe
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TacticalHeader.tsx    # Zona A: Header, live sync, jam ganda
│   │   │   ├── ActionStrip.tsx       # Banner peringatan aksi cepat
│   │   │   ├── ControllerDock.tsx    # Zona B: Pusat kendali parameter simulasi
│   │   │   ├── MapWorkspace.tsx      # Zona C: Peta Leaflet, poligon, rute
│   │   │   ├── TimelinePlayer.tsx    # Zona C: Timeline slider 0-48 jam
│   │   │   └── AnalyticsDrawer.tsx   # Zona D: Laci samping 5 tab
│   │   └── tabs/
│   │       ├── TabImpact.tsx         # Tab 1: Dampak populasi P5-P50-P95, sawah, lahar
│   │       ├── TabSchools.tsx        # Tab 2: Triase sekolah PJJ daring & rute evakuasi
│   │       ├── TabEvac.tsx           # Tab 3: Rujukan medis, klasifikasi RS bebas abu
│   │       ├── TabHealth.tsx         # Tab 4: Edukasi respirator N95 & bahaya softlens
│   │       └── TabScience.tsx        # Tab 5: Validasi FSS & transparansi asumsi sains
│   ├── utils/
│   │   └── formatters.ts       # Format angka locale ID, jam T+XX, rentang
│   ├── App.tsx                 # Root layout container
│   ├── main.tsx                # Entry point React
│   └── index.css               # Tailwind CSS v4 & custom dark tactical theme
├── vite.config.ts              # Konfigurasi Vite + React + Tailwind v4
└── package.json
```

---

## 🔗 Integrasi dengan Backend FastAPI

Backend dijalankan secara terpisah pada port 8000:
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
Frontend telah dikonfigurasi untuk langsung berkomunikasi dengan `http://127.0.0.1:8000`.
