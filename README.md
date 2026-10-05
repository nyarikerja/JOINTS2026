# UdaraSiaga Indonesia: Platform Komando Pemodelan Sebaran Atmosfer & Aksi Dini Multi-Bahaya

> **Platform Komando Simulasi Sains & Sistem Pendukung Keputusan Kesiapsiagaan Dini terhadap Erupsi Gunung Api (Abu Vulkanik) dan Kebakaran Hutan/Lahan (Asap PM2.5)**  
> *Dikembangkan untuk Hackathon JOINTS UGM 2026 — Track Multi-Hazard Atmospheric Dispersion & Early Action Protocol*

---

> [!IMPORTANT]
> **DISCLAIMER RESMI:**  
> UdaraSiaga Indonesia adalah platform estimasi sains terkomputasi untuk pembelajaran, perencanaan kontinjensi, dan protokol kesiapsiagaan aksi dini. Aplikasi ini **BUKAN PERINGATAN RESMI**. Untuk komando evakuasi darurat, status kedaruratan, dan kebijakan kebencanaan di lapangan, seluruh pihak tetap merujuk pada arahan otoritatif resmi dari **PVMBG Badan Geologi**, **BMKG**, dan **BNPB / BPBD**.

---

## Panduan Menjalankan Cepat (Quickstart Guide)

### 1. Menjalankan Server & Antarmuka Aplikasi
Aplikasi dirancang ringan tanpa dependensi build kompleks (*zero build step*):

```bash
# 1. Masuk ke direktori backend
cd backend

# 2. Pasang dependensi Python (FastAPI, NumPy, SciPy, Shapely, Rasterio)
pip install -r requirements.txt

# 3. Jalankan server aplikasi
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- **Akses Dashboard Web Taktis**: [http://127.0.0.1:8000/dummy/](http://127.0.0.1:8000/dummy/)
- **Dokumentasi REST API Interaktif (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Endpoint Status Sistem & Telemetri**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### 2. Menjalankan Pengujian Otomatis (Test Suite)
```bash
# Eksekusi seluruh 29 pengujian unit, fisika, lapis 2, dan lapis 3
pytest tests/

# Pemeriksaan linter kode Python (Ruff)
ruff check app/
```
*Hasil Verifikasi: 29/29 PASSED (100% lulus dalam ~3.8 detik), 0 lint warning.*

---

## Diagram Alur Kerja Sistem (End-to-End Architecture)

```
+-------------------------------------------------------------------------------------------------+
|                                1. SUMBER DATA OTORITATIF (INGEST)                               |
|  - PVMBG MAGMA: Elevasi kawah, koordinat vent, radius KRB, laporan VONA resmi                  |
|  - NASA FIRMS: Deteksi titik api NRT satelit VIIRS SNPP/NOAA-20 beserta Fire Radiative Power    |
|  - Open-Meteo: Vektor angin atmosfer multi-level (u, v) dan presipitasi hujan (15-51 ensemble) |
|  - WorldPop: Grid densitas kependudukan resolusi 100m (total jiwa, demografi anak & lansia)     |
|  - OpenStreetMap (Overpass): Fasilitas publik (sekolah, puskesmas, rumah sakit rujukan, bandara)|
+-------------------------------------------------------------------------------------------------+
                                                |
                                                v
+-------------------------------------------------------------------------------------------------+
|                         2. MESIN DISPERSI LAGRANGIAN RK2 (PHYSICS ENGINE)                       |
|  - Erupsi Vulkanik: Laju Emisi Massa Mastin et al. (2009) [M = 140.85 * H^4.15 kg/s]            |
|  - Karhutla Gambut: Konversi FRP Wooster et al. (2005) [0.27 - 0.37 - 0.45 kg/MJ]               |
|  - Adveksi-Difusi: Integrasi Runge-Kutta Ordo 2 (RK2) + Difusi Turbulen Atmosfer (80 m2/s)      |
|  - Pencucian Presipitasi: Wet Scavenging Lambda = a * R^b + Peringatan Lahar Hujan Lereng       |
|  - Agregasi Probabilitas: Difusi Gaussian Kontinu + Poligon Vektor Shapely MultiPolygon         |
+-------------------------------------------------------------------------------------------------+
                                                |
                                                v
