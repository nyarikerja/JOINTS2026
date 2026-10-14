import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Plus, Minus, Stack, X, Crosshair, User } from "@phosphor-icons/react";
import { Map as MapIcon, Satellite } from "lucide-react";
import { CONFIG } from "../../config/constants";
import { api } from "../../services/api";
import { reportBoot, trackTileLayer } from "../../utils/bootProgress";
import { formatHour } from "../../utils/formatters";
import { NationalModes } from "./NationalModes";
import { CameraReadout } from "./MapReadouts";
import { HeatLeafletLayer } from "../../simulation/heatLayer";
import type { HazardType } from "../../types/api";

// Algoritma Ray-Casting untuk deteksi titik di dalam poligon
function isPointInRing(point: [number, number], ring: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInGeoJsonGeometry(lng: number, lat: number, geometry: any): boolean {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return isPointInRing([lng, lat], geometry.coordinates[0]);
  }
  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      if (isPointInRing([lng, lat], polygon[0])) return true;
    }
  }
  return false;
}

interface MapWorkspaceProps {
  hazard: HazardType;
  eventId: string;
  currentHour: number;
  hourlyTiersCache: Record<string | number, any> | null;
  evacuationRoute: { geometry: [number, number][]; label: string; distanceKm?: number; durationMin?: number } | null;
  onSelectEvent: (eventId: string, lat: number, lng: number, radiusKm: number, hazardType?: HazardType) => void;
  resetViewTrigger: number;
  flyToTarget?: { lat: number; lng: number; _t: number } | null;
  activeRunId?: string | null;
  isDrawerOpen?: boolean;
  onToggleLegend?: () => void;
  onLayersLoaded?: () => void;
  focusEventTrigger?: number;
  showSchools?: boolean;
  onToggleSchools?: (val: boolean) => void;
  showHospitals?: boolean;
  onToggleHospitals?: (val: boolean) => void;
  showAirports?: boolean;
  onToggleAirports?: (val: boolean) => void;
  runHotspots?: any[];
  impactedFacilities?: any;
}

