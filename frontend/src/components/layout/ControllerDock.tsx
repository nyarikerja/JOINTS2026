import React, { useState, useEffect, useMemo } from "react";
import { Sliders, Printer, ChevronDown, ChevronUp, Play } from "lucide-react";
import type { HazardType, ModelingMode, SimulationOverrides } from "../../types/api";
import { api } from "../../services/api";
import BasicDropdown, { type DropdownItem } from "@/components/ui/accordion-2";

interface ControllerDockProps {
  hazard: HazardType;
  onHazardChange: (hazard: HazardType) => void;
  eventId: string;
  onEventChange: (eventId: string) => void;
  onEventNameChange?: (name: string) => void;
  mode: ModelingMode;
  onModeChange: (mode: ModelingMode) => void;
  overrides: SimulationOverrides;
  onOverridesChange: (overrides: SimulationOverrides) => void;
  onRunSimulation: () => void;
  onRunDemo?: () => void;
  onOpenPrintReport?: () => void;
  isRunning: boolean;
  progressText: string;
  activeRunId?: string | null;
  simulatedEventName?: string;
}

export const ControllerDock: React.FC<ControllerDockProps> = ({
  hazard,
  onHazardChange,
  eventId,
  onEventChange,
  onEventNameChange,
  mode,
  onModeChange,
  overrides,
  onOverridesChange,
  onRunSimulation,
  onOpenPrintReport,
  isRunning,
  progressText: _progressText,
  activeRunId,
  simulatedEventName: _simulatedEventName
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
          // Masukkan seluruh 70 katalog gunung api aktif PVMBG nasional
          const reg = f.properties?.region || "Lainnya";
          if (!groups[reg]) groups[reg] = [];
          groups[reg].push(f);
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
      const collected: any[] = [];
      targetRegions.forEach((reg) => {
        (currentGroups[reg] || []).forEach((f: any) => {
          collected.push(f);
        });
      });

      // Urutkan: Level tertinggi (Awas/Siaga/Waspada/Normal) terlebih dahulu, lalu nama alfabetis
      collected.sort((a, b) => {
        const lvlA = a.properties?.level ?? 1;
        const lvlB = b.properties?.level ?? 1;
        if (lvlB !== lvlA) return lvlB - lvlA;
        return (a.properties?.name || "").localeCompare(b.properties?.name || "");
      });

      collected.forEach((f: any) => {
        const p = f.properties || f;
        const id = p.event_id || p.id;
        if (id) {
          const statusSuffix = p.level_name ? ` • ${p.level_name}` : "";
          items.push({
            id: p.event_id || id,
            label: `${p.name}${statusSuffix}`
          });
        }
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

  React.useEffect(() => {
    if (onEventNameChange) {
      const selected = eventItems.find((i) => String(i.id) === eventId);
      if (selected) {
        const nameOnly = selected.label.split(" • ")[0];
        onEventNameChange(nameOnly);
      }
    }
  }, [eventId, eventItems, onEventNameChange]);

  return (
    <div
      className="absolute top-3.5 left-3.5 w-72 backdrop-blur-md rounded-xl z-[1000] flex flex-col font-sans text-[#140f0e] overflow-visible"
      style={{
        background: "rgba(245, 239, 227, 0.95)",
        boxShadow: "10px -8px 24px rgba(0, 0, 0, 0.45)"
      }}
    >
      {/* Header Panel (Background Putih Bersih Seperti Header Modal Panduan) */}
      <div
        className={`px-4 py-3 flex items-center justify-between shrink-0 select-none bg-white transition-[border-radius] duration-300 ${
          isCollapsed ? "rounded-xl" : "rounded-t-xl border-b"
        }`}
        style={{ borderColor: "rgba(43, 33, 30, 0.1)" }}
      >
        <span
          className="font-heading text-[15px] leading-none tracking-wide"
          style={{ color: "#140f0e", letterSpacing: "0.04em" }}
        >
          Pusat Kendali Simulasi
        </span>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded transition cursor-pointer hover:bg-black/5 text-[#140f0e]/60 hover:text-[#140f0e]"
          title={isCollapsed ? "Buka Panel" : "Sembunyikan Panel"}
        >
          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Body Container dengan Animasi Expand/Collapse CSS Grid */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          isCollapsed ? "grid-rows-[0fr] opacity-0 pointer-events-none" : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className={isCollapsed ? "overflow-hidden" : "overflow-visible"}>
          <div className="p-3 space-y-2 overflow-visible">
            {/* 1. Pemilih Bahaya */}
            <div>
              <span className="block text-[8.5px] text-[#140f0e]/85 mb-1 font-subheading tracking-wider uppercase">
                Jenis Bencana
              </span>
              <div
                className="grid grid-cols-2 rounded p-0.5 bg-white/70 border border-black/10"
              >
                <button
                  type="button"
                  onClick={() => handleHazardSelect("volcano")}
                  className={`py-1.5 px-2 rounded text-[11.5px] text-center transition cursor-pointer !font-body ${
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
                  className={`py-1.5 px-2 rounded text-[11.5px] text-center transition cursor-pointer !font-body ${
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
              <label className="block text-[8.5px] text-[#140f0e]/85 mb-1 font-subheading tracking-wider uppercase">
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
                <label className="block text-[8.5px] text-[#140f0e]/85 font-subheading tracking-wider uppercase">
                  Titik Lokasi
                </label>
                <span className="text-[10px] text-[#140f0e]/50 font-body">
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
              <span className="block text-[8.5px] text-[#140f0e]/85 mb-1 font-subheading tracking-wider uppercase">
                Pilihan Mode
              </span>
              <div
                className="grid grid-cols-2 rounded p-0.5 bg-white/70 border border-black/10"
              >
                <button
                  type="button"
                  onClick={() => onModeChange("auto")}
                  className={`py-1.5 rounded transition cursor-pointer text-[11.5px] text-center !font-body ${
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
                  className={`py-1.5 rounded transition cursor-pointer text-[11.5px] text-center !font-body ${
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
                className="rounded p-2 space-y-1.5 text-xs border bg-white/60 border-[#EB895B]/40 font-body"
              >
                <div className="flex items-center gap-1.5 text-[10.5px] text-[#EB895B] font-subheading">
                  <Sliders className="w-3 h-3" />
                  <span>Pengaturan Tambahan</span>
                </div>

                {hazard === "volcano" ? (
                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5 text-[#140f0e]/80 font-body">
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
                    <div className="flex justify-between text-[10px] mb-0.5 text-[#140f0e]/80 font-body">
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
                  <div className="flex justify-between text-[10px] mb-0.5 text-[#140f0e]/80 font-body">
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

                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer pt-0.5 text-[#140f0e]/85 font-body">
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
              className="w-full py-2.5 px-3 rounded text-[10px] tracking-wider uppercase flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-white bg-[#EB895B] hover:bg-[#d97746] active:scale-[0.99] shadow-xs font-button"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{isRunning ? "Menghitung Sebaran..." : "Mulai Simulasi"}</span>
            </button>

            {/* Tombol Ekspor Laporan */}
            <button
              type="button"
              disabled={isRunning || !activeRunId}
              onClick={() => {
                if (onOpenPrintReport) {
                  onOpenPrintReport();
                } else if (activeRunId) {
                  window.print();
                }
              }}
              className="w-full py-1.5 px-2 rounded text-[9.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5 bg-white/70 border border-black/10 text-[#140f0e]/80 hover:text-[#140f0e] font-button"
            >
              <Printer className="w-3.5 h-3.5 text-[#140f0e]/60" />
              <span>Cetak Ringkasan</span>
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};
