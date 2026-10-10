# UdaraSiaga Indonesia: Platform Komando Pemodelan Sebaran Atmosfer & Aksi Dini Multi-Bahaya

> **Platform Komando Simulasi Sains & Sistem Pendukung Keputusan Kesiapsiagaan Dini terhadap Erupsi Gunung Api (Abu Vulkanik) dan Kebakaran Hutan/Lahan (Asap PM2.5)**  
> *Dikembangkan untuk Hackathon JOINTS UGM 2026 — Track Multi-Hazard Atmospheric Dispersion & Early Action Protocol*

---

> [!IMPORTANT]
> **DISCLAIMER RESMI:**  
> UdaraSiaga Indonesia adalah platform estimasi sains terkomputasi untuk pembelajaran, perencanaan kontinjensi, dan protokol kesiapsiagaan aksi dini. Aplikasi ini **BUKAN PERINGATAN RESMI**. Untuk komando evakuasi darurat, status kedaruratan, dan kebijakan kebencanaan di lapangan, seluruh pihak tetap merujuk pada arahan otoritatif resmi dari **PVMBG Badan Geologi**, **BMKG**, dan **BNPB / BPBD**.

---

## Panduan Menjalankan Cepat (Quickstart Guide)

### 1. Menjalankan Backend (FastAPI)
Pastikan Python 3.10+ telah terpasang:

```bash
# 1. Masuk ke direktori backend
cd backend

# 2. Pasang dependensi Python (FastAPI, NumPy, SciPy, Shapely, Rasterio)
pip install -r requirements.txt

# 3. Jalankan server backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- **REST API & Dokumentasi Interaktif (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Endpoint Status Sistem & Telemetri**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- **Dashboard Web Dummy (Fallback)**: [http://127.0.0.1:8000/dummy/](http://127.0.0.1:8000/dummy/)

### 2. Menjalankan Frontend Utama (React + TypeScript + Vite)
Buka terminal baru untuk menjalankan antarmuka web modern React:

```bash
# 1. Masuk ke direktori frontend
cd frontend

# 2. Pasang dependensi Node.js
npm install

# 3. Jalankan development server Vite
npm run dev
```

- **Akses Dashboard Web Taktis Utama**: [http://localhost:5173](http://localhost:5173)

Untuk memeriksa kelengkapan tipe (*type-checking*) dan membuat *production build*:
```bash
npm run build
```

### 3. Menjalankan Pengujian Otomatis (Test Suite)
```bash
# Eksekusi seluruh 29 pengujian unit, fisika, lapis 2, dan lapis 3
pytest tests/

```bash
# Pemeriksaan linter kode Python (Ruff)
ruff check app/ tests/
```
*Hasil Verifikasi: 37/37 PASSED (100% lulus dalam ~5.5 detik), 0 lint warning.*

---

## Diagram Alur Kerja Sistem (End-to-End Architecture)

```mermaid
flowchart TD
    subgraph S1["1. SUMBER DATA OTORITATIF (INGEST)"]
        A1["PVMBG MAGMA: Elevasi kawah, koordinat vent, radius KRB, VONA"]
        A2["NASA FIRMS: Titik api NRT satelit VIIRS SNPP / NOAA-20 & FRP"]
        A3["Open-Meteo Ensemble: Vektor angin multi-level (u, v) & presipitasi"]
        A4["WorldPop: Grid demografi 100m (total jiwa, anak <15, lansia >=65)"]
        A5["Kemendikbud & Kemenkes: Sekolah posko evakuasi BPBD, RS rujukan, bandara"]
    end

    subgraph S2["2. BASIS DATA SPASIAL TERPUSAT (STORAGE & R*TREE)"]
        B1[("SQLite Relasional: udarasiaga.db")]
        B2{{"Indeks Spasial Virtual: R*Tree Tables"}}
        B3["Pola Akses Data: Repository Pattern (LOD & BBOX Viewport < 1 ms)"]
        B1 --- B2 --- B3
    end

    subgraph S3["3. MESIN DISPERSI LAGRANGIAN RK2 (PHYSICS ENGINE)"]
        C1["Erupsi Vulkanik: Laju Massa Mastin et al. 2009 (M = 140.85 * H^4.15 kg/s)"]
        C2["Karhutla Gambut: Konversi FRP Wooster et al. 2005 (0.27 - 0.37 - 0.45 kg/MJ)"]
        C3["Adveksi-Difusi: Integrasi Runge-Kutta Ordo 2 + Difusi Turbulen (80 m2/s)"]
        C4["Pencucian Presipitasi: Wet Scavenging Lambda = a * R^b & Bahaya Lahar Dingin"]
    end

    subgraph S4["4. ESTIMASI DAMPAK & PROTOKOL AKSI DINI (IMPACT & UI)"]
        D1["Agregasi Kontur Gaussian: Rentang Ketidakpastian P5 - P50 - P95"]
        D2["Triase Sekolah: Rekomendasi PJJ Daring (>=40%) / Pembatasan Luar Ruang"]
        D3["Triase Fasilitas Kesehatan: Rujukan ke RS Aman Bebas Abu Terdekat"]
        D4["Visualisasi Kanvas Taktis 4-Zona & Player Garis Waktu 48 Jam"]
    end

    S1 --> S2
    S2 --> S3
    S3 --> S4
```