export const MapWorkspace: React.FC<MapWorkspaceProps> = ({
  hazard,
  eventId,
  currentHour,
  hourlyTiersCache,
  evacuationRoute,
  onSelectEvent,
  resetViewTrigger,
  flyToTarget,
  activeRunId,
  isDrawerOpen: _isDrawerOpen = false,
  onToggleLegend: _onToggleLegend,
  onLayersLoaded,
  focusEventTrigger = 0,
  showSchools: controlledShowSchools,
  onToggleSchools,
  showHospitals: controlledShowHospitals,
  onToggleHospitals,
  showAirports: controlledShowAirports,
  onToggleAirports,
  runHotspots,
  impactedFacilities
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const hazardRef = useRef<HazardType>(hazard);
  hazardRef.current = hazard;
  const eventIdRef = useRef<string>(eventId);
  eventIdRef.current = eventId;

  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsTileLayerRef = useRef<L.TileLayer | null>(null);

  const [showVolcanoes, setShowVolcanoes] = useState(true);
  const [showForests, setShowForests] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showPlume, setShowPlume] = useState(true);

  const [internalShowSchools, setInternalShowSchools] = useState(false);
  const [internalShowHospitals, setInternalShowHospitals] = useState(false);
  const [internalShowAirports, setInternalShowAirports] = useState(false);

  const showSchools = controlledShowSchools !== undefined ? controlledShowSchools : internalShowSchools;
  const setShowSchools = onToggleSchools || setInternalShowSchools;

  const showHospitals = controlledShowHospitals !== undefined ? controlledShowHospitals : internalShowHospitals;
  const setShowHospitals = onToggleHospitals || setInternalShowHospitals;

  const showAirports = controlledShowAirports !== undefined ? controlledShowAirports : internalShowAirports;
  const setShowAirports = onToggleAirports || setInternalShowAirports;

  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);

  const volcanoesLayerRef = useRef<L.GeoJSON | null>(null);
  const forestsLayerRef = useRef<L.GeoJSON | null>(null);
  const hotspotsLayerRef = useRef<L.GeoJSON | null>(null);
  const hotspotsHeatmapRef = useRef<HeatLeafletLayer | null>(null);
  const heatmapDataRef = useRef<{ cells: any[]; maxFrp: number; cellDeg: number } | null>(null);
  const hotspotsBboxRef = useRef<string | null>(null);
  const loadHotspotsRef = useRef<((map: L.Map, targetEventId?: string) => void) | null>(null);
  const selectedForestHotspotsLayerRef = useRef<L.GeoJSON | null>(null);
  const rawHotspotsRef = useRef<any[]>([]);
  const showHotspotsRef = useRef<boolean>(showHotspots);
  showHotspotsRef.current = showHotspots;
  const updateHotspotsViewportRef = useRef<(map: L.Map) => void>(() => {});
  const focusEventRef = useRef<(map: L.Map, id: string, h: HazardType) => void>(() => {});
  const schoolsLayerRef = useRef<L.GeoJSON | null>(null);
  const hospitalsLayerRef = useRef<L.GeoJSON | null>(null);
  const airportsLayerRef = useRef<L.GeoJSON | null>(null);
  const impactedFacilitiesLayerRef = useRef<L.GeoJSON | null>(null);
  const focusedHospitalMarkerRef = useRef<L.Marker | null>(null);
  const evacHospitalMarkerRef = useRef<L.Marker | null>(null);
  const plumeLayerRef = useRef<L.GeoJSON | null>(null);
  const krbCircleRef = useRef<L.Circle | null>(null);
  const forestBoundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const forestBoundariesRef = useRef<any[]>([]);
  const evacRouteLineRef = useRef<L.Polyline | null>(null);
  const volcanoesDataRef = useRef<any[]>([]);
  const forestsDataRef = useRef<any[]>([]);
  const rawFacilitiesRef = useRef<{ schools: any[]; hospitals: any[]; airports: any[] }>({
    schools: [],
    hospitals: [],
    airports: []
  });
  const currentPlumeGeoRef = useRef<any>(null);
  const plumeTooltipRef = useRef<L.Tooltip | null>(null);

  const [mapStyle, setMapStyle] = useState<"exposure" | "satellite">("satellite");
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);

  const showSchoolsRef = useRef<boolean>(showSchools);
  showSchoolsRef.current = showSchools;
  const showHospitalsRef = useRef<boolean>(showHospitals);
  showHospitalsRef.current = showHospitals;
  const showAirportsRef = useRef<boolean>(showAirports);
  showAirportsRef.current = showAirports;

  const loadFacilitiesRef = useRef<((map: L.Map) => void) | null>(null);
  const airportsGeoRef = useRef<any>(null);

  const applyBasemap = (map: L.Map, type: "exposure" | "satellite") => {
    if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current);
    if (labelsTileLayerRef.current) map.removeLayer(labelsTileLayerRef.current);
    labelsTileLayerRef.current = null;
    map.getContainer().classList.toggle("map-paper", type === "exposure");

    if (type === "exposure") {
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
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    applyBasemap(mapRef.current, mapStyle);
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
            <div class="relative w-8 h-8 flex items-center justify-center">
              <span class="absolute w-8 h-8 rounded-full bg-emerald-400/40 animate-ping"></span>
              <span class="relative w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-lg"></span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        userLocationMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon, zIndexOffset: 3000 })
          .addTo(mapRef.current)
          .bindTooltip(
            `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.45; text-align: left;">
              <strong style="color: #16241b; font-size: 12.5px; font-weight: 800;">📍 Lokasi Anda (GPS)</strong>
            </div>`,
            { direction: "top", offset: [0, -16], className: "tactical-tooltip-f7faf4" }
          )
          .bindPopup(`
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.45; text-align: left; padding: 2px;">
              <strong style="color: #16241b; font-size: 13px; font-weight: 800;">Lokasi Anda</strong><br/>
              <span style="font-size: 11px; color: #475569;">Koordinat terdeteksi dari GPS perangkat.</span>
            </div>
          `)
          .openPopup();
      },
      () => {
        setIsLocating(false);
        alert("Gagal membaca koordinat GPS perangkat. Pastikan izin lokasi aktif.");
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
    if (!showHotspotsRef.current) {
      if (hotspotsLayerRef.current) {
        map.removeLayer(hotspotsLayerRef.current);
        hotspotsLayerRef.current = null;
      }
      if (hotspotsHeatmapRef.current) {
        hotspotsHeatmapRef.current.setVisible(false);
      }
      return;
    }

    const zoom = map.getZoom();

    // LOD SWITCHER:
    // Zoom < 9: Mode Heatmap (Peta Panas Kepadatan Radiasi Termal Nasional)
    // Zoom >= 9: Mode Titik Api Individual (Ikon titik_api.png dengan Tooltip Telemetri Lengkap)
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
              html: `<img src="/titik_api.png" class="w-5 h-5 object-contain pointer-events-auto hover:scale-125 transition-transform" />`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            return L.marker(latlng, { icon });
          },
          onEachFeature: (feature: any, layer) => {
            const p = feature.properties;
            layer.bindTooltip(
              `<div style="min-width: 170px; line-height: 1.45; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2px;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                  <img src="/titik_api.png" style="width: 16px; height: 16px; object-fit: contain;" />
                  <strong style="color: #16241b; font-size: 12px; font-weight: 800;">Titik Api ${p.sensor || "NASA FIRMS"}</strong>
                </div>
                <div style="color: #c2410c; font-size: 11px; margin-bottom: 2px; font-weight: 700;">
                  Radiasi Energi (FRP): <strong style="color: #9a3412;">${p.frp ? `${p.frp} MW` : '-'}</strong>
                </div>
                ${p.confidence ? `
                  <div style="color: #475569; font-size: 10.5px;">
                    Keyakinan Deteksi: <strong style="color: #1e293b;">${p.confidence}</strong>
                  </div>
                ` : ''}
                ${p.acq_date ? `
                  <div style="color: #64748b; font-size: 9.5px; margin-top: 3px; border-top: 1px solid rgba(0,0,0,0.08); padding-top: 3px;">
                    Terdeteksi: ${p.acq_datetime_utc ? new Date(p.acq_datetime_utc).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " WIB" : `${p.acq_date} ${p.acq_time || ""} UTC`}
                  </div>
                ` : ''}
              </div>`,
              { direction: "top", offset: [0, -10], className: "tactical-tooltip-f7faf4" }
            );
          }
        }).addTo(map);
      }
    }
  }, []);

  updateHotspotsViewportRef.current = updateHotspotsViewport;

  const loadHotspots = useCallback(async (map: L.Map, _targetEventId?: string) => {
    try {
      // Heatmap = deteksi FIRMS 24 jam terakhir (Peta Panas Skala Nasional)
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

    // Pasang Basemap Default (Satelit Esri + Labels)
    applyBasemap(map, "satellite");
    if (baseTileLayerRef.current) trackTileLayer(baseTileLayerRef.current);

    mapRef.current = map;

    // Pasang Kanvas Peta Panas (Heatmap) Titik Api Skala Makro
    hotspotsHeatmapRef.current = new HeatLeafletLayer(map);

    // Hook moveend & zoomend dengan debounce ringan untuk Viewport Culling titik api & fasilitas
    let moveTimeout: ReturnType<typeof setTimeout> | null = null;
    const onMoveOrZoomEnd = () => {
      if (moveTimeout) clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        updateHotspotsViewportRef.current(map);
        if (showSchoolsRef.current || showHospitalsRef.current) {
          loadFacilitiesRef.current?.(map);
        }
      }, 150);
    };
    map.on("moveend", onMoveOrZoomEnd);
    map.on("zoomend", onMoveOrZoomEnd);

    // Deteksi hover zona sebaran partikel secara independen (Solusi evaluasi 1: selalu jalan meski simulasi play/running)
    const onMouseMove = (e: L.LeafletMouseEvent) => {
      const geo = currentPlumeGeoRef.current;
      if (!geo || !geo.features || geo.features.length === 0) {
        if (plumeTooltipRef.current) {
          map.removeLayer(plumeTooltipRef.current);
          plumeTooltipRef.current = null;
        }
        return;
      }

      const { lat, lng } = e.latlng;
      // Prioritas hierarki pengecekan: P90 (minimum) -> P50 (mid) -> P05 (maximum)
      let matchedFeature: any = null;
      for (const targetTier of ["minimum", "mid", "maximum"]) {
        const found = geo.features.find((f: any) => {
          const t = f.properties?.tier;
          const normalized = t === "min" || t === "p90" ? "minimum" : t === "p50" ? "mid" : t;
          return normalized === targetTier && isPointInGeoJsonGeometry(lng, lat, f.geometry);
        });
        if (found) {
          matchedFeature = found;
          break;
        }
      }

      if (!matchedFeature) {
        // Fallback: cek poligon apa saja yang mencakup titik ini
        matchedFeature = geo.features.find((f: any) => isPointInGeoJsonGeometry(lng, lat, f.geometry));
      }

      if (matchedFeature) {
        const p = matchedFeature.properties || {};
        const t = p.tier;
        const isFire =
          hazardRef.current === "fire" ||
          eventIdRef.current.startsWith("hutan_") ||
          eventIdRef.current.startsWith("karhutla_");

        let tierName = "Asap Sedang (P50)";
        let tierColor = "#ea580c";
        if (t === "minimum" || t === "p90" || t === "min") {
          tierName = isFire ? "Asap Sangat Pekat (P90)" : "Abu Tebal / Bahaya Tinggi (P90)";
          tierColor = "#dc2626";
        } else if (t === "mid" || t === "p50") {
          tierName = isFire ? "Asap Sedang (P50)" : "Abu Sedang / Waspada (P50)";
          tierColor = "#ea580c";
        } else {
          tierName = isFire ? "Asap Tipis / Siaga Dini (P05)" : "Debu Halus / Siaga Dini (P05)";
          tierColor = "#d97706";
        }

        const hazardLabel = isFire ? "Sebaran Asap Karhutla (PM2.5)" : "Sebaran Abu Vulkanik";
        const hazardIcon = isFire ? "💨" : "🌋";

        const content = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.4; text-align: left; min-width: 200px; width: max-content; white-space: nowrap;">
            <div style="font-size: 13px; font-weight: 800; color: #16241b; margin-bottom: 3px; letter-spacing: -0.01em; display: flex; align-items: center; gap: 5px;">
              <span>${hazardIcon}</span>
              <span>${hazardLabel}</span>
            </div>
            <div style="font-size: 11.5px; color: #334155; margin-bottom: 3px;">
              Tingkat: <strong style="color: ${tierColor}; font-weight: 700;">${tierName}</strong>
            </div>
            <div style="border-top: 1px solid rgba(22, 38, 28, 0.12); margin: 5px 0 4px 0;"></div>
            <div style="font-size: 10px; color: #64748b; font-weight: 500; display: flex; align-items: center; gap: 4px;">
              <span>⏱️</span> <span>Waktu Horizon: <strong style="color: #1e293b; font-weight: 700;">${formatHour(currentHour)}</strong></span>
            </div>
          </div>
        `;

        if (!plumeTooltipRef.current) {
          plumeTooltipRef.current = L.tooltip({
            direction: "top",
            offset: [0, -12],
            className: "tactical-tooltip-f7faf4 plume-global-tooltip"
          });
        }
        plumeTooltipRef.current.setLatLng(e.latlng).setContent(content);
        if (!map.hasLayer(plumeTooltipRef.current)) {
          plumeTooltipRef.current.openOn(map);
        }
      } else if (plumeTooltipRef.current) {
        map.removeLayer(plumeTooltipRef.current);
        plumeTooltipRef.current = null;
      }
    };

    const onMouseOut = () => {
      if (plumeTooltipRef.current) {
        map.removeLayer(plumeTooltipRef.current);
        plumeTooltipRef.current = null;
      }
    };

    map.on("mousemove", onMouseMove);
    map.on("mouseout", onMouseOut);

    // Load layer utama (gunung, hutan, batas, fasilitas) untuk kesiapan tampilan peta
    let layersDone = 0;
    const layerJobs = [
      loadVolcanoes(map),
      loadForests(map),
      api.getForestBoundaries().then((res) => {
        forestBoundariesRef.current = res?.features || [];
      }).catch(() => {}),
      loadFacilities(map)
    ];
    const tickLayer = () => reportBoot("peta", ++layersDone / (layerJobs.length + 1));
    layerJobs.forEach((job) => job.then(tickLayer, tickLayer));

    // Titik api (payload besar) dimuat di latar belakang tanpa menahan pembukaan peta
    loadHotspots(map).finally(tickLayer);

    // Pengaman responsif: peta langsung dibuka maksimal dalam 1.2 detik
    const safetyTimer = setTimeout(() => {
      reportBoot("peta", 1);
      onLayersLoaded?.();
    }, 1200);

    Promise.allSettled(layerJobs).finally(() => {
      clearTimeout(safetyTimer);
      reportBoot("peta", 1);
      if (eventIdRef.current) {
        focusEventRef.current(map, eventIdRef.current, hazardRef.current);
      }
      onLayersLoaded?.();
    });

    return () => {
      clearTimeout(safetyTimer);
      if (moveTimeout) clearTimeout(moveTimeout);
      map.off("moveend", onMoveOrZoomEnd);
      map.off("zoomend", onMoveOrZoomEnd);
      map.off("mousemove", onMouseMove);
      map.off("mouseout", onMouseOut);
      if (plumeTooltipRef.current) {
        map.removeLayer(plumeTooltipRef.current);
        plumeTooltipRef.current = null;
      }
      if (hotspotsHeatmapRef.current) {
        hotspotsHeatmapRef.current.destroy();
        hotspotsHeatmapRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Reset View Handler
  useEffect(() => {
    if (resetViewTrigger > 0 && mapRef.current) {
      mapRef.current.flyTo(
        [CONFIG.DEFAULT_MAP_VIEW.lat, CONFIG.DEFAULT_MAP_VIEW.lng],
        CONFIG.DEFAULT_MAP_VIEW.zoom,
        { duration: 1.2 }
      );
    }
  }, [resetViewTrigger]);

  // FlyTo Handler untuk Fasilitas (Sekolah/RS) + Tampilkan Marker Tunggal RS Tanpa Membuka Seluruh RS
  useEffect(() => {
    if (flyToTarget && mapRef.current) {
      const map = mapRef.current;
      map.flyTo(
        [flyToTarget.lat, flyToTarget.lng],
        14, // Zoom level 14 untuk melihat detail wilayah fasilitas
        { duration: 1.2, easeLinearity: 0.25 }
      );

      // Cari apakah target flyTo adalah rumah sakit/faskes
      const hospitals = rawFacilitiesRef.current?.hospitals || [];
      const targetHospital = hospitals.find((h: any) => {
        const coords = h.geometry?.coordinates;
        if (!coords) return false;
        // toleransi kedekatan koordinat float
        return Math.abs(coords[1] - flyToTarget.lat) < 0.001 && Math.abs(coords[0] - flyToTarget.lng) < 0.001;
      });

      if (targetHospital) {
        if (focusedHospitalMarkerRef.current) {
          map.removeLayer(focusedHospitalMarkerRef.current);
          focusedHospitalMarkerRef.current = null;
        }

        const hp = targetHospital.properties || {};
        const icon = L.divIcon({
          className: "fac-impacted-marker fac-impacted-glow",
          html: `<img src="/hospital.png" class="w-7 h-7 object-contain drop-shadow-lg" />`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const marker = L.marker([flyToTarget.lat, flyToTarget.lng], { icon, zIndexOffset: 1000 }).addTo(map);
        marker
          .bindTooltip(
            `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.45; text-align: left;">
              <div style="font-size: 13px; font-weight: 800; color: #16241b; margin-bottom: 2px;">${hp.name || "Rumah Sakit Rujukan"}</div>
              <div style="font-size: 11px; color: #059669; font-weight: 600;">[RS Rujukan Evakuasi Aman]</div>
            </div>`,
            { direction: "top", offset: [0, -16], className: "tactical-tooltip-f7faf4" }
          )
          .bindPopup(
            `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.45; text-align: left; padding: 2px;">
              <div style="color: #0d9488; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 2px;">[RS RUJUKAN EVAKUASI AMAN]</div>
              <strong style="font-size: 13.5px; font-weight: 800; color: #16241b;">${hp.name || "Rumah Sakit Rujukan"}</strong><br/>
              <span style="font-size: 11px; color: #64748b;">${hp.district || ""} &bull; Hotline: <strong style="color: #dc2626;">${hp.emergency_hotline || "119"}</strong></span>
            </div>`
          ).openPopup();

        focusedHospitalMarkerRef.current = marker;
      }
    }
  }, [flyToTarget]);

  // Otomatis arahkan kamera peta ke lokasi kejadian terpilih
  const EVENT_COORDS: Record<string, [number, number, number]> = {
    anak_krakatau_2026_09: [-6.102, 105.423, 10.5],
    merapi_yogyakarta: [-7.540, 110.446, 11],
    lewotobi_laki_laki: [-8.538, 122.768, 11],
    marapi_sumatera: [-0.381, 100.473, 11],
    semeru: [-8.108, 112.922, 11],
    agung: [-8.343, 115.508, 11],
    rinjani: [-8.420, 116.470, 11],
    sinabung: [3.170, 98.392, 11],
    live_kalimantan: [-2.200, 113.900, 8.5]
  };

  const highlightKrb = useCallback((map: L.Map, _lat?: number, _lng?: number, _radiusKm?: number, _volcanoName?: string) => {
    if (krbCircleRef.current) {
      map.removeLayer(krbCircleRef.current);
      krbCircleRef.current = null;
    }
  }, []);

  const focusEvent = useCallback((map: L.Map, targetEventId: string, targetHazard: HazardType) => {
    if (!targetEventId) {
      if (krbCircleRef.current) {
        map.removeLayer(krbCircleRef.current);
        krbCircleRef.current = null;
      }
      if (forestBoundaryLayerRef.current) {
        map.removeLayer(forestBoundaryLayerRef.current);
        forestBoundaryLayerRef.current = null;
      }
      if (rawHotspotsRef.current.length === 0) {
        loadHotspots(map, "national");
      }
      return;
    }

    // Periksa apakah targetEventId adalah kawasan hutan atau gunung api
    const isFireEvent =
      targetHazard === "fire" ||
      targetEventId.startsWith("hutan_") ||
      targetEventId.startsWith("karhutla_") ||
      (forestsDataRef.current || []).some((f: any) => f.id === targetEventId);

    if (isFireEvent) {
      if (krbCircleRef.current) {
        map.removeLayer(krbCircleRef.current);
        krbCircleRef.current = null;
      }

      if (forestBoundaryLayerRef.current) {
        map.removeLayer(forestBoundaryLayerRef.current);
        forestBoundaryLayerRef.current = null;
      }

      // Batas daerah hutan disembunyikan agar tidak tampil di layar pengguna (sesuai Gambar 2)

      const fireObj = (forestsDataRef.current || []).find((f: any) => f.id === targetEventId);
      if (fireObj) {
        map.flyTo([fireObj.lat, fireObj.lon], 10, { duration: 1.8, easeLinearity: 0.25 });
      } else if (EVENT_COORDS[targetEventId]) {
        const c = EVENT_COORDS[targetEventId];
        map.flyTo([c[0], c[1]], c[2] || 10, { duration: 1.8, easeLinearity: 0.25 });
      }
      loadHotspots(map, targetEventId);
    } else {
      if (forestBoundaryLayerRef.current) {
        map.removeLayer(forestBoundaryLayerRef.current);
        forestBoundaryLayerRef.current = null;
      }

      const feat = (volcanoesDataRef.current || []).find(
        (f: any) =>
          (f.properties?.event_id && f.properties.event_id === targetEventId) ||
          (f.properties?.id && f.properties.id === targetEventId) ||
          (f.id && f.id === targetEventId)
      );
      if (feat && feat.geometry && feat.geometry.coordinates) {
        const c = feat.geometry.coordinates;
        map.flyTo([c[1], c[0]], 11, { duration: 1.8, easeLinearity: 0.25 });
        highlightKrb(map, c[1], c[0], feat.properties?.radius_bahaya_km || 5.0, feat.properties?.name);
      } else if (EVENT_COORDS[targetEventId]) {
        const target = EVENT_COORDS[targetEventId];
        map.flyTo([target[0], target[1]], target[2], { duration: 1.8, easeLinearity: 0.25 });
        highlightKrb(map, target[0], target[1], 5.0);
      }
    }
  }, [loadHotspots, highlightKrb]);

  focusEventRef.current = focusEvent;

  useEffect(() => {
    if (!mapRef.current) return;
    if (showVolcanoes) volcanoesLayerRef.current?.addTo(mapRef.current);
    else volcanoesLayerRef.current?.remove();
  }, [showVolcanoes]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (showForests) forestsLayerRef.current?.addTo(mapRef.current);
    else forestsLayerRef.current?.remove();
  }, [showForests]);

  useEffect(() => {
    if (!mapRef.current) return;
    updateHotspotsViewport(mapRef.current);
  }, [showHotspots, updateHotspotsViewport]);

  useEffect(() => {
    loadFacilitiesRef.current = loadFacilities;
  });

  useEffect(() => {
    showSchoolsRef.current = showSchools;
    if (!mapRef.current) return;
    if (showSchools) {
      if (schoolsLayerRef.current) {
        schoolsLayerRef.current.addTo(mapRef.current);
      } else {
        loadFacilities(mapRef.current);
      }
    } else {
      schoolsLayerRef.current?.remove();
    }
  }, [showSchools]);

  useEffect(() => {
    showHospitalsRef.current = showHospitals;
    if (!mapRef.current) return;
    if (showHospitals) {
      if (hospitalsLayerRef.current) {
        hospitalsLayerRef.current.addTo(mapRef.current);
      } else {
        loadFacilities(mapRef.current);
      }
    } else {
      hospitalsLayerRef.current?.remove();
    }
  }, [showHospitals]);

  useEffect(() => {
    showAirportsRef.current = showAirports;
    if (!mapRef.current) return;
    if (showAirports) {
      if (airportsLayerRef.current) {
        airportsLayerRef.current.addTo(mapRef.current);
      } else {
        loadFacilities(mapRef.current);
      }
    } else {
      airportsLayerRef.current?.remove();
    }
  }, [showAirports]);

  useEffect(() => {
    if (!mapRef.current) return;
    focusEvent(mapRef.current, eventId, hazard);
  }, [eventId, hazard, focusEventTrigger, focusEvent]);

  // Render titik api eksklusif di wilayah kawasan hutan terpilih (Point-in-Area Hutan)
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
                `<div style="min-width: 170px; line-height: 1.45; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2px;">
                  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <img src="/titik_api.png" style="width: 16px; height: 16px; object-fit: contain;" />
                    <strong style="color: #16241b; font-size: 12px; font-weight: 800;">Titik Api ${p.sensor || "NASA FIRMS"}</strong>
                  </div>
                  <div style="color: #c2410c; font-size: 11px; margin-bottom: 2px; font-weight: 700;">
                    Radiasi Energi (FRP): <strong style="color: #9a3412;">${p.frp ? `${p.frp} MW` : '-'}</strong>
                  </div>
                  ${p.confidence ? `
                    <div style="color: #475569; font-size: 10.5px;">
                      Keyakinan Deteksi: <strong style="color: #1e293b;">${p.confidence}</strong>
                    </div>
                  ` : ''}
                  ${p.acq_date ? `
                    <div style="color: #64748b; font-size: 9.5px; margin-top: 3px; border-top: 1px solid rgba(0,0,0,0.08); padding-top: 3px;">
                      Terdeteksi: ${p.acq_datetime_utc ? new Date(p.acq_datetime_utc).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " WIB" : `${p.acq_date} ${p.acq_time || ""} UTC`}
                    </div>
                  ` : ''}
                </div>`,
                { direction: "top", offset: [0, -10], className: "tactical-tooltip-f7faf4" }
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

  const loadForests = async (map: L.Map) => {
    try {
      const forests = await api.getNationalForests();
      const list = Array.isArray(forests) ? forests : (forests?.forests || []);
      forestsDataRef.current = list;

      if (forestsLayerRef.current) map.removeLayer(forestsLayerRef.current);

      const features = list.map((f: any) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [f.lon, f.lat]
        },
        properties: f
      }));

      forestsLayerRef.current = L.geoJSON({ type: "FeatureCollection", features } as any, {
        pointToLayer: (feature: any, latlng) => {
          const p = feature.properties;
          let imageSrc = "/hutan.png";
          if (p.level === 4 || p.risk_level === "Sangat Rawan") {
            imageSrc = "/hutan_sangat_rawan.png";
          } else if (p.level === 3 || p.risk_level === "Rawan") {
            imageSrc = "/hutan_rawan.png";
          } else if (p.level === 2 || p.risk_level === "Waspada") {
            imageSrc = "/hutan_waspada.png";
          }

          const isCritical = p.level >= 3 || p.risk_level === "Sangat Rawan" || p.risk_level === "Rawan";
          const pulseHtml = isCritical
            ? `<span class="volcano-pulse-ring ${p.level === 4 ? 'ring-red' : 'ring-orange'}"></span>`
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

          // Format Tooltip Kawasan Hutan Sesuai Gambar 2:
          // Title: Hutan Lindung Sungai Wain & IKN (Balikpapan, Kaltim)
          // Line 1: 🌲 Hutan Lindung Penyangga Ibu Kota • 10.025 ha
          // Line 2: 📍 Kalimantan Timur • Kalimantan
          // Line 3: Status Bahaya (Live): Level II (Waspada)
          // Line 4: 🔥 6 titik api aktif  (NASA FIRMS, 24 jam)
          const areaHaStr = p.area_ha ? `${Number(p.area_ha).toLocaleString("id-ID")} ha` : "";
          const forestTypeLine = [p.forest_type || "Kawasan Hutan", areaHaStr].filter(Boolean).join(" &bull; ");
          const locLine = [p.province, p.region].filter(Boolean).join(" &bull; ");

          let riskColor = "#16a34a"; // Normal (green)
          if (p.level === 4 || p.risk_level === "Sangat Rawan") riskColor = "#dc2626"; // Red
          else if (p.level === 3 || p.risk_level === "Rawan") riskColor = "#ea580c"; // Orange
          else if (p.level === 2 || p.risk_level === "Waspada") riskColor = "#d97706"; // Amber

          const riskText = p.level_name || (p.level === 4 || p.risk_level === "Sangat Rawan" ? "Level IV (Sangat Rawan)" : p.level === 3 || p.risk_level === "Rawan" ? "Level III (Rawan)" : p.level === 2 || p.risk_level === "Waspada" ? "Level II (Waspada)" : "Level I (Normal)");
          const nHotspots = p.n_hotspots != null ? p.n_hotspots : 0;

          const forestHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.45; text-align: left;">
              <div style="font-size: 13.5px; font-weight: 800; color: #16241b; margin-bottom: 3px; letter-spacing: -0.01em;">${p.name}</div>
              <div style="font-size: 11px; color: #166534; font-weight: 600; display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                <span>🌲</span> <span>${forestTypeLine}</span>
              </div>
              <div style="font-size: 11px; color: #2b6cb0; font-weight: 500; display: flex; align-items: center; gap: 4px; margin-bottom: 3px;">
                <span style="font-size: 11px;">📍</span> <span>${locLine || 'Indonesia'}</span>
              </div>
              <div style="font-size: 11px; color: #2d3748; margin-bottom: 3px;">
                Status Bahaya (Live): <strong style="color: ${riskColor}; font-weight: 700;">${riskText}</strong>
              </div>
              <div style="font-size: 11px; display: flex; align-items: center; gap: 4px;">
                <span>🔥</span> <strong style="color: #dc2626; font-weight: 800;">${nHotspots} titik api aktif</strong>
                <span style="color: #64748b; font-size: 10px; margin-left: 2px;">(NASA FIRMS, 24 jam)</span>
              </div>
            </div>
          `;

          layer.bindTooltip(forestHtml, {
            direction: "top",
            offset: [0, -18],
            className: "tactical-tooltip-f7faf4"
          });

          layer.on("click", () => {
            map.flyTo([coords[1], coords[0]], 10, { duration: 1.8, easeLinearity: 0.25 });
            onSelectEvent(p.id, coords[1], coords[0], 15.0, "fire");
          });
        }
      });

      if (showForests) {
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

          // Format Tooltip Gunung Api Sesuai Gambar 1:
          // Title: G. Sinabung
          // Line 1: 📍 Karo, Sumatera Utara • Sumatera • 2.460 mdpl
          // Line 2: Status Aktivitas: Level III (Siaga)
          // Line 3: ⚠️ Radius bahaya (katalog): 5 km
          // Divider
          // Footer: Sumber level: MAGMA (PVMBG), diperiksa 14 Okt, 20.21 WIB
          const elevStr = p.elevation_m ? `${Number(p.elevation_m).toLocaleString("id-ID")} mdpl` : "";
          const locParts = [p.province, p.region, elevStr].filter(Boolean).join(" &bull; ");

          let statusColor = "#16a34a"; // Normal (Level I)
          if (p.level === 4 || (p.level_name && p.level_name.includes("Awas"))) statusColor = "#dc2626"; // Awas (red)
          else if (p.level === 3 || (p.level_name && p.level_name.includes("Siaga"))) statusColor = "#ea580c"; // Siaga (orange)
          else if (p.level === 2 || (p.level_name && p.level_name.includes("Waspada"))) statusColor = "#d97706"; // Waspada (amber)

          const statusText = p.level_name || (p.level === 4 ? "Level IV (Awas)" : p.level === 3 ? "Level III (Siaga)" : p.level === 2 ? "Level II (Waspada)" : "Level I (Normal)");
          const radiusKm = p.radius_bahaya_km || 5;

          const now = new Date();
          const dateStr = now.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
          const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(":", ".");
          const footerStr = `Sumber level: MAGMA (PVMBG), diperiksa ${dateStr}, ${timeStr} WIB`;

          const volcanoHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.45; text-align: left;">
              <div style="font-size: 13.5px; font-weight: 800; color: #16241b; margin-bottom: 3px; letter-spacing: -0.01em;">${p.name}</div>
              <div style="font-size: 11px; color: #2b6cb0; font-weight: 500; display: flex; align-items: center; gap: 4px; margin-bottom: 3px;">
                <span style="font-size: 11px;">📍</span> <span>${locParts || 'Indonesia'}</span>
              </div>
              <div style="font-size: 11px; color: #2d3748; margin-bottom: 3px;">
                Status Aktivitas: <strong style="color: ${statusColor}; font-weight: 700;">${statusText}</strong>
              </div>
              <div style="font-size: 11px; color: #854d0e; display: flex; align-items: center; gap: 4px; margin-bottom: 5px;">
                <span>⚠️</span> <span>Radius bahaya (katalog):</span> <strong style="color: #a16207; font-weight: 800;">${radiusKm} km</strong>
              </div>
              <div style="border-top: 1px solid rgba(22, 38, 28, 0.12); margin: 6px 0 5px 0;"></div>
              <div style="font-size: 9.5px; color: #64748b; font-weight: 500;">
                ${footerStr}
              </div>
            </div>
          `;

          layer.bindTooltip(volcanoHtml, {
            direction: "top",
            offset: [0, -18],
            className: "tactical-tooltip-f7faf4"
          });

          layer.on("click", () => {
            map.flyTo([coords[1], coords[0]], 11, { duration: 1.8, easeLinearity: 0.25 });
            highlightKrb(map, coords[1], coords[0], p.radius_bahaya_km, p.name);
            onSelectEvent(p.id || p.event_id, coords[1], coords[0], p.radius_bahaya_km, "volcano");
          });
        }
      }).addTo(map);

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
      // Dapatkan batas koordinat pandang peta saat ini (viewport bounds)
      const bounds = map.getBounds().pad(0.3);
      const bboxKey = `${bounds.getWest().toFixed(2)},${bounds.getSouth().toFixed(2)},${bounds.getEast().toFixed(2)},${bounds.getNorth().toFixed(2)}`;

      const fetchJobs: Promise<any>[] = [
        airportsGeoRef.current ? Promise.resolve(airportsGeoRef.current) : api.getFacilities({ facilityType: "airport" }),
        api.getFacilities({ bbox: bboxKey, facilityType: "school", limit: 600 }),
        api.getFacilities({ bbox: bboxKey, facilityType: "healthcare", limit: 300 })
      ];

      const [airGeo, schoolGeo, hospGeo] = await Promise.all(fetchJobs);
      if (airGeo) airportsGeoRef.current = airGeo;

      const schools = schoolGeo?.features || [];
      const hospitals = hospGeo?.features || [];
      const airports = airportsGeoRef.current?.features || [];

      rawFacilitiesRef.current = {
        schools,
        hospitals,
        airports
      };

      if (schoolsLayerRef.current) map.removeLayer(schoolsLayerRef.current);
      if (hospitalsLayerRef.current) map.removeLayer(hospitalsLayerRef.current);
      if (airportsLayerRef.current) map.removeLayer(airportsLayerRef.current);

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
            `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.45; text-align: left;">
              <div style="font-size: 13px; font-weight: 800; color: #16241b; margin-bottom: 2px;">${p.name || 'Sekolah'}</div>
              <div style="font-size: 11px; color: #2563eb; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                <span>🏫</span> <span>${p.district || 'Fasilitas Pendidikan'}</span>
              </div>
            </div>`,
            { direction: "top", offset: [0, -12], className: "tactical-tooltip-f7faf4" }
          );
          layer.bindPopup(`<div class="text-xs p-1 font-bold text-slate-800">${p.name || 'Sekolah'}</div>`);
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
            `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.45; text-align: left;">
              <div style="font-size: 13px; font-weight: 800; color: #16241b; margin-bottom: 2px;">${p.name || 'Fasilitas Kesehatan'}</div>
              <div style="font-size: 11px; color: #059669; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                <span>🏥</span> <span>${p.district || 'Pusat Medis / RS'}</span>
              </div>
            </div>`,
            { direction: "top", offset: [0, -12], className: "tactical-tooltip-f7faf4" }
          );
          layer.bindPopup(`<div class="text-xs p-1 font-bold text-slate-800">${p.name || 'Fasilitas Kesehatan'}</div>`);
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
          layer.bindTooltip(
            `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.45; text-align: left;">
              <div style="font-size: 13px; font-weight: 800; color: #16241b; margin-bottom: 2px;">${p.name || 'Bandara'}</div>
              <div style="font-size: 11px; color: #0284c7; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                <span>✈️</span> <span>${p.iata ? `Bandara (${p.iata})` : 'Bandar Udara'}</span>
              </div>
            </div>`,
            { direction: "top", offset: [0, -12], className: "tactical-tooltip-f7faf4" }
          );
          layer.bindPopup(`<div class="text-xs p-1 font-bold text-slate-800">${p.name || 'Bandara'}</div>`);
        }
      });

      if (showSchoolsRef.current) schoolsLayerRef.current?.addTo(map);
      if (showHospitalsRef.current) hospitalsLayerRef.current?.addTo(map);
      if (showAirportsRef.current) airportsLayerRef.current?.addTo(map);
    } catch {
      // Offline fallback
    }
  };

  // Render Poligon Sebaran Asap Karhutla & Abu Vulkanik saat jam berubah atau cache simulasi aktif
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (plumeTooltipRef.current) {
      map.removeLayer(plumeTooltipRef.current);
      plumeTooltipRef.current = null;
    }

    if (plumeLayerRef.current) {
      map.removeLayer(plumeLayerRef.current);
      plumeLayerRef.current = null;
    }
    currentPlumeGeoRef.current = null;

    if (impactedFacilitiesLayerRef.current) {
      map.removeLayer(impactedFacilitiesLayerRef.current);
      impactedFacilitiesLayerRef.current = null;
    }

    if (!showPlume || !hourlyTiersCache) return;

    const hourKey = `hour_${currentHour}`;
    const geoData = hourlyTiersCache[hourKey] || hourlyTiersCache[currentHour] || (hourlyTiersCache.features ? hourlyTiersCache : null);

    if (!geoData || !geoData.features || geoData.features.length === 0) return;

    currentPlumeGeoRef.current = geoData;

    const colors = CONFIG.COLORS[hazard] || CONFIG.COLORS.volcano;

    plumeLayerRef.current = L.geoJSON(geoData, {
      style: (feature: any) => {
        const tier = feature.properties?.tier || "mid";
        if (tier === "p90" || tier === "min" || tier === "minimum") {
          return { color: colors.p90, fillColor: colors.p90, fillOpacity: 0.58, weight: 1.5 };
        }
        if (tier === "p50" || tier === "mid") {
          return { color: colors.p50, fillColor: colors.p50, fillOpacity: 0.36, weight: 1.2, dashArray: "3,3" };
        }
        return { color: colors.p05, fillColor: colors.p05, fillOpacity: 0.18, weight: 0.8 };
      },
      onEachFeature: () => {
        // Tooltip poligon sebaran ditangani secara dinamis dengan prioritas tingkat bahaya oleh onMouseMove map
      }
    }).addTo(map);

    // Evaluasi Fasilitas Terdampak
    let impactedList: any[] = [];
    if (impactedFacilities && (impactedFacilities.schools || impactedFacilities.healthcare || impactedFacilities.hospitals)) {
      const impSchools = (impactedFacilities.schools || []).map((s: any) => ({
        type: "Feature",
        properties: {
          ...s,
          facility_type: "school",
          name: s.name,
          district: s.district,
          exposure_pct: s.exposure_pct ?? (s.exposure_probability ? Math.round(s.exposure_probability * 100) : 0),
          action_code: s.action_code,
          nearest_safe_hospital: s.nearest_safe_hospital
        },
        geometry: {
          type: "Point",
          coordinates: [Number(s.lng ?? s.longitude), Number(s.lat ?? s.latitude)]
        }
      }));
      const impHealth = (impactedFacilities.healthcare || impactedFacilities.hospitals || []).map((h: any) => ({
        type: "Feature",
        properties: {
          ...h,
          facility_type: "hospital",
          name: h.name,
          district: h.district,
          exposure_pct: h.exposure_pct ?? (h.exposure_probability ? Math.round(h.exposure_probability * 100) : 0),
          is_safe: h.is_safe
        },
        geometry: {
          type: "Point",
          coordinates: [Number(h.lng ?? h.longitude), Number(h.lat ?? h.latitude)]
        }
      }));
      impactedList = [...impSchools, ...impHealth].filter(
        (f: any) => !isNaN(f.geometry.coordinates[0]) && !isNaN(f.geometry.coordinates[1]) && f.geometry.coordinates[0] !== 0
      );
    } else {
      const { schools, hospitals, airports } = rawFacilitiesRef.current;
      if (activeRunId && (schools.length > 0 || hospitals.length > 0 || airports.length > 0)) {
        const allFacilities = [...schools, ...hospitals, ...airports];
        impactedList = allFacilities.filter((f) => {
          const coords = f.geometry?.coordinates;
          if (!coords) return false;
          return geoData.features.some((pf: any) =>
            isPointInGeoJsonGeometry(coords[0], coords[1], pf.geometry)
          );
        });
      }
    }

    if (impactedList.length > 0) {
      impactedFacilitiesLayerRef.current = L.geoJSON({ type: "FeatureCollection", features: impactedList } as any, {
        pointToLayer: (feature: any, latlng) => {
          const facType = feature.properties?.facility_type;
          const imgSrc = facType === "school" ? "/school.png" : (facType === "airport" ? "/plane.png" : "/hospital.png");
          const icon = L.divIcon({
            className: "fac-impacted-marker fac-impacted-glow",
            html: `<img src="${imgSrc}" class="w-6 h-6 object-contain drop-shadow-md" />`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          return L.marker(latlng, { icon });
        },
        onEachFeature: (feature: any, layer) => {
          const p = feature.properties || {};
          const facType = p.facility_type;
          const isAwas = (p.exposure_pct && p.exposure_pct >= 40) || p.action_code === "PJJ_DARING";

          layer.bindTooltip(
            `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.45; text-align: left; min-width: 170px;">
              <div style="font-size: 12.5px; font-weight: 800; color: ${isAwas ? '#dc2626' : '#d97706'}; margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
                <span>⚠️</span> <span>${facType === 'school' ? 'Sekolah Terdampak' : 'Fasilitas Kesehatan'}</span>
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #16241b;">
                ${p.name || 'Fasilitas Publik'}
              </div>
              <div style="font-size: 11px; color: #475569; margin-top: 3px;">
                ${p.district ? `Kecamatan: <strong>${p.district}</strong><br/>` : ''}
                ${p.exposure_pct !== undefined ? `Peluang Paparan: <strong style="color:${isAwas ? '#dc2626' : '#ea580c'};">${p.exposure_pct}%</strong>` : ''}
              </div>
              ${isAwas ? '<div style="margin-top:4px;font-size:10px;font-weight:700;color:#dc2626;">[STATUS: DIALIHKAN KE PJJ DARING]</div>' : ''}
            </div>`,
            { direction: "top", offset: [0, -14], className: "tactical-tooltip-f7faf4" }
          );
        }
      }).addTo(map);
    }
  }, [currentHour, hourlyTiersCache, activeRunId, hazard, showPlume, impactedFacilities]);

  // Gambar Rute Evakuasi & Otomatis Munculkan Marker RS Tujuan Evakuasi
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (evacRouteLineRef.current) map.removeLayer(evacRouteLineRef.current);
    if (evacHospitalMarkerRef.current) {
      map.removeLayer(evacHospitalMarkerRef.current);
      evacHospitalMarkerRef.current = null;
    }

    if (evacuationRoute && evacuationRoute.geometry.length > 0) {
      evacRouteLineRef.current = L.polyline(evacuationRoute.geometry, {
        color: "#8AD6D1",
        weight: 4,
        opacity: 0.95
      }).addTo(map);

      const tooltipContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.45; text-align: left;">
          <div style="font-size: 13px; font-weight: 800; color: #16241b; margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
            <span>🚑</span> <span>Rute Evakuasi Medis</span>
          </div>
          <div style="font-size: 11px; color: #0f766e; font-weight: 600;">
            ${evacuationRoute.label}
          </div>
          ${evacuationRoute.distanceKm && evacuationRoute.durationMin ? `
            <div style="border-top: 1px solid rgba(22, 38, 28, 0.12); margin: 4px 0;"></div>
            <div style="font-size: 10px; color: #64748b;">
              Jarak: <strong style="color: #1e293b;">${evacuationRoute.distanceKm} km</strong> &bull; Estimasi: <strong style="color: #1e293b;">${evacuationRoute.durationMin} mnt</strong>
            </div>
          ` : ''}
        </div>
      `;

      evacRouteLineRef.current.bindTooltip(tooltipContent, {
        permanent: true,
        direction: "top",
        sticky: true,
        className: "tactical-tooltip-f7faf4"
      });

      // Munculkan secara otomatis pin RS tujuan evakuasi di titik akhir rute
      const destCoord = evacuationRoute.geometry[evacuationRoute.geometry.length - 1];
      if (destCoord) {
        const icon = L.divIcon({
          className: "fac-impacted-marker fac-impacted-glow",
          html: `<img src="/hospital.png" class="w-7 h-7 object-contain drop-shadow-lg" />`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const hospitalMarker = L.marker([destCoord[0], destCoord[1]], {
          icon,
          zIndexOffset: 1200
        }).addTo(map);

        hospitalMarker.bindTooltip(
          `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.45; text-align: left;">
            <div style="font-size: 13px; font-weight: 800; color: #16241b; margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
              <span>🏥</span> <span>RS Rujukan Evakuasi Aman</span>
            </div>
            <div style="font-size: 11px; color: #059669; font-weight: 600;">
              ${evacuationRoute.label || 'Fasilitas Kesehatan Terpilih'}
            </div>
          </div>`,
          { direction: "top", offset: [0, -16], className: "tactical-tooltip-f7faf4" }
        );

        evacHospitalMarkerRef.current = hospitalMarker;
      }

      map.fitBounds(evacRouteLineRef.current.getBounds(), { padding: [60, 60], maxZoom: 13 });
    }
  }, [evacuationRoute]);

  return (
    <div className="relative w-full h-full isolate z-0">
      <div ref={mapContainerRef} className="w-full h-full bg-[#140f0e]" />

      {/* Kontrol Navigasi Kiri Bawah (Zoom [+|-], Suite [User|Pusatkan|Spasial], dan CameraReadout) */}
      <div className="absolute bottom-3 sm:bottom-4 left-2 md:left-4 z-[600] flex flex-col items-start gap-1.5 transition-all duration-300 select-none">
        {/* Switch Gaya Peta: [ 🗺️ Kertas Taktis | 🛰️ Satelit ] */}
        <div
          className="flex rounded-full p-1 backdrop-blur-xl border shadow-2xl gap-1 mb-0.5"
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

        {/* Baris Tombol: [ + | - ] lalu [ 👤 | 🎯 | 📑 ] */}
        <div className="flex items-center gap-2">
          {/* 1. Dock Zoom: + (Zoom In) lalu - (Zoom Out) */}
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
              onClick={() => mapRef.current?.zoomIn()}
              className="w-8 h-9 flex items-center justify-center transition cursor-pointer active:scale-95 hover:bg-black/5 text-[#140f0e] border-r border-black/10"
              title="Perbesar Peta (Zoom In)"
            >
              <Plus size={14} weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.zoomOut()}
              className="w-8 h-9 flex items-center justify-center transition cursor-pointer active:scale-95 hover:bg-black/5 text-[#140f0e]"
              title="Perkecil Peta (Zoom Out)"
            >
              <Minus size={14} weight="bold" />
            </button>
          </div>

          {/* 2. Dock Suite: Icon User, Icon Pusatkan, Icon Spasial */}
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
              title="Tampilkan Lokasi Anda di Peta (GPS)"
            >
              <User size={16} weight="duotone" />
            </button>

            {/* 🎯 Pusatkan Peta ke Seluruh Wilayah Indonesia */}
            <button
              type="button"
              onClick={handleResetIndonesia}
              className="w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 bg-black/5 hover:bg-black/10 text-[#140f0e] border border-black/10 shadow-xs"
              title="Pusatkan Peta ke Seluruh Indonesia"
            >
              <Crosshair size={16} weight="bold" />
            </button>

            {/* 📑 Tombol Popover Lapisan Spasial (Icon Only) */}
            <div className="relative">
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
                <Stack size={16} weight="duotone" />
              </button>

              {/* Popover Lapisan Spasial: Membuka ke arah KANAN (horizontal flyout) */}
              {isLayerPanelOpen && (
                <div
                  className="absolute bottom-0 left-full ml-3 rounded-xl p-3 shadow-2xl flex flex-col gap-2 backdrop-blur-xl text-[#140f0e] border animate-in fade-in zoom-in-95 duration-150 min-w-[220px] max-h-[260px] overflow-y-auto z-[1100]"
                  style={{
                    background: "rgba(245, 239, 227, 0.98)",
                    borderColor: "rgba(235, 137, 91, 0.4)",
                    boxShadow: "0 12px 28px -4px rgba(0,0,0,0.25)"
                  }}
                >
                  <div className="flex items-center justify-between border-b pb-1.5 mb-0.5" style={{ borderColor: "rgba(20, 15, 14, 0.1)" }}>
                    <span className="font-subheading text-[10px] font-bold tracking-wider uppercase text-[#EB895B]">
                      Lapisan Spasial
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsLayerPanelOpen(false)}
                      className="text-[#140f0e]/50 hover:text-[#140f0e] transition cursor-pointer p-0.5 rounded hover:bg-black/5"
                      title="Tutup Panel"
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </div>

                  <label className="flex items-center gap-2 text-[11px] font-body font-medium cursor-pointer hover:opacity-80 transition select-none">
                    <input type="checkbox" checked={showVolcanoes} onChange={(e) => setShowVolcanoes(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B] rounded" />
                    <img src="/1_normal.png" className="w-3.5 h-3.5 object-contain" />
                    <span className="font-body">Gunungapi PVMBG</span>
                  </label>

                  <label className="flex items-center gap-2 text-[11px] font-body font-medium cursor-pointer hover:opacity-80 transition select-none">
                    <input type="checkbox" checked={showForests} onChange={(e) => setShowForests(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B] rounded" />
                    <img src="/hutan.png" className="w-3.5 h-3.5 object-contain" />
                    <span className="font-body">Kawasan Hutan & Gambut</span>
                  </label>

                  <label className="flex items-center gap-2 text-[11px] font-body font-medium cursor-pointer hover:opacity-80 transition select-none">
                    <input type="checkbox" checked={showHotspots} onChange={(e) => setShowHotspots(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B] rounded" />
                    <img src="/titik_api.png" className="w-3.5 h-3.5 object-contain" />
                    <span className="font-body">Titik Api Satelit (LOD)</span>
                  </label>

                  <label className="flex items-center gap-2 text-[11px] font-body font-medium cursor-pointer hover:opacity-80 transition select-none">
                    <input type="checkbox" checked={showPlume} onChange={(e) => setShowPlume(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B] rounded" />
                    <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(235, 137, 91, 0.35)", border: "1px dashed #EB895B" }}></div>
                    <span className="font-body">
                      {hazard === "fire" ? "Sebaran Asap Karhutla" : "Sebaran Abu Vulkanik"}
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-[11px] font-body font-medium cursor-pointer hover:opacity-80 transition select-none">
                    <input type="checkbox" checked={showSchools} onChange={(e) => setShowSchools(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B] rounded" />
                    <img src="/school.png" className="w-3.5 h-3.5 object-contain" />
                    <span className="font-body">Fasilitas Sekolah</span>
                  </label>

                  <label className="flex items-center gap-2 text-[11px] font-body font-medium cursor-pointer hover:opacity-80 transition select-none">
                    <input type="checkbox" checked={showHospitals} onChange={(e) => setShowHospitals(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B] rounded" />
                    <img src="/hospital.png" className="w-3.5 h-3.5 object-contain" />
                    <span className="font-body">Fasilitas Kesehatan</span>
                  </label>

                  <label className="flex items-center gap-2 text-[11px] font-body font-medium cursor-pointer hover:opacity-80 transition select-none">
                    <input type="checkbox" checked={showAirports} onChange={(e) => setShowAirports(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B] rounded" />
                    <img src="/plane.png" className="w-3.5 h-3.5 object-contain" />
                    <span className="font-body">Bandara Udara</span>
                  </label>

                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Camera Coordinates Readout */}
        <CameraReadout map={mapRef.current} lang="id" />
      </div>

      {/* Mode Peta Nasional (Histori Heatmap, Real-time Wind Streamlines, 16-Day Forecast & Smoke Paths) */}
      <div
        className={`absolute top-3.5 right-3.5 sm:top-4 sm:right-4 ${_isDrawerOpen ? "lg:right-[396px]" : "lg:right-4"} z-[500] transition-all duration-300 flex flex-col items-end`}
      >
        <NationalModes
          map={mapRef.current}
          lang="id"
        />
      </div>
    </div>
  );
};
