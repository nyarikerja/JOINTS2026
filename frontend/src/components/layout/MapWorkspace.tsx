import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Plus, Minus, Layers, X, LocateFixed, User, Map as MapIcon, Satellite } from "lucide-react";
import { CameraReadout } from "./MapReadouts";
import { CONFIG } from "../../config/constants";
import { api } from "../../services/api";
import { reportBoot, trackTileLayer } from "../../utils/bootProgress";
import { formatHour } from "../../utils/formatters";
import { NationalModes } from "./NationalModes";
import { HeatLeafletLayer } from "../../simulation/heatLayer";
import type { HazardType, FacilitiesImpactResponse, SchoolItem, HospitalItem } from "../../types/api";

// Algoritma Ray-Casting untuk memastikan fasilitas benar-benar berada di dalam poligon sebaran abu/gas
function pointInRing(pt: [number, number], ring: number[][]): boolean {
  const [x, y] = pt; // x: lng, y: lat
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInGeoJson(lng: number, lat: number, geojson: any): boolean {
  if (!geojson) return false;
  const features = geojson.type === "FeatureCollection" ? geojson.features : (Array.isArray(geojson) ? geojson : [geojson]);
  for (const feat of (features || [])) {
    const geom = feat?.geometry || feat;
    if (!geom || !geom.coordinates) continue;
    if (geom.type === "Polygon") {
      if (pointInRing([lng, lat], geom.coordinates[0])) return true;
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        if (pointInRing([lng, lat], poly[0])) return true;
      }
    }
  }
  return false;
}

interface MapWorkspaceProps {
  hazard: HazardType;
  eventId: string;
  currentHour: number;
  hourlyTiersCache: Record<string | number, any> | null;
  impactedFacilities?: FacilitiesImpactResponse | null;
  evacuationRoute: {
    geometry: [number, number][];
    label: string;
    distanceKm?: number;
    durationMin?: number;
    facilityId?: string;
    originName?: string;
    destName?: string;
  } | null;
  onSelectEvent: (eventId: string, lat: number, lng: number, radiusKm: number) => void;
  resetViewTrigger: number;
  flyToTarget?: { lat: number; lng: number; _t: number; name?: string; type?: "school" | "hospital" | string } | null;
  activeRunId?: string | null;
  runCenter?: { latitude: number; longitude: number } | null;
  isDrawerOpen?: boolean;
  onToggleLegend?: () => void;
  onLayersLoaded?: () => void;
  selectedFacilityId?: string | null;
  onSelectFacility?: (id: string | null) => void;
  onSelectPlumeTier?: (tier: string | null) => void;
  selectedPlumeTier?: string | null;
  runHotspots?: any[];
}

const FACILITY_MIN_ZOOM = 11;

