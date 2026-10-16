# Landing Page HELALOKA

Landing page statis dengan scene 3D Three.js r149, tanpa langkah build. Markup ada di `frontend/index.html`; gaya, skrip, dan aset ada di `frontend/public/landing/`.

## Menjalankan

Jalankan bersama frontend (`npm run dev`, lalu buka http://localhost:5173), atau sajikan folder `frontend/` dengan server statis apa pun. Font (Fraunces, Manrope, DM Mono) dimuat dari Google Fonts. Three.js dan Lenis sudah disertakan di `vendor/`.

Parameter URL:

| Parameter | Efek |
| :--- | :--- |
| `?hq` | Mematikan kualitas adaptif (untuk tangkapan layar) |
| `?sim=` | Membuka skenario dari tautan yang dibagikan |
| `#<bagian>` | Langsung ke bagian tersebut dengan suasananya |

Pengaturan kualitas disimpan di `localStorage` kunci `hl-quality` (`auto`, `high`, `lite`, `static`); suara di `hl-sound` (`on`, `off`).

## Struktur berkas

| Berkas | Isi |
| :--- | :--- |
| `css/style.css` | Tata letak, bentuk kartu organik (daun, batu, daun kering, kelopak), sulur kartu |
| `js/page.js` | Gulir halus Lenis, suasana per bagian, parallax, animasi masuk, rail navigasi, anotasi 3D |
| `js/scene.js` | Scene 3D dan pascaproses (bloom, sinar matahari, grading) |
| `js/sim.js` | Simulasi ilustrasi 24 anggota ansambel (RK2) di canvas 2D; skenario bisa dibagikan lewat `?sim=` |
| `js/quality.js` | Pilihan kualitas grafis (dipakai juga oleh loader) |
| `js/folk.js` | Warga per musim, kijang, dan menara gaya Istana Pagaruyung; dilukis prosedural sebagai sprite |
| `js/trail.js` | Jalur pendakian bertitik antarbagian dan kartu gaya scrapbook (selotip, sedikit miring) |
| `js/fog.js` | Lapisan kabut, dipakai bersama loader |
| `js/portal.js` | Transisi ke `/app/` saat tombol CTA diklik (kabut bergulung masuk) |
| `js/autoscroll.js` | Tur gulir otomatis "Gulir saja" |
| `js/audio.js` | Suara alam prosedural (Web Audio API) tanpa berkas eksternal |
| `vendor/` | Three.js r149, Lenis 1.1.13, GLTFLoader, meshopt decoder (lisensi MIT disertakan) |
| `img/`, `assets/` | Gambar lanskap, logo sumber data, model koi (CC0) |

## Scene dan suasana

Setiap `<section>` mengatur suasana scene lewat atribut:

| Atribut | Fungsi |
| :--- | :--- |
| `data-scene` | Suasana: `sunrise`, `noon`, `sunset`, `night`, `rain`, `storm`, `snow`, `autumn`, `sakura` |
| `data-ash`, `data-smoke`, `data-fire`, `data-lava`, `data-mud` | Intensitas bahaya di scene |
| `data-ext` | Efek tambahan |
| `data-norail` | Bagian tidak mendapat ikon di rail navigasi |

Nilai suasana bergeser menerus mengikuti gulir; lompatan lewat menu diputar sebagai time-lapse. Bagian penting di `scene.js`:

| Elemen | Fungsi atau variabel |
| :--- | :--- |
| Langit, matahari, bulan, awan | `HOUR`, `TOD`, `skyBody`, `SCN` |
| Bukit dan padang | `layerDefs`, `ridgeF` |
| Pohon | `buildTrees`, goyangan `treeV` |
| Gunung api dan lahar | `volH`, `volMat` |
| Kolom abu, awan panas, hujan abu | `plume`, `pyro`, `ashfall` |
| Daun gugur dan kelopak | `leaves`, `mapleTex`, `petals` |
| Bintang dan Bima Sakti | `starL` |

Scene ini dibuat orisinal dengan gaya referensi ThreeUI, bukan salinan kode ThreeUI.

## Aksesibilitas dan performa

- Menu hamburger di lebar ≤ 1100 px, tautan lompat ke konten, kontras teks tinggi.
- Peta simulasi dapat dipakai dengan keyboard (tombol panah, Shift untuk langkah besar).
- Resolusi adaptif, render berhenti saat tab tersembunyi, rasio piksel maksimum 1,25 di ponsel.
- Kartu besar tidak memakai `backdrop-filter`; blur dimatikan di ponsel, layar sentuh, serta mode Hemat dan Statis.
- Tabel sekolah bertumpuk menjadi kartu di lebar ≤ 600 px.
- Hindari GLSL dengan loop berat: kompilasi shader pertama di Windows (ANGLE/D3D) bisa tersendat.

## Sebelum deploy

- Ubah `og:image` dan `twitter:image` menjadi URL absolut, lalu tambahkan `<link rel="canonical">`.
- Isi `LINKS={app,repo,email}` di skrip agar tombol "Buka aplikasi", "Lihat kode", dan "Hubungi tim" tampil.

## Riwayat perubahan

| Versi | Perubahan utama |
| :--- | :--- |
| v5–v6 | Awan kumulus, lahar bercabang, pohon bergoyang, jam dinding, danau dan pondok, performa adaptif |
| v7–v8 | Ikon siluet suasana di rail kanan, bintang tiga lapis dan Bima Sakti, tajuk pohon bertepi halus |
| v9–v11 | Musim gugur dengan daun berguguran (maple dan lonjong, digambar di shader); hewan dihapus |
| v12 | SEO (meta, Open Graph, JSON-LD), menu hamburger, bagian `#mulai`, istilah zona peta (90/50/5%) dipisah dari persentil (P5/P50/P95) |
| v13 | Tekstur daun maple asli, ikon rail ganda diperbaiki |
| v14 | CTA "Coba simulasi", statistik nyata di hero, bagian `#masalah`, dukungan keyboard pada peta |
| v15 | Kode dipecah ke `css/` dan `js/`, tipografi Fraunces + Manrope + DM Mono, kartu organik, musim sakura, pascaproses HDR |
| 11 Okt 2026 | Sulur kartu dibangun ulang dengan `ResizeObserver` dan berwarna mengikuti musim, blur dimatikan di perangkat ringan, teks disamakan dengan data aplikasi |
| 15 Okt 2026 | Merek ditulis HELALOKA, dokumentasi dipindah keluar dari `public/` |
