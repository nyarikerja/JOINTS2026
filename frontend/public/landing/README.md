# HelaLoka Indonesia - Landing Page

Landing page statis dengan scene 3D Three.js r149 (tanpa build step).

## Menjalankan
Buka `index.html` langsung di browser, atau jalankan server lokal:

    npx serve .
    # atau
    python3 -m http.server 8080

Font Poppins dan DM Mono dimuat dari Google Fonts, jadi perlu internet. Three.js sudah disertakan di `vendor/`.

## Struktur
- `index.html` : markup dan teks
- `css/style.css` : tampilan, bentuk kartu organik (daun, batu, daun kering, kelopak)
- `js/page.js` : gulir halus Lenis, status suasana, parallax, animasi masuk, rail, anotasi 3D
- `js/scene.js` : scene 3D + pascaproses (bloom, sinar matahari, grading)
- `js/sim.js` : simulasi ensemble + salin tautan skenario (`?sim=`)
- `vendor/lenis.min.js` : Lenis 1.1.13 (MIT)
- `vendor/three.min.js` : Three.js r149 (lisensi MIT, lihat `THREE-LICENSE.txt`)

## Bagian penting di index.html
- Palet warna : variabel CSS di `:root` (teal/krem/oranye dan maroon/merah/oranye/emas)
- Suasana tiap section : atribut `data-scene`, `data-ash`, `data-smoke`, `data-fire`, `data-lava`, `data-ext`, `data-mud` pada tag `<section>`
- Langit: jam sehari menerus (`HOUR`, `TOD`, `skyBody`) ditambah cuaca hujan/badai (`SCN`). Matahari dan bulan bergerak mengikuti scroll
- Bukit berhutan dan padang rumput berbunga : `layerDefs` dan `ridgeF`; pohon : `buildTrees`
- Awan lereng : `bankF`; kolom abu, awan panas, hujan abu : `plume`, `pyro`, `ashfall`
- Lahar : blok lahar di `volMat`
- Tombol "Lihat gunung" menyembunyikan kartu; Esc memulihkan
- Gunung api 3D : fungsi `volH` dan shader `volMat`
- Api, asap, bara : bagian "kebakaran lahan"
- Simulasi ensemble RK2 : skrip kedua (`compute()`)

Catatan : scene dibuat orisinal bergaya referensi ThreeUI, bukan salinan source ThreeUI.

## Catatan v5
- Awan kumulus di langit (blok `cu` pada shader langit)
- Kolom abu lebih gelap dengan payung menjamur di puncak
- Lahar: 8 aliran bercabang dengan retakan pijar
- Pohon bergoyang tertiup angin (`treeV`)
- Kartu lebih kecil di HP; lompatan jauh lewat menu memakai transisi pudar (`#veil`)

## Catatan v6
- Jam dinding (SVG) di kanan bawah, mengikuti jam langit
- Transisi: jam langit memakai pegas teredam; lompatan jauh lewat menu memudar lalu langsung pindah
- Danau + angsa, kijang, kelinci, pagar, batu, pondok (`TX`, `spr`, `updateProps`)
- Awan panas 260 partikel, lebih sering dan lebih besar
- Lahar hujan (mode `uMud`): aliran lebih lebar, lebih jauh, bergaris lumpur
- Pohon: tepi tajuk bergerigi, gumpalan daun, variasi warna, kulit batang
- Performa: resolusi adaptif (Q), berhenti saat tab tersembunyi, PR maksimum 1.25 di HP

## Catatan v7
- Navigasi titik di kanan diganti ikon siluet per suasana (fajar, siang, senja, malam, hujan, badai, salju). Warna diatur di objek `ICON_COLOR`, bentuk di objek `ICON` (SVG `currentColor`, bisa diubah bebas).

## Catatan v8
- Ikon navigasi kanan dibuat ulang: lebih besar (badge bulat 40px), dua lapis dengan detail (bukit, awan berlapis, kepingan salju bercabang, bintang). Bentuk di `ICON`, warna di `ICON_COLOR`.

## Catatan v8
- Bintang: 3 lapis (redup, sedang, terang berkilau silang), warna biru-putih sampai kuning, kerlip berbeda tiap bintang, langit berputar pelan, dan pita Bima Sakti dengan jalur debu (`starL`)
- Hewan kabur saat bencana (abu, api/asap, badai, lahar): kijang dan kelinci berlari ke kiri, angsa terbang; kembali pelan setelah aman (`updateProps`, `fleeF`)
- Pohon: bentuk tajuk dari beberapa gumpalan, tepi halus (`alphaToCoverage`), bercak daun, lubang cahaya di tepi, bayangan arah matahari

