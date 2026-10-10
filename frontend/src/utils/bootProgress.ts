/**
 * utils/bootProgress.ts - Jembatan progres muat aplikasi ke loader sungai (public/loader/river-loader.js).
 *
 * Loader mendaftarkan tugas berbobot (bundle, fonts, data, tiles, peta) sebelum React berjalan.
 * Modul ini melaporkan progres ASLI ke tugas-tugas itu. Jika loader tidak ada (gagal dimuat,
 * sudah ditutup, atau dilewati), semua fungsi menjadi no-op.
 */

type RiverLoaderApi = {
  Progress: { report: (name: string, v: number) => void; done: (name: string) => void };
  active: boolean;
  skip: () => void;
};

declare global {
  interface Window {
    RiverLoader?: RiverLoaderApi | null;
  }
}

const loader = (): RiverLoaderApi | null => {
  const l = typeof window !== "undefined" ? window.RiverLoader : null;
  return l && l.active ? l : null;
};

export const isLoaderActive = (): boolean => !!loader();

export function reportBoot(name: string, v: number): void {
  loader()?.Progress.report(name, v);
}

/** Menghitung permintaan API selama fase muat awal: progres = selesai / dimulai. */
let started = 0;
let finished = 0;
export function trackBootRequest<T>(p: Promise<T>): Promise<T> {
  if (!loader()) return p;
  started++;
  const settle = () => {
    finished++;
    reportBoot("data", finished / Math.max(started, 1));
  };
  p.then(settle, settle);
  return p;
}

/** Ubin peta dasar: progres = ubin selesai (berhasil/gagal) / ubin diminta, lalu penuh saat event "load". */
export function trackTileLayer(layer: {
  on: (ev: string, fn: () => void) => unknown;
  off: (ev: string, fn: () => void) => unknown;
}): void {
  if (!loader()) return;
  let want = 0;
  let got = 0;
  const start = () => { want++; };
  const end = () => { got++; reportBoot("tiles", got / Math.max(want, 1)); };
  const all = () => {
    reportBoot("tiles", 1);
    layer.off("tileloadstart", start);
    layer.off("tileload", end);
    layer.off("tileerror", end);
    layer.off("load", all);
  };
  layer.on("tileloadstart", start);
  layer.on("tileload", end);
  layer.on("tileerror", end);
  layer.on("load", all);
}

/** Dipanggil sekali saat modul utama mulai: bundle sudah terunduh dan dieksekusi. */
export function initBootProgress(): void {
  if (typeof window === "undefined") return;
  const overlay = document.getElementById("hlLoader");
  if (!window.RiverLoader) {
    // loader gagal dimuat (mis. three.js tidak tersedia): jangan biarkan latarnya menutupi aplikasi
    overlay?.remove();
    document.documentElement.classList.remove("hl-loading");
    return;
  }
  reportBoot("bundle", 1);
  // jaga-jaga: jika tidak ada permintaan data sama sekali, tugas data tidak boleh menggantung
  window.setTimeout(() => { if (started === 0) reportBoot("data", 1); }, 4000);
}
