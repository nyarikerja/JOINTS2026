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
  const [eventId, setEventId] = useState<string>("");
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
  const [advisoryData, setAdvisoryData] = useState<any>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>("");
  const [loadingProgress, setLoadingProgress] = useState<number>(0);

  const [evacuationRoute, setEvacuationRoute] = useState<{
    geometry: [number, number][];
    label: string;
    distanceKm?: number;
    durationMin?: number;
    facilityId?: string;
  } | null>(null);

  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number; _t: number } | null>(null);
  const [resetViewTrigger, setResetViewTrigger] = useState<number>(0);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [selectedEventName, setSelectedEventName] = useState<string>("G. Anak Krakatau");

  // Ambil poligon sebaran jam tertentu saat activeRunId aktif atau currentHour berubah
  React.useEffect(() => {
    if (!activeRunId) return;

    api.getTiersAtHour(activeRunId, currentHour)
      .then((geo) => {
        setHourlyTiersCache((prev) => ({
          ...(prev || {}),
          [currentHour]: geo,
          [`hour_${currentHour}`]: geo
        }));
      })
      .catch((err) => console.error("Gagal memuat poligon jam", currentHour, err));
  }, [activeRunId, currentHour]);

  const handleHazardChange = (newHazard: HazardType) => {
    if (newHazard !== hazard) {
      setHazard(newHazard);
      setEventId("");
    }
  };

  const handleEventChange = (newEventId: string) => {
    if (newEventId !== eventId) {
      setEventId(newEventId);
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
    setLoadingProgress(0);
    setProgressText("Menghitung adveksi atmosferik 15 anggota ensemble (RK2)...");

    const loadingInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev < 35) return prev + 2;
        if (prev < 80) return prev + 1;
        if (prev < 99) return prev + 0.5;
        return 99;
      });
    }, 100);

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
      
      // Gunakan selectedEventName karena backend hanya mengembalikan "kejadian observasi" tanpa nama gunung
      setSimulatedEventName(selectedEventName || simRes.scenario_label || activeEventId);

      setProgressText("Mengekstrak kontur poligon & dampak populasi...");
      setLoadingProgress(85);

      // Set pratinjau jam ke 48 (akhir) agar pengguna tahu simulasi mencakup 48 jam penuh
      setCurrentHour(48);

      const [impact, facilities, validation, advisory, tier48] = await Promise.all([
        api.getImpact(runId).catch(() => null),
        api.getFacilitiesImpacted(runId).catch(() => null),
        api.getValidation(activeEventId).catch(() => null),
        api.getEmergencyAdvisory(runId).catch(() => null),
        api.getTiersAtHour(runId, 48).catch(() => null)
      ]);

      if (tier48) {
        setHourlyTiersCache({ 48: tier48 });
      }

      setImpactData(impact);
      setFacilitiesData(facilities);
      setValidationData(validation);
      setAdvisoryData(advisory);
      setIsDrawerOpen(true);
      setProgressText(`Selesai: ${simRes.scenario_label || "15 anggota ensemble"}`);
    } catch (err: any) {
      setProgressText(`Gagal: ${err.message || "Server offline"}`);
    } finally {
      clearInterval(loadingInterval);
      setLoadingProgress(100);
      setTimeout(() => {
        setIsRunning(false);
        setProgressText("");
        setLoadingProgress(0);
      }, 500);
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

  const handleDrawRoute = async (s: SchoolItem) => {
    const facilityId = s.id || s.facility_id || s.name;
    if (evacuationRoute && evacuationRoute.facilityId === facilityId) {
      setEvacuationRoute(null);
      return;
    }

    const sLat = s.lat ?? s.latitude;
    const sLng = s.lng ?? s.longitude;
    if (sLat === undefined || sLng === undefined || !activeRunId) return;

    const hospital = s.nearest_safe_hospital || s.nearest_hospital;
    const destLat = hospital?.lat ?? hospital?.latitude ?? sLat + 0.035;
    const destLng = hospital?.lng ?? hospital?.longitude ?? sLng + 0.035;

    setProgressText(`Menghitung rute evakuasi dari ${s.name}...`);
    try {
      const res = await api.getEvacuationRoute(
        activeRunId,
        sLat,
        sLng,
        destLat,
        destLng,
        s.name,
        hospital?.name || "RSUD Terdekat"
      );
      
      const geom: [number, number][] = res.geometry.map((coord: [number, number]) => [coord[1], coord[0]]); // Leaflet uses [lat, lng]
      
      setEvacuationRoute({
        geometry: geom.length > 0 ? geom : [[sLat, sLng], [destLat, destLng]],
        label: `Evakuasi: ${s.name} → ${hospital?.name || "RSUD Terdekat"}`,
        distanceKm: res.distance_km,
        durationMin: res.duration_min,
        facilityId
      });
      setProgressText("");
    } catch (err) {
      console.error(err);
      setProgressText("Gagal mengambil rute riil, menampilkan garis lurus.");
      setEvacuationRoute({
        geometry: [[sLat, sLng], [destLat, destLng]],
        label: `Evakuasi: ${s.name} → ${hospital?.name || "RSUD Terdekat"}`,
        facilityId
      });
      setTimeout(() => setProgressText(""), 3000);
    }
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
            handleEventChange(newId);
          }}
          resetViewTrigger={resetViewTrigger}
          flyToTarget={flyToTarget}
          activeRunId={activeRunId}
          isDrawerOpen={isDrawerOpen}
          onToggleLegend={() => setIsLegendOpen((prev) => !prev)}
          onLayersLoaded={() => setIsMapReady(true)}
        />

        {/* Global Loading Overlay (Di bawah Navbar) */}
        {!isMapReady && !isRunning && (
          <div className="absolute inset-0 z-[1500] bg-[#140f0e] flex flex-col items-center justify-center gap-3 select-none pointer-events-none">
            <Loader2 className="w-6 h-6 text-[#EB895B] animate-spin" />
            <span className="font-mono text-xs uppercase tracking-wider text-[#FFF0C5]/80">
              Memuat Data Spasial
            </span>
          </div>
        )}

        {/* Loading Simulasi Center Screen */}
        {isRunning && (
          <div className="absolute inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center select-none">
            <div className="bg-[#f7f3ed] p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full border border-[#2b211e]/10 animate-popup text-[#2b211e]">
              <div className="relative w-20 h-20 mb-4">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-[#2b211e]/10"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray="226"
                    strokeDashoffset={226 - (226 * Math.min(Math.round(loadingProgress), 100)) / 100}
                    className="text-[#EB895B] transition-all duration-100 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-bold text-[#EB895B] text-lg font-mono">
                    {Math.round(loadingProgress)}%
                  </span>
                </div>
              </div>
              <h3 className="font-bold text-sm mb-1 text-center">Memproses Pemodelan</h3>
              <p className="text-[11px] text-[#2b211e]/70 text-center leading-relaxed h-8">
                {progressText}
              </p>
            </div>
          </div>
        )}

        {/* Floating Active Simulation Pill */}
        {activeRunId && (
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 bg-[#1c1513]/90 backdrop-blur-md border border-[#EB895B]/30 rounded-full px-3.5 py-1 z-[1000] text-xs flex items-center gap-2 shadow-xl pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[#FFF0C5]/70">Simulasi Aktif:</span>
            <strong className="text-[#FFF0C5] font-semibold">{simulatedEventName}</strong>
            <span className="text-[#EB895B] font-mono text-[11px]">(H+{currentHour}:00)</span>
          </div>
        )}

        {/* Watermark Skenario Hipotetis (Mode Coba-Coba / Experiment) */}
        {mode === "experiment" && activeRunId && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-amber-950/80 backdrop-blur-sm border border-amber-500/40 rounded px-2.5 py-0.5 z-[999] text-[10px] font-mono tracking-wider text-amber-200 uppercase pointer-events-none shadow-md">
            SKENARIO HIPOTETIS &bull; BUKAN DATA RESMI
          </div>
        )}

        {/* Zona B: Floating Controller Melayang di Kiri Atas Peta */}
        <ControllerDock
          hazard={hazard}
          onHazardChange={handleHazardChange}
          eventId={eventId}
          onEventChange={handleEventChange}
          onEventNameChange={setSelectedEventName}
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
          isDrawerOpen={isDrawerOpen}
        />

        {/* Zona D: Tabbed Inspection Dock Melayang di Kanan */}
        <AnalyticsDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          impact={impactData}
          facilities={facilitiesData}
          validation={validationData}
          advisory={advisoryData}
          hazard={hazard}
          currentHour={currentHour}
          rainMm={mode === "experiment" ? overrides.rain_scavenging_mm_h ?? 0 : 0}
          onOpenLegend={() => setIsLegendOpen(true)}
          onFlyTo={(lat, lng) => {
            setFlyToTarget({ lat, lng, _t: Date.now() });
          }}
          onDrawRoute={handleDrawRoute}
          activeRouteId={evacuationRoute?.facilityId}
          simulatedEventName={simulatedEventName}
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
