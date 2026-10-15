import React, { useState, useEffect } from "react";
import { TacticalHeader } from "./components/layout/TacticalHeader";
import { ControllerDock } from "./components/layout/ControllerDock";
import { MapWorkspace } from "./components/layout/MapWorkspace";
import { TimelinePlayer } from "./components/layout/TimelinePlayer";
import { AnalyticsDrawer } from "./components/layout/AnalyticsDrawer";
import { LegendModal } from "./components/layout/LegendModal";
import { GpsAdvisoryModal } from "./components/layout/GpsAdvisoryModal";
import { PrintReportModal } from "./components/layout/PrintReportModal";
import { api } from "./services/api";
import { isLoaderActive } from "./utils/bootProgress";
import { useLocationWatch } from "./utils/locationWatch";
import type {
  HazardType,
  ModelingMode,
  SimulationOverrides,
  SimulationPayload,
  SimulationResponse,
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
  const [runInfo, setRunInfo] = useState<SimulationResponse | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [currentHour, setCurrentHour] = useState<number>(0);
  const [hourlyTiersCache, setHourlyTiersCache] = useState<Record<string | number, any> | null>(null);

  const [impactData, setImpactData] = useState<ImpactResponse | null>(null);
  const [facilitiesData, setFacilitiesData] = useState<FacilitiesImpactResponse | null>(null);
  const [validationData] = useState<ValidationResponse | null>(null);
  const [advisoryData, setAdvisoryData] = useState<any>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);
  const [isGpsModalOpen, setIsGpsModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useLocationWatch();
  const [progressText, setProgressText] = useState<string>("");
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [selectedPlumeTier, setSelectedPlumeTier] = useState<string | null>(null);

  const [evacuationRoute, setEvacuationRoute] = useState<{
    geometry: [number, number][];
    label: string;
    distanceKm?: number;
    durationMin?: number;
    facilityId?: string;
    originName?: string;
    destName?: string;
  } | null>(null);

  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number; _t: number; name?: string; type?: "school" | "hospital" | string } | null>(null);
  const [resetViewTrigger, setResetViewTrigger] = useState<number>(0);
  const [autoPlayTrigger, setAutoPlayTrigger] = useState<number>(0);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  // Loader sungai (public/loader) menggantikan overlay "Memuat Data Spasial" selama masih tampil
  const [riverLoaderOn, setRiverLoaderOn] = useState<boolean>(() => isLoaderActive());
  React.useEffect(() => {
    if (!riverLoaderOn) return;
    const off = () => setRiverLoaderOn(false);
    window.addEventListener("loader:done", off);
    return () => window.removeEventListener("loader:done", off);
  }, [riverLoaderOn]);
  const [selectedEventName, setSelectedEventName] = useState<string>("G. Anak Krakatau");
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [eventFocusTrigger, setEventFocusTrigger] = useState<number>(0);
  const [showSchools, setShowSchools] = useState<boolean>(false);
  const [showHospitals, setShowHospitals] = useState<boolean>(false);
  const [showAirports, setShowAirports] = useState<boolean>(false);

  // Pulihkan run dari tautan (?run=...) atau sesi terakhir (localStorage) saat pertama kali dimuat
  React.useEffect(() => {
    const restoreLastSession = async () => {
      const urlRun = new URLSearchParams(window.location.search).get("run");
      const savedRunId = urlRun || localStorage.getItem("lastRunId");
      if (!savedRunId) return;
      try {
        const info = await api.getRun(savedRunId).catch(() => null);
        if (!info) {
          // Run sudah tidak ada di server: jangan tampilkan sesi kosong
          ["lastRunId", "lastEventId", "lastEventName", "lastHazard"].forEach((k) => localStorage.removeItem(k));
          if (urlRun) setSimError(`Run ${urlRun} tidak ditemukan di server.`);
          return;
        }
        const name = info.event_name || info.event_id || savedRunId;
        setHazard(info.hazard);
        if (info.event_id && !info.event_id.startsWith("custom_")) setEventId(info.event_id);
        setSelectedEventName(name);
        setSimulatedEventName(name);
        setActiveRunId(savedRunId);
        setRunInfo(info);
        setCurrentHour(48);
        const [impact, facilities, advisory, allTiers] = await Promise.all([
          api.getImpact(savedRunId).catch(() => null),
          api.getFacilitiesImpacted(savedRunId).catch(() => null),
          api.getEmergencyAdvisory(savedRunId).catch(() => null),
          api.getAllTiers(savedRunId).catch(() => null)
        ]);
        if (allTiers && typeof allTiers === "object") {
          const normalized: Record<string | number, any> = {};
          Object.entries(allTiers).forEach(([k, val]) => {
            normalized[k] = val;
            normalized[Number(k)] = val;
            normalized[`hour_${k}`] = val;
          });
          setHourlyTiersCache(normalized);
        }
        if (impact) setImpactData(impact);
        if (facilities) setFacilitiesData(facilities);
        if (advisory) setAdvisoryData(advisory);
        if (urlRun) setIsDrawerOpen(true);
      } catch (e) {
        console.error("Gagal memuat sesi sebelumnya", e);
      }
    };
    restoreLastSession();
  }, []);

  // Tautan berbagi: URL selalu memuat run yang aktif
  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (activeRunId) url.searchParams.set("run", activeRunId);
    else url.searchParams.delete("run");
    window.history.replaceState(null, "", url.toString());
  }, [activeRunId]);

  useLocationWatch();

  // Ambil seluruh 48 jam poligon sebaran secara instan agar animasi timeline mulus tanpa kedip
  React.useEffect(() => {
    if (!activeRunId) return;

    api.getAllTiers(activeRunId)
      .then((allTiers) => {
        if (allTiers && typeof allTiers === "object") {
          const normalized: Record<string | number, any> = {};
          Object.entries(allTiers).forEach(([k, val]) => {
            normalized[k] = val;
            normalized[Number(k)] = val;
            normalized[`hour_${k}`] = val;
          });
          setHourlyTiersCache((prev) => ({
            ...(prev || {}),
            ...normalized
          }));
        }
      })
      .catch((err) => {
        console.warn("Fallback load single hour", err);
        api.getTiersAtHour(activeRunId, currentHour)
          .then((geo) => {
            setHourlyTiersCache((prev) => ({
              ...(prev || {}),
              [currentHour]: geo,
              [`hour_${currentHour}`]: geo
            }));
          })
          .catch(() => {});
      });
  }, [activeRunId]);

  const handleHazardChange = (newHazard: HazardType) => {
    if (newHazard !== hazard) {
      setHazard(newHazard);
      setEventId("");
    }
  };

  const handleEventChange = (newEventId: string, newHazard?: HazardType) => {
    if (newHazard && newHazard !== hazard) {
      setHazard(newHazard);
    }
    setEventId(newEventId);
    setEventFocusTrigger((prev) => prev + 1);
  };

  const [simulatedEventName, setSimulatedEventName] = useState<string>("G. Anak Krakatau");

  const handleRunSimulation = async (
    targetHazard?: HazardType,
    targetEventId?: string,
    customLocation?: { lat: number; lng: number; name?: string }
  ) => {
    const activeHazard = targetHazard || hazard;
    const activeEventId = customLocation ? "" : (targetEventId || eventId);

    if (targetHazard) setHazard(targetHazard);
    if (targetEventId && !customLocation) setEventId(targetEventId);

    setIsRunning(true);
    setSimError(null);
    setLoadingProgress(1);
    const isFire = activeHazard === "fire";
    setProgressText(
      customLocation
        ? `Menghubungkan data koordinat [${customLocation.lat.toFixed(2)}, ${customLocation.lng.toFixed(2)}] & angin ECMWF...`
        : isFire
        ? "Menghubungkan data titik api NASA FIRMS & angin ECMWF..."
        : "Mengambil parameter erupsi PVMBG & profil angin troposfer ECMWF..."
    );

    // Fase 1 & 2: Dibatasi maksimal 74% selama backend komputasi pemodelan adveksi & dispersi 48 jam
    let targetCap = 74;
    const loadingInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= targetCap) return prev;
        const remaining = targetCap - prev;
        const delta = Math.max(0.08, remaining * 0.035);
        const next = Math.min(targetCap, prev + delta);

        if (next < 35) {
          setProgressText(
            customLocation
              ? `Menghubungkan data koordinat [${customLocation.lat.toFixed(2)}, ${customLocation.lng.toFixed(2)}] & angin ECMWF...`
              : isFire
              ? "Menghubungkan data titik api NASA FIRMS & angin ECMWF..."
              : "Mengambil parameter erupsi PVMBG & profil angin troposfer ECMWF..."
          );
        } else if (next < 74) {
          setProgressText(
            isFire
              ? "Mengalkulasi pemodelan emisi PM2.5 & adveksi partikel 48 jam..."
              : "Mensimulasikan dispersi abu vulkanik 15 ensemble members 48 jam..."
          );
        }

        return next;
      });
    }, 80);

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
      source: customLocation
        ? {
            event_id: "",
            latitude: customLocation.lat,
            longitude: customLocation.lng,
            name: customLocation.name || `Titik Koordinat [${customLocation.lat.toFixed(2)}, ${customLocation.lng.toFixed(2)}]`
          }
        : { event_id: activeEventId },
      horizon_hours: 48,
      n_members: activeEventId === "anak_krakatau_2026_09" ? 51 : 15,
      seed: 42,
      thresholds: { min: 0.9, mid: 0.5, max: 0.05 },
      overrides: backendOverrides
    };

    try {
      // 1. Eksekusi Pemodelan Fisika di Backend
      const simRes = await api.runSimulation(payload);
      const runId = simRes.run_id;
      setActiveRunId(runId);
      setRunInfo(simRes);

      const eventLabel = customLocation
        ? `Titik Bebas (${customLocation.lat.toFixed(2)}, ${customLocation.lng.toFixed(2)})`
        : (simRes.event_name || selectedEventName || activeEventId);
      setSimulatedEventName(eventLabel);

      // Fase 3: Pemodelan selesai, beralih ke analisis dampak & rekomendasi mitigasi
      targetCap = 94;
      setLoadingProgress((p) => Math.max(p, 76));
      setProgressText(
        isFire
          ? "Menganalisis fasilitas terdampak asap & menyiapkan jalur evakuasi..."
          : "Menganalisis wilayah & fasilitas terdampak abu vulkanik..."
      );

      // Reset jam ke 0 lalu aktifkan auto-play agar animasi sebaran jam 0 s/d 48 langsung berjalan otomatis
      setCurrentHour(0);

      const [impact, facilities, advisory, allTiers] = await Promise.all([
        api.getImpact(runId).catch(() => null),
        api.getFacilitiesImpacted(runId).catch(() => null),
        api.getEmergencyAdvisory(runId).catch(() => null),
        api.getAllTiers(runId).catch(() => null)
      ]);

      if (allTiers && typeof allTiers === "object") {
        const normalized: Record<string | number, any> = {};
        Object.entries(allTiers).forEach(([k, val]) => {
          normalized[k] = val;
          normalized[Number(k)] = val;
          normalized[`hour_${k}`] = val;
        });
        setHourlyTiersCache(normalized);
      }

      setImpactData(impact);
      setFacilitiesData(facilities);
      setAdvisoryData(advisory);
      setIsDrawerOpen(true);
      // Fase 4: Finalisasi & Tampilkan 100%
      clearInterval(loadingInterval);
      setLoadingProgress(96);
      setProgressText(
        isFire
          ? "Pemodelan sebaran asap karhutla siap ditampilkan"
          : "Pemodelan sebaran abu vulkanik siap ditampilkan"
      );

      await new Promise((resolve) => setTimeout(resolve, 150));
      setLoadingProgress(100);

      // Simpan referensi run terakhir dan riwayat run (untuk fitur bandingkan)
      try {
        const hist = JSON.parse(localStorage.getItem("runHistory") || "[]").filter((r: any) => r.id !== runId);
        hist.unshift({ id: runId, name: eventLabel, mode: simRes.mode, hazard: activeHazard, label: simRes.scenario_label, t: Date.now() });
        localStorage.setItem("runHistory", JSON.stringify(hist.slice(0, 12)));
      } catch {}
      localStorage.setItem("lastRunId", runId);
      localStorage.setItem("lastEventId", activeEventId || runId);
      localStorage.setItem("lastEventName", eventLabel);
      localStorage.setItem("lastHazard", activeHazard);
    } catch (err: any) {
      clearInterval(loadingInterval);
      setProgressText(`Gagal: ${err.message || "Server offline"}`);
      setSimError(err?.message || "Server tidak dapat dihubungi.");
    } finally {
      clearInterval(loadingInterval);
      setTimeout(() => {
        setIsRunning(false);
        setProgressText("");
        setLoadingProgress(0);
      }, 500);
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
    const destLat = hospital?.lat ?? hospital?.latitude;
    const destLng = hospital?.lng ?? hospital?.longitude;
    if (!hospital || destLat === undefined || destLng === undefined) {
      setSimError(`Tidak ada rumah sakit OSM di sekitar ${s.name} untuk dijadikan tujuan rujukan.`);
      return;
    }

    setProgressText(`Menghitung rute evakuasi dari ${s.name}...`);
    try {
      const res = await api.getEvacuationRoute(
        activeRunId,
        sLat,
        sLng,
        destLat,
        destLng,
        s.name,
        hospital.name
      );
      // Backend sudah mengembalikan dalam format [lat, lng], tidak perlu di-swap lagi
      const geom: [number, number][] = res.coordinates || [];
      
      setEvacuationRoute({
        geometry: geom.length > 0 ? geom : [[sLat, sLng], [destLat, destLng]],
        label: res.is_real_road
          ? `Evakuasi: ${s.name} → ${hospital.name}`
          : `Arah garis lurus (rute jalan tidak tersedia): ${s.name} → ${hospital.name}`,
        distanceKm: res.distance_km ?? undefined,
        durationMin: res.estimated_duration_minutes ?? undefined,
        facilityId,
        originName: s.name,
        destName: hospital.name
      });
      setProgressText("");
    } catch (err) {
      console.error(err);
      setProgressText("");
      setSimError("Gagal mengambil rute evakuasi dari server.");
    }
  };

  const handleResetSimulationState = React.useCallback(() => {
    setActiveRunId(null);
    setRunInfo(null);
    setSimError(null);
    setCurrentHour(0);
    setHourlyTiersCache(null);
    setImpactData(null);
    setFacilitiesData(null);
    setAdvisoryData(null);
    setEvacuationRoute(null);
    setSelectedFacilityId(null);
    setSelectedPlumeTier(null);
    setIsDrawerOpen(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("run");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#080c0e] text-slate-100 font-sans">
      {/* Zona A: Tactical Header */}
      <TacticalHeader
        onResetView={() => setResetViewTrigger((t) => t + 1)}
        onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
        isDrawerOpen={isDrawerOpen}
        onToggleLegend={() => setIsLegendOpen((prev) => !prev)}
        isLegendOpen={isLegendOpen}
        onOpenGpsModal={() => setIsGpsModalOpen(true)}
      />


      {/* Main Workspace (Zona B, C, dan D) */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Zona C: Peta Leaflet Full Canvas */}
        <MapWorkspace
          hazard={hazard}
          eventId={eventId}
          currentHour={currentHour}
          hourlyTiersCache={hourlyTiersCache}
          impactedFacilities={facilitiesData}
          evacuationRoute={evacuationRoute}
          onSelectEvent={(newId) => {
            if (newId.startsWith("hutan_") || newId.startsWith("karhutla_")) {
              setHazard("fire");
            } else {
              setHazard("volcano");
            }
            handleEventChange(newId);
          }}
          resetViewTrigger={resetViewTrigger}
          onResetSimulation={handleResetSimulationState}
          flyToTarget={flyToTarget}
          activeRunId={activeRunId}
          runCenter={runInfo?.center_coords ?? null}
          runHotspots={runInfo?.hotspots}
          isDrawerOpen={isDrawerOpen}
          onToggleLegend={() => setIsLegendOpen((prev) => !prev)}
          focusEventTrigger={eventFocusTrigger}
          onLayersLoaded={() => setIsMapReady(true)}
          onSelectFacility={(id) => {
            setSelectedFacilityId(id);
            if (id) setIsDrawerOpen(true);
          }}
          selectedFacilityId={selectedFacilityId}
          selectedPlumeTier={selectedPlumeTier}
          onSelectPlumeTier={(tier) => {
            setSelectedPlumeTier(tier);
            if (tier && tier !== "all") setIsDrawerOpen(true);
          }}
        />

        {/* Global Loading Overlay (Di bawah Navbar): cadangan jika loader sungai dilewati sebelum peta siap */}
        {!isMapReady && !isRunning && !riverLoaderOn && (
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

        {simError && (
          <div role="alert" className="absolute top-14 left-1/2 -translate-x-1/2 z-[2100] max-w-lg w-[calc(100%-2rem)] bg-[#f7f3ed] text-[#2b211e] border border-[#DA6556]/50 rounded-xl shadow-2xl px-4 py-3 text-xs flex items-start gap-3">
            <span className="font-bold text-[#A14646] shrink-0">Tidak dapat diproses</span>
            <span className="leading-relaxed flex-1">{simError}</span>
            <button type="button" onClick={() => setSimError(null)} className="shrink-0 font-bold text-[#A14646] hover:opacity-70 cursor-pointer" aria-label="Tutup">✕</button>
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
          isRunning={isRunning}
          progressText={progressText}
          activeRunId={activeRunId}
          simulatedEventName={simulatedEventName}
          onOpenPrintReport={() => setIsPrintModalOpen(true)}
        />

        {/* Zona C: Timeline Player Melayang di Bawah Peta */}
        <TimelinePlayer
          currentHour={currentHour}
          onHourChange={setCurrentHour}
          isDrawerOpen={isDrawerOpen}
          simulatedEventName={simulatedEventName}
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
          onFlyTo={(lat, lng, name, type) => {
            setFlyToTarget({ lat, lng, _t: Date.now(), name, type });
          }}
          onDrawRoute={handleDrawRoute}
          activeRouteId={evacuationRoute?.facilityId}
          simulatedEventName={simulatedEventName}
          activeRunId={activeRunId}
          selectedFacilityId={selectedFacilityId}
          onSelectFacility={setSelectedFacilityId}
          selectedPlumeTier={selectedPlumeTier}
          onSelectPlumeTier={setSelectedPlumeTier}
          onHourChange={setCurrentHour}
          eventId={eventId}
          runInfo={runInfo}
        />

        {/* Modal Legenda Otoritatif PVMBG & Dispersi */}
        <LegendModal
          isOpen={isLegendOpen}
          onClose={() => setIsLegendOpen(false)}
          showSchools={showSchools}
          onToggleSchools={setShowSchools}
          showHospitals={showHospitals}
          onToggleHospitals={setShowHospitals}
          showAirports={showAirports}
          onToggleAirports={setShowAirports}
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
          hourlyTiersCache={hourlyTiersCache}
        />

        {/* Modal AI GPS Siaga Personal Warga */}
        <GpsAdvisoryModal
          isOpen={isGpsModalOpen}
          onClose={() => setIsGpsModalOpen(false)}
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
          hourlyTiersCache={hourlyTiersCache}
        />

        {/* Modal AI Siaga Lokasi Personal (GPS Saya) */}
        <GpsAdvisoryModal
          isOpen={isGpsModalOpen}
          onClose={() => setIsGpsModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default App;
