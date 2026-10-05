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

  const [currentHour, setCurrentHour] = useState<number>(0);
  const [hourlyTiersCache, setHourlyTiersCache] = useState<Record<string, any> | null>(null);

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

  const handleRunSimulation = async () => {
    setIsRunning(true);
    setProgressText("Mengunduh vektor angin adveksi...");

    const payload = {
      hazard,
      mode,
      source: { event_id: eventId },
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

      setProgressText("Mengekstrak kontur poligon & dampak populasi...");
      const [impact, facilities, validation] = await Promise.all([
        api.getImpact(runId).catch(() => null),
        api.getFacilitiesImpacted(runId).catch(() => null),
        api.getValidation(runId).catch(() => null)
      ]);

      if (simRes.hourly_tiers) {
        setHourlyTiersCache(simRes.hourly_tiers);
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
    await handleRunSimulation();
  };

  const handleDrawRoute = (s: SchoolItem) => {
    const hospital = s.nearest_hospital;
    const destLat = hospital?.lat ?? s.lat + 0.035;
    const destLng = hospital?.lng ?? s.lng + 0.035;

    setEvacuationRoute({
      origin: [s.lat, s.lng],
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
          currentHour={currentHour}
          hourlyTiersCache={hourlyTiersCache}
          evacuationRoute={evacuationRoute}
          onSelectEvent={(newId) => {
            setEventId(newId);
          }}
          resetViewTrigger={resetViewTrigger}
        />

        {/* Zona B: Floating Controller Melayang di Kiri Atas Peta */}
        <ControllerDock
          hazard={hazard}
          onHazardChange={setHazard}
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
