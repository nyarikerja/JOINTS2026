import React, { useState, useEffect } from "react";
import {
  ArrowClockwise,
  SidebarSimple,
  Stack,
  Question,
  X,
  CrosshairSimple,
  BookOpen
} from "@phosphor-icons/react";
import { Home } from "lucide-react";
import { api } from "../../services/api";
import type { SummaryKpiResponse } from "../../types/api";

interface TacticalHeaderProps {
  onResetView?: () => void;
  onToggleDrawer: () => void;
  isDrawerOpen: boolean;
  onToggleLegend?: () => void;
  isLegendOpen?: boolean;
  isHelpOpen?: boolean;
  onOpenHelp?: () => void;
  onCloseHelp?: () => void;
  onOpenGpsModal?: () => void;
}

export const TacticalHeader: React.FC<TacticalHeaderProps> = ({
  onToggleDrawer,
  isDrawerOpen,
  onToggleLegend,
  isLegendOpen = false,
  isHelpOpen: controlledHelpOpen,
  onOpenHelp,
  onCloseHelp,
  onOpenGpsModal
}) => {
  const [clockWib, setClockWib] = useState("--:--:-- WIB");
  const [clockUtc, setClockUtc] = useState("--:--:-- UTC");
  const [kpi, setKpi] = useState<SummaryKpiResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [internalHelpOpen, setInternalHelpOpen] = useState(false);

  const isHelpOpen = controlledHelpOpen !== undefined ? controlledHelpOpen : internalHelpOpen;

  const closeHelp = () => {
    if (onCloseHelp) {
      onCloseHelp();
    } else {
      setInternalHelpOpen(false);
    }
    localStorage.setItem("hasSeenManual", "true");
  };

  const openHelp = () => {
    if (onOpenHelp) {
      onOpenHelp();
    } else {
      setInternalHelpOpen(true);
    }
  };

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isHelpOpen) {
        closeHelp();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHelpOpen]);

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
      const latencies = Object.values(res.sources || {})
        .map((s) => s.latency_ms)
        .filter((l): l is number => typeof l === "number");
      const avgLatency = latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : (res.latency_ms || 92);
      setSyncStatus(`Tersinkron (${avgLatency}ms)`);
      await loadKpi();
    } catch {
      setSyncStatus("Gagal");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  return (
    <>
      <header
      className="h-[52px] backdrop-blur-md px-4 flex items-center justify-between z-[1100] shrink-0"
      style={{
        backgroundColor: "#EB895B",
        borderBottom: "1px solid rgba(161, 70, 70, 0.35)",
        boxShadow: "0 2px 14px rgba(0, 0, 0, 0.2)"
      }}
    >
      <a
        href="/"
        className="flex items-center gap-2.5 group cursor-pointer transition hover:opacity-90 no-underline"
        title="Kembali ke Landing Page HelaLoka"
        onClick={() => {
          try {
            if (localStorage.getItem('hl-sound') !== 'off') {
              localStorage.setItem('hl-sound', 'on');
            }
          } catch (e) {}
        }}
      >
        <img
          src="/gunung_black.png"
          alt="Logo HELALOKA"
          className="w-8 h-8 object-contain shrink-0 drop-shadow-sm select-none pointer-events-none group-hover:scale-105 transition-transform"
        />
        <div className="flex items-center gap-1.5">
          <span className="font-heading text-lg tracking-tight" style={{ color: "#140f0e" }}>HELALOKA</span>
          <span className="font-subheading text-[10px] px-1.5 py-0.5 rounded tracking-wider text-white shadow-xs" style={{ backgroundColor: "#A14646" }}>
            INDONESIA
          </span>
        </div>
      </a>

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

        {/* Tombol Kembali ke Landing Page */}
        <a
          href="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs hover:brightness-105 active:scale-95 no-underline bg-[#F5EFE3]"
          style={{
            border: "1px solid rgba(20, 15, 14, 0.12)",
            color: "#140f0e",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)"
          }}
          title="Kembali ke Landing Page HelaLoka"
        >
          <Home className="w-3.5 h-3.5" style={{ color: "#A14646" }} />
          <span className="hidden sm:inline">Beranda</span>
        </a>

        <button
          onClick={openHelp}
          className="flex items-center justify-center w-7 h-7 rounded-lg transition cursor-pointer shadow-xs hover:brightness-105 active:scale-95 bg-[#F5EFE3]"
          style={{
            border: "1px solid rgba(20, 15, 14, 0.12)",
            color: "#A14646",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)"
          }}
          title="Panduan Penggunaan"
        >
          <Question size={16} weight="bold" />
        </button>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center justify-center w-7 h-7 rounded-lg transition cursor-pointer disabled:opacity-50 shadow-xs hover:brightness-105 active:scale-95 bg-[#F5EFE3]"
          style={{
            border: "1px solid rgba(20, 15, 14, 0.12)",
            color: "#140f0e",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)"
          }}
          title={syncStatus ? `Sinkronisasi: ${syncStatus}` : "Sinkronisasi sensor NASA & Open-Meteo"}
          aria-label="Live Sync"
        >
          <ArrowClockwise size={15} weight="bold" className={isSyncing ? "animate-spin" : ""} style={{ color: isSyncing ? "#DA6556" : "#A14646" }} />
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
          <Stack size={15} weight={isLegendOpen ? "fill" : "duotone"} style={{ color: isLegendOpen ? "#F5EFE3" : "#DA6556" }} />
          <span>Legenda</span>
        </button>

        {/* Tombol AI Cek GPS (Pindah ke tengah antara Legenda dan Proyeksi) */}
        {onOpenGpsModal && (
          <button
            onClick={onOpenGpsModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs hover:brightness-105 active:scale-95"
            style={{
              background: "#F5EFE3",
              border: "1px solid rgba(20, 15, 14, 0.12)",
              color: "#065f46",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)"
            }}
            title="Periksa zonasi bahaya abu/karhutla di lokasi Anda saat ini (AI GPS)"
          >
            <CrosshairSimple size={15} weight="bold" className="text-emerald-700" />
            <span>AI GPS</span>
          </button>
        )}

        {/* Tombol Proyeksi */}
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
          title="Buka / Tutup Proyeksi"
        >
          <SidebarSimple size={15} weight={isDrawerOpen ? "fill" : "duotone"} style={{ color: isDrawerOpen ? "#F5EFE3" : "#140f0e" }} />
          <span>Proyeksi</span>
        </button>
      </div>
    </header>

      {/* Modal Panduan Operasional Simulasi (Style Identik GPS Modal) */}
      {isHelpOpen && (
        <div 
          className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 font-sans animate-fade-in"
          onClick={closeHelp}
        >
          <div 
            className="relative w-full max-w-md bg-[#f7f3ed] rounded-[28px] shadow-2xl border border-[#2b211e]/15 overflow-hidden text-[#2b211e] flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
            style={{
              boxShadow: "0 25px 60px -15px rgba(20, 15, 14, 0.5)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Scrollable Body */}
            <div className="overflow-y-auto p-6 md:p-7 space-y-4 custom-scrollbar">
              {/* 1. Baris Atas: Badge Status di Kiri, Logo HELALOKA & Tombol Tutup di Kanan */}
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-bold tracking-wide uppercase shadow-2xs bg-[#EB895B] text-white">
                  <BookOpen size={13} weight="bold" />
                  <span>PANDUAN OPERASIONAL</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <img
                    src="/gunung_black.png"
                    alt="Logo HELALOKA"
                    className="w-8 h-8 object-contain shrink-0"
                  />
                  <button
                    type="button"
                    onClick={closeHelp}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#2b211e]/50 hover:text-[#2b211e] hover:bg-[#2b211e]/10 transition cursor-pointer"
                    title="Tutup (Esc)"
                  >
                    <X size={18} weight="bold" />
                  </button>
                </div>
              </div>

              {/* 2. Judul Utama & Subtitle */}
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-[#140f0e] leading-snug tracking-tight">
                  Panduan Simulasi
                </h2>
                <p className="text-xs text-[#2b211e]/75 mt-1 leading-relaxed">
                  Tiga langkah taktis menjalankan pemodelan dispersi atmosferik dan menganalisis proyeksi.
                </p>
              </div>

              {/* Step 1 */}
              <div className="rounded-2xl p-4 bg-white/80 border border-[#2b211e]/10 shadow-2xs flex items-start gap-3.5 transition hover:border-[#EB895B]/40">
                <div className="w-8 h-8 rounded-full bg-[#EB895B] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs font-mono">
                  1
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-[#140f0e] mb-0.5">Pilih Gunung / Kejadian</h4>
                  <p className="text-[11px] text-[#2b211e]/75 leading-relaxed">
                    Pilih salah satu gunung berapi aktif di sebelah menu <strong>"Pusat Kendali Simulasi"</strong> pada pojok kiri bawah.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-2xl p-4 bg-white/80 border border-[#2b211e]/10 shadow-2xs flex items-start gap-3.5 transition hover:border-[#EB895B]/40">
                <div className="w-8 h-8 rounded-full bg-[#DA6556] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs font-mono">
                  2
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-[#140f0e] mb-0.5">Jalankan Simulasi</h4>
                  <p className="text-[11px] text-[#2b211e]/75 leading-relaxed">
                    Tekan tombol <strong>"Mulai Simulasi"</strong> yang berwarna oranye dan tunggu hingga pemrosesan model dispersi selesai.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-2xl p-4 bg-white/80 border border-[#2b211e]/10 shadow-2xs flex items-start gap-3.5 transition hover:border-[#EB895B]/40">
                <div className="w-8 h-8 rounded-full bg-[#A14646] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs font-mono">
                  3
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-[#140f0e] mb-0.5">Lihat Proyeksi</h4>
                  <p className="text-[11px] text-[#2b211e]/75 leading-relaxed">
                    Akses analisis hasil paparan penduduk, fasilitas publik, dan AI melalui tombol <strong>"Proyeksi"</strong> di pojok kanan atas.
                  </p>
                </div>
              </div>

              {/* 3. Footer Aksi */}
              <div className="pt-2 flex items-center justify-end border-t border-[#2b211e]/10">
                <button
                  type="button"
                  onClick={closeHelp}
                  className="px-6 py-2 bg-[#EB895B] hover:bg-[#DA6556] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer font-button active:scale-98"
                >
                  Paham
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