+-------------------------------------------------------------------------------------------------+
|                         3. ESTIMASI DAMPAK & PROTOKOL AKSI DINI (IMPACT)                        |
|  - Kuantifikasi Ketidakpastian: Rentang P5 (Min) - P50 (Median) - P95 (Max)                     |
|  - Triase Sekolah: Rekomendasi PJJ Daring (>=40%) / Pembatasan Luar Ruang (15-39%)             |
|  - Triase Evakuasi Faskes: Klasifikasi RS Aman Bebas Abu vs Penyangga + Rute Terukur (km)       |
|  - Dampak Lingkungan: Hektare sawah/kebun, sumber air minum, tonase emisi karbon gambut        |
|  - Integritas Etika: Penonaktifan ISPU transparan selama faktor emisi masih placeholder        |
+-------------------------------------------------------------------------------------------------+
                                                |
                                                v
+-------------------------------------------------------------------------------------------------+
|                        4. PLATFORM KOMANDO GIS TAKTIS (4-ZONE COMMAND CANVAS)                   |
|  - Zone A: Tactical Header & Telemetri Nasional (WIB & UTC)                                     |
|  - Zone B: Panel Konfigurasi Kejadian Melayang (Gunung PVMBG vs Karhutla FIRMS)                |
|  - Zone C: Peta Interaktif Leaflet Dark Mode, Palet Hazard-Aware, & Timeline Player 48 Jam      |
|  - Zone D: Laci Analitik 5 Tab (Dampak, Sekolah, Rujukan Medis, Edukasi APD, Audit Sains)       |
+-------------------------------------------------------------------------------------------------+
```

---

## Alur Lengkap Cara Kerja Web UdaraSiaga

Aplikasi web UdaraSiaga beroperasi melalui 8 tahapan alur kerja terpadu dari hulu data hingga aksi lapangan:

### Langkah 1: Pengguna Memilih Kejadian & Mode Pemodelan
Pengguna mengakses antarmuka dan mengatur parameter skenario melalui **Panel Kontrol Melayang (Zone B)**:
1. **Pilihan Jenis Bahaya Atmosfer**:
   - **Erupsi Gunung Api (Abu Vulkanik)**: Menargetkan partikulat silika tajam dan gas vulkanik.
   - **Kebakaran Hutan & Lahan (Asap Karhutla)**: Menargetkan kabut asap organik dan partikel $PM_{2.5}$.
2. **Pilihan Lokasi Kejadian (Nasional)**:
   - Menjangkau 20 gunung api aktif nasional berstatus Level I s.d. Level IV (Anak Krakatau, Merapi, Lewotobi Laki-Laki, Marapi Sumatera, Semeru, Ibu, Ruang, Lokon, Sinabung, dll.) atau Karhutla Gambut Kalimantan.
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

### Langkah 5: Estimasi Dampak Multi-Sektor (Tab 1)
Laci analitik kanan otomatis terbuka dan menyajikan estimasi dampak:
1. **Penyajian Rentang Ketidakpastian (P5 – P50 – P95)**:
   - Mematuhi prinsip data integrity: **tidak pernah menampilkan angka tunggal**. Seluruh metrik disajikan dalam batas bawah (P5), median (P50), dan batas atas (P95).
2. **Demografi Kependudukan**:
   - Estimasi total jiwa terpapar berdasarkan grid WorldPop.
   - Perhitungan kelompok rentan khusus: Anak-anak ($< 15\text{ tahun}$) dan Lansia ($\ge 65\text{ tahun}$).
3. **Dampak Lingkungan & Pertanian**:
   - Luas sawah dan kebun terdampak abu (hektare berisiko gagal panen).
   - Sumber air minum dan DAS hulu berisiko tercemar asam abu.
   - Tonase emisi karbon kebakaran hutan ($CO_2e$ gambut dan non-gambut).
4. **Transparansi Kategori ISPU**:
   - Sesuai prinsip etika sains, kategori ISPU dinonaktifkan secara jujur dan transparan selama faktor emisi $PM_{2.5}$ gambut masih berstatus placeholder literatur.

---

### Langkah 6: Protokol Triase Aksi Dini & Rute Evakuasi Medis (Tab 2 & 3)
Aplikasi menurunkan estimasi sains menjadi protokol kesiapsiagaan operasional:
1. **Triase Kebijakan Sekolah (Pendidikan)**:
   - Peluang $\ge 40\%$: Instruksi tegas `[AWAS] SEGERA ALIHKAN KE PJJ DARING` sebelum abu tiba, wajib pemakaian masker respirator N95 bagi seluruh warga sekolah.
   - Peluang $15\% - 39\%$: `[WASPADA] HENTIKAN AKTIVITAS OUTDOOR` (dilarang olahraga dan upacara luar kelas).
   - Dilengkapi estimasi waktu tiba partikel tercepat (*Earliest Arrival Time*) dalam hitungan jam ($T + \text{jam}$).
2. **Triase Rumah Sakit Rujukan Bebas Abu (Kesehatan)**:
   - Menghubungkan sekolah terdampak ke fasilitas kesehatan terdekat yang **berada di luar zona sebaran abu** (`[RUJUKAN UTAMA] RS Aman Bebas Abu`).
   - Mencegah evakuasi korban sesak napas akut ke rumah sakit yang udaranya justru tercemar abu pekat.
3. **Visualisasi Rute Evakuasi Interaktif**:
   - Mengklik tombol **"Rute Evakuasi"** pada kartu sekolah langsung memusatkan (*flyTo*) peta dan melukiskan garis rute darurat putus-putus berwarna hijau ke rumah sakit rujukan terdekat beserta jarak kilometer dan koordinasi hotline SPGDT 119.

---

### Langkah 7: Edukasi APD Kesehatan Masyarakat (Tab 4)
Menyajikan panduan perlindungan diri berbasis standar medis otoritatif (IVHHN, WHO, dan BNPB):
1. **Komparasi Masker Bedah vs Respirator N95**:
   - **Masker Kain & Masker Bedah Biasa**: Diklasifikasikan `[TIDAK MEMENUHI STANDAR] DILARANG` karena kebocoran samping mencapai $30\% - 50\%$ dan pori-pori terlalu besar sehingga partikel silika mikroskopis tetap menembus saluran napas bawah.
   - **Masker Partikulat N95 / KN95 / FFP2**: Diklasifikasikan `[STANDAR RESMI OTORITATIF] WAJIB` dengan filtrasi $\ge 95\%$ partikel hingga $0.3\text{ mikron}$ dengan segel rapat di hidung dan pipi.
2. **Peringatan Medis Kritis: Larangan Lensa Kontak (Softlens)**:
   - Memberikan peringatan tegas larangan memakai lensa kontak saat terjadi hujan abu. Pecahan kristal silika memiliki sudut tajam yang dapat terperangkap di bawah softlens dan menyebabkan luka robek kornea mata (**abrasi kornea permanen**) hingga kebutaan. Dianjurkan memakai *Safety Goggles*.

---

### Langkah 8: Validasi Sains, Uji Sensitivitas, & Transparansi Asumsi (Tab 5)
Membuktikan akurasi dan akuntabilitas ilmiah model:
1. **Evaluasi Lapangan Lapis 3**:
   - Menguji akurasi model terhadap kejadian historis (misal: Erupsi Anak Krakatau 2026 atau Karhutla Kalimantan) menggunakan metrik *Fractions Skill Score* (FSS) dan *District Hit Rate* per kabupaten.
2. **Kurva Sensitivitas Parameter (Bar Chart Visual)**:
   - Pengguna dapat menjalankan sapuan sensitivitas (*parameter sweep*) untuk parameter tinggi kolom letusan atau curah hujan.
   - Hasilnya ditampilkan dalam grafik batang horizontal bergradien biru yang membandingkan dampak populasi terpapar secara visual.
3. **Simulasi Intervensi Pemadaman Titik Api (*Cluster Extinguishment Delta*)**:
   - Pada kejadian karhutla, pengguna dapat menekan tombol pemadaman klaster titik api teratas. Sistem menghitung seketika penurunan FRP (%), jumlah penduduk yang terlindungi, dan tonase emisi gas rumah kaca yang dicegah.
4. **Katalog Transparansi Asumsi (D01 s.d. D24)**:
   - Menampilkan status setiap parameter pemodelan (`sourced`, `sourced_secondary`, `assumption_placeholder`) beserta tautan referensi jurnal dan catatan batas model.

---

## Arsitektur Antarmuka: The 4-Zone Command Canvas

Antarmuka web UdaraSiaga mengadopsi tata letak kanvas komando terpadu untuk mencegah beban kognitif (*cognitive overload*):

```
+-----------------------------------------------------------------------------------+
| ZONE A: TACTICAL COMMAND HEADER (Brand, Live Sync Ping, KPI Status Nasional)      |
+-----------------------------------------------------------------------------------+
| STRIP: [PROTOKOL RESMI] SISTEM PERINGATAN DINI & AKSI PENCEGAHAN BENCANA          |
+-------------------+-------------------------------------------+-------------------+
| ZONE B:           | ZONE C: INTERACTIVE GIS WORKSPACE         | ZONE D:           |
| FLOATING CONTROL  |                                           | TABBED INSPECTION |
| (Panel Bencana,   | - Peta Taktis Gelap (Full Bleed Leaflet)  | DOCK (Laci Kanan) |
|  20 Gunung PVMBG, | - Poligon Dispersi Berwarna Hazard-Aware  |                   |
|  Mode Eksperimen, | - Hotspot NASA & Titik Fasilitas Publik   | [Tab 1: Dampak]   |
|  Jalankan Sim)    | - Legenda Dinamis Kiri Bawah              | [Tab 2: Sekolah]  |
|                   | +---------------------------------------+ | [Tab 3: Evakuasi] |
| (Dapat Diciutkan) | | TIMELINE PLAYER (T+0 s.d. T+48 Jam)   | | [Tab 4: Edukasi]  |
|                   | +---------------------------------------+ | [Tab 5: Audit]    |
+-------------------+-------------------------------------------+-------------------+
```

- **Zone A (Tactical Header)**: Logo platform, lencana status `SIAGA 24/7`, telemetri ticker nasional (jumlah gunung api Level 3/4 dan titik api satelit FIRMS), tombol uji latensi sinkronisasi, tombol putar demo otomatis, dan jam digital ganda (WIB & UTC).
- **Zone B (Floating Control Dock)**: Panel kaca melayang di kiri atas peta untuk konfigurasi cepat skenario erupsi/karhutla tanpa menutup pandangan peta. Dapat diciutkan dengan satu klik.
- **Zone C (Interactive GIS Workspace)**: Peta layar penuh berbasis Leaflet taktis gelap, kontrol layer independen, legenda dinamis, dan pemutar garis waktu melayang di bawah tengah peta.
- **Zone D (Tabbed Inspection Dock)**: Laci samping kanan dengan 5 tab terstruktur (Dampak, Sekolah, Evakuasi, Edukasi APD, dan Audit Sains).

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

*UdaraSiaga Indonesia — Mengubah Estimasi Sains Dispersi Atmosferik Menjadi Aksi Perlindungan Nyata Bagi Warga, Sekolah, dan Tenaga Kesehatan.*
