import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Plus, Minus, Stack, X, Crosshair, User } from "@phosphor-icons/react";
import { CONFIG } from "../../config/constants";
import { api } from "../../services/api";
import { reportBoot, trackTileLayer } from "../../utils/bootProgress";
import { formatHour } from "../../utils/formatters";
import { NationalModes } from "./NationalModes";
import { CameraReadout } from "./MapReadouts";
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
  focusEventTrigger = 0
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
  const [showSchools, setShowSchools] = useState(false);
  const [showHospitals, setShowHospitals] = useState(false);
  const [showAirports, setShowAirports] = useState(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);

  const volcanoesLayerRef = useRef<L.GeoJSON | null>(null);
  const forestsLayerRef = useRef<L.GeoJSON | null>(null);
  const hotspotsLayerRef = useRef<L.GeoJSON | null>(null);
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

  const [mapStyle] = useState<"exposure" | "satellite">("satellite");
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);

  const applyBasemap = (map: L.Map, type: "exposure" | "satellite") => {
    if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current);
    if (labelsTileLayerRef.current) map.removeLayer(labelsTileLayerRef.current);
    labelsTileLayerRef.current = null;

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
      // Tampilan Taktis Kertas / Gelap
      baseTileLayerRef.current = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap | PVMBG &bull; NASA FIRMS &bull; Open-Meteo",
        className: "dark-tiles",
        maxZoom: 18
      }).addTo(map);
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
          .bindPopup("<strong>Lokasi Anda</strong><br>Koordinat terdeteksi dari GPS perangkat.")
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

  // Update Hotspot layer dengan Viewport Culling & LOD zoom
  const updateHotspotsViewport = useCallback((map: L.Map) => {
    if (!showHotspotsRef.current) {
      if (hotspotsLayerRef.current) {
        map.removeLayer(hotspotsLayerRef.current);
        hotspotsLayerRef.current = null;
      }
      return;
    }

    const zoom = map.getZoom();
    const isSpecificForest = hazardRef.current === "fire" && !!eventIdRef.current;

    // LOD SWITCHER:
    // Jika melihat peta nasional (tanpa titik hutan spesifik) dan zoom jauh (< 8.0),
    // sembunyikan titik api individual agar tidak clutter.
    // Jika satu kawasan hutan spesifik dipilih, tampilkan titik api bahkan sejak zoom 6.5+.
    const minZoom = isSpecificForest ? 6.5 : 8.0;
    if (zoom < minZoom) {
      if (hotspotsLayerRef.current) {
        map.removeLayer(hotspotsLayerRef.current);
        hotspotsLayerRef.current = null;
      }
      return;
    }

    const allFeatures = rawHotspotsRef.current;
    if (!allFeatures || !allFeatures.length) {
      if (hotspotsLayerRef.current) {
        map.removeLayer(hotspotsLayerRef.current);
        hotspotsLayerRef.current = null;
      }
      return;
    }

    if (hotspotsLayerRef.current) map.removeLayer(hotspotsLayerRef.current);

    const bounds = map.getBounds().pad(0.15); // Buffer 15% di luar viewport
    const inBounds = allFeatures.filter((f: any) => {
      const c = f.geometry?.coordinates;
      if (!c) return false;
      return bounds.contains([c[1], c[0]]);
    });

    if (!inBounds.length) {
      if (hotspotsLayerRef.current) {
        map.removeLayer(hotspotsLayerRef.current);
        hotspotsLayerRef.current = null;
      }
      return;
    }

    // Urutkan titik api berdasarkan FRP tertinggi agar api paling signifikan selalu diprioritaskan
    const sorted = [...inBounds].sort((a: any, b: any) => (b.properties?.frp || 0) - (a.properties?.frp || 0));

    // Deduplikasi spasial dinamis (Grid Culling): cegah ratusan icon bertumpuk pada piksel yang sama
    // Menghilangkan lag browser secara drastis (60fps) dan menjaga tampilan peta tetap bersih & profesional
    const seenGrid = new Set<string>();
    const sampledFeatures: any[] = [];
    const maxMarkers = 50; // Maksimal 50 marker aktif per viewport agar bebas lag
    const gridSize = zoom >= 13 ? 0.005 : (zoom >= 11 ? 0.012 : (zoom >= 9 ? 0.025 : 0.045));

    for (const f of sorted) {
      const c = f.geometry?.coordinates;
      if (!c) continue;
      const key = `${Math.round(c[0] / gridSize)}_${Math.round(c[1] / gridSize)}`;
      if (!seenGrid.has(key)) {
        seenGrid.add(key);
        sampledFeatures.push(f);
        if (sampledFeatures.length >= maxMarkers) break;
      }
    }

    hotspotsLayerRef.current = L.geoJSON({ type: "FeatureCollection", features: sampledFeatures } as any, {
      pointToLayer: (_feature: any, latlng) => {
        const icon = L.divIcon({
          className: "hotspot-icon",
          html: `<img src="/titik_api.png" class="w-4.5 h-4.5 object-contain drop-shadow-md pointer-events-auto hover:scale-125 transition-transform" />`,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
        return L.marker(latlng, { icon });
      },
      onEachFeature: (feature: any, layer) => {
        const p = feature.properties;
        layer.bindTooltip(
          `<div style="font-family: ui-sans-serif, system-ui, sans-serif; padding: 2px;">
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
              <img src="/titik_api.png" style="width: 14px; height: 14px; object-fit: contain;" />
              <strong style="color: #140f0e; font-size: 11px;">Titik Api NASA FIRMS</strong>
            </div>
            <span style="color: #A14646; font-size: 10.5px; font-weight: 600;">FRP: ${p.frp ? `${p.frp} MW` : '-'}</span>
          </div>`,
          { direction: "top", offset: [0, -8] }
        );
      }
    }).addTo(map);
  }, []);

  updateHotspotsViewportRef.current = updateHotspotsViewport;

  const loadHotspots = useCallback(async (map: L.Map, targetEventId?: string) => {
    try {
      const target = targetEventId || (hazardRef.current === "fire" && eventIdRef.current ? eventIdRef.current : "national");
      const geo = await api.getHotspots(target);
      const features = geo?.features || [];
      if (features.length > 0 || !rawHotspotsRef.current.length) {
        rawHotspotsRef.current = features;
      }
      updateHotspotsViewportRef.current(map);
    } catch {
      // Offline fallback
    }
  }, []);

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

    // Load Coastline fallback
    api.getCoastline()
      .then((geo) => {
        L.geoJSON(geo, {
          style: { color: "#8AD6D1", weight: 0.8, opacity: 0.35 }
        }).addTo(map);
      })
      .catch(() => {});

    // Hook moveend & zoomend dengan debounce ringan untuk Viewport Culling titik api & LOD zoom
    let moveTimeout: ReturnType<typeof setTimeout> | null = null;
    const onMoveOrZoomEnd = () => {
      if (moveTimeout) clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        updateHotspotsViewportRef.current(map);
      }, 80);
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

        const tierName =
          t === "minimum" || t === "p90" || t === "min"
            ? (isFire ? "Asap Sangat Pekat (P90)" : "Abu Tebal / Bahaya Tinggi (P90)")
            : t === "mid" || t === "p50"
            ? (isFire ? "Asap Sedang (P50)" : "Abu Sedang / Waspada (P50)")
            : (isFire ? "Asap Tipis / Siaga Dini (P05)" : "Debu Halus / Siaga Dini (P05)");

        const hazardLabel = isFire ? "Sebaran Asap Karhutla (PM2.5)" : "Sebaran Abu Vulkanik";
        const content = `<div class="p-1"><strong>${hazardLabel}</strong><br/>Tingkat: <span class="font-bold text-[#EB895B]">${tierName}</span><br/><small class="text-slate-400">Waktu Horizon: ${formatHour(currentHour)}</small></div>`;

        if (!plumeTooltipRef.current) {
          plumeTooltipRef.current = L.tooltip({
            sticky: true,
            direction: "top",
            className: "plume-global-tooltip"
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

    // Load semua layer secara paralel (progres tiap layer dilaporkan ke loader sungai)
    let layersDone = 0;
    const layerJobs = [
      loadVolcanoes(map),
      loadForests(map),
      api.getForestBoundaries().then((res) => {
        forestBoundariesRef.current = res?.features || [];
      }).catch(() => {}),
      loadHotspots(map),
      loadFacilities(map)
    ];
    const tickLayer = () => reportBoot("peta", ++layersDone / layerJobs.length);
    layerJobs.forEach((job) => job.then(tickLayer, tickLayer));
    Promise.allSettled(layerJobs).finally(() => {
      reportBoot("peta", 1);
      if (eventIdRef.current) {
        focusEventRef.current(map, eventIdRef.current, hazardRef.current);
      }
      onLayersLoaded?.();
    });

    return () => {
      if (moveTimeout) clearTimeout(moveTimeout);
      map.off("moveend", onMoveOrZoomEnd);
      map.off("zoomend", onMoveOrZoomEnd);
      map.off("mousemove", onMouseMove);
      map.off("mouseout", onMouseOut);
      if (plumeTooltipRef.current) {
        map.removeLayer(plumeTooltipRef.current);
        plumeTooltipRef.current = null;
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
        marker.bindPopup(
          `<div class="text-xs p-1 font-sans text-slate-800">
            <span class="text-[#2a8485] font-bold tracking-wide">[RS RUJUKAN EVAKUASI AMAN]</span><br/>
            <strong class="text-sm">${hp.name || "Rumah Sakit Rujukan"}</strong><br/>
            <span class="text-slate-600 text-[11px]">${hp.district || ""} &bull; Hotline: ${hp.emergency_hotline || "119"}</span>
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

      const boundaryFeat = forestBoundariesRef.current.find(
        (f: any) => f.id === targetEventId || f.properties?.id === targetEventId || f.properties?.forest_id === targetEventId
      );

      if (boundaryFeat && boundaryFeat.geometry) {
        forestBoundaryLayerRef.current = L.geoJSON(boundaryFeat as any, {
          style: {
            color: "#EB895B",
            weight: 1.5,
            dashArray: "4, 4",
            fillColor: "#EB895B",
            fillOpacity: 0.08
          }
        }).addTo(map);
      }

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
    if (!mapRef.current) return;
    if (showSchools) schoolsLayerRef.current?.addTo(mapRef.current);
    else schoolsLayerRef.current?.remove();
  }, [showSchools]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (showHospitals) hospitalsLayerRef.current?.addTo(mapRef.current);
    else hospitalsLayerRef.current?.remove();
  }, [showHospitals]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (showAirports) airportsLayerRef.current?.addTo(mapRef.current);
    else airportsLayerRef.current?.remove();
  }, [showAirports]);

  useEffect(() => {
    if (!mapRef.current) return;
    focusEvent(mapRef.current, eventId, hazard);
  }, [eventId, hazard, focusEventTrigger, focusEvent]);

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

          let badgeColor = "#22c55e";
          if (p.level === 4 || p.risk_level === "Sangat Rawan") badgeColor = "#A14646";
          else if (p.level === 3 || p.risk_level === "Rawan") badgeColor = "#DA6556";
          else if (p.level === 2 || p.risk_level === "Waspada") badgeColor = "#EB895B";

          layer.bindTooltip(
            `<div style="font-family: ui-sans-serif, system-ui, sans-serif; padding: 2px;">
              <strong style="color: #140f0e; font-size: 11px;">${p.name}</strong><br>
              <span style="display: inline-block; padding: 1px 5px; border-radius: 4px; font-size: 9.5px; font-weight: 700; color: #fff; background-color: ${badgeColor}; margin-top: 3px;">
                ${p.level_name || p.risk_level || 'Normal'}
              </span>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                ${p.n_hotspots != null ? `🔥 ${p.n_hotspots} titik api (24j)` : ''}
                ${p.area_ha ? ` &bull; ${(p.area_ha / 1000).toLocaleString('id-ID')}k Ha` : ''}
              </div>
            </div>`,
            { direction: "top", offset: [0, -10] }
          );

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

          layer.bindTooltip(`<strong>${p.name}</strong><br><span style="color:${p.color}">${p.level_name}</span>`, {
            direction: "top",
            offset: [0, -10]
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
      const geo = await api.getFacilities();
      const features = geo.features || [];

      const schools = features.filter((f: any) => f.properties.facility_type === "school");
      const hospitals = features.filter((f: any) => f.properties.facility_type === "healthcare" || f.properties.facility_type === "hospital");
      const airports = features.filter((f: any) => f.properties.facility_type === "airport");

      rawFacilitiesRef.current = { schools, hospitals, airports };

      if (schoolsLayerRef.current) map.removeLayer(schoolsLayerRef.current);
      if (hospitalsLayerRef.current) map.removeLayer(hospitalsLayerRef.current);
      if (airportsLayerRef.current) map.removeLayer(airportsLayerRef.current);

      schoolsLayerRef.current = L.geoJSON({ type: "FeatureCollection", features: schools } as any, {
        pointToLayer: (_feature: any, latlng) => {
          const icon = L.divIcon({
            className: "fac-icon-school",
            html: `<img src="/school.png" class="w-5 h-5 object-contain drop-shadow-sm" />`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          return L.marker(latlng, { icon });
        },
        onEachFeature: (feature: any, layer) => {
          const p = feature.properties;
          layer.bindPopup(`<div class="text-xs p-1 font-sans text-slate-800"><strong>${p.name || 'Sekolah'}</strong><br/><small class="text-slate-500">${p.district || ''}</small></div>`);
        }
      });

      hospitalsLayerRef.current = L.geoJSON({ type: "FeatureCollection", features: hospitals } as any, {
        pointToLayer: (_feature: any, latlng) => {
          const icon = L.divIcon({
            className: "fac-icon-hospital",
            html: `<img src="/hospital.png" class="w-5 h-5 object-contain drop-shadow-sm" />`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          return L.marker(latlng, { icon });
        },
        onEachFeature: (feature: any, layer) => {
          const p = feature.properties;
          layer.bindPopup(`<div class="text-xs p-1 font-sans text-slate-800"><strong>${p.name || 'Fasilitas Kesehatan'}</strong><br/><small class="text-slate-500">${p.district || ''}</small></div>`);
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
          layer.bindPopup(`<div class="text-xs p-1 font-sans text-slate-800"><strong>${p.name || 'Bandara'}</strong></div>`);
        }
      });

      if (showSchools) schoolsLayerRef.current.addTo(map);
      if (showHospitals) hospitalsLayerRef.current.addTo(map);
      if (showAirports) airportsLayerRef.current.addTo(map);
    } catch {
      // Offline fallback
    }
  };

  // Render Poligon Sebaran Asap Karhutla & Abu Vulkanik saat jam berubah atau cache simulasi aktif
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

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
      onEachFeature: (feature: any, layer) => {
        const p = feature.properties || {};
        const isFire =
          hazard === "fire" ||
          eventId.startsWith("hutan_") ||
          eventId.startsWith("karhutla_");

        const tierName =
          p.tier === "p90" || p.tier === "min" || p.tier === "minimum"
            ? (isFire ? "Asap Sangat Pekat (P90)" : "Abu Tebal / Bahaya Tinggi (P90)")
            : p.tier === "p50" || p.tier === "mid"
            ? (isFire ? "Asap Sedang (P50)" : "Abu Sedang / Waspada (P50)")
            : (isFire ? "Asap Tipis / Siaga Dini (P05)" : "Debu Halus / Siaga Dini (P05)");

        const hazardLabel = isFire ? "Sebaran Asap Karhutla (PM2.5)" : "Sebaran Abu Vulkanik";

        layer.bindTooltip(
          `<strong>${hazardLabel}</strong><br/>Tingkat: <span style="color:#EB895B;font-weight:700;">${tierName}</span><br/><small style="color:#94a3b8">Waktu Horizon: ${formatHour(currentHour)}</small>`,
          { sticky: true }
        );
      }
    }).addTo(map);

    // Evaluasi Fasilitas Terdampak
    const { schools, hospitals, airports } = rawFacilitiesRef.current;
    if (activeRunId && (schools.length > 0 || hospitals.length > 0 || airports.length > 0)) {
      const allFacilities = [...schools, ...hospitals, ...airports];
      const impactedList = allFacilities.filter((f) => {
        const coords = f.geometry?.coordinates;
        if (!coords) return false;
        return geoData.features.some((pf: any) =>
          isPointInGeoJsonGeometry(coords[0], coords[1], pf.geometry)
        );
      });

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
          }
        }).addTo(map);
      }
    }
  }, [currentHour, hourlyTiersCache, activeRunId, hazard, showPlume]);

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

      let tooltipContent = `<strong>Rute Evakuasi:</strong> ${evacuationRoute.label}`;
      if (evacuationRoute.distanceKm && evacuationRoute.durationMin) {
        tooltipContent += `<br/>Jarak: ${evacuationRoute.distanceKm} km (Est. ${evacuationRoute.durationMin} mnt)`;
      }

      evacRouteLineRef.current.bindTooltip(tooltipContent, { permanent: true, direction: "top", sticky: true });

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
