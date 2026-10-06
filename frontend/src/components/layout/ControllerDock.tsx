import React, { useState, useEffect } from "react";
import { Zap, Play, Printer, ChevronDown, ChevronUp } from "lucide-react";
import type { HazardType, ModelingMode, SimulationOverrides } from "../../types/api";
import { api } from "../../services/api";
import { CONFIG } from "../../config/constants";

interface ControllerDockProps {
  hazard: HazardType;
  onHazardChange: (hazard: HazardType) => void;
  eventId: string;
  onEventChange: (eventId: string) => void;
  mode: ModelingMode;
  onModeChange: (mode: ModelingMode) => void;
  overrides: SimulationOverrides;
  onOverridesChange: (overrides: SimulationOverrides) => void;
  onRunSimulation: () => void;
  onRunDemo: () => void;
  isRunning: boolean;
  progressText: string;
  activeRunId?: string | null;
}

export const ControllerDock: React.FC<ControllerDockProps> = ({
  hazard,
  onHazardChange,
  eventId,
  onEventChange,
  mode,
  onModeChange,
  overrides,
  onOverridesChange,
  onRunSimulation,
  onRunDemo,
  isRunning,
  progressText,
  activeRunId
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [volcanoGroups, setVolcanoGroups] = useState<Record<string, any[]>>({});
  const [forestGroups, setForestGroups] = useState<Record<string, any[]>>({});

  useEffect(() => {
    // 1. Muat 70 Gunungapi Nasional dari Backend (PVMBG)
    api.getNationalVolcanoes()
      .then((geo) => {
        const features = geo?.features || [];
        const groups: Record<string, any[]> = {
          "Sumatera": [],
          "Jawa": [],
          "Bali & Nusa Tenggara": [],
          "Sulawesi": [],
          "Maluku & Papua": []
        };
        features.forEach((f: any) => {
          const reg = f.properties?.region || "Lainnya";
          if (!groups[reg]) groups[reg] = [];
          groups[reg].push(f);
        });
        setVolcanoGroups(groups);
      })
      .catch((err) => console.error("Gagal memuat katalog gunung:", err));

    // 2. Muat 36 Kawasan Hutan & Gambut dari Backend
    api.getNationalForests()
      .then((forests) => {
        const list = Array.isArray(forests) ? forests : (forests?.forests || []);
        const groups: Record<string, any[]> = {
          "Sumatera": [],
          "Kalimantan": [],
          "Jawa": [],
          "Bali & Nusa Tenggara": [],
          "Sulawesi": [],
          "Maluku & Papua": []
        };
        list.forEach((k: any) => {
          const reg = k.region || "Lainnya";
          if (!groups[reg]) groups[reg] = [];
          groups[reg].push(k);
        });
        setForestGroups(groups);
      })
      .catch((err) => console.error("Gagal memuat katalog hutan:", err));
  }, []);

  return (
    <div
      className="absolute top-3.5 left-3.5 w-80 max-h-[calc(100%-80px)] backdrop-blur-xl rounded-xl shadow-2xl z-[1000] flex flex-col overflow-hidden"
      style={{
        background: "rgba(245, 239, 227, 0.95)",
        border: "1px solid rgba(0, 0, 0, 0.1)",
        color: "#140f0e"
      }}
    >
      {/* Header Dock */}
      <div
        className="px-3.5 py-2.5 flex items-center justify-between shrink-0"
        style={{ borderBottom: "1px solid rgba(0, 0, 0, 0.08)" }}
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: "#EB895B" }} />
          <div>
            <span className="font-bold text-xs block" style={{ color: "#140f0e" }}>Pusat Kendali Simulasi</span>
            <span className="text-[10px]" style={{ color: "rgba(20, 15, 14, 0.6)" }}>Model Lagrangian RK2 (15 Ansambel)</span>
          </div>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded transition cursor-pointer hover:bg-black/5 hover:text-black"
          style={{ color: "rgba(20, 15, 14, 0.6)" }}
          title={isCollapsed ? "Buka Panel" : "Ciutkan Panel"}
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Body Dock */}
      {!isCollapsed && (
        <div className="p-3.5 space-y-3 overflow-y-auto">
          {/* Pilihan Bahaya */}
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "rgba(20, 15, 14, 0.85)" }}>
              Jenis Bahaya Atmosfer:
            </label>
            <select
              value={hazard}
              onChange={(e) => onHazardChange(e.target.value as HazardType)}
              className="w-full rounded-md px-2.5 py-1.5 text-xs outline-none transition"
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(0, 0, 0, 0.15)",
                color: "#140f0e"
              }}
            >
              <option value="volcano">🌋 Erupsi Gunung Api (Abu Vulkanik)</option>
              <option value="fire">🔥 Karhutla Gambut (Asap PM2.5)</option>
            </select>
          </div>

          {/* Pilihan Kejadian */}
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "rgba(20, 15, 14, 0.85)" }}>
              Lokasi Kejadian (Nasional):
            </label>
            <select
              value={eventId}
              onChange={(e) => onEventChange(e.target.value)}
              className="w-full rounded-md px-2.5 py-1.5 text-xs outline-none transition"
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(0, 0, 0, 0.15)",
                color: "#140f0e"
              }}
            >
              {hazard === "volcano" ? (
                Object.keys(volcanoGroups).length > 0 ? (
                  Object.entries(volcanoGroups).map(([reg, list]) => {
                    if (list.length === 0) return null;
                    return (
                      <optgroup key={reg} label={`Gunung Api ${reg} (${list.length})`}>
                        {list.map((f) => {
                          const p = f.properties || f;
                          const id = p.event_id || p.id;
                          const lvlName = p.level_name ? p.level_name.split(' ')[0] + ' ' + (p.level_name.split(' ')[1] || '') : `Level ${p.level || 1}`;
                          return (
                            <option key={id} value={id}>
                              {`[${lvlName}] ${p.name} (${p.province}) - ${p.elevation_m}m`}
                            </option>
                          );
                        })}
                      </optgroup>
                    );
                  })
                ) : (
                  <optgroup label="Gunungapi Aktif PVMBG">
                    <option value="anak_krakatau_2026_09">[Level III] G. Anak Krakatau (Selat Sunda)</option>
                    <option value="merapi_yogyakarta">[Level III] G. Merapi (Jawa Tengah / DIY)</option>
                    <option value="lewotobi_laki_laki">[Level IV] G. Lewotobi Laki-laki (NTT)</option>
                    <option value="marapi_sumatera">[Level III] G. Marapi (Sumatera Barat)</option>
                    <option value="semeru">[Level III] G. Semeru (Jawa Timur)</option>
                    <option value="agung">[Level II] G. Agung (Bali)</option>
                    <option value="rinjani">[Level II] G. Rinjani (Lombok, NTB)</option>
                    <option value="sinabung">[Level II] G. Sinabung (Sumatera Utara)</option>
                  </optgroup>
                )
              ) : (
                Object.keys(forestGroups).length > 0 ? (
                  Object.entries(forestGroups).map(([reg, list]) => {
                    if (list.length === 0) return null;
                    return (
                      <optgroup key={reg} label={`Kawasan Hutan ${reg} (${list.length})`}>
                        {list.map((k) => (
                          <option key={k.id} value={k.id}>
                            {`[${k.risk_level || 'Rawan'}] ${k.name} - ${k.forest_type}`}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })
                ) : (
                  <optgroup label="Kebakaran Hutan &amp; Lahan Gambut">
                    <option value="hutan_sebangau">[Sangat Rawan] TN Sebangau - Hutan Rawa Gambut Tropis</option>
                    <option value="hutan_eks_plg">[Sangat Rawan] KHG Eks-PLG Sejuta Ha - Gambut Kritis</option>
                    <option value="live_kalimantan">Karhutla Gambut Kalimantan (NASA FIRMS Live)</option>
                  </optgroup>
                )
              )}
            </select>
          </div>

          {/* Switcher Mode */}
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "rgba(20, 15, 14, 0.85)" }}>
              Mode Pemodelan:
            </label>
            <div
              className="grid grid-cols-2 rounded-md p-0.5 text-center text-xs"
              style={{ background: "#FFFFFF", border: "1px solid rgba(0, 0, 0, 0.1)" }}
            >
              <button
                type="button"
                onClick={() => onModeChange("auto")}
                className="py-1 rounded font-medium transition cursor-pointer"
                style={mode === "auto" ? {
                  background: "#EB895B",
                  color: "#FFFFFF",
                  fontWeight: 700
                } : {
                  color: "rgba(20, 15, 14, 0.6)"
                }}
              >
                Otomatis (Data Nyata)
              </button>
              <button
                type="button"
                onClick={() => onModeChange("experiment")}
                className="py-1 rounded font-medium transition cursor-pointer"
                style={mode === "experiment" ? {
                  background: "#EB895B",
                  color: "#FFFFFF",
                  fontWeight: 700
                } : {
                  color: "rgba(20, 15, 14, 0.6)"
                }}
              >
                Coba-coba (What-If)
              </button>
            </div>
          </div>

          {/* Parameter Eksperimen */}
          {mode === "experiment" && (
            <div
              className="rounded-lg p-2.5 space-y-2 text-xs"
              style={{
                background: "rgba(255, 255, 255, 0.5)",
                border: "1px solid rgba(0, 0, 0, 0.05)"
              }}
            >
              <span className="font-bold block text-[11px]" style={{ color: "#EB895B" }}>Parameter What-If Skenario</span>

              {hazard === "volcano" ? (
                <div>
                  <label className="text-[10px] block mb-1" style={{ color: "rgba(20, 15, 14, 0.7)" }}>
                    Tinggi Kolom (km di atas kawah):
                  </label>
                  <input
                    type="number"
                    value={overrides.column_height_km ?? 12}
                    min={1}
                    max={25}
                    step={0.5}
                    onChange={(e) =>
                      onOverridesChange({ ...overrides, column_height_km: parseFloat(e.target.value) })
                    }
                    className="w-full rounded px-2 py-1 font-mono text-xs"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(0, 0, 0, 0.15)",
                      color: "#140f0e"
                    }}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] block mb-1" style={{ color: "rgba(20, 15, 14, 0.7)" }}>
                    Skala Daya Panas Api (FRP %): {overrides.frp_scale ? overrides.frp_scale * 100 : 100}%
                  </label>
                  <input
                    type="range"
                    min={20}
                    max={200}
                    value={overrides.frp_scale ? overrides.frp_scale * 100 : 100}
                    onChange={(e) =>
                      onOverridesChange({ ...overrides, frp_scale: parseFloat(e.target.value) / 100 })
                    }
                    className="w-full"
                    style={{ accentColor: "#EB895B" }}
                  />
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 text-[11px] cursor-pointer pt-1" style={{ color: "rgba(20, 15, 14, 0.85)" }}>
                  <input
                    type="checkbox"
                    checked={overrides.wind_reverse_troposphere ?? false}
                    onChange={(e) =>
                      onOverridesChange({ ...overrides, wind_reverse_troposphere: e.target.checked })
                    }
                    className="rounded"
                    style={{ accentColor: "#EB895B" }}
                  />
                  <span>Balikkan Arah Angin Troposfer (180°)</span>
                </label>
              </div>

              <div>
                <label className="text-[10px] block mb-1" style={{ color: "rgba(20, 15, 14, 0.7)" }}>
                  Curah Hujan Pencuci (mm/jam):
                </label>
                <input
                  type="number"
                  value={overrides.rain_scavenging_mm_h ?? 0}
                  min={0}
                  max={50}
                  step={5}
                  onChange={(e) =>
                    onOverridesChange({ ...overrides, rain_scavenging_mm_h: parseFloat(e.target.value) })
                  }
                  className="w-full rounded px-2 py-1 font-mono text-xs"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(0, 0, 0, 0.15)",
                    color: "#140f0e"
                  }}
                />
              </div>
            </div>
          )}

          {/* Tombol Eksekusi Utama */}
          <button
            onClick={onRunSimulation}
            disabled={isRunning}
            className="w-full py-2.5 px-3 rounded-lg font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            style={{
              background: "linear-gradient(to right, #EB895B, #DA6556)",
              color: "#FFFFFF",
              boxShadow: "0 4px 14px rgba(235, 137, 91, 0.3)"
            }}
          >
            <Zap className={`w-4 h-4 ${isRunning ? "animate-spin" : ""}`} />
            <span>{isRunning ? "MENGHITUNG SEBARAN..." : "JALANKAN SIMULASI SEBARAN"}</span>
          </button>

          {/* Action Row */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={onRunDemo}
              disabled={isRunning}
              className="py-1.5 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer hover:bg-black/5"
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(0, 0, 0, 0.1)",
                color: "#140f0e"
              }}
            >
              <Play className="w-3 h-3 fill-current" style={{ color: "#EB895B" }} />
              <span>Putar Demo</span>
            </button>
            <button
              onClick={() => {
                if (activeRunId) {
                  window.open(`${CONFIG.API_BASE}/runs/${activeRunId}/export?format=html`, "_blank");
                } else {
                  window.print();
                }
              }}
              className="py-1.5 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer hover:bg-black/5"
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(0, 0, 0, 0.1)",
                color: "#140f0e"
              }}
            >
              <Printer className="w-3 h-3" style={{ color: "rgba(20, 15, 14, 0.6)" }} />
              <span>Ekspor Laporan</span>
            </button>
          </div>

          {/* Progress Indicator */}
          {isRunning && (
            <div className="pt-2">
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(235, 137, 91, 0.15)" }}>
                <div className="h-full animate-pulse w-3/4 rounded-full" style={{ background: "#EB895B" }} />
              </div>
              <span className="text-[10px] block text-center mt-1 font-mono" style={{ color: "#EB895B" }}>
                {progressText}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