export const MapWorkspace: React.FC<MapWorkspaceProps> = ({
  hazard,
  eventId,
  currentHour,
  hourlyTiersCache,
  impactedFacilities,
  evacuationRoute,
  onSelectEvent,
  resetViewTrigger,
  flyToTarget,
  activeRunId,
  runCenter,
  runHotspots,
  isDrawerOpen: _isDrawerOpen = false,
  onToggleLegend: _onToggleLegend,
  onLayersLoaded,
  selectedFacilityId,
  onSelectFacility,
  onSelectPlumeTier,
  selectedPlumeTier
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsTileLayerRef = useRef<L.TileLayer | null>(null);

  const [showVolcanoes, setShowVolcanoes] = useState(true);
  const [showForests, setShowForests] = useState(true);
  const [showHotspots, setShowHotspots] = useState(false);
  const [showPlume, setShowPlume] = useState(false);
  const [showSchools, setShowSchools] = useState(false);
  const [showHospitals, setShowHospitals] = useState(false);
  const [showAirports, setShowAirports] = useState(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768 && window.innerHeight >= 900);

  // Status & parameter medan angin dinamis (ForgeHack Authentic Wind Vector & Plume Drift)
  const [currentWindInfo, setCurrentWindInfo] = useState<{
    cardinal: string;
    cardinal_from?: string;
    cardinal_to?: string;
    speed_ms: number;
    speed_kmh: number;
    direction_deg: number;
    bearing_motion_deg: number;
    u?: number;
    v?: number;
    description?: string;
  } | null>(null);
  const windVectorMarkerRef = useRef<L.Marker | null>(null);

  const showVolcanoesRef = useRef(showVolcanoes);
  const showForestsRef = useRef(showForests);
  const showHotspotsRef = useRef(showHotspots);
  const showSchoolsRef = useRef(showSchools);
  const showHospitalsRef = useRef(showHospitals);
  const showAirportsRef = useRef(showAirports);

  const volcanoesLayerRef = useRef<L.GeoJSON | null>(null);
  const forestsLayerRef = useRef<L.GeoJSON | null>(null);
  const selectedForestHotspotsLayerRef = useRef<L.GeoJSON | null>(null);
  const hotspotsLayerRef = useRef<L.GeoJSON | null>(null);
  const hotspotsHeatmapRef = useRef<HeatLeafletLayer | null>(null);
  const heatmapDataRef = useRef<{ cells: any[]; maxFrp: number; cellDeg: number } | null>(null);
  const rawHotspotsRef = useRef<any[]>([]);
  const hotspotsBboxRef = useRef<string | null>(null);
  const updateHotspotsViewportRef = useRef<((map: L.Map) => void) | null>(null);
  const facilitiesBboxRef = useRef<string | null>(null);
  const airportsGeoRef = useRef<any>(null);
  const loadFacilitiesRef = useRef<((map: L.Map) => void) | null>(null);
  const loadHotspotsRef = useRef<((map: L.Map, targetEventId?: string) => Promise<void>) | null>(null);
  const schoolsLayerRef = useRef<L.GeoJSON | null>(null);
  const hospitalsLayerRef = useRef<L.GeoJSON | null>(null);
  const airportsLayerRef = useRef<L.GeoJSON | null>(null);
  const plumeLayerRef = useRef<L.GeoJSON | null>(null);
  const impactedFacilitiesLayerRef = useRef<L.LayerGroup | null>(null);
  const krbCircleRef = useRef<L.Circle | null>(null);
  const evacRouteLineRef = useRef<L.Polyline | null>(null);
  const routeStartMarkerRef = useRef<L.Marker | null>(null);
  const routeEndMarkerRef = useRef<L.Marker | null>(null);
  const focusMarkerRef = useRef<L.Marker | null>(null);
  const volcanoesDataRef = useRef<any[]>([]);
  const forestsDataRef = useRef<any[]>([]);

  const [mapStyle, setMapStyle] = useState<"exposure" | "satellite">("satellite");
  const [isLocating, setIsLocating] = useState(false);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);

  const applyBasemap = (map: L.Map, type: "satellite" | "dark" | "paper") => {
    if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current);
    if (labelsTileLayerRef.current) map.removeLayer(labelsTileLayerRef.current);
    labelsTileLayerRef.current = null;
    map.getContainer().classList.toggle("map-paper", type === "paper");

    if (type === "paper") {
      baseTileLayerRef.current = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        className: "paper-tiles",
        maxZoom: 18
      }).addTo(map);
      return;
    }

    if (type === "satellite") {
      // 1. Esri World Imagery (Citra Satelit & Relief Permukaan / Batimetri Laut)
      baseTileLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
          maxZoom: 19
        }
      ).addTo(map);

      // 2. Esri World Boundaries and Places (Label Kota, Jalan, & Batas Wilayah)
      labelsTileLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "",
          maxZoom: 19
        }
      ).addTo(map);
    } else {
      // Tampilan Taktis Gelap (OSM + Inverted Dark Filter)
      baseTileLayerRef.current = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap | PVMBG &bull; NASA FIRMS &bull; Open-Meteo",
        className: "dark-tiles",
        maxZoom: 18
      }).addTo(map);
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    applyBasemap(mapRef.current, mapStyle === "exposure" ? "paper" : "satellite");
  }, [mapStyle]);

  const handleShowMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung geolokasi GPS.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        if (!mapRef.current) return;

        mapRef.current.flyTo([latitude, longitude], 14, { duration: 1.5 });

        if (userLocationMarkerRef.current) {
          mapRef.current.removeLayer(userLocationMarkerRef.current);
        }

        const userIcon = L.divIcon({
          className: "user-gps-pulse-marker",
          html: `
            <div style="position: relative; width: 22px; height: 22px;">
              <span style="position: absolute; inset: 0; border-radius: 9999px; background: rgba(56, 189, 248, 0.45); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
              <span style="position: absolute; inset: 3px; border-radius: 9999px; background: #0284c7; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.5);"></span>
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        userLocationMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon, zIndexOffset: 3000 })
          .addTo(mapRef.current)
          .bindTooltip("<strong>Lokasi Anda (GPS)</strong>", { permanent: false, direction: "top" });
      },
      (err) => {
        setIsLocating(false);
        console.warn("Geolocation error:", err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleResetIndonesia = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(
        [CONFIG.DEFAULT_MAP_VIEW.lat, CONFIG.DEFAULT_MAP_VIEW.lng],
        CONFIG.DEFAULT_MAP_VIEW.zoom,
        { duration: 1.2 }
      );
    }
  };

  // Update Hotspot layer dengan Hybrid LOD (Heatmap < 9, Markers >= 9) & Viewport Culling
  const updateHotspotsViewport = useCallback((map: L.Map) => {
    if (!showHotspots) {
      if (hotspotsLayerRef.current) {
        map.removeLayer(hotspotsLayerRef.current);
        hotspotsLayerRef.current = null;
      }
      if (hotspotsHeatmapRef.current) {
        hotspotsHeatmapRef.current.setVisible(false);
      }
      return;
    }

    // Jika data heatmap belum tersedia, minta reload otomatis
    if (!heatmapDataRef.current) {
      loadHotspotsRef.current?.(map);
      return;
    }

    const zoom = map.getZoom();

    // LOD SWITCHER:
    // Zoom < 9: Mode Heatmap (Peta Panas Kepadatan Radiasi Termal Nasional)
    // Zoom >= 9: Mode Titik Api Individual (Ikon titik_api.png dengan Tooltip Telemetri)
    if (zoom < 9) {
      if (hotspotsLayerRef.current) {
        map.removeLayer(hotspotsLayerRef.current);
        hotspotsLayerRef.current = null;
      }
      if (hotspotsHeatmapRef.current) {
        if (heatmapDataRef.current) {
          hotspotsHeatmapRef.current.setData(
            heatmapDataRef.current.cells,
            heatmapDataRef.current.maxFrp,
            heatmapDataRef.current.cellDeg
          );
        }
        hotspotsHeatmapRef.current.setVisible(true);
      }
    } else {
      if (hotspotsHeatmapRef.current) {
        hotspotsHeatmapRef.current.setVisible(false);
      }

      const bounds = map.getBounds().pad(0.25); // Buffer 25% di luar viewport
      const bboxKey = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].map((v) => v.toFixed(2)).join(",");
      if (hotspotsBboxRef.current !== bboxKey) {
        hotspotsBboxRef.current = bboxKey;
        api.getHotspots("national", bboxKey)
          .then((geo) => {
            rawHotspotsRef.current = geo?.features || [];
            if (hotspotsBboxRef.current === bboxKey) updateHotspotsViewportRef.current?.(map);
          })
          .catch(() => {});
        return;
      }
      const allFeatures = rawHotspotsRef.current;

      const inBounds = allFeatures.filter((f: any) => {
        const c = f.geometry?.coordinates;
        if (!c) return false;
        return bounds.contains([c[1], c[0]]);
      });

      if (hotspotsLayerRef.current) {
        map.removeLayer(hotspotsLayerRef.current);
        hotspotsLayerRef.current = null;
      }

      if (inBounds.length > 0) {
        hotspotsLayerRef.current = L.geoJSON({ type: "FeatureCollection", features: inBounds } as any, {
          pointToLayer: (_feature: any, latlng) => {
            const icon = L.divIcon({
              className: "hotspot-icon",
              html: `<img src="/titik_api.png" class="w-5 h-5 object-contain pointer-events-auto" />`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            return L.marker(latlng, { icon });
          },
          onEachFeature: (feature: any, layer) => {
            const p = feature.properties;
            layer.bindTooltip(
              `<div style="min-width: 170px; line-height: 1.45; font-family: ui-sans-serif, system-ui, sans-serif; padding: 2px;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                  <img src="/titik_api.png" style="width: 16px; height: 16px; object-fit: contain;" />
                  <strong style="color: #FFF0C5; font-size: 12px; font-weight: 700;">Titik Api ${p.sensor || "NASA FIRMS"}</strong>
                </div>
                <div style="color: #FDB773; font-size: 11px; margin-bottom: 2px;">
                  Radiasi Energi (FRP): <strong style="color: #FFEDD5;">${p.frp ? `${p.frp} MW` : '-'}</strong>
                </div>
                ${p.confidence ? `
                  <div style="color: #cbd5e1; font-size: 10.5px;">
                    Keyakinan Deteksi: <strong style="color: #f1f5f9;">${p.confidence}</strong>
                  </div>
                ` : ''}
                ${p.acq_date ? `
                  <div style="color: #94a3b8; font-size: 9.5px; margin-top: 3px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 3px;">
                    Terdeteksi: ${p.acq_datetime_utc ? new Date(p.acq_datetime_utc).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " WIB" : `${p.acq_date} ${p.acq_time || ""} UTC`}
                  </div>
                ` : ''}
              </div>`,
              { direction: "top", offset: [0, -10] }
            );
          }
        }).addTo(map);
      }
    }
  }, [showHotspots]);

  const loadHotspots = useCallback(async (map: L.Map, _targetEventId?: string) => {
    try {
      // Heatmap = deteksi FIRMS 24 jam terakhir (sama dengan angka "Titik Api Aktif (24h)" di header)
      const [heatRes] = await Promise.allSettled([api.getHeatmap(1)]);
      hotspotsBboxRef.current = null;

      if (heatRes.status === "fulfilled" && heatRes.value?.cells && heatRes.value?.available) {
        heatmapDataRef.current = {
          cells: heatRes.value.cells,
          maxFrp: heatRes.value.max_frp_sum || 1,
          cellDeg: heatRes.value.cell_deg || 0.25
        };
        if (hotspotsHeatmapRef.current) {
          hotspotsHeatmapRef.current.setData(
            heatRes.value.cells,
            heatRes.value.max_frp_sum || 1,
            heatRes.value.cell_deg || 0.25
          );
        }
      }

      updateHotspotsViewport(map);
    } catch {
      // Offline fallback
    }
  }, [updateHotspotsViewport]);

  useEffect(() => {
    loadHotspotsRef.current = loadHotspots;
  }, [loadHotspots]);

  useEffect(() => {
    updateHotspotsViewportRef.current = updateHotspotsViewport;
  }, [updateHotspotsViewport]);

  // Inisialisasi Peta Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const cfg = CONFIG.DEFAULT_MAP_VIEW;
    const map = L.map(mapContainerRef.current, {
      center: [cfg.lat, cfg.lng],
      zoom: cfg.zoom,
      minZoom: cfg.minZoom,
      maxZoom: cfg.maxZoom,
      zoomControl: false,
      preferCanvas: true,            // Render vektor poligon plume & batas wilayah di GPU Canvas
      wheelPxPerZoomLevel: 120,      // Zoom scroll lebih halus dan presisi
      wheelDebounceTime: 40,
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
      inertia: true,                 // Luncuran halus saat geser peta dilepas
      inertiaDeceleration: 3000,
      inertiaMaxSpeed: 1500,
      easeLinearity: 0.2
    });

    // Pasang Basemap Default (Exposure Paper atau Satelit Esri)
    applyBasemap(map, mapStyle === "exposure" ? "paper" : "satellite");
    if (baseTileLayerRef.current) trackTileLayer(baseTileLayerRef.current);

    mapRef.current = map;

    // Pasang Kanvas Peta Panas (Heatmap) Titik Api Skala Makro
    hotspotsHeatmapRef.current = new HeatLeafletLayer(map);

    // Load Coastline fallback
    api.getCoastline()
      .then((geo) => {
        L.geoJSON(geo, {
          style: { color: "#8AD6D1", weight: 0.8, opacity: 0.35 }
        }).addTo(map);
      })
      .catch(() => {});

    // Hook moveend & zoomend dengan debounce ringan untuk Viewport Culling titik api & LOD transition
    let moveTimeout: ReturnType<typeof setTimeout> | null = null;
    const onMoveOrZoom = () => {
      if (moveTimeout) clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        updateHotspotsViewport(map);
        if ((showSchoolsRef.current || showHospitalsRef.current) && map.getZoom() >= FACILITY_MIN_ZOOM) {
          loadFacilitiesRef.current?.(map);
        }
      }, 250);
    };
    map.on("moveend", onMoveOrZoom);
    map.on("zoomend", onMoveOrZoom);

    // Load semua layer secara paralel (progres tiap layer dilaporkan ke loader sungai)
    let layersDone = 0;
    const layerJobs = [loadVolcanoes(map), loadForests(map), loadHotspots(map), loadFacilities(map)];
    const tickLayer = () => reportBoot("peta", ++layersDone / layerJobs.length);
    layerJobs.forEach((job) => job.then(tickLayer, tickLayer));
    Promise.allSettled(layerJobs).finally(() => {
      reportBoot("peta", 1);
      onLayersLoaded?.();
    });

    return () => {
      if (moveTimeout) clearTimeout(moveTimeout);
      map.off("moveend", onMoveOrZoom);
      map.off("zoomend", onMoveOrZoom);
      map.off("click");
      if (hotspotsHeatmapRef.current) {
        hotspotsHeatmapRef.current.destroy();
        hotspotsHeatmapRef.current = null;
      }
      if (impactedFacilitiesLayerRef.current) {
        impactedFacilitiesLayerRef.current.clearLayers();
        impactedFacilitiesLayerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [updateHotspotsViewport]);

  // Reset View Handler
  useEffect(() => {
    if (resetViewTrigger > 0 && mapRef.current) {
      mapRef.current.flyTo(
        [CONFIG.DEFAULT_MAP_VIEW.lat, CONFIG.DEFAULT_MAP_VIEW.lng],
        CONFIG.DEFAULT_MAP_VIEW.zoom,
        { duration: 1.2 }
      );
      // Kembalikan checkbox titik api ke default (TIDAK DICENTANG)
      setShowHotspots(false);
      showHotspotsRef.current = false;
      if (hotspotsLayerRef.current) {
        mapRef.current.removeLayer(hotspotsLayerRef.current);
        hotspotsLayerRef.current = null;
      }
      if (hotspotsHeatmapRef.current) {
        hotspotsHeatmapRef.current.setVisible(false);
      }
      setShowSchools(false);
      setShowHospitals(false);
      setShowAirports(false);
      setShowPlume(false);
      if (plumeLayerRef.current) {
        mapRef.current.removeLayer(plumeLayerRef.current);
        plumeLayerRef.current = null;
      }
      if (windVectorMarkerRef.current) {
        mapRef.current.removeLayer(windVectorMarkerRef.current);
        windVectorMarkerRef.current = null;
      }
      if (krbCircleRef.current) {
        mapRef.current.removeLayer(krbCircleRef.current);
        krbCircleRef.current = null;
      }
      if (selectedForestHotspotsLayerRef.current) {
        mapRef.current.removeLayer(selectedForestHotspotsLayerRef.current);
        selectedForestHotspotsLayerRef.current = null;
      }
    }
  }, [resetViewTrigger]);

  // FlyTo Handler untuk Fasilitas (Sekolah/RS) + Tampilkan Logo Marker Fokus & Popup
  useEffect(() => {
    if (flyToTarget && mapRef.current) {
      const map = mapRef.current;

      map.flyTo(
        [flyToTarget.lat, flyToTarget.lng],
        14, // Zoom level 14 untuk melihat detail wilayah fasilitas
        { duration: 1.2, easeLinearity: 0.25 }
      );

      if (focusMarkerRef.current) {
        map.removeLayer(focusMarkerRef.current);
      }

      const isHospital = flyToTarget.type === "hospital" || flyToTarget.name?.toLowerCase().includes("rs") || flyToTarget.name?.toLowerCase().includes("puskesmas");
      const iconImg = isHospital ? "/hospital.png" : "/school.png";
      const titleLabel = isHospital ? "Fasilitas Kesehatan" : "Sekolah";

      const focusIcon = L.divIcon({
        className: "fac-focus-pin",
        html: `
          <div class="cursor-pointer hover:scale-110 transition-transform drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]">
            <img src="${iconImg}" class="w-8 h-8 object-contain pointer-events-none" />
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      focusMarkerRef.current = L.marker([flyToTarget.lat, flyToTarget.lng], {
        icon: focusIcon,
        zIndexOffset: 3000
      })
        .addTo(map)
        .bindPopup(`
          <div class="text-xs p-1 font-sans">
            <div class="font-bold text-slate-800 text-[13px]">${flyToTarget.name || titleLabel}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">${titleLabel} Terpilih</div>
          </div>
        `)
        .openPopup();
    }
  }, [flyToTarget]);

  // Sinkronisasi data arah & vektor kecepatan angin saat jam/simulasi berubah (100% konsisten fisik)
  useEffect(() => {
    const hourKey = `hour_${currentHour}`;
    const curGeo = hourlyTiersCache
      ? (hourlyTiersCache[hourKey] || hourlyTiersCache[currentHour] || hourlyTiersCache[String(currentHour)] || (hourlyTiersCache.features ? hourlyTiersCache : null))
      : null;
    const wind = curGeo?.properties?.wind;

    const CARDINALS = ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"];
    const resolveWindCards = (w: any) => {
      const bearDeg = Number(w?.bearing_motion_deg ?? (Number(w.direction_deg) + 180) % 360);
      const dirDeg = Number(w?.direction_deg ?? ((bearDeg + 180) % 360));
      const cardFromIdx = Math.round(dirDeg / 45) % 8;
      const cardToIdx = Math.round(bearDeg / 45) % 8;
      return {
        bearing_motion_deg: bearDeg,
        direction_deg: dirDeg,
        cardinal_from: w?.cardinal_from || CARDINALS[cardFromIdx],
        cardinal_to: w?.cardinal_to || CARDINALS[cardToIdx],
        cardinal: w?.cardinal_to || CARDINALS[cardToIdx],
        speed_ms: w?.speed_ms,
        speed_kmh: w?.speed_kmh,
        u: w?.u,
        v: w?.v,
        description: w?.description
      };
    };

    // Angin hanya ditampilkan dari data run (ensemble Open-Meteo); tanpa run tidak ada panah angin
    if (wind && wind.speed_ms !== undefined) {
      setCurrentWindInfo(resolveWindCards(wind));
    } else if (activeRunId) {
      api.getWindAtHour(activeRunId, currentHour)
        .then((res) => {
          const w = res?.wind || res;
          setCurrentWindInfo(w && w.speed_ms !== undefined && w.available !== false ? resolveWindCards(w) : null);
        })
        .catch(() => setCurrentWindInfo(null));
    } else {
      setCurrentWindInfo(null);
    }
  }, [currentHour, hourlyTiersCache, activeRunId]);

  // Otomatis arahkan kamera peta ke lokasi kejadian terpilih
  const EVENT_COORDS: Record<string, [number, number, number]> = {
    // Gunung Api PVMBG
    anak_krakatau_2026_09: [-6.102, 105.423, 10.5],
    merapi_yogyakarta: [-7.540, 110.446, 11],
    lewotobi_laki_laki: [-8.538, 122.768, 11],
    marapi_sumatera: [-0.381, 100.473, 11],
    semeru: [-8.108, 112.922, 11],
    agung: [-8.343, 115.508, 11],
    rinjani: [-8.420, 116.470, 11],
    sinabung: [3.170, 98.392, 11],
    kelud: [-7.930, 112.308, 11],
    bromo: [-7.942, 112.953, 11],
    ruang: [2.300, 125.370, 11],
    ibu: [1.488, 127.630, 11],
    dukono: [1.693, 127.894, 11],
    iya: [-8.897, 121.645, 11],

    // Kejadian Karhutla Satelit & Kawasan Hutan
    live_kalimantan: [-2.200, 113.900, 8.5],
    karhutla_riau: [0.442, 101.892, 9],
    karhutla_jambi: [-1.889, 103.834, 9],
    karhutla_kalbar: [-1.166, 110.647, 9],
    karhutla_kalsel: [-2.932, 115.019, 9],
    karhutla_sumsel: [-4.261, 105.174, 9],
    karhutla_papua: [-8.307, 140.712, 9],

    // 24 Kawasan Hutan & Lahan Gambut Kritis
    hutan_sebangau: [-2.55, 113.85, 9.5],
    hutan_eks_plg: [-2.85, 114.25, 9.5],
    hutan_tanjung_puting: [-3.05, 111.95, 9.5],
    hutan_gunung_palung: [-1.25, 110.15, 9.5],
    hutan_kubu_raya: [-0.35, 109.45, 9.5],
    hutan_danau_sentarum: [0.85, 112.15, 9.5],
    hutan_meratus: [-2.75, 115.55, 9.5],
    hutan_banjarbaru: [-3.48, 114.78, 10],
    hutan_kutai: [0.25, 117.25, 9.5],
    hutan_sungai_wain: [-1.12, 116.85, 10],
    hutan_tesso_nilo: [-0.08, 101.62, 9.5],
    hutan_giam_siak: [1.18, 101.88, 9.5],
    hutan_berbak: [-1.42, 104.28, 9.5],
    hutan_padang_sugihan: [-3.22, 105.12, 9.5],
    hutan_meranti_pesisir: [0.95, 102.72, 9.5],
    hutan_bukit_tigapuluh: [-0.85, 102.45, 9.5],
    hutan_kerinci_seblat: [-2.15, 101.45, 9.5],
    hutan_way_kambas: [-4.95, 105.75, 9.5],
    hutan_bromo: [-7.94, 112.95, 10],
    hutan_baluran: [-7.83, 114.38, 10],
    hutan_gunung_lawu: [-7.63, 111.19, 10],
    hutan_merbabu: [-7.45, 110.43, 10],
    hutan_ciremai: [-6.89, 108.40, 10],
    hutan_alas_purwo: [-8.65, 114.45, 10],
    hutan_komodo: [-8.55, 119.55, 9.5],
    hutan_manupeu_sumba: [-9.75, 119.85, 9.5],
    hutan_tambora: [-8.25, 118.00, 9.5],
    hutan_rinjani: [-8.42, 116.45, 9.5],
    hutan_bali_barat: [-8.15, 114.48, 10],
    hutan_rawa_aopa: [-4.45, 121.95, 9.5],
    hutan_lore_lindu: [-1.35, 120.15, 9.5],
    hutan_bogani: [0.55, 123.65, 9.5],
    hutan_maros: [-4.95, 119.75, 10],
    hutan_wasur: [-8.55, 140.65, 9.5],
    hutan_mappi_asmat: [-6.85, 139.45, 9.5],
    hutan_bintuni: [-2.15, 133.55, 9.5]
  };

  // Render Marker Panah Vektor Angin Langsung di Titik Episentrum Kejadian (100% Mengarah ke Plume)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (windVectorMarkerRef.current) {
      map.removeLayer(windVectorMarkerRef.current);
      windVectorMarkerRef.current = null;
    }

    if (!currentWindInfo) return;

    // Resolusi koordinat pusat kejadian: TEPAT MENEMPEL PADA LOGO POHON / TITIK API / GUNUNG API
    let cLat: number | undefined;
    let cLng: number | undefined;

    if (hazard === "fire") {
      // 1. Prioritaskan koordinat pohon kawasan hutan terpilih agar panah menempel tepat di logo pohon
      const fireObj = (forestsDataRef.current || []).find((f: any) =>
        f.id === eventId || f.name === eventId || (f.properties && (f.properties.id === eventId || f.properties.name === eventId))
      );
      if (fireObj) {
        cLat = Number(fireObj.lat ?? fireObj.latitude ?? fireObj.geometry?.coordinates?.[1]);
        cLng = Number(fireObj.lon ?? fireObj.longitude ?? fireObj.geometry?.coordinates?.[0]);
      } else if (runHotspots && runHotspots.length > 0) {
        // 2. Jika tidak ada objek pohon di katalog, ambil titik api terkuat (FRP terbesar)
        const sortedHs = [...runHotspots].sort((a, b) => (Number(b.frp) || 0) - (Number(a.frp) || 0));
        cLat = Number(sortedHs[0].latitude);
        cLng = Number(sortedHs[0].longitude);
      } else if (EVENT_COORDS[eventId]) {
        cLat = EVENT_COORDS[eventId][0];
        cLng = EVENT_COORDS[eventId][1];
      } else if (runCenter) {
        cLat = Number(runCenter.latitude);
        cLng = Number(runCenter.longitude);
      }
    } else {
      // Mode gunung api: pasang panah tepat di koordinat kawah gunung api terpilih
      const feat = (volcanoesDataRef.current || []).find(
        (f: any) => (f.properties?.event_id || f.properties?.id || f.id) === eventId
      );
      if (feat?.geometry?.coordinates) {
        cLat = feat.geometry.coordinates[1];
        cLng = feat.geometry.coordinates[0];
      } else if (EVENT_COORDS[eventId]) {
        cLat = EVENT_COORDS[eventId][0];
        cLng = EVENT_COORDS[eventId][1];
      } else if (runCenter) {
        cLat = Number(runCenter.latitude);
        cLng = Number(runCenter.longitude);
      }
    }

    // Tanpa koordinat sumber yang diketahui, panah tidak digambar
    if (cLat === undefined || cLng === undefined || isNaN(cLat) || isNaN(cLng)) {
      return;
    }

    // Resolusi warna level simbol aktif (Level I: Hijau, Level II: Kuning, Level III: Oranye, Level IV: Merah)
    let symbolColor = "#f97316"; // Default siaga

    if (hazard === "fire") {
      const fireObj = (forestsDataRef.current || []).find((f: any) =>
        f.id === eventId || f.name === eventId || (f.properties && (f.properties.id === eventId || f.properties.name === eventId))
      );
      const p = fireObj?.properties || fireObj;
      const nHot = Number(p?.n_hotspots || (runHotspots ? runHotspots.length : 0));
      const lvl = Number(p?.level || (nHot >= 100 ? 4 : nHot >= 10 ? 3 : nHot >= 1 ? 2 : 1));
      if (lvl === 4) symbolColor = "#ef4444"; // Level IV (Awas / Merah)
      else if (lvl === 3) symbolColor = "#f97316"; // Level III (Siaga / Oranye)
      else if (lvl === 2) symbolColor = "#eab308"; // Level II (Waspada / Kuning)
      else symbolColor = "#10b981"; // Level I (Normal / Hijau)
    } else {
      const feat = (volcanoesDataRef.current || []).find(
        (f: any) => (f.properties?.event_id || f.properties?.id || f.id) === eventId
      );
      const p = feat?.properties || feat;
      const lvl = Number(p?.level || p?.status_level || 3);
      if (lvl === 4) symbolColor = "#ef4444"; // Level 4 (Awas / Merah)
      else if (lvl === 3) symbolColor = "#f97316"; // Level 3 (Siaga / Oranye)
      else if (lvl === 2) symbolColor = "#eab308"; // Level 2 (Waspada / Kuning)
      else if (lvl === 1) symbolColor = "#10b981"; // Level 1 (Normal / Hijau)
      else if (p?.color) symbolColor = p.color;
    }

    const bearing = currentWindInfo.bearing_motion_deg;
    const speed = currentWindInfo.speed_ms;
    const toCard = currentWindInfo.cardinal_to || currentWindInfo.cardinal;

    const arrowIcon = L.divIcon({
      className: "epicenter-wind-arrow-marker",
      html: `
        <div style="position: relative; width: 0; height: 0; pointer-events: none;">
          <!-- Panah Vektor Menembus dari Episentrum ke Arah Sebaran Plume (Warna Selaras Simbol) -->
          <div style="position: absolute; top: 0; left: 0; transform: rotate(${bearing}deg); transform-origin: 0 0;">
            <div style="position: absolute; bottom: 20px; left: -12px; width: 24px; height: 54px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;">
              <svg width="24" height="26" viewBox="0 0 24 26" fill="none" style="filter: drop-shadow(0 2px 8px rgba(0,0,0,0.85));">
                <path d="M12 0 L23 18 L15 15 L12 26 L9 15 L1 18 Z" fill="${symbolColor}" stroke="#FFF0C5" stroke-width="1.6" stroke-linejoin="round" />
              </svg>
              <div style="width: 2.5px; height: 26px; background: linear-gradient(to top, rgba(0,0,0,0), ${symbolColor}); box-shadow: 0 0 8px ${symbolColor};"></div>
              <div style="width: 6px; height: 6px; border-radius: 50%; background: #FFF0C5; box-shadow: 0 0 8px ${symbolColor}; border: 1.5px solid ${symbolColor};"></div>
            </div>
          </div>
          <!-- Label Telemetri Arah Sebaran Vektor (Modern Tactile Chip) -->
          <div style="
            position: absolute;
            top: 32px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(18, 14, 13, 0.90);
            border: 1px solid ${symbolColor}55;
            border-radius: 9999px;
            padding: 3px 10px;
            white-space: nowrap;
            color: #FFF0C5;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            gap: 6px;
            pointer-events: auto;
            user-select: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ">
            <!-- Dynamic rotating wind vector arrow icon matching bearing and symbol color -->
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${symbolColor}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${bearing}deg); flex-shrink: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>

            <!-- Arah Sebaran & Derajat -->
            <span style="font-size: 10px; font-weight: 500; color: rgba(255, 240, 197, 0.75);">Sebaran:</span>
            <strong style="font-size: 10.5px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.01em;">${toCard}</strong>
            <span style="font-size: 9.5px; color: rgba(255, 240, 197, 0.6); font-family: monospace;">(${Math.round(bearing)}°)</span>

            <!-- Hairline Divider -->
            <span style="width: 1px; height: 10px; background: rgba(255, 255, 255, 0.2);"></span>

            <!-- Speed Chip -->
            <span style="
              background: ${symbolColor}22;
              color: ${symbolColor};
              border: 1px solid ${symbolColor}44;
              padding: 0.5px 5px;
              border-radius: 4px;
              font-family: ui-monospace, monospace;
              font-size: 9.5px;
              font-weight: 700;
            ">${speed} m/s</span>
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });

    windVectorMarkerRef.current = L.marker([cLat, cLng], {
      icon: arrowIcon,
      zIndexOffset: 1500,
      interactive: false
    }).addTo(map);

    return () => {
      if (windVectorMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(windVectorMarkerRef.current);
        windVectorMarkerRef.current = null;
      }
    };
  }, [currentWindInfo, eventId, hazard, hourlyTiersCache, currentHour, runCenter, runHotspots]);

  // Render titik api eksklusif di wilayah kawasan hutan terpilih (Point-in-Area Hutan, TANPA menceklis toggle nasional)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (selectedForestHotspotsLayerRef.current) {
      map.removeLayer(selectedForestHotspotsLayerRef.current);
      selectedForestHotspotsLayerRef.current = null;
    }

    const isForestEvent = Boolean(
      eventId && (
        eventId.startsWith("hutan_") ||
        eventId.startsWith("karhutla_") ||
        hazard === "fire" ||
        (forestsDataRef.current || []).some((f: any) => f.id === eventId || f.name === eventId)
      )
    );

    if (!isForestEvent || !eventId) return;

    api.getHotspots(eventId)
      .then((geo) => {
        if (!mapRef.current) return;
        const baseFeatures = geo?.features || [];

        // Gabungkan titik api dari simulasi aktif jika ada
        const simHs = (runHotspots || []).map((h: any, idx: number) => ({
          type: "Feature",
          properties: {
            id: h.id || `sim_${idx}`,
            frp: h.frp || 25,
            confidence: h.confidence || "Tinggi",
            sensor: h.sensor || "NASA FIRMS (VIIRS)",
            acq_date: h.acq_date || "",
            acq_time: h.acq_time || "",
            acq_datetime_utc: h.acq_datetime_utc || ""
          },
          geometry: {
            type: "Point",
            coordinates: [Number(h.longitude), Number(h.latitude)]
          }
        }));

        const combined = [...baseFeatures, ...simHs];
        if (combined.length === 0) return;

        if (selectedForestHotspotsLayerRef.current) {
          map.removeLayer(selectedForestHotspotsLayerRef.current);
        }

        selectedForestHotspotsLayerRef.current = L.geoJSON(
          { type: "FeatureCollection", features: combined } as any,
          {
            pointToLayer: (_feat: any, latlng) => {
              const icon = L.divIcon({
                className: "forest-selected-hotspot-icon",
                html: `<img src="/titik_api.png" class="w-5 h-5 object-contain pointer-events-auto filter drop-shadow hover:scale-125 transition-transform" />`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              });
              return L.marker(latlng, { icon, zIndexOffset: 2500 });
            },
            onEachFeature: (feature: any, layer) => {
              const p = feature.properties;
              layer.bindTooltip(
                `<div style="min-width: 170px; line-height: 1.45; font-family: ui-sans-serif, system-ui, sans-serif; padding: 2px;">
                  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <img src="/titik_api.png" style="width: 16px; height: 16px; object-fit: contain;" />
                    <strong style="color: #FFF0C5; font-size: 12px; font-weight: 700;">Titik Api ${p.sensor || "NASA FIRMS"}</strong>
                  </div>
                  <div style="color: #FDB773; font-size: 11px; margin-bottom: 2px;">
                    Radiasi Energi (FRP): <strong style="color: #FFEDD5;">${p.frp ? `${p.frp} MW` : '-'}</strong>
                  </div>
                  ${p.confidence ? `
                    <div style="color: #cbd5e1; font-size: 10.5px;">
                      Keyakinan Deteksi: <strong style="color: #f1f5f9;">${p.confidence}</strong>
                    </div>
                  ` : ''}
                  ${p.acq_date ? `
                    <div style="color: #94a3b8; font-size: 9.5px; margin-top: 3px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 3px;">
                      Terdeteksi: ${p.acq_datetime_utc ? new Date(p.acq_datetime_utc).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " WIB" : `${p.acq_date} ${p.acq_time || ""} UTC`}
                    </div>
                  ` : ''}
                </div>`,
                { direction: "top", offset: [0, -10] }
              );
            }
          }
        ).addTo(map);
      })
      .catch(() => {});

    return () => {
      if (selectedForestHotspotsLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(selectedForestHotspotsLayerRef.current);
        selectedForestHotspotsLayerRef.current = null;
      }
    };
  }, [eventId, hazard, runHotspots]);

  const prevEventIdRef = useRef<string>(eventId);

  useEffect(() => {
    showVolcanoesRef.current = showVolcanoes;
    if (!mapRef.current) return;
    if (showVolcanoes) volcanoesLayerRef.current?.addTo(mapRef.current);
    else volcanoesLayerRef.current?.remove();
  }, [showVolcanoes]);

  useEffect(() => {
    showForestsRef.current = showForests;
    if (!mapRef.current) return;
    if (showForests) forestsLayerRef.current?.addTo(mapRef.current);
    else forestsLayerRef.current?.remove();
  }, [showForests]);

  useEffect(() => {
    showHotspotsRef.current = showHotspots;
    if (!mapRef.current) return;
    updateHotspotsViewport(mapRef.current);
  }, [showHotspots, updateHotspotsViewport]);

  // Otomatis aktifkan layer analisis plume dan titik api ketika simulasi aktif
  const prevActiveRunIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeRunId && activeRunId !== prevActiveRunIdRef.current) {
      prevActiveRunIdRef.current = activeRunId;
      setShowPlume(true);
      if (mapRef.current && plumeLayerRef.current) {
        plumeLayerRef.current.addTo(mapRef.current);
      }
    }
  }, [activeRunId, hazard]);

  // Render Fasilitas (Sekolah & RS) yang Berada di Dalam Area Sebaran Abu/Gas (Sesuai Jam Aktif)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (!impactedFacilitiesLayerRef.current) {
      impactedFacilitiesLayerRef.current = L.layerGroup().addTo(map);
    }
    const layerGroup = impactedFacilitiesLayerRef.current;
    layerGroup.clearLayers();

    if (!impactedFacilities || !activeRunId) return;

    const rawSchools: SchoolItem[] = impactedFacilities.schools || [];
    const rawHospitals: HospitalItem[] = impactedFacilities.healthcare || impactedFacilities.hospitals || [];

    // Cek poligon sebaran abu/gas pada jam saat ini jika sudah tersedia di cache
    const hourKey = `hour_${currentHour}`;
    const currentTierGeo = hourlyTiersCache
      ? (hourlyTiersCache[hourKey] || hourlyTiersCache[currentHour] || hourlyTiersCache[String(currentHour)] || (hourlyTiersCache.features ? hourlyTiersCache : null))
      : null;
    const hasPolygonData = Boolean(currentTierGeo && currentTierGeo.features && currentTierGeo.features.length > 0);

    // Filter fasilitas yang berada di dalam area sebaran abu/gas pada jam aktif (currentHour)
    const activeSchools = rawSchools.filter((s) => {
      const lat = s.lat ?? s.latitude;
      const lng = s.lng ?? s.longitude;
      if (lat === undefined || lng === undefined) return false;

      // 1. Selalu tampilkan jika fasilitas ini sedang dipilih secara aktif
      if (selectedFacilityId && (s.facility_id === selectedFacilityId || s.id === selectedFacilityId || s.name === selectedFacilityId)) {
        return true;
      }

      // 2. Tampilkan jika merupakan titik awal rute evakuasi aktif
      if (evacuationRoute && evacuationRoute.facilityId && (s.facility_id === evacuationRoute.facilityId || s.id === evacuationRoute.facilityId || s.name === evacuationRoute.facilityId)) {
        return true;
      }

      // 3. Tampilkan jika merupakan target pusatkan di peta (flyToTarget)
      if (flyToTarget && Math.abs(flyToTarget.lat - lat) < 0.005 && Math.abs(flyToTarget.lng - lng) < 0.005) {
        return true;
      }

      // 4. Jika poligon sebaran jam aktif tersedia: HARUS benar-benar berada di dalam batas zona sebaran abu/gas
      if (hasPolygonData) {
        return isPointInGeoJson(lng, lat, currentTierGeo);
      }

      return false;
    });

    const activeHospitals = rawHospitals.filter((h) => {
      const lat = h.lat ?? h.latitude;
      const lng = h.lng ?? h.longitude;
      if (lat === undefined || lng === undefined) return false;

      // 1. Selalu tampilkan jika fasilitas ini sedang dipilih secara aktif
      if (selectedFacilityId && (h.facility_id === selectedFacilityId || h.id === selectedFacilityId || h.name === selectedFacilityId)) {
        return true;
      }

      // 2. Tampilkan jika merupakan tujuan rute evakuasi aktif
      if (evacuationRoute && evacuationRoute.destName && (h.name === evacuationRoute.destName || (h.district && evacuationRoute.destName.includes(h.district)))) {
        return true;
      }

      // 3. Tampilkan jika merupakan target pusatkan di peta (flyToTarget)
      if (flyToTarget && Math.abs(flyToTarget.lat - lat) < 0.005 && Math.abs(flyToTarget.lng - lng) < 0.005) {
        return true;
      }

      // 4. Jika poligon sebaran jam aktif tersedia: HARUS benar-benar berada di dalam batas zona sebaran abu/gas
      if (hasPolygonData) {
        return isPointInGeoJson(lng, lat, currentTierGeo);
      }

      return false;
    });

    // Render Sekolah yang berada di dalam area sebaran (ikon murni tanpa lingkaran & tanpa ping)
    activeSchools.forEach((s) => {
      const lat = s.lat ?? s.latitude;
      const lng = s.lng ?? s.longitude;
      if (lat === undefined || lng === undefined) return;

      const prob = s.exposure_pct ?? s.exposure_prob_pct ?? (s.exposure_probability ? Math.round(s.exposure_probability * 100) : 0);
      const isHigh = prob >= 50;
      const eta = s.arrival_time_earliest_h ?? null;

      const icon = L.divIcon({
        className: "impacted-school-pin",
        html: `
          <div class="cursor-pointer hover:scale-125 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            <img src="/school.png" class="w-6 h-6 object-contain pointer-events-none" />
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([lat, lng], { icon, zIndexOffset: 1200 })
        .bindTooltip(
          `<div style="min-width: 140px; line-height: 1.45;">
            <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 2px;">
              <img src="/school.png" style="width: 15px; height: 15px; object-fit: contain;" />
              <strong style="color: #FFF0C5; font-size: 11.5px;">${s.name}</strong>
            </div>
            <div style="color: ${isHigh ? '#f87171' : '#fde047'}; font-size: 10px;">
              ⚠️ Peluang terpapar ${hazard === 'fire' ? 'asap' : 'abu'}: <strong>${prob}%</strong>${eta !== null ? ` (paling cepat T+${eta} jam)` : ''}
            </div>
            <div style="color: #93c5fd; font-size: 9.5px;">${s.district || ''}</div>
          </div>`,
          { direction: "top", offset: [0, -14] }
        )
        .on("click", () => {
          onSelectFacility?.(s.facility_id || s.id || s.name);
        });

      layerGroup.addLayer(marker);
    });

    // Render Rumah Sakit / Faskes yang berada di dalam area sebaran (ikon murni tanpa lingkaran & tanpa ping)
    activeHospitals.forEach((h) => {
      const lat = h.lat ?? h.latitude;
      const lng = h.lng ?? h.longitude;
      if (lat === undefined || lng === undefined) return;

      const prob = h.exposure_pct ?? h.exposure_prob_pct ?? (h.exposure_probability ? Math.round(h.exposure_probability * 100) : 0);
      const isSafe = h.is_safe !== undefined ? h.is_safe : prob < 10;

      const icon = L.divIcon({
        className: "impacted-hosp-pin",
        html: `
          <div class="cursor-pointer hover:scale-125 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            <img src="/hospital.png" class="w-6 h-6 object-contain pointer-events-none" />
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([lat, lng], { icon, zIndexOffset: 1200 })
        .bindTooltip(
          `<div style="min-width: 140px; line-height: 1.45;">
            <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 2px;">
              <img src="/hospital.png" style="width: 15px; height: 15px; object-fit: contain;" />
              <strong style="color: #FFF0C5; font-size: 11.5px;">${h.name}</strong>
            </div>
            <div style="color: ${isSafe ? '#34d399' : '#f87171'}; font-size: 10px;">
              ${isSafe ? '✅ Di luar jalur paparan (peluang < 10%)' : `⚠️ Peluang terpapar ${hazard === 'fire' ? 'asap' : 'abu'} ${prob}%`}
            </div>
            <div style="color: #93c5fd; font-size: 9.5px;">${h.district || ''}</div>
          </div>`,
          { direction: "top", offset: [0, -14] }
        )
        .on("click", () => {
          onSelectFacility?.(h.facility_id || h.id || h.name);
        });

      layerGroup.addLayer(marker);
    });
  }, [impactedFacilities, activeRunId, currentHour, hazard, hourlyTiersCache, selectedFacilityId, onSelectFacility, evacuationRoute, flyToTarget]);

  useEffect(() => {
    loadFacilitiesRef.current = loadFacilities;
  });

  useEffect(() => {
    if (mapRef.current && (showSchools || showHospitals)) loadFacilities(mapRef.current);
  }, [showSchools, showHospitals]);

  useEffect(() => {
    showSchoolsRef.current = showSchools;
    if (!mapRef.current) return;
    if (showSchools) schoolsLayerRef.current?.addTo(mapRef.current);
    else schoolsLayerRef.current?.remove();
  }, [showSchools]);

  useEffect(() => {
    showHospitalsRef.current = showHospitals;
    if (!mapRef.current) return;
    if (showHospitals) hospitalsLayerRef.current?.addTo(mapRef.current);
    else hospitalsLayerRef.current?.remove();
  }, [showHospitals]);

  useEffect(() => {
    showAirportsRef.current = showAirports;
    if (!mapRef.current) return;
    if (showAirports) airportsLayerRef.current?.addTo(mapRef.current);
    else airportsLayerRef.current?.remove();
  }, [showAirports]);


  useEffect(() => {
    // Terbang ke episentrum kejadian saat eventId atau hazard berubah
    if (prevEventIdRef.current !== eventId) {
      prevEventIdRef.current = eventId;
      if (!eventId) {
        if (krbCircleRef.current && mapRef.current) {
          mapRef.current.removeLayer(krbCircleRef.current);
          krbCircleRef.current = null;
        }
        return;
      }
      if (mapRef.current && eventId) {
        if (hazard === "fire") {
          const fireObj = (forestsDataRef.current || []).find((f: any) => f.id === eventId);
          if (fireObj) {
            mapRef.current.flyTo([fireObj.lat, fireObj.lon], 10, { duration: 1.8, easeLinearity: 0.25 });
          } else if (EVENT_COORDS[eventId]) {
            const target = EVENT_COORDS[eventId];
            mapRef.current.flyTo([target[0], target[1]], target[2], { duration: 1.8, easeLinearity: 0.25 });
          }
          if (krbCircleRef.current) {
            mapRef.current.removeLayer(krbCircleRef.current);
            krbCircleRef.current = null;
          }
          loadHotspots(mapRef.current, eventId);
        } else {
          const feat = (volcanoesDataRef.current || []).find(
            (f: any) => (f.properties?.event_id || f.properties?.id || f.id) === eventId
          );
          if (feat && feat.geometry && feat.geometry.coordinates) {
            const c = feat.geometry.coordinates;
            mapRef.current.flyTo([c[1], c[0]], 11, { duration: 1.8, easeLinearity: 0.25 });
            highlightKrb(mapRef.current, c[1], c[0], feat.properties?.radius_bahaya_km || 5.0, feat.properties?.name);
          } else if (EVENT_COORDS[eventId]) {
            const target = EVENT_COORDS[eventId];
            mapRef.current.flyTo([target[0], target[1]], target[2], { duration: 1.8, easeLinearity: 0.25 });
            highlightKrb(mapRef.current, target[0], target[1], 5.0);
          }
        }
      }
    }
  }, [eventId, hazard]);

  const loadForests = async (map: L.Map) => {
    try {
      const forests = await api.getNationalForests();
      const list = Array.isArray(forests) ? forests : (forests?.forests || []);
      forestsDataRef.current = list;

      if (forestsLayerRef.current) map.removeLayer(forestsLayerRef.current);

      const features = list
        .filter((f: any) => f.lat !== undefined && f.lon !== undefined)
        .map((f: any) => ({
          type: "Feature",
          properties: f,
          geometry: {
            type: "Point",
            coordinates: [f.lon, f.lat]
          }
        }));

      forestsLayerRef.current = L.geoJSON({ type: "FeatureCollection", features } as any, {
        pointToLayer: (feature: any, latlng) => {
          const p = feature.properties;
          const nHot = Number(p.n_hotspots || 0);

          // Sistem Level 1-4 Karhutla Berbasis Titik Api Aktif (Selaras Gunung Api)
          let imageSrc = "/hutan_waspada.png"; // Level I: Normal
          let pulseClass = "";

          if (nHot >= 100) {
            imageSrc = "/hutan_sangat_rawan.png"; // Level IV: Awas
            pulseClass = "ring-red";
          } else if (nHot >= 10) {
            imageSrc = "/hutan_rawan.png"; // Level III: Siaga
            pulseClass = "ring-orange";
          } else if (nHot >= 1) {
            imageSrc = "/hutan_rawan.png"; // Level II: Waspada
            pulseClass = "";
          }

          const pulseHtml = pulseClass
            ? `<span class="volcano-pulse-ring ${pulseClass}"></span>`
            : "";

          const icon = L.divIcon({
            className: "forest-div-icon",
            html: `
              <div class="relative w-8 h-8 flex items-center justify-center overflow-visible">
                ${pulseHtml}
                <img src="${imageSrc}" class="w-7 h-7 object-contain drop-shadow-md z-10 relative select-none pointer-events-none hover:scale-110 transition-transform" />
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
          });

          return L.marker(latlng, { icon });
        },
        onEachFeature: (feature: any, layer) => {
          const p = feature.properties;
          const coords = feature.geometry.coordinates;
          const nHot = Number(p.n_hotspots || 0);

          // Status Bahaya Level 1-4 Selaras Gunung Api
          let levelBadge = "Level I (Normal)";
          let statusColor = "#10b981"; // Hijau

          if (nHot >= 100) {
            levelBadge = "Level IV (Awas - Sangat Rawan)";
            statusColor = "#ef4444"; // Merah
          } else if (nHot >= 10) {
            levelBadge = "Level III (Siaga - Rawan)";
            statusColor = "#f97316"; // Oranye
          } else if (nHot >= 1) {
            levelBadge = "Level II (Waspada)";
            statusColor = "#f59e0b"; // Kuning
          }

          const location = [p.province, p.region].filter(Boolean).join(" &bull; ");
          const area = p.area_ha ? `${p.area_ha.toLocaleString("id-ID")} ha` : "";

          layer.bindTooltip(
            `<div style="min-width: 185px; line-height: 1.45;">
              <strong style="font-size: 13px; color: #FFF0C5; display: block; margin-bottom: 2px;">${p.name}</strong>
              <div style="color: #a7f3d0; font-size: 10.5px; margin-bottom: 2px;">
                🌲 ${p.forest_type || 'Kawasan Hutan'}${area ? ` &bull; <strong>${area}</strong>` : ''}
              </div>
              ${location ? `
                <div style="color: #93c5fd; font-size: 10.5px; margin-bottom: 2px;">
                  📍 ${location}
                </div>
              ` : ''}
              <div style="font-size: 11px; margin-bottom: 2px;">
                Status Bahaya (Live): <strong style="color: ${statusColor}">${levelBadge}</strong>
              </div>
              <div style="display: flex; align-items: center; gap: 4px; color: ${nHot > 0 ? '#f87171' : '#a7f3d0'}; font-size: 11px; border-top: 1px solid rgba(235,137,91,0.25); padding-top: 3px; margin-top: 3px;">
                <img src="/titik_api.png" style="width: 14px; height: 14px; object-fit: contain;" />
                <strong>${nHot > 0 ? `${nHot} titik api aktif` : '0 titik api (Bebas Api)'}</strong>&nbsp;<span style="color:#cbd5e1;">(NASA FIRMS, 24 jam)</span>
              </div>
            </div>`,
            { direction: "top", offset: [0, -12] }
          );

          layer.on("click", () => {
            map.flyTo([coords[1], coords[0]], 10, { duration: 1.8, easeLinearity: 0.25 });
            onSelectEvent(p.id, coords[1], coords[0], 10.0);
          });
        }
      });

      if (showForestsRef.current && forestsLayerRef.current) {
        forestsLayerRef.current.addTo(map);
      }
    } catch {
      // Offline fallback
    }
  };


  const loadVolcanoes = async (map: L.Map) => {
    try {
      const geo = await api.getNationalVolcanoes();
      const features = geo.features || [];
      volcanoesDataRef.current = features;

      if (volcanoesLayerRef.current) map.removeLayer(volcanoesLayerRef.current);

      volcanoesLayerRef.current = L.geoJSON({ type: "FeatureCollection", features } as any, {
        pointToLayer: (feature: any, latlng) => {
          const p = feature.properties;
          let imageSrc = "/1_normal.png";
          if (p.level === 2) imageSrc = "/2_waspada.png";
          else if (p.level === 3) imageSrc = "/3_siaga.png";
          else if (p.level === 4) imageSrc = "/4_awas.png";

          const isHighAlert = p.level >= 3;
          const pulseHtml = isHighAlert
            ? `<span class="volcano-pulse-ring ${p.level === 4 ? 'ring-red' : 'ring-orange'}"></span>`
            : "";

          const icon = L.divIcon({
            className: "volcano-div-icon",
            html: `
              <div class="relative w-8 h-8 flex items-center justify-center overflow-visible">
                ${pulseHtml}
                <img src="${imageSrc}" class="w-7 h-7 object-contain drop-shadow-md z-10 relative select-none pointer-events-none" />
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
          });

          return L.marker(latlng, { icon });
        },
        onEachFeature: (feature: any, layer) => {
          const p = feature.properties;
          const coords = feature.geometry.coordinates;
          const levelNum = Number(p.level);
          const levelColor = p.color || (levelNum === 4 ? "#ef4444" : levelNum === 3 ? "#f97316" : levelNum === 2 ? "#eab308" : "#10b981");
          const location = [p.province, p.region].filter(Boolean).join(" &bull; ");
          const elevation = p.elevation_m ? `${p.elevation_m.toLocaleString("id-ID")} mdpl` : "";
          const radius = p.radius_bahaya_km ? `${p.radius_bahaya_km} km` : "";

          const tooltipHtml = `
            <div style="min-width: 175px; line-height: 1.45;">
              <strong style="font-size: 13px; color: #FFF0C5; display: block; margin-bottom: 2px;">${p.name}</strong>
              <div style="color: #93c5fd; font-size: 10.5px; margin-bottom: 2px;">
                📍 ${location || 'Indonesia'}${elevation ? ` &bull; <strong>${elevation}</strong>` : ''}
              </div>
              <div style="font-size: 11px; margin-bottom: 2px;">
                Status Aktivitas: <strong style="color: ${levelColor}">${p.level_name || `Level ${p.level}`}</strong>
              </div>
              ${radius ? `
                <div style="color: #fde047; font-size: 10.5px; margin-bottom: 2px;">
                  ⚠️ Radius bahaya (katalog): <strong>${radius}</strong>
                </div>
              ` : ''}
              <div style="color: #cbd5e1; font-size: 10px; border-top: 1px solid rgba(235,137,91,0.25); padding-top: 3px; margin-top: 3px;">
                ${p.level_source === 'magma'
                  ? `Sumber level: MAGMA (PVMBG)${p.level_updated_at ? `, diperiksa ${new Date(p.level_updated_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} WIB` : ''}`
                  : 'Level belum terverifikasi MAGMA (gunung tidak ada di daftar MAGMA)'}
              </div>
            </div>
          `;

          layer.bindTooltip(tooltipHtml, {
            direction: "top",
            offset: [0, -12]
          });

          layer.on("click", () => {
            map.flyTo([coords[1], coords[0]], 11, { duration: 1.8, easeLinearity: 0.25 });
            highlightKrb(map, coords[1], coords[0], p.radius_bahaya_km, p.name);
            onSelectEvent(p.event_id || p.id, coords[1], coords[0], p.radius_bahaya_km);
          });
        }
      });

      if (showVolcanoesRef.current && volcanoesLayerRef.current) {
        volcanoesLayerRef.current.addTo(map);
      }

      // Tampilkan langsung zona KRB saat layer gunung pertama kali selesai dimuat
      if (hazard === "volcano" && eventId) {
        const activeVolc = features.find(
          (f: any) => (f.properties?.event_id || f.properties?.id || f.id) === eventId
        );
        if (activeVolc && activeVolc.geometry?.coordinates) {
          const c = activeVolc.geometry.coordinates;
          highlightKrb(map, c[1], c[0], activeVolc.properties?.radius_bahaya_km || 5.0, activeVolc.properties?.name);
        }
      }
    } catch {
      // Offline fallback
    }
  };

  const loadFacilities = async (map: L.Map) => {
    try {
      // Bandara: seluruh Indonesia. Sekolah & faskes (OSM): hanya area tampilan saat zoom >= 11.
      const z = map.getZoom();
      const b = map.getBounds();
      const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => v.toFixed(3)).join(",");
      const needLocal = (showSchoolsRef.current || showHospitalsRef.current) && z >= FACILITY_MIN_ZOOM;
      facilitiesBboxRef.current = needLocal ? bbox : null;
      const [airGeo, localGeo] = await Promise.all([
        airportsGeoRef.current ? Promise.resolve(airportsGeoRef.current) : api.getFacilities({ facilityType: "airport" }),
        needLocal ? api.getFacilities({ bbox, zoom: z }) : Promise.resolve({ features: [] })
      ]);
      airportsGeoRef.current = airGeo;
      if (needLocal && facilitiesBboxRef.current !== bbox) return; // sudah ada permintaan yang lebih baru
      const features = [
        ...(airGeo?.features || []),
        ...((localGeo?.features || []).filter((f: any) => f.properties.facility_type !== "airport"))
      ];

      if (schoolsLayerRef.current) map.removeLayer(schoolsLayerRef.current);
      if (hospitalsLayerRef.current) map.removeLayer(hospitalsLayerRef.current);
      if (airportsLayerRef.current) map.removeLayer(airportsLayerRef.current);

      const schools = features.filter((f: any) => f.properties.facility_type === "school");
      const hospitals = features.filter((f: any) => f.properties.facility_type === "healthcare" || f.properties.facility_type === "hospital");
      const airports = features.filter((f: any) => f.properties.facility_type === "airport");

      schoolsLayerRef.current = L.geoJSON({ type: "FeatureCollection", features: schools } as any, {
        pointToLayer: (_feature: any, latlng) => {
          const icon = L.divIcon({
            className: "fac-icon-school",
            html: `
              <div class="cursor-pointer hover:scale-125 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                <img src="/school.png" class="w-5 h-5 object-contain pointer-events-none" />
              </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          return L.marker(latlng, { icon });
        },
        onEachFeature: (feature: any, layer) => {
          const p = feature.properties;
          layer.bindTooltip(
            `<div style="min-width: 130px; line-height: 1.4;">
              <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 2px;">
                <img src="/school.png" style="width: 14px; height: 14px; object-fit: contain;" />
                <strong style="color: #FFF0C5; font-size: 11.5px;">${p.name || 'Sekolah'}</strong>
              </div>
              <div style="color: #93c5fd; font-size: 10px;">🏫 ${p.district || 'Fasilitas Pendidikan'}</div>
            </div>`,
            { direction: "top", offset: [0, -12] }
          );
          layer.bindPopup(`<div class="text-xs p-1 font-bold text-slate-800">${p.name || 'Sekolah'}</div>`);
          layer.on("click", () => {
            onSelectFacility?.(p.facility_id || p.id || p.name);
          });
        }
      });

      hospitalsLayerRef.current = L.geoJSON({ type: "FeatureCollection", features: hospitals } as any, {
        pointToLayer: (_feature: any, latlng) => {
          const icon = L.divIcon({
            className: "fac-icon-hospital",
            html: `
              <div class="cursor-pointer hover:scale-125 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                <img src="/hospital.png" class="w-5 h-5 object-contain pointer-events-none" />
              </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          return L.marker(latlng, { icon });
        },
        onEachFeature: (feature: any, layer) => {
          const p = feature.properties;
          layer.bindTooltip(
            `<div style="min-width: 130px; line-height: 1.4;">
              <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 2px;">
                <img src="/hospital.png" style="width: 14px; height: 14px; object-fit: contain;" />
                <strong style="color: #FFF0C5; font-size: 11.5px;">${p.name || 'Fasilitas Kesehatan'}</strong>
              </div>
              <div style="color: #a7f3d0; font-size: 10px;">🏥 ${p.district || 'Pusat Medis / RS'}</div>
            </div>`,
            { direction: "top", offset: [0, -12] }
          );
          layer.bindPopup(`<div class="text-xs p-1 font-bold text-slate-800">${p.name || 'Fasilitas Kesehatan'}</div>`);
          layer.on("click", () => {
            onSelectFacility?.(p.facility_id || p.id || p.name);
          });
        }
      });

      airportsLayerRef.current = L.geoJSON({ type: "FeatureCollection", features: airports } as any, {
        pointToLayer: (_feature: any, latlng) => {
          const icon = L.divIcon({
            className: "fac-icon-airport",
            html: `<img src="/plane.png" class="w-5 h-5 object-contain drop-shadow-sm" />`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          return L.marker(latlng, { icon });
        },
        onEachFeature: (feature: any, layer) => {
          const p = feature.properties;
          layer.bindPopup(`<div class="text-xs p-1 font-bold text-slate-800">${p.name || 'Bandara'}</div>`);
          layer.on("click", () => {
            onSelectFacility?.(p.facility_id || p.id || p.name);
          });
        }
      });

      if (showSchoolsRef.current && schoolsLayerRef.current) schoolsLayerRef.current.addTo(map);
      if (showHospitalsRef.current && hospitalsLayerRef.current) hospitalsLayerRef.current.addTo(map);
      if (showAirportsRef.current && airportsLayerRef.current) airportsLayerRef.current.addTo(map);
    } catch {
      // Offline fallback
    }
  };

  const highlightKrb = (map: L.Map, lat: number, lng: number, radiusKm: number, volcanoName?: string) => {
    if (krbCircleRef.current) map.removeLayer(krbCircleRef.current);

    const radKm = radiusKm || 5.0;
    krbCircleRef.current = L.circle([lat, lng], {
      radius: radKm * 1000,
      color: "#DA6556",
      weight: 1.5,
      dashArray: "4, 4",
      fillColor: "#DA6556",
      fillOpacity: 0.12,
      interactive: true
    }).addTo(map);

    krbCircleRef.current.bindTooltip(
      `<div class="text-xs font-mono">
        <strong>KRB PVMBG: ${volcanoName || "Gunung Api"}</strong><br/>
        Radius Bahaya: ${radKm} km
      </div>`,
      { sticky: true }
    );
  };

  // Fungsi penyorotan kontur putih tegas saat zona plume diklik (Sesuai Efek Visual Acuan)
  const applyPlumeHighlight = useCallback((tierKey: string | null) => {
    if (!plumeLayerRef.current) return;

    const sub = { max: [] as any[], mid: [] as any[], min: [] as any[] };
    plumeLayerRef.current.eachLayer((l: any) => {
      if (!l.feature?.properties) return;
      const t = l.feature.properties.tier;
      if (t === "minimum" || t === "min" || t === "p90") sub.min.push(l);
      else if (t === "mid" || t === "p50") sub.mid.push(l);
      else sub.max.push(l);
    });

    const isFire = hazard === "fire";
    const palette = isFire
      ? {
          min: { fill: "#78350f", stroke: "#451a03", fillOpacity: 0.60, strokeOpacity: 1.0, weight: 2.5, dash: undefined },
          mid: { fill: "#92400e", stroke: "#78350f", fillOpacity: 0.35, strokeOpacity: 0.85, weight: 1.8, dash: "6, 4" },
          max: { fill: "#a16207", stroke: "#854d0e", fillOpacity: 0.15, strokeOpacity: 0.70, weight: 1.0, dash: "3, 3" }
        }
      : {
          min: { fill: "#991b1b", stroke: "#7f1d1d", fillOpacity: 0.60, strokeOpacity: 1.0, weight: 2.5, dash: undefined },
          mid: { fill: "#dc2626", stroke: "#b91c1c", fillOpacity: 0.35, strokeOpacity: 0.85, weight: 1.8, dash: "6, 4" },
          max: { fill: "#f59e0b", stroke: "#d97706", fillOpacity: 0.18, strokeOpacity: 0.70, weight: 1.0, dash: "3, 3" }
        };

    const setLayerStyle = (l: any, style: any, isWhiteContour = false) => {
      l.setStyle({
        color: isWhiteContour ? "#ffffff" : (style.color || style.stroke),
        weight: isWhiteContour ? (style.weight || 3.2) : style.weight,
        opacity: isWhiteContour ? 1 : (style.opacity ?? style.strokeOpacity ?? 0.85),
        fillColor: style.fillColor || style.fill,
        fillOpacity: style.fillOpacity,
        dashArray: isWhiteContour ? "" : (style.dashArray || style.dash || "")
      });
      if (l._path) {
        if (isWhiteContour) {
          l._path.classList.add("plume-selected-contour");
          l._path.setAttribute("stroke", "#ffffff");
          l._path.setAttribute("stroke-width", String(style.weight || 3.2));
          l._path.setAttribute("stroke-opacity", "1");
          l._path.removeAttribute("stroke-dasharray");
        } else {
          l._path.classList.remove("plume-selected-contour");
          l._path.setAttribute("stroke", style.color || style.stroke);
          l._path.setAttribute("stroke-width", String(style.weight));
          l._path.setAttribute("stroke-opacity", String(style.opacity ?? style.strokeOpacity ?? 0.85));
          if (style.dashArray || style.dash) {
            l._path.setAttribute("stroke-dasharray", style.dashArray || style.dash);
          } else {
            l._path.removeAttribute("stroke-dasharray");
          }
        }
      }
    };

    if (!tierKey || tierKey === "all") {
      sub.min.forEach((l) => setLayerStyle(l, palette.min, false));
      sub.mid.forEach((l) => setLayerStyle(l, palette.mid, false));
      sub.max.forEach((l) => setLayerStyle(l, palette.max, false));
      return;
    }

    const norm = tierKey === "min" ? "minimum" : tierKey === "max" ? "maximum" : tierKey;

    if (norm === "minimum") {
      sub.min.forEach((l) =>
        setLayerStyle(
          l,
          { color: "#ffffff", stroke: "#ffffff", weight: 3.2, opacity: 1, fillColor: palette.min.fill, fillOpacity: 0.70 },
          true
        )
      );
      sub.mid.forEach((l) =>
        setLayerStyle(
          l,
          { color: palette.mid.stroke, weight: 1.0, opacity: 0.25, dash: "6, 4", fillColor: palette.mid.fill, fillOpacity: 0.08 },
          false
        )
      );
      sub.max.forEach((l) =>
        setLayerStyle(
          l,
          { color: palette.max.stroke, weight: 1.0, opacity: 0.20, dash: "3, 3", fillColor: palette.max.fill, fillOpacity: 0.04 },
          false
        )
      );
    } else if (norm === "mid") {
      sub.mid.forEach((l) =>
        setLayerStyle(
          l,
          { color: "#ffffff", stroke: "#ffffff", weight: 3.2, opacity: 1, fillColor: palette.mid.fill, fillOpacity: 0.48 },
          true
        )
      );
      sub.min.forEach((l) =>
        setLayerStyle(
          l,
          { color: "#ffffff", stroke: "#ffffff", weight: 3.0, opacity: 1, fillColor: palette.min.fill, fillOpacity: 0.18 },
          true
        )
      );
      sub.max.forEach((l) =>
        setLayerStyle(
          l,
          { color: palette.max.stroke, weight: 1.0, opacity: 0.25, dash: "3, 3", fillColor: palette.max.fill, fillOpacity: 0.05 },
          false
        )
      );
    } else if (norm === "maximum") {
      sub.max.forEach((l) =>
        setLayerStyle(
          l,
          { color: "#ffffff", stroke: "#ffffff", weight: 3.2, opacity: 1, fillColor: palette.max.fill, fillOpacity: 0.28 },
          true
        )
      );
      sub.mid.forEach((l) =>
        setLayerStyle(
          l,
          { color: "#ffffff", stroke: "#ffffff", weight: 3.0, opacity: 1, fillColor: palette.mid.fill, fillOpacity: 0.08 },
          true
        )
      );
      sub.min.forEach((l) =>
        setLayerStyle(
          l,
          { color: palette.min.stroke, weight: 1.2, opacity: 0.25, fillColor: palette.min.fill, fillOpacity: 0.10 },
          false
        )
      );
    }
  }, [hazard]);

  // Sinkronkan penyorotan kontur saat selectedPlumeTier berubah (dari chip laci atau klik peta)
  useEffect(() => {
    applyPlumeHighlight(selectedPlumeTier || null);
  }, [selectedPlumeTier, applyPlumeHighlight]);

  // Klik di kanvas peta luar poligon me-reset kontur seleksi
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const handleCanvasClick = () => {
      applyPlumeHighlight(null);
      onSelectPlumeTier?.("all");
    };
    map.on("click", handleCanvasClick);
    return () => {
      map.off("click", handleCanvasClick);
    };
  }, [applyPlumeHighlight, onSelectPlumeTier]);

  // Render Poligon Plume saat jam berubah atau cache diperbarui (Mulus tanpa kedap-kedip)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Jika layer plume dimatikan oleh user di panel lapisan spasial
    if (!showPlume) {
      if (plumeLayerRef.current) {
        map.removeLayer(plumeLayerRef.current);
        plumeLayerRef.current = null;
      }
      return;
    }

    if (!hourlyTiersCache) return;

    const hourKey = `hour_${currentHour}`;
    const geoData =
      hourlyTiersCache[hourKey] ||
      hourlyTiersCache[currentHour] ||
      hourlyTiersCache[String(currentHour)] ||
      (hourlyTiersCache.features ? hourlyTiersCache : null);

    // KUNCI ANTI-KEDIP 1: Jika data frame jam ini belum ada di cache, JANGAN hapus layer lama!
    // Membiarkan layer sebelumnya tetap aktif mencegah layar kosong / kedip putih selama transisi.
    if (!geoData || !geoData.features) return;

    // Jika memang frame kosong (misal t=0 tidak ada partikel), bersihkan dengan aman
    if (geoData.features.length === 0) {
      if (plumeLayerRef.current) {
        map.removeLayer(plumeLayerRef.current);
        plumeLayerRef.current = null;
      }
      return;
    }

    const colors = hazard === "fire"
      ? {
          p90: { fill: "#78350f", stroke: "#451a03", fillOpacity: 0.60, weight: 2.5, dash: undefined },
          p50: { fill: "#92400e", stroke: "#78350f", fillOpacity: 0.35, weight: 1.8, dash: "6, 4" },
          p05: { fill: "#a16207", stroke: "#854d0e", fillOpacity: 0.15, weight: 1.0, dash: "3, 3" },
          label: "Sebaran Asap Karhutla (PM2.5)"
        }
      : {
          p90: { fill: "#991b1b", stroke: "#7f1d1d", fillOpacity: 0.60, weight: 2.5, dash: undefined },
          p50: { fill: "#dc2626", stroke: "#b91c1c", fillOpacity: 0.35, weight: 1.8, dash: "6, 4" },
          p05: { fill: "#f59e0b", stroke: "#d97706", fillOpacity: 0.18, weight: 1.0, dash: "3, 3" },
          label: "Sebaran Abu Vulkanik"
        };

    // KUNCI ANTI-KEDIP 2: Buat layer baru terlebih dahulu memakai SVG renderer berkualitas tinggi
    const newPlumeLayer = L.geoJSON(geoData, {
      style: (feature: any) => {
        const tier = feature.properties?.tier;
        let c;
        if (tier === "minimum" || tier === "p90" || tier === "min") {
          c = colors.p90;
        } else if (tier === "mid" || tier === "p50") {
          c = colors.p50;
        } else {
          c = colors.p05;
        }
        return {
          color: c.stroke,
          weight: c.weight,
          opacity: 0.9,
          fillColor: c.fill,
          fillOpacity: c.fillOpacity,
          dashArray: c.dash,
          className: "plume-polygon-tier"
        };
      },
      onEachFeature: (feature: any, layer: any) => {
        const p = feature.properties;
        const tierName =
          p.tier_label ||
          (p.tier === "minimum" || p.tier === "p90" || p.tier === "min"
            ? "Peluang ≥ 90% (inti)"
            : p.tier === "mid" || p.tier === "p50"
            ? "Peluang ≥ 50%"
            : "Peluang ≥ 5% (terjauh)");
        layer.bindTooltip(`<strong>${colors.label}</strong><br>Tingkat: ${tierName}<br>Waktu: ${formatHour(currentHour)}<br><small style="color:#7dd3fc">Klik untuk melihat detail &amp; batas zona</small>`, {
          sticky: true
        });
        layer.on("click", (e: any) => {
          if (e && L.DomEvent && typeof L.DomEvent.stopPropagation === "function") {
            L.DomEvent.stopPropagation(e);
          }
          const t = p.tier === "min" ? "minimum" : p.tier === "max" ? "maximum" : (p.tier || "minimum");
          applyPlumeHighlight(t);
          onSelectPlumeTier?.(t);
        });
      }
    });

    // Tambahkan layer baru ke peta
    newPlumeLayer.addTo(map);

    // KUNCI ANTI-KEDIP 3 (Double Buffering): Hapus layer lama SETELAH layer baru sudah menempel di peta
    const prevLayer = plumeLayerRef.current;
    plumeLayerRef.current = newPlumeLayer;
    if (prevLayer) {
      map.removeLayer(prevLayer);
    }

    // Terapkan highlight aktif jika ada zona terpilih
    if (selectedPlumeTier && selectedPlumeTier !== "all") {
      applyPlumeHighlight(selectedPlumeTier);
    }
  }, [currentHour, hourlyTiersCache, hazard, showPlume, applyPlumeHighlight, onSelectPlumeTier, selectedPlumeTier]);

  // Gambar Rute Evakuasi & Tampilkan Pin Titik Awal (Sekolah) serta Tujuan (RS)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (evacRouteLineRef.current) {
      map.removeLayer(evacRouteLineRef.current);
      evacRouteLineRef.current = null;
    }
    if (routeStartMarkerRef.current) {
      map.removeLayer(routeStartMarkerRef.current);
      routeStartMarkerRef.current = null;
    }
    if (routeEndMarkerRef.current) {
      map.removeLayer(routeEndMarkerRef.current);
      routeEndMarkerRef.current = null;
    }

    if (evacuationRoute && evacuationRoute.geometry.length > 0) {
      evacRouteLineRef.current = L.polyline(evacuationRoute.geometry, {
        color: "#8AD6D1",
        weight: 4,
        opacity: 0.95
      }).addTo(map);

      let tooltipContent = `<strong>Rute Evakuasi:</strong> ${evacuationRoute.label}`;
      if (evacuationRoute.distanceKm && evacuationRoute.durationMin) {
        tooltipContent += `<br/>Jarak: ${evacuationRoute.distanceKm} km (Est. ${evacuationRoute.durationMin} mnt)`;
      }

      evacRouteLineRef.current.bindTooltip(tooltipContent, { permanent: true, direction: "top", sticky: true });

      // 1. Pin Titik Awal: Sekolah yang Terancam
      const startCoord = evacuationRoute.geometry[0];
      const startIcon = L.divIcon({
        className: "route-start-pin",
        html: `
          <div class="cursor-pointer hover:scale-110 transition-transform drop-shadow-[0_3px_6px_rgba(0,0,0,0.7)]">
            <img src="/school.png" class="w-7 h-7 object-contain pointer-events-none" />
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      routeStartMarkerRef.current = L.marker(startCoord, { icon: startIcon, zIndexOffset: 2500 })
        .addTo(map)
        .bindTooltip(`<strong>Titik Evakuasi (Sekolah):</strong><br/>${evacuationRoute.originName || 'Sekolah'}`, {
          permanent: false,
          direction: "top",
          offset: [0, -14]
        });

      // 2. Pin Titik Tujuan: Fasilitas Kesehatan Aman / RS Rujukan
      const endCoord = evacuationRoute.geometry[evacuationRoute.geometry.length - 1];
      const endIcon = L.divIcon({
        className: "route-end-pin",
        html: `
          <div class="cursor-pointer hover:scale-110 transition-transform drop-shadow-[0_3px_6px_rgba(0,0,0,0.7)]">
            <img src="/hospital.png" class="w-7 h-7 object-contain pointer-events-none" />
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      routeEndMarkerRef.current = L.marker(endCoord, { icon: endIcon, zIndexOffset: 2500 })
        .addTo(map)
        .bindTooltip(`<strong>Tujuan Aman (Fasilitas Kesehatan):</strong><br/>${evacuationRoute.destName || 'Rumah Sakit'}`, {
          permanent: false,
          direction: "top",
          offset: [0, -16]
        });

      map.fitBounds(evacRouteLineRef.current.getBounds(), { padding: [60, 60], maxZoom: 13 });
    }
  }, [evacuationRoute]);

  return (
    <div className="relative w-full h-full isolate z-0">
      {/* Container Leaflet Map Utama (Stacking Context terisolasi agar overlay peta tidak tembus kartu UI) */}
      <div ref={mapContainerRef} className="w-full h-full bg-[#140f0e] relative z-0" />


      {/* KONTROL NAVIGASI KIRI BAWAH KHAS FE-FORGEHACK (Basemap Switcher, Suite Control Dock [User|Locate|Layers] + [-|+], dan CameraReadout) */}
      <div className="absolute bottom-32 lg:bottom-6 left-2 md:left-4 flex flex-col items-start gap-2 z-[500] transition-all duration-300 ease-out select-none">
        {/* Switch Gaya Peta: [ 🗺️ Exposure | 🛰️ Satellite ] */}
        <div
          className="flex rounded-full p-1 backdrop-blur-xl border shadow-2xl gap-1"
          style={{
            background: "rgba(245, 239, 227, 0.95)",
            borderColor: "rgba(235, 137, 91, 0.4)",
            boxShadow: "0 8px 20px -3px rgba(0,0,0,0.15)"
          }}
          role="group"
          aria-label="Gaya peta"
        >
          <button
            type="button"
            aria-pressed={mapStyle === "exposure"}
            title="Tampilan Kertas Taktis"
            onClick={() => setMapStyle("exposure")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              mapStyle === "exposure"
                ? "bg-[#EB895B] text-white shadow-md"
                : "text-[#140f0e]/75 hover:text-[#140f0e] hover:bg-black/5"
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Kertas Taktis</span>
          </button>

          <button
            type="button"
            aria-pressed={mapStyle === "satellite"}
            title="Citra Satelit Esri"
            onClick={() => setMapStyle("satellite")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              mapStyle === "satellite"
                ? "bg-[#EB895B] text-white shadow-md"
                : "text-[#140f0e]/75 hover:text-[#140f0e] hover:bg-black/5"
            }`}
          >
            <Satellite className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Satelit</span>
          </button>
        </div>

        {/* 3. Suite Control Dock: [ 👤 (GPS) | 🎯 (Pusatkan Indonesia) | 📑 (Lapisan) ] dan [ - | + ] */}
        <div className="flex items-center gap-2">
          {/* Dock tombol kontrol kiri: Lokasi Anda (GPS), Pusatkan ke Seluruh Indonesia, dan Lapisan Spasial */}
          <div
            className="flex items-center gap-1.5 p-1 rounded-full backdrop-blur-xl shadow-2xl border"
            style={{
              background: "rgba(245, 239, 227, 0.95)",
              borderColor: "rgba(235, 137, 91, 0.4)",
              boxShadow: "0 8px 20px -3px rgba(0,0,0,0.15)"
            }}
          >
            {/* 👤 Lokasi Anda (GPS) */}
            <button
              type="button"
              onClick={handleShowMyLocation}
              disabled={isLocating}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 shadow-md ${
                isLocating
                  ? "bg-[#EB895B] text-white animate-pulse border border-[#EB895B]"
                  : "bg-[#EB895B]/15 hover:bg-[#EB895B]/25 text-[#A14646] border border-[#EB895B]/40"
              }`}
              title="Tampilkan Lokasi Anda (GPS)"
            >
              <User className="w-4 h-4" />
            </button>

            {/* 🎯 Pusatkan Peta ke Seluruh Wilayah Indonesia */}
            <button
              type="button"
              onClick={handleResetIndonesia}
              className="w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 bg-black/5 hover:bg-black/10 text-[#140f0e] border border-black/10 shadow-xs"
              title="Pusatkan Peta ke Seluruh Indonesia"
            >
              <LocateFixed className="w-4 h-4" />
            </button>

            {/* 📑 Tombol Popover Lapisan Spasial */}
            <button
              type="button"
              onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 shadow-md border ${
                isLayerPanelOpen
                  ? "bg-[#EB895B] text-white border-[#EB895B]"
                  : "bg-black/5 hover:bg-black/10 text-[#140f0e] border-black/10"
              }`}
              title="Pengaturan Lapisan Spasial"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>

          {/* Dock tombol Zoom: Minus (kiri) & Plus (kanan) */}
          <div
            className="flex items-center rounded-full overflow-hidden shadow-2xl backdrop-blur-xl border"
            style={{
              background: "rgba(245, 239, 227, 0.95)",
              borderColor: "rgba(235, 137, 91, 0.4)",
              boxShadow: "0 8px 20px -3px rgba(0,0,0,0.15)"
            }}
          >
            <button
              type="button"
              onClick={() => mapRef.current?.zoomOut()}
              className="w-8 h-9 flex items-center justify-center transition cursor-pointer active:scale-95 hover:bg-black/5 text-[#140f0e] border-r border-black/10"
              title="Perkecil Peta (Zoom Out)"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.zoomIn()}
              className="w-8 h-9 flex items-center justify-center transition cursor-pointer active:scale-95 hover:bg-black/5 text-[#140f0e]"
              title="Perbesar Peta (Zoom In)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4. Live Camera Coordinates Readout */}
        <CameraReadout map={mapRef.current} lang="id" />

        {/* Popover Lapisan Spasial */}
        {isLayerPanelOpen && (
          <div
            className="absolute bottom-full mb-3 left-0 rounded-2xl p-3.5 shadow-2xl flex flex-col gap-2.5 backdrop-blur-xl text-[#140f0e] border animate-in fade-in zoom-in-95 duration-200 min-w-[220px]"
            style={{
              background: "rgba(245, 239, 227, 0.96)",
              borderColor: "rgba(235, 137, 91, 0.4)"
            }}
          >
            <div className="flex items-center justify-between border-b pb-1.5 mb-0.5" style={{ borderColor: "rgba(0, 0, 0, 0.1)" }}>
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#EB895B" }}>
                Lapisan Spasial
              </span>
              <button
                type="button"
                onClick={() => setIsLayerPanelOpen(false)}
                className="text-[#EB895B] hover:text-slate-800 transition cursor-pointer opacity-80 hover:opacity-100"
                title="Tutup Panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer hover:opacity-80 transition select-none">
              <input type="checkbox" checked={showVolcanoes} onChange={(e) => setShowVolcanoes(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
              <img src="/1_normal.png" className="w-4 h-4 object-contain" />
              <span>Gunungapi PVMBG</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer hover:opacity-80 transition select-none">
              <input type="checkbox" checked={showForests} onChange={(e) => setShowForests(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
              <img src="/hutan.png" className="w-4 h-4 object-contain" />
              <span>Kawasan Hutan &amp; Gambut</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer hover:opacity-80 transition select-none">
              <input type="checkbox" checked={showHotspots} onChange={(e) => setShowHotspots(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
              <img src="/titik_api.png" className="w-4 h-4 object-contain" />
              <span>Titik Api Satelit</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer hover:opacity-80 transition select-none">
              <input type="checkbox" checked={showPlume} onChange={(e) => setShowPlume(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
              <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(253, 183, 115, 0.3)", border: "1px dashed #FDB773" }}></div>
              <span>Peluang Dispersi</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer hover:opacity-80 transition select-none">
              <input type="checkbox" checked={showSchools} onChange={(e) => setShowSchools(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
              <img src="/school.png" className="w-4 h-4 object-contain" />
              <span>Fasilitas Sekolah</span>
            </label>
            {(showSchools || showHospitals) && (mapRef.current?.getZoom() ?? 0) < FACILITY_MIN_ZOOM && (
              <span className="text-[10px] text-[#A14646] -mt-1 pl-6">Perbesar peta (zoom ≥ {FACILITY_MIN_ZOOM}) untuk memuat sekolah/faskes OSM.</span>
            )}

            <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer hover:opacity-80 transition select-none">
              <input type="checkbox" checked={showHospitals} onChange={(e) => setShowHospitals(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
              <img src="/hospital.png" className="w-4 h-4 object-contain" />
              <span>Fasilitas Kesehatan</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer hover:opacity-80 transition select-none">
              <input type="checkbox" checked={showAirports} onChange={(e) => setShowAirports(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
              <img src="/plane.png" className="w-4 h-4 object-contain" />
              <span>Bandara Udara</span>
            </label>
          </div>
        )}
      </div>

      {/* Mode Peta Nasional (Histori Heatmap, Real-time Wind Streamlines, 16-Day Forecast & Smoke Paths) */}
      <div
        className={`absolute top-16 right-2 lg:top-auto lg:bottom-6 ${_isDrawerOpen ? "lg:right-[396px]" : "lg:right-4"} z-[500] transition-all duration-300`}
      >
        <NationalModes
          map={mapRef.current}
          lang="id"
          windInfo={currentWindInfo}
          currentHour={currentHour}
        />
      </div>

    </div>
  );
};
