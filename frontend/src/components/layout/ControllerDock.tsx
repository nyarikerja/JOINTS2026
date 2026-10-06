import React, { useState } from "react";
import { Zap, Play, Printer, Minus, Plus } from "lucide-react";
import type { HazardType, ModelingMode, SimulationOverrides } from "../../types/api";

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
  progressText
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="absolute top-3.5 left-3.5 w-80 max-h-[calc(100%-80px)] bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl z-[1000] flex flex-col overflow-hidden text-slate-100">
      {/* Header Dock */}
      <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-sky-400" />
          <div>
            <span className="font-bold text-xs text-white block">Pusat Kendali Simulasi</span>
            <span className="text-[10px] text-slate-400">Model Lagrangian RK2 (15 Ansambel)</span>
          </div>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
          title={isCollapsed ? "Buka Panel" : "Ciutkan Panel"}
        >
          {isCollapsed ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
        </button>
      </div>

      {/* Body Dock */}
      {!isCollapsed && (
        <div className="p-3.5 space-y-3 overflow-y-auto">
          {/* Pilihan Bahaya */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Jenis Bahaya Atmosfer:
            </label>
            <select
              value={hazard}
              onChange={(e) => onHazardChange(e.target.value as HazardType)}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-500 transition"
            >
              <option value="volcano">🌋 Erupsi Gunung Api (Abu Vulkanik)</option>
              <option value="fire">🔥 Karhutla Gambut (Asap PM2.5)</option>
            </select>
          </div>

          {/* Pilihan Kejadian */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Lokasi Kejadian (Nasional):
            </label>
            <select
              value={eventId}
              onChange={(e) => onEventChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-500 transition"
            >
              {hazard === "volcano" ? (
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
              ) : (
                <optgroup label="Kebakaran Hutan &amp; Lahan Gambut">
                  <option value="live_kalimantan">Karhutla Gambut Kalimantan (NASA FIRMS Live)</option>
                </optgroup>
              )}
            </select>
          </div>

          {/* Switcher Mode */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Mode Pemodelan:
            </label>
            <div className="grid grid-cols-2 bg-slate-950 border border-slate-800 rounded-md p-0.5 text-center text-xs">
              <button
                type="button"
                onClick={() => onModeChange("auto")}
                className={`py-1 rounded font-medium transition cursor-pointer ${
                  mode === "auto" ? "bg-sky-600 text-white font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Otomatis (Data Nyata)
              </button>
              <button
                type="button"
                onClick={() => onModeChange("experiment")}
                className={`py-1 rounded font-medium transition cursor-pointer ${
                  mode === "experiment" ? "bg-sky-600 text-white font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Coba-coba (What-If)
              </button>
            </div>
          </div>

          {/* Parameter Eksperimen */}
          {mode === "experiment" && (
            <div className="bg-slate-950/80 border border-sky-600/40 rounded-lg p-2.5 space-y-2 text-xs">
              <span className="text-sky-400 font-bold block text-[11px]">Parameter What-If Skenario</span>

              {hazard === "volcano" ? (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
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
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
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
                    className="w-full accent-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={overrides.wind_reverse_troposphere ?? false}
                    onChange={(e) =>
                      onOverridesChange({ ...overrides, wind_reverse_troposphere: e.target.checked })
                    }
                    className="rounded accent-sky-500"
                  />
                  <span>Balikkan Arah Angin Troposfer (180°)</span>
                </label>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
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
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* Tombol Eksekusi Utama */}
          <button
            onClick={onRunSimulation}
            disabled={isRunning}
            className="w-full py-2.5 px-3 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white rounded-lg font-bold text-xs tracking-wide shadow-[0_0_16px_rgba(2,132,199,0.4)] flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
          >
            <Zap className={`w-4 h-4 ${isRunning ? "animate-spin" : ""}`} />
            <span>{isRunning ? "MENGHITUNG SEBARAN..." : "JALANKAN SIMULASI SEBARAN"}</span>
          </button>

          {/* Action Row */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={onRunDemo}
              disabled={isRunning}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Play className="w-3 h-3 text-sky-400 fill-sky-400" />
              <span>Putar Demo</span>
            </button>
            <button
              onClick={() => window.print()}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3 h-3 text-slate-300" />
              <span>Ekspor Laporan</span>
            </button>
          </div>

          {/* Progress Indicator */}
          {isRunning && (
            <div className="pt-2">
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-sky-400 animate-pulse w-3/4 rounded-full" />
              </div>
              <span className="text-[10px] text-sky-400 block text-center mt-1 font-mono">
                {progressText}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
