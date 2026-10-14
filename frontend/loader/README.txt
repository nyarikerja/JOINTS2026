HelaLoka river loader (layar pemuatan aplikasi /app/)

Alur: landing (/) -> klik "Jalankan simulasi" -> kabut bergulung masuk (public/landing/js/portal.js + fog.js) -> /app/
-> loader sungai tampil di atas aplikasi React, perahu bergerak mengikuti progres muat ASLI
-> perahu selalu mulai sebelum jembatan dan lewat di bawahnya -> tiba di gerbang candi bentar -> otomatis masuk:
   kamera berhenti di depan gerbang, perahu berlayar masuk dan lenyap di kabut; kabut (fog.js) menutup layar lalu menipis memperlihatkan aplikasi.
Loader ini menggantikan overlay "Memuat Data Spasial" (overlay lama hanya muncul jika loader dilewati sebelum peta siap).

Build: edit file di src/, lalu jalankan  node build.mjs  (atau bash build.sh). Hasil:
  ../public/loader/river-loader.js   inti (p1..p5b)
  ../public/loader/river-loader.css  gaya
  ../app/index.html                  markup + boot disisipkan di antara <!--LOADER:BEGIN--> dan <!--LOADER:END-->
  index.html                         demo mandiri dengan progres simulasi: /loader/index.html?speed=0.3 (lambat), ?speed=4 (cepat), ?quick, ?next=/app/

Modul src/:
  p1_core.js     CFG (jumlah objek, kecepatan, durasi minimum), kualitas (localStorage 'hl-quality'), GATE, POND, BRIDGE
  p2_world.js    langit, terrain, pohon, cemara, tepian, kabut, kelopak
  p3_boat.js     kit tokoh (PK: batik, kebaya, caping, tubuh ber-IK) + jukung bercadik dengan haluan gajah mina, juru galah, penumpang, anak
  p3b_bridge.js  jembatan lengkung batu andesit + bata merah (z = BRIDGE.z), pilar candi, tanaman rambat, warga
  p3c_gate.js    gerbang candi bentar + portal dimensi + weatherMat (basah/lumut dekat air)
  p3d_koi.js     koi (koi_lo.glb CC0 dari landing/assets) berenang di kolam depan gerbang, cincin riak di air
  p3e_life.js    kelapa, pisang, bambu, rumah panggung, sampan tertambat, penjor, teratai, bebek, kuntul, kupu-kupu, warga tepian
  p4_view.js     air (pantulan setengah resolusi, riak, wake, cincin koi), post (bloom, god rays), kamera, gubernur resolusi
  p5_app.js      versi 2D cadangan + pengendali progres/UI/reveal
  p5b_audio.js   suara prosedural (sungai, angin, burung, metalofon slendro, cebur galah, desir portal); pilihan disimpan di 'hl-sound'
  p6_embed.js    boot di aplikasi: tugas berbobot bundle/fonts/data/tiles/peta (dilapor dari src/utils/bootProgress.ts)
  p6_boot.js     boot demo mandiri

API (window.RiverLoader): setProgress(0..1), Progress.register(nama, bobot, label) / report(nama, 0..1) / done(nama),
onReady(cb), start(), skip(), destroy(). Event: 'loader:reveal', 'loader:done'.
Kunjungan ulang dalam sesi yang sama: perjalanan dipersingkat dan masuk otomatis.
Pengaman: setelah 22 detik loader tidak lagi menunggu data yang macet (CFG/opts.watchdog).
Folder _backup_public_loader/ berisi salinan lama dari public/loader (tidak dipakai); boleh dihapus.
