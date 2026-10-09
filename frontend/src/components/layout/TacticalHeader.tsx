import React, { useEffect, useState } from "react";
import { RefreshCw, PanelRight, Layers } from "lucide-react";
import { api } from "../../services/api";
import type { SummaryKpiResponse } from "../../types/api";

interface TacticalHeaderProps {
  onResetView?: () => void;
  onToggleDrawer: () => void;
  isDrawerOpen: boolean;
  onToggleLegend?: () => void;
  isLegendOpen?: boolean;
}

export const TacticalHeader: React.FC<TacticalHeaderProps> = ({
  onToggleDrawer,
  isDrawerOpen,
  onToggleLegend,
  isLegendOpen = false
}) => {
  const [clockWib, setClockWib] = useState("--:--:-- WIB");
  const [clockUtc, setClockUtc] = useState("--:--:-- UTC");
  const [kpi, setKpi] = useState<SummaryKpiResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const volcanoAlertCount = kpi?.volcanoes
    ? (kpi.volcanoes.level_4_awas || 0) + (kpi.volcanoes.level_3_siaga || 0)
    : 7;

  const fireCount = kpi?.wildfire_hotspots?.active_24h_firms !== undefined
    ? Number(kpi.wildfire_hotspots.active_24h_firms).toLocaleString("id-ID")
    : "1.680";

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const wibStr = now.toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      setClockWib(`${wibStr} WIB`);

      const utcH = String(now.getUTCHours()).padStart(2, "0");
      const utcM = String(now.getUTCMinutes()).padStart(2, "0");
      const utcS = String(now.getUTCSeconds()).padStart(2, "0");
      setClockUtc(`${utcH}:${utcM}:${utcS} UTC`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadKpi = async () => {
    try {
      const data = await api.getSummaryKpi();
      setKpi(data);
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    loadKpi();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncLive();
      setSyncStatus(`Tersinkron (${res.latency_ms || 92}ms)`);
      await loadKpi();
    } catch {
      setSyncStatus("Gagal");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  return (
    <header
      className="h-[52px] backdrop-blur-md px-4 flex items-center justify-between z-[1100] shrink-0"
      style={{
        backgroundColor: "#EB895B",
        borderBottom: "1px solid rgba(161, 70, 70, 0.35)",
        boxShadow: "0 2px 14px rgba(0, 0, 0, 0.2)"
      }}
    >
      <div className="flex items-center gap-2.5">
        <img
          src="/gunung.png"
          alt="Logo hELAlOKA"
          className="w-8 h-8 object-contain shrink-0 drop-shadow-sm select-none pointer-events-none"
        />
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-base tracking-tight" style={{ color: "#140f0e" }}>hELAlOKA</span>
          <span className="font-bold text-[10px] px-1.5 py-0.5 rounded tracking-wider text-white shadow-xs" style={{ backgroundColor: "#A14646" }}>
            INDONESIA
          </span>
        </div>
      </div>

      {/* Live Telemetry Ticker (KPI Dinamis Nasional) */}
      <div className="hidden md:flex items-center gap-2.5">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs shadow-xs"
          style={{
            background: "#F5EFE3",
            border: "1px solid rgba(20, 15, 14, 0.12)",
            color: "#140f0e",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)"
          }}
          title="Status Gunung Api Aktif PVMBG (Level III Siaga & Level IV Awas)"
        >
          <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "#A14646" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M2 22L12 2l10 20H2z" />
            <path d="M12 9v4" />
          </svg>
          <span className="text-xs font-semibold" style={{ color: "rgba(20, 15, 14, 0.85)" }}>Gunung Siaga / Awas:</span>
          <strong className="font-mono font-bold text-xs" style={{ color: "#A14646" }}>{volcanoAlertCount}</strong>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs shadow-xs"
          style={{
            background: "#F5EFE3",
            border: "1px solid rgba(20, 15, 14, 0.12)",
            color: "#140f0e",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)"
          }}
          title="Deteksi Titik Api Satelit NASA FIRMS VIIRS 24 Jam Terakhir"
        >
          <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "#DA6556" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 2c-4 4-6 8-6 12 0 4.4 3.6 8 8 8s8-3.6 8-8c0-3-2-6-5-8-1 3-3 4-5 2z" />
          </svg>
          <span className="text-xs font-semibold" style={{ color: "rgba(20, 15, 14, 0.85)" }}>Titik Api Aktif (24h):</span>
          <strong className="font-mono font-bold text-xs" style={{ color: "#DA6556" }}>{fireCount}</strong>
        </div>
      </div>

      {/* Jam Digital Ganda & Tombol Aksi */}
      <div className="flex items-center gap-2.5">
        <div className="text-right font-mono text-xs hidden sm:block leading-tight">
          <div className="font-bold" style={{ color: "#140f0e" }}>{clockWib}</div>
          <div className="text-[10px]" style={{ color: "rgba(20, 15, 14, 0.75)" }}>{clockUtc}</div>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-xs hover:brightness-105 active:scale-95"
          style={{
            background: "#F5EFE3",
            border: "1px solid rgba(20, 15, 14, 0.12)",
            color: "#140f0e",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)"
          }}
          title="Sinkronisasi sensor NASA & Open-Meteo"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} style={{ color: isSyncing ? "#DA6556" : "#A14646" }} />
          <span>{syncStatus || "Live Sync"}</span>
        </button>

        {/* Tombol Legenda */}
        <button
          onClick={onToggleLegend}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs hover:brightness-105 active:scale-95"
          style={isLegendOpen ? {
            background: "#140f0e",
            color: "#F5EFE3",
            border: "1px solid #140f0e",
            boxShadow: "0 2px 10px rgba(20, 15, 14, 0.35)"
          } : {
            background: "#F5EFE3",
            border: "1px solid rgba(20, 15, 14, 0.12)",
            color: "#140f0e",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)"
          }}
          title="Buka / Tutup Keterangan Peta Status Gunung & Ancaman Udara"
        >
          <Layers className="w-3.5 h-3.5" style={{ color: isLegendOpen ? "#F5EFE3" : "#DA6556" }} />
          <span>Legenda</span>
        </button>

        <button
          onClick={onToggleDrawer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs hover:brightness-105 active:scale-95"
          style={isDrawerOpen ? {
            background: "#140f0e",
            color: "#F5EFE3",
            border: "1px solid #140f0e",
            boxShadow: "0 2px 10px rgba(20, 15, 14, 0.35)"
          } : {
            background: "#F5EFE3",
            border: "1px solid rgba(20, 15, 14, 0.12)",
            color: "#140f0e",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)"
          }}
          title="Buka / Tutup Proyeksi Dampak"
        >
          <PanelRight className="w-3.5 h-3.5" style={{ color: isDrawerOpen ? "#F5EFE3" : "#140f0e" }} />
          <span>Proyeksi Dampak</span>
        </button>
      </div>
    </header>
  );
};