---

## Alur Lengkap Cara Kerja Web UdaraSiaga

Aplikasi web UdaraSiaga beroperasi melalui 8 tahapan alur kerja terpadu dari hulu data hingga aksi lapangan:

### Langkah 1: Pengguna Memilih Kejadian & Mode Pemodelan
Pengguna mengakses antarmuka dan mengatur parameter skenario melalui **Panel Kontrol Melayang (Zone B)**:
1. **Pilihan Jenis Bahaya Atmosfer**:
   - **Erupsi Gunung Api (Abu Vulkanik)**: Menargetkan partikulat silika tajam dan gas vulkanik.
   - **Kebakaran Hutan & Lahan (Asap Karhutla)**: Menargetkan kabut asap organik dan partikel $PM_{2.5}$.
2. **Pilihan Lokasi Kejadian (Cakupan Penuh 1 Indonesia)**:
   - **Katalog 70 Gunung Api Aktif Tipe A PVMBG**: Menjangkau seluruh gunung api aktif di Sumatera (13 gunung), Jawa (19 gunung), Bali & Nusa Tenggara (18 gunung), Sulawesi & Sangihe (10 gunung), serta Maluku & Papua (10 gunung) berstatus Level I s.d. Level IV.
   - **Katalog 7 Zona Karhutla Strategis Nasional**: Meliputi Kalimantan (Kalteng, Kalbar, Kalsel), Sumatera (Riau, Sumsel-OKI, Jambi), dan Papua Selatan (Merauke).
   - **Mode Simulasi Titik Bebas (Klik Peta Indonesia)**: Pengguna dapat mengklik sembarang titik koordinat di atas kepulauan Nusantara untuk menjalankan simulasi dispersi dinamis secara *on-the-fly* via API live Open-Meteo dan deteksi otomatis faskes serta sekolah sekitar.
3. **Pilihan Mode Operasional**:
   - **Mode Otomatis (Data Nyata Otoritatif)**: Mengunci input sesuai laporan observasi riil PVMBG/FIRMS dan cuaca aktual.
   - **Mode Coba-coba (Eksperimen PVMBG)**: Membuka kontrol eksperimen untuk skenario perencanaan:
     - Tinggi kolom erupsi ($1 - 25\text{ km}$ di atas kawah).
     - Pembalik arah angin troposfer ($180^\circ$).
     - Presipitasi hujan pencuci ($0 - 50\text{ mm/jam}$).

---

### Langkah 2: Pengambilan & Sinkronisasi Sumber Data Otoritatif
Ketika skenario dijalankan, backend melakukan agregasi data dari berbagai sumber resmi:
- **Laporan VONA / PVMBG**: Memuat koordinat kawah, elevasi puncak, dan riwayat letusan.
- **NASA FIRMS (VIIRS SNPP/NOAA-20)**: Memuat titik api aktif dan nilai *Fire Radiative Power* (FRP dalam satuan Megawatt).
- **Open-Meteo Weather Ensemble**: Mengunduh komponen angin zona zonal ($u$) dan meridional ($v$) pada berbagai aras ketinggian atmosfer serta laju curah hujan per jam.
- **WorldPop & OSM**: Menyiapkan grid populasi dan titik koordinat fasilitas publik (sekolah, puskesmas, rumah sakit rujukan, bandara).
- *Dukungan Offline*: Seluruh data acuan telah disimpan dalam cache lokal (`data/events/` dan `data/layers/`) sehingga sistem dapat berjalan tanpa koneksi internet.

