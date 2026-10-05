/**
 * config/constants.ts - Konstanta Konfigurasi Global Aplikasi UdaraSiaga
 */

export const CONFIG = {
  // Base URL Backend FastAPI (mendukung dev server lokal port 8000)
  API_BASE: typeof window !== "undefined" && window.location.port === "8000"
    ? window.location.origin
    : "http://127.0.0.1:8000",

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
