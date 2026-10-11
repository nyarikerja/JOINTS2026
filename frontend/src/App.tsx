import React, { useState, useEffect } from "react";
import { TacticalHeader } from "./components/layout/TacticalHeader";
import { ControllerDock } from "./components/layout/ControllerDock";
import { MapWorkspace } from "./components/layout/MapWorkspace";
import { TimelinePlayer } from "./components/layout/TimelinePlayer";
import { AnalyticsDrawer } from "./components/layout/AnalyticsDrawer";
import { LegendModal } from "./components/layout/LegendModal";
import { PrintReportModal } from "./components/layout/PrintReportModal";
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
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
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
  const [autoPlayTrigger, setAutoPlayTrigger] = useState<number>(0);
  const [selectedEventName, setSelectedEventName] = useState<string>("G. Anak Krakatau");
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  useEffect(() => {
    // Buka panduan simulasi secara otomatis saat user pertama kali membuka web
    const hasSeenManual = localStorage.getItem("hasSeenManual");
    if (!hasSeenManual) {
      setIsHelpOpen(true);
    }
  }, []);

  // Pulihkan sesi simulasi terakhir dari localStorage saat pertama kali dimuat
  React.useEffect(() => {
    const restoreLastSession = async () => {
      const savedRunId = localStorage.getItem("lastRunId");
      const savedEventId = localStorage.getItem("lastEventId");
      const savedEventName = localStorage.getItem("lastEventName");
      const savedHazard = localStorage.getItem("lastHazard") as HazardType;
      
      if (savedRunId && savedEventId) {
        setEventId(savedEventId);
        if (savedHazard) setHazard(savedHazard);
        if (savedEventName) setSelectedEventName(savedEventName);
        
        setActiveRunId(savedRunId);
        setSimulatedEventName(savedEventName || savedEventId);
        setCurrentHour(48);
        
        try {
          const [impact, facilities, validation, advisory, tier48] = await Promise.all([
            api.getImpact(savedRunId).catch(() => null),
            api.getFacilitiesImpacted(savedRunId).catch(() => null),
            api.getValidation(savedEventId).catch(() => null),
            api.getEmergencyAdvisory(savedRunId).catch(() => null),
            api.getTiersAtHour(savedRunId, 48).catch(() => null)
          ]);
          
          if (tier48) setHourlyTiersCache({ 48: tier48 });
          if (impact) setImpactData(impact);
          if (facilities) setFacilitiesData(facilities);
          if (validation) setValidationData(validation);
          if (advisory) setAdvisoryData(advisory);
        } catch (e) {
          console.error("Gagal memuat sesi sebelumnya", e);
        }
      }
    };
    restoreLastSession();
  }, []);

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
    setLoadingProgress(1);
    const isFire = activeHazard === "fire";
    setProgressText(
      isFire
        ? "Memproses pemodelan sebaran asap & emisi PM2.5 karhutla..."
        : "Memproses pemodelan erupsi & trayektori sebaran abu vulkanik..."
    );

    // Progress dinamis continuous melambat secara natural asimtotik mendekati 99%, tidak pernah berhenti total (stuck)
    const loadingInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 99) return 99;
        // Makin tinggi persentase, penambahan makin halus sehingga tetap terasa berjalan
        const remaining = 99 - prev;
        const delta = Math.max(0.1, remaining * 0.04);
        const next = prev + delta;

        // Transisi teks fase secara dinamis dan mulus
        if (next < 50) {
          setProgressText(
            isFire
              ? "Memproses pemodelan sebaran asap & emisi PM2.5 karhutla..."
              : "Memproses pemodelan erupsi & trayektori sebaran abu vulkanik..."
          );
        } else if (next < 99) {
          setProgressText(
            isFire
              ? "Menganalisis dampak kabut asap pada populasi & fasilitas..."
              : "Menganalisis proyeksi paparan abu vulkanik pada wilayah & faskes..."
          );
        }

        return next;
      });
    }, 60);

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
      
      // Reset jam ke 0 lalu aktifkan auto-play agar animasi sebaran jam 0 s/d 48 langsung berjalan otomatis
      setCurrentHour(0);

      const [impact, facilities, validation, advisory, tier0] = await Promise.all([
        api.getImpact(runId).catch(() => null),
        api.getFacilitiesImpacted(runId).catch(() => null),
        api.getValidation(activeEventId).catch(() => null),
        api.getEmergencyAdvisory(runId).catch(() => null),
        api.getTiersAtHour(runId, 0).catch(() => null)
      ]);

      if (tier0) {
        setHourlyTiersCache({ 0: tier0 });
      }

      setImpactData(impact);
      setFacilitiesData(facilities);
      setValidationData(validation);
      setAdvisoryData(advisory);
      setIsDrawerOpen(true);
      setAutoPlayTrigger((prev) => prev + 1);

      // Fase 3: 100% Selesai
      clearInterval(loadingInterval);
      setLoadingProgress(100);
      setProgressText(
        isFire
          ? "Pemodelan sebaran asap karhutla siap ditampilkan"
          : "Pemodelan sebaran abu vulkanik siap ditampilkan"
      );

      // Simpan referensi run terakhir ke local storage
      localStorage.setItem("lastRunId", runId);
      localStorage.setItem("lastEventId", activeEventId);
      localStorage.setItem("lastEventName", selectedEventName || simRes.scenario_label || activeEventId);
      localStorage.setItem("lastHazard", activeHazard);
    } catch (err: any) {
      clearInterval(loadingInterval);
      setProgressText(`Gagal: ${err.message || "Server offline"}`);
    } finally {
      clearInterval(loadingInterval);
      setTimeout(() => {
        setIsRunning(false);
        setProgressText("");
        setLoadingProgress(0);
      }, 700);
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
      // Backend sudah mengembalikan dalam format [lat, lng], tidak perlu di-swap lagi
      const geom: [number, number][] = res.coordinates || [];
      
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
        isHelpOpen={isHelpOpen}
        onOpenHelp={() => setIsHelpOpen(true)}
        onCloseHelp={() => setIsHelpOpen(false)}
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
        />

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
          onOpenPrintReport={() => setIsPrintModalOpen(true)}
          isRunning={isRunning}
          progressText={progressText}
          activeRunId={activeRunId}
          simulatedEventName={simulatedEventName}
        />

        {/* Zona C: Timeline Player Melayang di Bawah Peta */}
        <TimelinePlayer
          currentHour={currentHour}
          onHourChange={setCurrentHour}
          isDrawerOpen={isDrawerOpen}
          autoPlayTrigger={autoPlayTrigger}
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

        {/* Modal Pratinjau Dokumen Ringkasan Eksekutif (A4 Portrait) */}
        <PrintReportModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          hazard={hazard}
          simulatedEventName={simulatedEventName}
          activeRunId={activeRunId}
          impact={impactData}
          facilities={facilitiesData}
          advisory={advisoryData}
        />
      </div>
    </div>
  );
};

export default App;