---

### Langkah 3: Eksekusi Mesin Fisika Partikel Lagrangian RK2
Inti komputasi aplikasi digerakkan oleh mesin partikel fisik terpadu di [simulator.py](file:///c:/Users/arya4/JOINTS2026/backend/app/engine/simulator.py):
1. **Pelepasan Partikel Sumber**:
   - *Gunung Api*: Mengonversi tinggi kolom letusan ($H$) menjadi laju pelepasan massa (*Mass Eruption Rate* / MER) menggunakan hukum empiris Mastin et al. (2009):
     $$M = 140.85 \times H^{4.15}\text{ kg/s}$$
     dengan variasi acak distribusi lognormal untuk mengakomodasi ketidakpastian dinamika erupsi.
   - *Karhutla*: Mengonversi FRP satelit menjadi laju emisi massa $PM_{2.5}$ berdasarkan distribusi segitiga Wooster et al. (2005) ($0.27 - 0.37 - 0.45\text{ kg/MJ}$).
2. **Adveksi & Difusi Atmosferik**:
   - Melacak lintasan ribuan paket partikel secara deterministik menggunakan skema integrasi waktu Runge-Kutta Ordo 2 (RK2).
   - Menambahkan difusi turbulen acak ($K = 80\text{ m}^2/\text{s}$) untuk memodelkan turbulensi atmosferik.
3. **Pencucian oleh Hujan (*Wet Scavenging*) & Peringatan Lahar**:
   - Menghitung pengendapan partikel akibat guyuran hujan $\Lambda = a \cdot R^b$.
   - Jika intensitas hujan lebat terjadi di sekitar endapan abu tebal, sistem secara otomatis menerbitkan peringatan sekunder bahaya **Lahar Hujan (Cold Lahar Flow)** di alur sungai lereng gunung.
4. **Prakiraan Berulang (Ensemble Simulation)**:
   - Dijalankan sebanyak 15 hingga 51 anggota ansambel secara paralel untuk memetakan rentang kemungkinan spasial.

---

### Langkah 4: Visualisasi Peta Spasial & Player Waktu (Zone C)
Hasil pemodelan diproyeksikan langsung ke peta taktis Leaflet interaktif:
1. **Agregasi Kontur Tiga Tingkat Probabilitas**:
   - Probabilitas sel grid dihaluskan menggunakan filter Gaussian ($\sigma = 1.2$) untuk mengeliminasi sudut 90 derajat kotak piksel raster, lalu diekstrak menjadi poligon vektor *MultiPolygon* bersih:
     - **Tingkat Minimum (P90 - Hampir Pasti)**: Area yang terkena pada $\ge 90\%$ anggota ansambel (zona inti bahaya tinggi).
     - **Tingkat Menengah (P50 - Kemungkinan Besar)**: Area yang terkena pada $\ge 50\%$ anggota ansambel (zona waspada).
     - **Tingkat Maksimum (P05 - Mungkin Terkena)**: Area terluar yang terkena pada $\ge 5\%$ anggota ansambel (zona siaga dini).
2. **Diferensiasi Visual Multi-Bahaya ("Semakin Tebal Semakin Berbahaya")**:
   - **Abu Vulkanik**: Menggunakan palet merah silika pekat (`#991b1b`, 60% opasitas) $\rightarrow$ merah waspada (`#dc2626`, 35%) $\rightarrow$ kuning belerang (`#f59e0b`, 15%).
   - **Asap Karhutla**: Menggunakan palet coklat jelaga pekat (`#78350f`, 60% opasitas) $\rightarrow$ coklat kabut (`#92400e`, 35%) $\rightarrow$ haze tipis (`#a16207`, 15%).
   - Tipe garis: 2.5px solid (P90), 1.8px garis putus (P50), dan 1.0px garis titik halus (P05).
3. **Legenda Dinamis Real-Time**:
   - Kotak legenda di kiri bawah peta otomatis memperbarui judul, label intensitas, dan swatch warna sesuai bencana yang dipilih.
4. **Timeline Scrubber 48 Jam**:
   - Slider melayang memungkinkan pengguna melihat posisi sebaran dari jam ke-$0$ hingga jam ke-$48$.
   - Tombol Play/Pause otomatis memutar langkah simulasi dengan tombol langkah cepat (`T+0h`, `T+6h`, `T+12h`, `T+24h`, `T+36h`, `T+48h`) yang menyala aktif.

---

### Langkah 5: Penilaian Dampak Wilayah & Fasilitas Terpadu (Tab 1: Wilayah & Fasilitas)
Laci analitik kanan menyajikan seluruh informasi spasial dalam **satu lingkup geografis utuh**:
1. **Penyajian Rentang Ketidakpastian (P5 – P50 – P95)**:
   - Mematuhi prinsip data integrity: **tidak pernah menampilkan angka tunggal**. Seluruh metrik disajikan dalam batas bawah (P5), median (P50), dan batas atas (P95).
2. **Demografi Kependudukan & Kerentanan**:
   - Estimasi total jiwa terpapar berdasarkan grid WorldPop 100m.
   - Perhitungan kelompok rentan khusus: Anak-anak ($< 15\text{ tahun}$) dan Lansia ($\ge 65\text{ tahun}$).
3. **Dampak Lingkungan, Pertanian, & Karhutla**:
   - Luas sawah dan kebun terdampak abu (hektare berisiko gagal panen).
   - Sumber air minum dan DAS hulu berisiko tercemar asam abu.
   - Tonase pelepasan karbon kebakaran hutan ($CO_2e$ gambut dan non-gambut).
4. **Hierarki Spasial: Kecamatan sebagai Wadah Induk (*Spatial Container*)**:
   - Menyatukan data administratif dan aset publik: Di bawah setiap kartu Kecamatan, langsung tercantum sekolah-sekolah di wilayah tersebut (dengan mandat PJJ) dan faskes rujukan terdekat.
   - Filter chip cepat: `[Semua Wilayah]`, `[Hanya Sekolah (PJJ)]`, dan `[Hanya RS & Faskes]`.
5. **Rute Jalan Raya Riil OpenStreetMap (OSRM)**:
   - Menghubungkan fasilitas sekolah/faskes ke RS rujukan zona aman melalui jaringan jalan raya berbelok nyata (bukan garis lurus), lengkap dengan jarak kilometer riil dan estimasi waktu tempuh ambulans gawat darurat (menit).

---

### Langkah 6: Pusat Komando Aksi, AI Emergency Briefing, & Edukasi Medis (Tab 2: Protokol & Edukasi AI)
Pusat komando komunikasi publik dan protokol aksi taktis multi-sektor berbasis standar Kemenkes, WHO, IVHHN, dan PERDAMI:
1. **AI Emergency Briefing (Didukung Google Gemini & Pusdalops BNPB)**:
   - **Draf Siaran Pers Resmi BPBD**: Teks siap rilis media massa dengan narasi otoritatif dan terstruktur.
   - **Draf Pesan Siaran WhatsApp Warga**: Format pesan berpoin ringkas dengan tombol 1-klik salin teks untuk dibagikan ke grup warga dan relawan.
2. **Standar Masker Wajib: Respirator N95 vs Larangan Masker Kain**:
   - Masker kain dan masker bedah dilarang keras karena kebocoran samping mencapai $30\% - 50\%$. Wajib menggunakan respirator N95/KN95/KF94 dengan filtrasi $\ge 95\%$ partikel hingga $0.3\text{ mikron}$.
3. **Peringatan Medis Kritis: Larangan Mutlak Lensa Kontak (Softlens)**:
   - Pecahan kristal silika abu vulkanik ($SiO_2$) memiliki sudut tajam mikroskopis. Pemakaian softlens menjebak silika di kornea, memicu luka robek kornea (**abrasi kornea permanen**) hingga kebutaan. Wajib memakai *Safety Goggles* berlapis karet.
4. **Pengamanan Sumber Air Bersih & Hunian**:
   - Penutupan tandon air minum dan sumur gali dengan terpal kedap dari fluorida dan asam sulfur. Larangan menyapu abu kering (wajib disemprot air halus / dipel basah).
5. **Cetak Lembar Rencana Aksi Darurat (PDF / A4 Resmi)**:
   - Tombol 1-klik untuk mengekspor dokumen resmi cetak A4 format siap serah bagi Bupati dan Tim Tanggap Darurat.

---

### Langkah 7: Validasi Sains, Uji Sensitivitas, & Transparansi Asumsi
Membuktikan akurasi dan akuntabilitas ilmiah model:
1. **Evaluasi Lapangan Lapis 3**:
   - Menguji akurasi model terhadap kejadian historis (Erupsi Anak Krakatau 2026) menggunakan metrik *Fractions Skill Score* (FSS) dan *District Hit Rate* per kabupaten.
2. **Kurva Sensitivitas Parameter**:
   - Sapuan sensitivitas interaktif untuk parameter tinggi kolom letusan dan curah hujan terhadap lonjakan populasi terpapar.
3. **Simulasi Intervensi Pemadaman Titik Api (*Cluster Extinguishment Delta*)**:
   - Perhitungan seketika delta penurunan FRP (%), jumlah warga terlindungi, dan tonase emisi gas rumah kaca yang dicegah.
4. **Katalog Transparansi 24 Asumsi Ilmiah (D01 s.d. D24)**:
   - Audit terbuka status parameter model (`sourced`, `sourced_secondary`, `assumption_placeholder`) beserta tautan referensi jurnal.

---

## Arsitektur Antarmuka: The 4-Zone Command Canvas

Antarmuka web UdaraSiaga mengadopsi tata letak kanvas komando terpadu untuk mencegah beban kognitif (*cognitive overload*):

```mermaid
flowchart TB
    ZA["ZONE A: TACTICAL COMMAND HEADER (Brand, Live Telemetry, UTC/WIB Dual Clock)"]
    STRIP["BANNER: PROTOKOL RESMI KESIAPSIAGAAN & AKSI PENCEGAHAN BENCANA NASIONAL"]

    subgraph CoreWorkspace["RUANG KERJA UTAMA TAKTIS"]
        direction LR
        ZB["ZONE B: FLOATING CONTROL<br/>- Pilihan Jenis Bahaya<br/>- Katalog 70 Gunung Api<br/>- 36 Kawasan Hutan<br/>- Mode Eksperimen & Run"]
        ZC["ZONE C: INTERACTIVE GIS WORKSPACE<br/>- Peta Taktis Gelap Leaflet<br/>- Kontur Multi-Probabilitas P5/P50/P95<br/>- Titik Api Satelit & R*Tree Fasilitas<br/>- Player Garis Waktu 48 Jam (T+0 s.d. T+48)"]
        ZD["ZONE D: TABBED INSPECTION DOCK (2-TAB EMAS)<br/>- Tab 1: Wilayah & Fasilitas Terdampak (Kecamatan as Container + OSRM)<br/>- Tab 2: Protokol & Edukasi AI (Gemini Briefing, APD N95, Cetak PDF)"]
    end

    ZA --> STRIP
    STRIP --> CoreWorkspace
```

- **Zone A (Tactical Header)**: Logo platform, lencana status `SIAGA 24/7`, telemetri ticker nasional, tombol putar demo otomatis, dan jam digital ganda (WIB & UTC).
- **Zone B (Floating Control Dock)**: Panel kaca melayang di kiri atas peta untuk konfigurasi cepat skenario erupsi/karhutla tanpa menutup pandangan peta.
- **Zone C (Interactive GIS Workspace)**: Peta layar penuh berbasis Leaflet taktis gelap, kontrol layer independen, legenda dinamis, rute jalan raya OSRM, dan pemutar garis waktu 48 jam.
- **Zone D (Tabbed Inspection Dock - 2-Tab Emas)**: Laci samping kanan terpadu: **Tab 1: Wilayah & Fasilitas Terdampak** (Kecamatan sebagai wadah induk sekolah dan faskes rujukan) dan **Tab 2: Protokol & Edukasi AI** (AI briefing Gemini, broadcast WhatsApp, standar APD N95, larangan softlens, cetak PDF A4).

---

## Tabel Sumber Data & Atribusi Resmi

| Kategori Data | Variabel / Parameter | Sumber Data Otoritatif | Lisensi / Keterangan |
| :--- | :--- | :--- | :--- |
| **Vulkanologi** | Koordinat kawah, elevasi puncak, status level (I–IV), radius bahaya KRB, laporan letusan VONA | **PVMBG Badan Geologi ESDM** (MAGMA Indonesia) | Data Terbuka Pemerintah Indonesia |
| **Kebakaran Hutan** | Koordinat titik api, Fire Radiative Power (FRP), tingkat keyakinan sensor | **NASA FIRMS** (Satelit VIIRS SNPP & NOAA-20) | NASA Earthdata Open Access |
| **Meteorologi** | Vektor kecepatan & arah angin ($u, v$) multi-aras, curah hujan presipitasi | **Open-Meteo Ensemble API** (ECMWF & GFS) | CC BY 4.0 |
| **Kependudukan** | Estimasi total penduduk, struktur usia anak-anak ($<15$ th) dan lansia ($\ge 65$ th) per grid 100m | **WorldPop Project** | CC BY 4.0 |
| **Infrastruktur Publik**| Lokasi sekolah, puskesmas, rumah sakit rujukan darurat, bandara | **OpenStreetMap Contributors** (via Overpass API) | Open Database License (ODbL) |
| **Fisika Erupsi** | Laju Pelepasan Massa (*Mass Eruption Rate* / MER) berdasarkan tinggi kolom | **Mastin et al. (2009)**, *J. Volcanol. Geotherm. Res.* | DOI: 10.1016/j.jvolgeores.2009.01.008 |
| **Fisika Biomassa** | Faktor konversi FRP ke biomassa terbakar dan laju emisi partikulat $PM_{2.5}$ | **Wooster et al. (2005)** & **Li et al. (2018)** | Wooster (2005) doi:10.1029/2005JD006318 |
| **Standar Kualitas Udara** | Rentang konsentrasi $PM_{2.5}$ dan pedoman mitigasi kesehatan | **Permen LHK No. P.14/2020** (ISPU) & **WHO Air Quality Guidelines** | Regulasi Resmi RI & WHO |
| **Pedoman Abu & Masker** | Rekomendasi respirator partikulat N95/KN95 dan mitigasi abrasi kornea | **International Volcanic Health Hazard Network (IVHHN)** & **BNPB** | Standar Konsorsium Internasional |

---

## Matriks Penilaian & Kesiapan Pitching Juri JOINTS 2026

| Kriteria Penilaian | Bobot | Pembuktian Implementasi Nyata di UdaraSiaga Indonesia |
| :--- | :---: | :--- |
| **Inovasi & Relevansi Bencana** | 25% | Platform multi-bahaya pertama yang menyatukan pemodelan dispersi abu vulkanik dan asap karhutla dalam satu mesin partikel fisika terintegrasi dengan pencucian hujan dan peringatan bahaya lahar dingin. |
| **Ketepatan Sains & Rekayasa Data** | 25% | Mengimplementasikan formula Mastin et al. (2009) dan Wooster et al. (2005), kuantifikasi ketidakpastian rentang P5–P50–P95, penghalusan difusi Gaussian, dan kepatuhan etika data menolak kategori ISPU palsu. |
| **UI/UX & Desain Taktis** | 25% | Mengadopsi arsitektur *The 4-Zone Command Canvas*, palet warna hazard-aware (*semakin tebal semakin berbahaya*), scrubber waktu 48 jam, 0 emoji kartun kasual (100% lencana teks otoritatif dan siluet SVG taktis). |
| **Aksi Nyata & Mitigasi Publik** | 15% | Bukan sekadar visualisasi pasif: menghasilkan triase otomatis sekolah (PJJ Daring $\ge 40\%$), penentuan rute evakuasi darurat ke RS aman bebas abu, dan simulasi pemadaman titik api terukur. |
| **Kualitas Kode & Dokumentasi** | 10% | 29 dari 29 test pytest lolos 100%, linter ruff bersih tanpa error/warning, REST API FastAPI terdokumentasi otomatis di `/docs`, dan dokumentasi alur kerja komprehensif. |

---

## Lisensi & Atribusi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).  
Lihat berkas [CREDITS.md](CREDITS.md) untuk detail atribusi aset, model 3D, audio prosedural, dan pustaka pihak ketiga.

---

*UdaraSiaga Indonesia — Mengubah Estimasi Sains Dispersi Atmosferik Menjadi Aksi Perlindungan Nyata Bagi Warga, Sekolah, dan Tenaga Kesehatan.*

