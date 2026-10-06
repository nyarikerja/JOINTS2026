import React, { useEffect, useState } from "react";
import { RefreshCw, MapPin, PanelRight } from "lucide-react";
import { api } from "../../services/api";
import type { SummaryKpiResponse } from "../../types/api";

interface TacticalHeaderProps {
  onResetView: () => void;
  onToggleDrawer: () => void;
  isDrawerOpen: boolean;
}

export const TacticalHeader: React.FC<TacticalHeaderProps> = ({
  onResetView,
  onToggleDrawer,
  isDrawerOpen
}) => {
  const [clockWib, setClockWib] = useState("--:--:-- WIB");
  const [clockUtc, setClockUtc] = useState("--:--:-- UTC");
  const [, setKpi] = useState<SummaryKpiResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

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
    <header className="h-[52px] bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 flex items-center justify-between z-[1100] shrink-0">
      <div className="flex items-center gap-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm tracking-tight text-white">UdaraSiaga</span>
            <span className="bg-red-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded tracking-wider">
              INDONESIA
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block leading-tight">
            Pusat Pemodelan Dispersi Atmosfer Erupsi &amp; Karhutla Nasional
          </span>
        </div>
      </div>



      {/* Jam Digital Ganda & Tombol Aksi */}
      <div className="flex items-center gap-2.5">
        <div className="text-right font-mono text-xs hidden sm:block leading-tight">
          <div className="text-sky-400 font-semibold">{clockWib}</div>
          <div className="text-[10px] text-slate-400">{clockUtc}</div>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md text-xs font-medium text-slate-200 transition cursor-pointer disabled:opacity-50"
          title="Sinkronisasi sensor NASA & Open-Meteo"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-sky-400" : ""}`} />
          <span>{syncStatus || "Live Sync"}</span>
        </button>

        <button
          onClick={onResetView}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md text-xs font-medium text-slate-200 transition cursor-pointer"
          title="Pusatkan Tampilan Peta ke Indonesia"
        >
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Indonesia</span>
        </button>

        <button
          onClick={onToggleDrawer}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
            isDrawerOpen
              ? "bg-sky-600 hover:bg-sky-500 text-white shadow-[0_0_12px_rgba(2,132,199,0.5)]"
              : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          }`}
          title="Buka / Tutup Laci Analitik"
        >
          <PanelRight className="w-3.5 h-3.5" />
          <span>Laci Analitik</span>
        </button>
      </div>
    </header>
  );
};
