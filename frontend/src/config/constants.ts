/**
 * config/constants.ts - Konstanta Konfigurasi Global Aplikasi UdaraSiaga
 */

function resolveApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window === "undefined") return "http://127.0.0.1:8000";
  const { protocol, hostname, port, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://127.0.0.1:8000";
  }
  if (port && port !== "80" && port !== "443" && port !== "8000") {
    return `${protocol}//${hostname}:8000`;
  }
  return origin;
}

export const CONFIG = {
  // Alamat backend FastAPI:
  // 1. VITE_API_BASE saat build (mis. https://api.helaloka.id) bila backend di domain lain;
  // 2. dev server Vite (port 5173): backend di host yang sama, port 8000 (juga jalan dari HP di jaringan lokal);
  // 3. produksi: backend menyajikan frontend di origin yang sama.
  API_BASE: resolveApiBase(),

  DEFAULT_MAP_VIEW: {
    lat: -2.5,
    lng: 118.0,
    zoom: 5,
    minZoom: 4,
    maxZoom: 17
  },

  COLORS: {
    volcano: {
      p90: "#991b1b", // Abu Tebal (Konsentrasi Tinggi)
      p50: "#dc2626", // Abu Sedang
      p05: "#f87171", // Debu Halus
      label: "Sebaran Abu Vulkanik"
    },
    fire: {
      p90: "#78350f", // Asap Sangat Pekat
      p50: "#b45309", // Asap Sedang
      p05: "#f59e0b", // Asap Tipis
      label: "Sebaran Asap Karhutla (PM2.5)"
    },
    pvmbg: {
      level4: { color: "#ef4444", name: "Level IV (Awas)" },
      level3: { color: "#f97316", name: "Level III (Siaga)" },
      level2: { color: "#eab308", name: "Level II (Waspada)" },
      level1: { color: "#22c55e", name: "Level I (Normal)" }
    }
  },

  SCHOOL_THRESHOLDS: {
    pjj_daring: 40,
    stop_outdoor: 15
  }
} as const;