## Catatan v9
- Musim gugur: scene `autumn` (SCN, `HOUR.autumn`), bagian `#gugur` di rail dengan ikon daun, pohon jadi oranye/merah/kuning, padang menguning, daun berguguran (`leaves`), hutan gunung ikut menguning
- Pohon 3 lapis (kedalaman/parallax), garis-garis artefak dikurangi dengan membatasi `fwidth`
- Lahar/lava: aliran lebih sempit, lahar lebih lebar saat hujan
- Kamera: pitch saat erupsi dikurangi supaya padang tetap kelihatan

## Catatan v10
- Hewan (kijang, kelinci, angsa) dihapus; danau, pondok, pagar, dan batu tetap ada
- Ikon rail kembali ke siluet sederhana versi sebelumnya (tanpa lingkaran), ditambah ikon daun untuk musim gugur

## Catatan v11
- Daun musim gugur diganti: bentuk daun (lonjong berurat dan maple) digambar di shader `leaves`, dengan putaran, ayunan, dan balik badan 3D (`vAng`, `vF`), warna merah/jingga/emas/cokelat, sisi belakang lebih redup

## Catatan v12
- Ikon musim gugur diganti daun maple (`ICON.autumn`)
- SEO: meta description, Open Graph/Twitter, favicon, theme-color, JSON-LD, `og-image.png`. Setelah di-deploy, ubah `og:image` dan `twitter:image` jadi URL absolut dan tambahkan `<link rel="canonical">`
- Menu hamburger untuk layar <=860px, tautan lompat ke konten, kontras teks dinaikkan
- Bagian `#mulai` (untuk siapa + CTA). Isi `LINKS={app,repo,email}` di skrip agar tombol Buka aplikasi / Lihat kode / Hubungi tim tampil
- Istilah zona peta (90%/50%/5%) dipisahkan dari persentil rentang dampak (ke-5/50/95); contoh hasil diberi label ilustratif
- Font tidak lagi memblokir render; hujan, salju, dan daun tidak digambar saat intensitasnya nol

## Catatan v13
- Daun musim gugur kini memakai daun maple Kanada sungguhan (tekstur `mapleTex`, digambar di JS) dengan urat daun, berdampingan dengan daun lonjong; sekitar 60% daun berbentuk maple dan sedikit lebih besar

## Catatan v13.1
- Ikon salju di rail kanan tadi dobel karena `#mulai` (v12) memakai suasana yang sama dengan `#sumber`. Sekarang `#mulai` diberi `data-norail` sehingga tidak dibuatkan ikon; rail punya satu ikon per suasana

## Catatan v14
- Navigasi: pil "JOINTS UGM 2026" (tidak bisa diklik) diganti tombol CTA "Coba simulasi"; menu hamburger kini mulai di <=1100px agar tautan tidak terlipat di tablet
- Hero: lead dipersingkat; statistik diganti angka nyata (70 gunung api, 36 kawasan hutan, grid 100 m, P5–P95) di atas kartu krem agar terbaca di atas pepohonan
- Bagian baru `#masalah` (data ada, keputusan terlambat) setelah hero, `data-norail`
- Peta simulasi bisa dipakai lewat keyboard (fokus lalu tombol panah, Shift untuk langkah besar)
- Tautan langsung (mis. `#hasil`) langsung memakai suasana bagian itu
- Jam dinding disembunyikan di HP karena menutupi teks kartu; footer diberi tautan ke atas dan catatan bukan peringatan resmi

## Catatan v15
- Kode dipecah ke css/ dan js/; tipografi Fraunces + Manrope + DM Mono; teks ditulis ulang
- Kartu berbentuk daun/batu/daun kering/kelopak, nomor bagian, pita sumber data, anotasi yang menempel di objek 3D
- Musim sakura (`SCN.sakura`, `HOUR.sakura`, kelopak `petals`, bagian #mulai)
- Realisme: pascaproses HDR (bloom, sinar matahari, vinyet, grain), rumput bergoyang, bayangan awan, danau memantulkan langit, burung, kunang-kunang, cahaya tembus di tajuk, salju di pohon, endapan abu di lereng
- Transisi: semua nilai suasana bergeser menerus, Lenis + lompatan menu berupa time-lapse, kamera parallax mengikuti gulir
- `?hq` mematikan kualitas adaptif (untuk tangkapan layar)
