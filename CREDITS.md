# Kredit dan Atribusi (HelaLoka)

## Kode yang diadaptasi (MIT)

Beberapa teknik di landing page dan loader sungai diadaptasi (ditulis ulang, bukan disalin utuh) dari tiga proyek Bill Chan:

| Proyek | Bagian yang dipelajari | Dipakai di |
| --- | --- | --- |
| [sakura-fantasy](https://github.com/billpwchan/sakura-fantasy) | `src/main.js` report() (progres berbobot), `src/ui/ui.js` progress()/ready()/open(), `src/ui/ui.css` loader (judul blur ke fokus, reveal mask radial + `@property --hole`), wake perahu di `src/world/water.js` | `frontend/loader/src/p5_app.js`, `loader.css`, `p4_view.js` |
| [utsuroi](https://github.com/billpwchan/utsuroi) | `src/garden/koi.js` (gelombang tubuh kepala-ke-ekor, corak koi dari derau, perilaku berkelompok, naik ke permukaan + cincin riak `uRise`), `src/garden/water.js`/`terrain.js` (permukaan basah dan lumut dekat air) | `frontend/loader/src/p3d_koi.js`, `p3c_gate.js` (weatherMat), `p4_view.js` (rings), `frontend/public/landing/js/scene.js` (koi danau) |
| [halcyon](https://github.com/billpwchan/halcyon) | `src/life/fish.js` (kawanan ikan, LOD) | `frontend/loader/src/p3d_koi.js` |

Pemberitahuan lisensi asli:

```
MIT License

Copyright (c) 2026 Bill Chan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

The MIT licence covers the source code. Third-party assets under public/assets keep their own licences, listed in
CREDITS.md.
```

## Aset

| Berkas | Dipakai untuk | Karya | Oleh | Lisensi |
| --- | --- | --- | --- | --- |
| `frontend/public/landing/assets/glb/koi_lo.glb` (dan `koi.glb`, tidak dipakai saat ini) | Koi di loader sungai | [コイ Carp, Cyprinus carpio](https://sketchfab.com/3d-models/cc0-carp-cyprinus-carpio-6b404d20bab34fa99fba848060c42ca7) (versi teroptimasi dari repo utsuroi) | ffish.asia / floraZia.com | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |

Semua visual lain (sungai, perahu, gerbang candi bentar, jembatan, teratai, judul 3D, portal) dan seluruh suara (Web Audio) dibuat prosedural, tanpa aset berlisensi. Tidak ada aset berlisensi NC (mis. `kasuga.glb`) yang dipakai.

## Pustaka pihak ketiga

- [three.js](https://threejs.org) r149, MIT (`frontend/public/landing/vendor/THREE-LICENSE.txt`), termasuk `GLTFLoader.js`.
- [meshoptimizer](https://github.com/zeux/meshoptimizer) `meshopt_decoder.js`, MIT, (c) Arseny Kapoulkine.
- [Lenis](https://github.com/darkroomengineering/lenis) 1.1.13, MIT (`frontend/public/landing/vendor/LENIS-LICENSE.txt`).

## Lisensi Proyek

Kode sumber proyek HelaLoka / UdaraSiaga Indonesia dilisensikan di bawah [MIT License](LICENSE).  
Hak Cipta (c) 2026 Arya Refman & Tim HelaLoka / UdaraSiaga Indonesia (JOINTS UGM 2026).

