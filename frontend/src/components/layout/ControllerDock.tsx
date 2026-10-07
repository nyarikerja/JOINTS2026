import React, { useState, useEffect, useMemo } from "react";
import { Sliders, Printer, ChevronDown, ChevronUp, Play } from "lucide-react";
import type { HazardType, ModelingMode, SimulationOverrides } from "../../types/api";
import { api } from "../../services/api";
import { CONFIG } from "../../config/constants";
import BasicDropdown, { type DropdownItem } from "@/components/ui/accordion-2";

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
  onRunDemo?: () => void;
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
  isRunning,
  progressText,
  activeRunId
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [volcanoGroups, setVolcanoGroups] = useState<Record<string, any[]>>({});
  const [forestGroups, setForestGroups] = useState<Record<string, any[]>>({});

  useEffect(() => {
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
          // Hanya masukkan gunung yang memiliki skenario simulasi aktif (event_id)
          if (f.properties?.event_id) {
            const reg = f.properties?.region || "Lainnya";
            if (!groups[reg]) groups[reg] = [];
            groups[reg].push(f);
          }
        });
        setVolcanoGroups(groups);
      })
      .catch((err) => console.error("Gagal memuat katalog gunung:", err));

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

  const handleHazardSelect = (newHazard: HazardType) => {
    onHazardChange(newHazard);
    setSelectedRegion("ALL");
  };

  const regionOptions: DropdownItem[] = useMemo(() => {
    const currentGroups = hazard === "volcano" ? volcanoGroups : forestGroups;
    const base: DropdownItem[] = [{ id: "ALL", label: "Seluruh Indonesia" }];
    Object.entries(currentGroups).forEach(([reg, list]) => {
      if (list.length > 0) {
        base.push({
          id: reg,
          label: `${reg} (${list.length})`
        });
      }
    });
    return base;
  }, [hazard, volcanoGroups, forestGroups]);

  const eventItems: DropdownItem[] = useMemo(() => {
    const items: DropdownItem[] = [];
    const currentGroups = hazard === "volcano" ? volcanoGroups : forestGroups;

    if (hazard === "volcano") {
      const targetRegions = selectedRegion === "ALL" ? Object.keys(currentGroups) : [selectedRegion];
      targetRegions.forEach((reg) => {
        (currentGroups[reg] || []).forEach((f: any) => {
          const p = f.properties || f;
          const id = p.event_id || p.id;
          if (id) {
            items.push({
              id: p.event_id || id,
              label: p.name
            });
          }
        });
      });
    } else {
      const targetRegions = selectedRegion === "ALL" ? Object.keys(currentGroups) : [selectedRegion];
      targetRegions.forEach((reg) => {
        (currentGroups[reg] || []).forEach((k: any) => {
          // Bersihkan detail lokasi di dalam kurung, hanya ambil nama kawasan utamanya
          const cleanName = (k.name || "").replace(/\s*\(.*?\)\s*/g, "").trim();
          if (k.id) {
            items.push({
              id: k.id,
              label: cleanName || k.name
            });
          }
        });
      });
    }

    return items;
  }, [hazard, selectedRegion, volcanoGroups, forestGroups]);

  return (
    <div
      className="absolute top-3.5 left-3.5 w-72 backdrop-blur-md rounded-xl shadow-2xl z-[1000] flex flex-col font-sans text-[#140f0e] overflow-visible"
      style={{
        background: "rgba(245, 239, 227, 0.95)",
        border: "4px solid #EB895B"
      }}
    >
      {/* Header Panel (Sesuai Style Card Lapisan Spasial Aktif) */}
      <div
        className="px-3.5 py-2.5 flex items-center justify-between shrink-0 select-none border-b"
        style={{ borderColor: "rgba(0, 0, 0, 0.1)" }}
      >
        <span
          className="font-serif text-[15px] font-bold tracking-tight leading-none"
          style={{ color: "#EB895B" }}
        >
          Pusat Kendali Simulasi
        </span>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded transition cursor-pointer hover:bg-black/5 text-[#EB895B] opacity-80 hover:opacity-100"
          title={isCollapsed ? "Buka Panel" : "Sembunyikan Panel"}
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Body Container dengan Animasi Expand/Collapse CSS Grid */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          isCollapsed ? "grid-rows-[0fr] opacity-0 pointer-events-none" : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className={isCollapsed ? "overflow-hidden" : "overflow-visible"}>
          <div className="p-3.5 space-y-2.5 overflow-visible">
            {/* 1. Pemilih Bahaya */}
            <div>
              <span className="block text-[11px] text-[#140f0e]/75 mb-1 font-medium">
                Jenis Bencana
              </span>
              <div
                className="grid grid-cols-2 rounded p-0.5 bg-white/70 border border-black/10"
              >
                <button
                  type="button"
                  onClick={() => handleHazardSelect("volcano")}
                  className={`py-1.5 px-2 rounded text-[11px] font-medium text-center transition cursor-pointer ${
                    hazard === "volcano"
                      ? "bg-[#EB895B] text-white font-semibold shadow-xs"
                      : "text-[#140f0e]/70 hover:text-[#140f0e]"
                  }`}
                >
                  Gunung Api
                </button>
                <button
                  type="button"
                  onClick={() => handleHazardSelect("fire")}
                  className={`py-1.5 px-2 rounded text-[11px] font-medium text-center transition cursor-pointer ${
                    hazard === "fire"
                      ? "bg-[#EB895B] text-white font-semibold shadow-xs"
                      : "text-[#140f0e]/70 hover:text-[#140f0e]"
                  }`}
                >
                  Kebakaran Hutan
                </button>
              </div>
            </div>

            {/* 2. Filter Wilayah */}
            <div>
              <label className="block text-[11px] text-[#140f0e]/75 mb-1 font-medium">
                Pilih Wilayah
              </label>
              <BasicDropdown
                label="Pilih Wilayah"
                items={regionOptions}
                value={selectedRegion}
                onChange={(item) => setSelectedRegion(String(item.id))}
                className="w-full"
              />
            </div>

            {/* 3. Titik Kejadian */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] text-[#140f0e]/75 font-medium">
                  Titik Lokasi
                </label>
                <span className="text-[10px] text-[#140f0e]/50">
                  {eventItems.length} lokasi
                </span>
              </div>
              <BasicDropdown
                label={hazard === "volcano" ? "Pilih Gunung Api" : "Pilih Kawasan Hutan"}
                items={eventItems}
                value={eventId}
                searchable={true}
                searchPlaceholder={hazard === "volcano" ? "Cari nama gunung" : "Cari nama kawasan"}
                onChange={(item) => onEventChange(String(item.id))}
                className="w-full"
              />
            </div>

            {/* 4. Switcher Mode Pemodelan */}
            <div>
              <span className="block text-[11px] text-[#140f0e]/75 mb-1 font-medium">
                Pilihan Mode
              </span>
              <div
                className="grid grid-cols-2 rounded p-0.5 bg-white/70 border border-black/10"
              >
                <button
                  type="button"
                  onClick={() => onModeChange("auto")}
                  className={`py-1 rounded transition cursor-pointer text-[11px] text-center ${
                    mode === "auto"
                      ? "bg-[#EB895B] text-white font-semibold shadow-xs"
                      : "text-[#140f0e]/70 hover:text-[#140f0e]"
                  }`}
                >
                  Kondisi Nyata
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange("experiment")}
                  className={`py-1 rounded transition cursor-pointer text-[11px] text-center ${
                    mode === "experiment"
                      ? "bg-[#EB895B] text-white font-semibold shadow-xs"
                      : "text-[#140f0e]/70 hover:text-[#140f0e]"
                  }`}
                >
                  Uji Skenario
                </button>
              </div>
            </div>

            {/* 5. Parameter Uji Skenario */}
            {mode === "experiment" && (
              <div
                className="rounded p-2.5 space-y-2 text-xs border bg-white/60 border-[#EB895B]/40"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-[#EB895B] font-semibold">
                  <Sliders className="w-3 h-3" />
                  <span>Pengaturan Tambahan</span>
                </div>

                {hazard === "volcano" ? (
                  <div>
                    <div className="flex justify-between text-[11px] mb-1 text-[#140f0e]/80">
                      <span>Tinggi Letusan</span>
                      <strong className="text-[#140f0e] font-semibold">{overrides.column_height_km ?? 12} km</strong>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={25}
                      step={0.5}
                      value={overrides.column_height_km ?? 12}
                      onChange={(e) =>
                        onOverridesChange({ ...overrides, column_height_km: parseFloat(e.target.value) })
                      }
                      className="w-full h-1.5 rounded bg-black/10 cursor-pointer accent-[#EB895B]"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between text-[11px] mb-1 text-[#140f0e]/80">
                      <span>Kekuatan Api (FRP)</span>
                      <strong className="text-[#140f0e] font-semibold">{overrides.frp_scale ? Math.round(overrides.frp_scale * 100) : 100}%</strong>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={200}
                      value={overrides.frp_scale ? overrides.frp_scale * 100 : 100}
                      onChange={(e) =>
                        onOverridesChange({ ...overrides, frp_scale: parseFloat(e.target.value) / 100 })
                      }
                      className="w-full h-1.5 rounded bg-black/10 cursor-pointer accent-[#EB895B]"
                    />
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-[11px] mb-1 text-[#140f0e]/80">
                    <span>Hujan di Lokasi</span>
                    <strong className="text-[#140f0e] font-semibold">{overrides.rain_scavenging_mm_h ?? 0} mm/jam</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={5}
                    value={overrides.rain_scavenging_mm_h ?? 0}
                    onChange={(e) =>
                      onOverridesChange({ ...overrides, rain_scavenging_mm_h: parseFloat(e.target.value) })
                    }
                    className="w-full h-1.5 rounded bg-black/10 cursor-pointer accent-[#EB895B]"
                  />
                </div>

                <label className="flex items-center gap-2 text-[11px] cursor-pointer pt-0.5 text-[#140f0e]/85">
                  <input
                    type="checkbox"
                    checked={overrides.wind_reverse_troposphere ?? false}
                    onChange={(e) =>
                      onOverridesChange({ ...overrides, wind_reverse_troposphere: e.target.checked })
                    }
                    className="rounded accent-[#EB895B]"
                  />
                  <span>Balikkan Arah Angin</span>
                </label>
              </div>
            )}

            {/* 6. Tombol Tunggal Eksekusi Simulasi */}
            <button
              type="button"
              onClick={() => {
                console.log("Tombol Mulai Simulasi diklik! Hazard:", hazard, "EventId:", eventId);
                onRunSimulation();
              }}
              disabled={isRunning || !eventId}
              className="w-full py-2 px-3 rounded font-medium text-xs tracking-wide flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-white bg-[#EB895B] hover:bg-[#d97746] active:scale-[0.99] shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunning ? "Menghitung Sebaran..." : "Mulai Simulasi"}</span>
            </button>

            {/* Tombol Ekspor Laporan */}
            <button
              type="button"
              onClick={() => {
                if (activeRunId) {
                  window.open(`${CONFIG.API_BASE}/runs/${activeRunId}/export?format=html`, "_blank");
                } else {
                  window.print();
                }
              }}
              className="w-full py-1.5 px-2 rounded text-[11px] font-normal flex items-center justify-center gap-1.5 transition cursor-pointer hover:bg-black/5 bg-white/70 border border-black/10 text-[#140f0e]/80 hover:text-[#140f0e]"
            >
              <Printer className="w-3.5 h-3.5 text-[#140f0e]/60" />
              <span>Cetak Ringkasan</span>
            </button>

            {/* Progress Telemetri */}
            {isRunning && (
              <div className="pt-1">
                <div className="h-1 rounded-full overflow-hidden bg-black/10">
                  <div className="h-full animate-pulse w-3/4 rounded-full bg-[#EB895B]" />
                </div>
                <span className="text-[10px] block text-center mt-1 text-[#EB895B]">
                  {progressText}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
