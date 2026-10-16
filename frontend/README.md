# HELALOKA Frontend

Landing page, loader 3D, dan aplikasi simulasi HELALOKA. Dibangun dengan React 19, TypeScript, Vite, Tailwind CSS v4, dan Leaflet.

## Menjalankan

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (landing) dan http://localhost:5173/app/ (aplikasi)
```

Aplikasi membutuhkan backend di `http://127.0.0.1:8000` (lihat [../backend/README.md](../backend/README.md)). Untuk backend di domain lain, isi `VITE_API_BASE` di `.env` (contoh di `.env.example`).

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Server pengembangan Vite |
| `npm run build` | Pemeriksaan tipe (`tsc -b`) lalu build produksi ke `dist/` |
| `npm run lint` | Lint dengan oxlint |
| `npm run preview` | Menyajikan hasil build |

## Tiga halaman

Vite membangun tiga titik masuk (lihat `vite.config.ts`):

| Halaman | Berkas | Isi |
| :--- | :--- | :--- |
| `/` | `index.html` dan `public/landing/` | Landing page statis dengan scene 3D Three.js. Lihat [docs/LANDING.md](docs/LANDING.md). |
| `/app/` | `app/index.html` dan `src/` | Aplikasi simulasi React. Loader sungai disisipkan otomatis di antara penanda `<!--LOADER:BEGIN-->` dan `<!--LOADER:END-->`. |
| `/loader/` | `loader/index.html` | Demo mandiri loader 3D. Sumbernya di `loader/src/`, dibangun dengan `node loader/build.mjs` (lihat `loader/README.txt`). |

Jangan mengedit `public/loader/river-loader.*` atau bagian loader di `app/index.html` secara langsung. Ubah `loader/src/`, lalu jalankan `node loader/build.mjs`.

## Tata letak aplikasi

| Area | Komponen | Isi |
| :--- | :--- | :--- |
| Header | `TacticalHeader.tsx` | Merek, gunung Siaga/Awas, titik api 24 jam, jam WIB/UTC, Legenda, AI GPS, Proyeksi |
| Pusat Kendali | `ControllerDock.tsx` | Jenis bencana, lokasi, mode Kondisi Nyata atau Uji Skenario, Mulai Simulasi, Cetak Ringkasan |
| Peta | `MapWorkspace.tsx`, `NationalModes.tsx`, `TimelinePlayer.tsx`, `MapReadouts.tsx` | Peta satelit atau kertas taktis, lapisan spasial, mode nasional (Histori, Saat ini, Prediksi), horizon waktu H+0 sampai H+48 |
| Proyeksi | `AnalyticsDrawer.tsx` | Tab Wilayah (`TabImpact.tsx`), Fasilitas (`TabFacilities.tsx`), Protokol & AI (`TabProtocolAI.tsx`) |
| Modal | `GpsAdvisoryModal.tsx`, `PrintReportModal.tsx`, `LegendModal.tsx` | AI GPS warga, pratinjau cetak A4 dua halaman, legenda |

## Struktur kode

```text
frontend/
├── index.html                 Landing page
├── app/index.html             Halaman aplikasi (/app/)
├── loader/                    Sumber dan skrip build loader 3D
├── public/
│   ├── landing/               CSS, JS, gambar, dan vendor (Three.js, Lenis) untuk landing
│   ├── loader/                Hasil build loader (jangan diedit)
│   └── *.png                  Logo dan ikon peta
├── docs/
│   └── LANDING.md             Dokumentasi landing page
└── src/
    ├── App.tsx                State utama, alur simulasi, tata letak
    ├── main.tsx               Titik masuk React
    ├── index.css              Token desain dan gaya global
    ├── components/
    │   ├── layout/            Header, Pusat Kendali, peta, horizon waktu, laci Proyeksi, modal
    │   ├── tabs/              Isi tab Proyeksi
    │   └── ui/                Komponen kecil (akordeon, kompas, bingkai sulur)
    ├── config/constants.ts    Alamat API dan konstanta tampilan
    ├── services/api.ts        Klien REST API bertipe
    ├── simulation/            Lapisan peta panas dan partikel angin
    ├── types/                 Tipe kontrak API dan GeoJSON
    └── utils/                 Format angka, progres muat, pemantau lokasi
```

## Aturan tampilan data

- Angka dampak ditampilkan sebagai rentang P5 / P50 / P95.
- Ambang fasilitas sama dengan backend: peluang ≥ 90% pertimbangkan PJJ daring, ≥ 50% batasi kegiatan luar ruang, dan rumah sakit dengan peluang < 10% dianggap di luar jalur paparan.
- Data yang tidak tersedia disembunyikan, tidak diganti angka contoh.
- Hasil mode Uji Skenario selalu diberi label skenario hipotetis.
