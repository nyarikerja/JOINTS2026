import React, { useState } from "react";
import { TacticalHeader } from "./components/layout/TacticalHeader";
import { ActionStrip } from "./components/layout/ActionStrip";
import { ControllerDock } from "./components/layout/ControllerDock";
import { MapWorkspace } from "./components/layout/MapWorkspace";
import { TimelinePlayer } from "./components/layout/TimelinePlayer";
import { AnalyticsDrawer } from "./components/layout/AnalyticsDrawer";
import { api } from "./services/api";
import type {
  HazardType,
  ModelingMode,
  SimulationOverrides,
  ImpactResponse,
  FacilitiesImpactResponse,
  ValidationResponse,
  SchoolItem
} from "./types/api";

export const App: React.FC = () => {
  const [hazard, setHazard] = useState<HazardType>("volcano");
  const [eventId, setEventId] = useState<string>("anak_krakatau_2026_09");
  const [mode, setMode] = useState<ModelingMode>("auto");
  const [overrides, setOverrides] = useState<SimulationOverrides>({
    column_height_km: 12.0,
    frp_scale: 1.0,
    wind_reverse_troposphere: false,
    rain_scavenging_mm_h: 0
  });

  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [currentHour, setCurrentHour] = useState<number>(0);
  const [hourlyTiersCache, setHourlyTiersCache] = useState<Record<string | number, any> | null>(null);

  const [impactData, setImpactData] = useState<ImpactResponse | null>(null);
  const [facilitiesData, setFacilitiesData] = useState<FacilitiesImpactResponse | null>(null);
  const [validationData, setValidationData] = useState<ValidationResponse | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>("");

  const [evacuationRoute, setEvacuationRoute] = useState<{
    origin: [number, number];
    dest: [number, number];
    label: string;
  } | null>(null);

  const [resetViewTrigger, setResetViewTrigger] = useState<number>(0);

  // Ambil poligon sebaran jam tertentu saat activeRunId aktif atau currentHour berubah
  React.useEffect(() => {
    if (!activeRunId) return;
    if (hourlyTiersCache && hourlyTiersCache[currentHour]) return;

    api.getTiersAtHour(activeRunId, currentHour)
      .then((geo) => {
        setHourlyTiersCache((prev) => ({
          ...(prev || {}),
          [currentHour]: geo
        }));
      })
      .catch((err) => console.error("Gagal memuat poligon jam", currentHour, err));
  }, [activeRunId, currentHour]);

  const handleHazardChange = (newHazard: HazardType) => {
    setHazard(newHazard);
    if (newHazard === "fire" && eventId !== "live_kalimantan") {
      setEventId("live_kalimantan");
    } else if (newHazard === "volcano" && eventId === "live_kalimantan") {
      setEventId("anak_krakatau_2026_09");
    }
  };

  const [simulatedEventName, setSimulatedEventName] = useState<string>("G. Anak Krakatau");

  const handleRunSimulation = async (targetHazard?: HazardType, targetEventId?: string) => {
    const activeHazard = targetHazard || hazard;
    const activeEventId = targetEventId || eventId;

    if (targetHazard) setHazard(targetHazard);
    if (targetEventId) setEventId(targetEventId);

    setIsRunning(true);
    setProgressText("Mengunduh vektor angin adveksi...");

    const payload = {
      hazard: activeHazard,
      mode,
      source: { event_id: activeEventId },
      horizon_hours: 48,
      n_members: 15,
      seed: 42,
      thresholds: { min: 0.9, mid: 0.5, max: 0.05 },
      overrides: mode === "experiment" ? overrides : null
    };

    try {
      setProgressText("Menghitung dispersi partikel Lagrangian RK2 (15 ansambel)...");
      const simRes = await api.runSimulation(payload);
      const runId = simRes.run_id;
      setActiveRunId(runId);

      const nameMap: Record<string, string> = {
        anak_krakatau_2026_09: "G. Anak Krakatau (Selat Sunda)",
        merapi_yogyakarta: "G. Merapi (Jawa Tengah / DIY)",
        lewotobi_laki_laki: "G. Lewotobi Laki-laki (NTT)",
        marapi_sumatera: "G. Marapi (Sumatera Barat)",
        semeru: "G. Semeru (Jawa Timur)",
        live_kalimantan: "Karhutla Gambut Kalimantan"
      };
      setSimulatedEventName(nameMap[activeEventId] || activeEventId);

      setProgressText("Mengekstrak kontur poligon & dampak populasi...");
      const [impact, facilities, validation, tierZero] = await Promise.all([
        api.getImpact(runId).catch(() => null),
        api.getFacilitiesImpacted(runId).catch(() => null),
        api.getValidation(activeEventId).catch(() => null),
        api.getTiersAtHour(runId, 0).catch(() => null)
      ]);

      if (tierZero) {
        setHourlyTiersCache({ 0: tierZero });
      }

      setImpactData(impact);
      setFacilitiesData(facilities);
      setValidationData(validation);
      setCurrentHour(0);
      setIsDrawerOpen(true);
      setProgressText("Selesai!");
    } catch (err: any) {
      setProgressText(`Gagal: ${err.message || "Server offline"}`);
    } finally {
      setIsRunning(false);
      setTimeout(() => setProgressText(""), 3000);
    }
  };

  const handleRunDemo = async () => {
    setHazard("volcano");
    setEventId("anak_krakatau_2026_09");
    setMode("auto");
    await handleRunSimulation("volcano", "anak_krakatau_2026_09");
  };

  const handleDrawRoute = (s: SchoolItem) => {
    const sLat = s.lat ?? s.latitude;
    const sLng = s.lng ?? s.longitude;
    if (sLat === undefined || sLng === undefined) return;

    const hospital = s.nearest_safe_hospital || s.nearest_hospital;
    const destLat = hospital?.lat ?? hospital?.latitude ?? sLat + 0.035;
    const destLng = hospital?.lng ?? hospital?.longitude ?? sLng + 0.035;

    setEvacuationRoute({
      origin: [sLat, sLng],
      dest: [destLat, destLng],
      label: `Evakuasi Siswa: ${s.name} → ${hospital?.name || "RSUD Terdekat"}`
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#080c0e] text-slate-100 font-sans">
      {/* Zona A: Tactical Header */}
      <TacticalHeader
        onResetView={() => setResetViewTrigger((t) => t + 1)}
        onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
        isDrawerOpen={isDrawerOpen}
      />

      {/* Action Strip */}
      <ActionStrip />

      {/* Main Workspace (Zona B, C, dan D) */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Zona C: Peta Leaflet Full Canvas */}
        <MapWorkspace
          hazard={hazard}
          eventId={eventId}
          currentHour={currentHour}
          hourlyTiersCache={hourlyTiersCache}
          evacuationRoute={evacuationRoute}
          onSelectEvent={(newId) => {
            setEventId(newId);
          }}
          resetViewTrigger={resetViewTrigger}
        />

        {/* Floating Active Simulation Pill */}
        {activeRunId && (
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-full px-3.5 py-1 z-[1000] text-xs flex items-center gap-2 shadow-xl pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">Simulasi Aktif:</span>
            <strong className="text-white font-semibold">{simulatedEventName}</strong>
            <span className="text-sky-400 font-mono text-[11px]">(H+{currentHour}:00)</span>
          </div>
        )}

        {/* Zona B: Floating Controller Melayang di Kiri Atas Peta */}
        <ControllerDock
          hazard={hazard}
          onHazardChange={handleHazardChange}
          eventId={eventId}
          onEventChange={setEventId}
          mode={mode}
          onModeChange={setMode}
          overrides={overrides}
          onOverridesChange={setOverrides}
          onRunSimulation={handleRunSimulation}
          onRunDemo={handleRunDemo}
          isRunning={isRunning}
          progressText={progressText}
        />

        {/* Zona C: Timeline Player Melayang di Bawah Peta */}
        <TimelinePlayer
          currentHour={currentHour}
          onHourChange={setCurrentHour}
        />

        {/* Zona D: Tabbed Inspection Dock Melayang di Kanan */}
        <AnalyticsDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          impact={impactData}
          facilities={facilitiesData}
          validation={validationData}
          hazard={hazard}
          rainMm={mode === "experiment" ? overrides.rain_scavenging_mm_h ?? 0 : 0}
          onFlyTo={(lat, lng) => {
            // Pemusatan peta melalui event / ref jika diperlukan
            console.log("Fly to:", lat, lng);
          }}
          onDrawRoute={handleDrawRoute}
        />
      </div>
    </div>
  );
};

export default App;
