// Bangun loader sungai HelaLoka dari src/:
//  - ../public/loader/river-loader.js  : inti (p1..p5b), dipakai aplikasi (/app/) dan demo
//  - ../public/loader/river-loader.css : gaya
//  - ../app/index.html                 : markup + boot tertanam disisipkan di antara penanda LOADER:BEGIN/END
//  - index.html                        : demo mandiri dengan progres simulasi (?speed=, ?next=, ?quick)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), src = f => readFileSync(join(here, 'src', f), 'utf8');
const CORE = ['p1_core.js', 'p2_world.js', 'p3_boat.js', 'p3b_bridge.js', 'p3c_gate.js', 'p3d_koi.js', 'p3e_life.js', 'p4_view.js', 'p5_app.js', 'p5b_audio.js'];
const banner = `/* HelaLoka river loader (dibangun oleh loader/build.mjs dari loader/src, jangan diedit langsung).
   Sebagian teknik diadaptasi dari sakura-fantasy, utsuroi, dan halcyon (MIT, (c) 2026 Bill Chan); lihat CREDITS.md. */\n`;
const pub = join(here, '..', 'public', 'loader');
mkdirSync(pub, { recursive: true });
writeFileSync(join(pub, 'river-loader.js'), banner + CORE.map(src).join('\n'));
writeFileSync(join(pub, 'river-loader.css'), src('loader.css'));
const markup = src('markup.html').trim();
const FONTS = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,300..600&family=Manrope:wght@500;600;700;800&display=swap';
const block = (boot) => `<!--LOADER:BEGIN (disisipkan oleh loader/build.mjs)-->
<script>document.documentElement.classList.add('hl-loading');</script>
${markup}
<script src="/landing/vendor/three.min.js"></script>
<script src="/landing/js/fog.js"></script>
<script src="/loader/river-loader.js"></script>
<script>${boot}</script>
<!--LOADER:END-->`;
// aplikasi
const appPath = join(here, '..', 'app', 'index.html');
let app = readFileSync(appPath, 'utf8');
const re = /<!--LOADER:BEGIN[\s\S]*?<!--LOADER:END-->/;
if (!re.test(app)) throw new Error('penanda LOADER:BEGIN/END tidak ditemukan di app/index.html');
writeFileSync(appPath, app.replace(re, () => block(src('p6_embed.js'))));
// demo mandiri
writeFileSync(join(here, 'index.html'), `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>HELALOKA | Menyiapkan Ruang Simulasi</title>
<link rel="icon" type="image/png" href="/gunung.png?v=2">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/loader/river-loader.css">
<style>@view-transition{navigation:auto}html,body{margin:0;height:100%;background:#16131c}.demo{min-height:100%;display:grid;place-items:center;color:#f8ebe5;font:500 15px system-ui}</style>
</head>
<body>
<main class="demo" aria-live="polite">Demo loader selesai. Muat ulang untuk melihat lagi.</main>
${block(src('p6_boot.js'))}
</body>
</html>
`);
console.log('loader dibangun:', CORE.length, 'modul');
