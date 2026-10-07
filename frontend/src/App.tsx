import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { TacticalHeader } from "./components/layout/TacticalHeader";
import { ControllerDock } from "./components/layout/ControllerDock";
import { MapWorkspace } from "./components/layout/MapWorkspace";
import { TimelinePlayer } from "./components/layout/TimelinePlayer";
import { AnalyticsDrawer } from "./components/layout/AnalyticsDrawer";
import { LegendModal } from "./components/layout/LegendModal";
import { api } from "./services/api";
import type {
  HazardType,
  ModelingMode,
  SimulationOverrides,
  SimulationPayload,
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
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>("");

  const [evacuationRoute, setEvacuationRoute] = useState<{
    origin: [number, number];
    dest: [number, number];
    label: string;
  } | null>(null);

  const [resetViewTrigger, setResetViewTrigger] = useState<number>(0);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);

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
    if (newHazard === "fire" && !eventId.startsWith("hutan_")) {
      setEventId("hutan_sebangau");
    } else if (newHazard === "volcano" && (eventId.startsWith("hutan_") || eventId === "live_kalimantan")) {
      setEventId("anak_krakatau_2026_09");
    }
  };

  const [simulatedEventName, setSimulatedEventName] = useState<string>("G. Anak Krakatau");
  const demoIntervalRef = React.useRef<any>(null);

  const handleRunSimulation = async (targetHazard?: HazardType, targetEventId?: string) => {
    const activeHazard = targetHazard || hazard;
    const activeEventId = targetEventId || eventId;

    if (targetHazard) setHazard(targetHazard);
    if (targetEventId) setEventId(targetEventId);

    setIsRunning(true);
    setProgressText("Menghitung adveksi atmosferik 15 anggota ensemble (RK2)...");

    // Samakan konstruksi overrides dengan standar backend (hanya mode experiment)
    let backendOverrides: Record<string, any> | null = null;
    if (mode === "experiment") {
      backendOverrides = {};
      if (activeHazard === "volcano" && overrides.column_height_km) {
        backendOverrides.column_height_km = overrides.column_height_km;
      }
      if (overrides.wind_reverse_troposphere) {
        backendOverrides.wind = { reverse: true };
      }
      const rainMm = overrides.rain_scavenging_mm_h ?? 0;
      if (rainMm > 0) {
        backendOverrides.rain = { intensity_mm_h: rainMm, duration_h: 6, start_h: 4 };
      }
      if (activeHazard === "fire" && overrides.frp_scale !== undefined) {
        backendOverrides.hotspots = { frp_scale: overrides.frp_scale };
      }
    }

    const payload: SimulationPayload = {
      hazard: activeHazard,
      mode,
      source: { event_id: activeEventId },
      horizon_hours: 48,
      n_members: 15,
      seed: 42,
      thresholds: { min: 0.9, mid: 0.5, max: 0.05 },
      overrides: backendOverrides
    };

    try {
      const simRes = await api.runSimulation(payload);
      const runId = simRes.run_id;
      setActiveRunId(runId);
      setSimulatedEventName(simRes.scenario_label || activeEventId);

      setProgressText("Mengekstrak kontur poligon & dampak populasi...");

      // Set pratinjau jam ke 12 agar poligon sebaran langsung terlihat di peta (sesuai fe-dummy)
      setCurrentHour(12);

      const [impact, facilities, validation, tier12] = await Promise.all([
        api.getImpact(runId).catch(() => null),
        api.getFacilitiesImpacted(runId).catch(() => null),
        api.getValidation(activeEventId).catch(() => null),
        api.getTiersAtHour(runId, 12).catch(() => null)
      ]);

      if (tier12) {
        setHourlyTiersCache({ 12: tier12 });
      }

      setImpactData(impact);
      setFacilitiesData(facilities);
      setValidationData(validation);
      setIsDrawerOpen(true);
      setProgressText(`Selesai: ${simRes.scenario_label || "15 anggota ensemble"}`);
    } catch (err: any) {
      setProgressText(`Gagal: ${err.message || "Server offline"}`);
    } finally {
      setIsRunning(false);
      setTimeout(() => setProgressText(""), 4000);
    }
  };

  const handleRunDemo = async () => {
    setIsRunning(true);
    setProgressText("Memulai putar demo otomatis...");

    try {
      const demo = await api.playDemo(eventId).catch(() => null);
      if (demo && demo.steps && demo.steps.length > 0) {
        if (!activeRunId) {
          await handleRunSimulation(hazard, eventId);
        }

        let stepIdx = 0;
        if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);

        demoIntervalRef.current = setInterval(() => {
          if (stepIdx >= demo.steps.length) {
            clearInterval(demoIntervalRef.current);
            demoIntervalRef.current = null;
            setProgressText("Selesai memutar demo skenario.");
            setTimeout(() => setProgressText(""), 3000);
            return;
          }

          const step = demo.steps[stepIdx];
          setCurrentHour(step.hour);
          setProgressText(step.commentary || step.time_label);
          stepIdx++;
        }, 1200);
      } else {
        await handleRunSimulation(hazard, eventId);
      }
    } catch {
      await handleRunSimulation(hazard, eventId);
    }
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
        onToggleLegend={() => setIsLegendOpen((prev) => !prev)}
        isLegendOpen={isLegendOpen}
      />

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
          onToggleLegend={() => setIsLegendOpen((prev) => !prev)}
          onLayersLoaded={() => setIsMapReady(true)}
        />

        {/* Global Loading Overlay (Di bawah Navbar) */}
        {!isMapReady && (
          <div className="absolute inset-0 z-[1500] bg-[#140f0e] flex flex-col items-center justify-center gap-3 select-none pointer-events-none">
            <Loader2 className="w-6 h-6 text-[#EB895B] animate-spin" />
            <span className="font-mono text-xs uppercase tracking-wider text-[#FFF0C5]/80">
              Memuat Data Spasial
            </span>
          </div>
        )}

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
          activeRunId={activeRunId}
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

        {/* Modal Legenda Otoritatif PVMBG & Dispersi */}
        <LegendModal
          isOpen={isLegendOpen}
          onClose={() => setIsLegendOpen(false)}
        />
      </div>
    </div>
  );
};

export default App;
