import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Compass, Plus, Minus, Layers, X } from "lucide-react";
import { CONFIG } from "../../config/constants";
import { api } from "../../services/api";
import { formatHour } from "../../utils/formatters";
import type { HazardType } from "../../types/api";

interface MapWorkspaceProps {
  hazard: HazardType;
  eventId: string;
  currentHour: number;
  hourlyTiersCache: Record<string | number, any> | null;
  evacuationRoute: { origin: [number, number]; dest: [number, number]; label: string } | null;
  onSelectEvent: (eventId: string, lat: number, lng: number, radiusKm: number) => void;
  resetViewTrigger: number;
  onToggleLegend?: () => void;
  onLayersLoaded?: () => void;
}

export const MapWorkspace: React.FC<MapWorkspaceProps> = ({
  hazard,
  eventId,
  currentHour,
  hourlyTiersCache,
  evacuationRoute,
  onSelectEvent,
  resetViewTrigger,
  onToggleLegend: _onToggleLegend,
  onLayersLoaded
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsTileLayerRef = useRef<L.TileLayer | null>(null);

  const [showVolcanoes, setShowVolcanoes] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showPlume, setShowPlume] = useState(true);
  const [showSchools, setShowSchools] = useState(true);
  const [showHospitals, setShowHospitals] = useState(true);
  const [showAirports, setShowAirports] = useState(true);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(true);

  const volcanoesLayerRef = useRef<L.GeoJSON | null>(null);
  const hotspotsLayerRef = useRef<L.GeoJSON | null>(null);
  const rawHotspotsRef = useRef<any[]>([]);
  const schoolsLayerRef = useRef<L.GeoJSON | null>(null);
  const hospitalsLayerRef = useRef<L.GeoJSON | null>(null);
  const airportsLayerRef = useRef<L.GeoJSON | null>(null);
  const plumeLayerRef = useRef<L.GeoJSON | null>(null);
  const krbCircleRef = useRef<L.Circle | null>(null);
  const evacRouteLineRef = useRef<L.Polyline | null>(null);
  const volcanoesDataRef = useRef<any[]>([]);
  const forestsDataRef = useRef<any[]>([]);

  const applyBasemap = (map: L.Map, type: "satellite" | "dark") => {
    if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current);
    if (labelsTileLayerRef.current) map.removeLayer(labelsTileLayerRef.current);

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
    if (!showHotspots) {
      if (hotspotsLayerRef.current) map.removeLayer(hotspotsLayerRef.current);
      return;
    }

    const allFeatures = rawHotspotsRef.current;
    if (!allFeatures.length) return;

    if (hotspotsLayerRef.current) map.removeLayer(hotspotsLayerRef.current);

    const bounds = map.getBounds().pad(0.15); // Buffer 15% di luar viewport
    const zoom = map.getZoom();

    // Saring fitur yang ada di viewport
    const inBounds = allFeatures.filter((f: any) => {
      const c = f.geometry?.coordinates;
      if (!c) return false;
      return bounds.contains([c[1], c[0]]);
    });

    // LOD: jika zoom jauh (< 7), batasi max 150 titik terpanas (FRP tertinggi)
    let visibleFeatures = inBounds;
    if (zoom < 7 && inBounds.length > 150) {
      visibleFeatures = [...inBounds]
        .sort((a, b) => (b.properties?.frp || 0) - (a.properties?.frp || 0))
        .slice(0, 150);
    } else if (zoom < 9 && inBounds.length > 400) {
      visibleFeatures = [...inBounds]
        .sort((a, b) => (b.properties?.frp || 0) - (a.properties?.frp || 0))
        .slice(0, 400);
    }

    hotspotsLayerRef.current = L.geoJSON({ type: "FeatureCollection", features: visibleFeatures } as any, {
      pointToLayer: (_feature: any, latlng) => {
        const icon = L.divIcon({
          className: "hotspot-icon",
          html: `<img src="/titik_api.png" class="w-5 h-5 object-contain drop-shadow-md pointer-events-auto" />`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        return L.marker(latlng, { icon });
      },
      onEachFeature: (feature: any, layer) => {
        const p = feature.properties;
        layer.bindTooltip(
          `<strong>Titik Api VIIRS</strong><br>FRP: ${p.frp || '-'} MW`,
          { direction: "top" }
        );
      }
    }).addTo(map);
  }, [showHotspots]);

  const loadHotspots = useCallback(async (map: L.Map, targetEventId?: string) => {
    try {
      const target = targetEventId || (hazard === "fire" ? eventId : "national");
      const geo = await api.getHotspots(target);
      const features = geo.features || [];
      rawHotspotsRef.current = features;
      updateHotspotsViewport(map);
    } catch {
      // Offline fallback
    }
  }, [hazard, eventId, updateHotspotsViewport]);

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

    mapRef.current = map;

    // Load Coastline fallback
    api.getCoastline()
      .then((geo) => {
        L.geoJSON(geo, {
          style: { color: "#8AD6D1", weight: 0.8, opacity: 0.35 }
        }).addTo(map);
      })
      .catch(() => {});

    // Hook moveend dengan debounce ringan untuk Viewport Culling titik api
    let moveTimeout: ReturnType<typeof setTimeout> | null = null;
    const onMoveEnd = () => {
      if (moveTimeout) clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        updateHotspotsViewport(map);
      }, 80);
    };
    map.on("moveend", onMoveEnd);

    // Load semua layer secara paralel
    Promise.allSettled([
      loadVolcanoes(map),
      loadForests(),
      loadHotspots(map),
      loadFacilities(map)
    ]).finally(() => {
      onLayersLoaded?.();
    });

    return () => {
      if (moveTimeout) clearTimeout(moveTimeout);
      map.off("moveend", onMoveEnd);
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
    }
  }, [resetViewTrigger]);

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

  const prevEventIdRef = useRef<string>(eventId);

  useEffect(() => {
    if (!mapRef.current) return;
    if (showVolcanoes) volcanoesLayerRef.current?.addTo(mapRef.current);
    else volcanoesLayerRef.current?.remove();
  }, [showVolcanoes]);

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
    // Terbang ke episentrum kejadian saat eventId atau hazard berubah
    if (prevEventIdRef.current !== eventId) {
      prevEventIdRef.current = eventId;
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

  const loadForests = async () => {
    try {
      const forests = await api.getNationalForests();
      const list = Array.isArray(forests) ? forests : (forests?.forests || []);
      forestsDataRef.current = list;
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
            onSelectEvent(p.event_id || p.id, coords[1], coords[0], p.radius_bahaya_km);
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
            html: `<img src="/school.png" class="w-5 h-5 object-contain drop-shadow-sm" />`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          return L.marker(latlng, { icon });
        },
        onEachFeature: (feature: any, layer) => {
          const p = feature.properties;
          layer.bindPopup(`<div class="text-xs p-1 font-bold text-slate-800">${p.name || 'Sekolah'}</div>`);
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
          layer.bindPopup(`<div class="text-xs p-1 font-bold text-slate-800">${p.name || 'Bandara'}</div>`);
        }
      });

      if (showSchools) schoolsLayerRef.current.addTo(map);
      if (showHospitals) hospitalsLayerRef.current.addTo(map);
      if (showAirports) airportsLayerRef.current.addTo(map);
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

  // Render Poligon Plume saat jam berubah atau cache diperbarui
  useEffect(() => {
    if (!mapRef.current || !hourlyTiersCache) return;

    const map = mapRef.current;
    if (plumeLayerRef.current) map.removeLayer(plumeLayerRef.current);

    if (!showPlume) return;

    const hourKey = `hour_${currentHour}`;
    const geoData = hourlyTiersCache[hourKey] || hourlyTiersCache[currentHour] || (hourlyTiersCache.features ? hourlyTiersCache : null);

    if (!geoData) return;

    const colors = CONFIG.COLORS[hazard] || CONFIG.COLORS.volcano;

    plumeLayerRef.current = L.geoJSON(geoData, {
      style: (feature: any) => {
        const tier = feature.properties.tier || "mid";
        if (tier === "p90" || tier === "min") {
          return { color: colors.p90, fillColor: colors.p90, fillOpacity: 0.65, weight: 1.5 };
        }
        if (tier === "p50" || tier === "mid") {
          return { color: colors.p50, fillColor: colors.p50, fillOpacity: 0.40, weight: 1.2, dashArray: "3,3" };
        }
        return { color: colors.p05, fillColor: colors.p05, fillOpacity: 0.20, weight: 0.8 };
      },
      onEachFeature: (feature: any, layer) => {
        const p = feature.properties;
        const tierName = p.tier_label || (p.tier === "p90" || p.tier === "min" ? "Konsentrasi Tinggi (P90)" : (p.tier === "p50" || p.tier === "mid" ? "Konsentrasi Sedang (P50)" : "Jangkauan Maksimum (P05)"));
        layer.bindTooltip(`<strong>${colors.label}</strong><br>Tingkat: ${tierName}<br>Waktu: ${formatHour(currentHour)}`, {
          sticky: true
        });
      }
    }).addTo(map);
  }, [currentHour, hourlyTiersCache, hazard, showPlume]);

  // Gambar Rute Evakuasi
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (evacRouteLineRef.current) map.removeLayer(evacRouteLineRef.current);

    if (evacuationRoute) {
      evacRouteLineRef.current = L.polyline([evacuationRoute.origin, evacuationRoute.dest], {
        color: "#8AD6D1",
        weight: 3,
        dashArray: "6, 8",
        opacity: 0.95
      }).addTo(map);

      evacRouteLineRef.current.bindTooltip(`Rute Evakuasi: ${evacuationRoute.label}`, { permanent: true, direction: "center" });
      map.fitBounds(evacRouteLineRef.current.getBounds(), { padding: [60, 60], maxZoom: 13 });
    }
  }, [evacuationRoute]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full bg-[#140f0e]" />

      {/* 3. Panel Lapisan Spasial Aktif (Kiri Bawah) */}
      {!isLayerPanelOpen ? (
        <button
          onClick={() => setIsLayerPanelOpen(true)}
          className="absolute bottom-6 left-4 z-[500] w-10 h-10 rounded-full shadow-2xl flex items-center justify-center transition cursor-pointer active:scale-95 group"
          style={{
            background: "rgba(245, 239, 227, 0.95)",
            border: "1px solid rgba(235, 137, 91, 0.45)",
            color: "#EB895B"
          }}
          title="Tampilkan Lapisan Spasial"
        >
          <Layers className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
        </button>
      ) : (
        <div
          className="absolute bottom-6 left-4 z-[500] rounded-xl p-3.5 shadow-2xl flex flex-col gap-3 backdrop-blur-md text-[#140f0e]"
          style={{
            background: "rgba(245, 239, 227, 0.95)",
            border: "1px solid rgba(235, 137, 91, 0.4)",
            minWidth: "220px"
          }}
        >
          <div className="flex items-center justify-between border-b pb-2 mb-1" style={{ borderColor: "rgba(0, 0, 0, 0.1)" }}>
            <h3 className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: "#EB895B" }}>
              Lapisan Spasial Aktif
            </h3>
            <button onClick={() => setIsLayerPanelOpen(false)} className="text-[#EB895B] hover:text-slate-800 transition cursor-pointer opacity-80 hover:opacity-100" title="Sembunyikan Panel">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <label className="flex items-center gap-3 text-xs font-medium cursor-pointer hover:opacity-80 transition">
            <input type="checkbox" checked={showVolcanoes} onChange={(e) => setShowVolcanoes(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
            <img src="/1_normal.png" className="w-4 h-4 object-contain" />
            <span>Gunungapi PVMBG</span>
          </label>
          
          <label className="flex items-center gap-3 text-xs font-medium cursor-pointer hover:opacity-80 transition">
            <input type="checkbox" checked={showHotspots} onChange={(e) => setShowHotspots(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
            <img src="/titik_api.png" className="w-4 h-4 object-contain" />
            <span>Titik Api NASA FIRMS</span>
          </label>

          <label className="flex items-center gap-3 text-xs font-medium cursor-pointer hover:opacity-80 transition">
            <input type="checkbox" checked={showPlume} onChange={(e) => setShowPlume(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "rgba(253, 183, 115, 0.3)", border: "1px dashed #FDB773" }}></div>
            <span>Peluang Dispersi</span>
          </label>

          <label className="flex items-center gap-3 text-xs font-medium cursor-pointer hover:opacity-80 transition">
            <input type="checkbox" checked={showSchools} onChange={(e) => setShowSchools(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
            <img src="/school.png" className="w-4 h-4 object-contain" />
            <span>Fasilitas Sekolah</span>
          </label>

          <label className="flex items-center gap-3 text-xs font-medium cursor-pointer hover:opacity-80 transition">
            <input type="checkbox" checked={showHospitals} onChange={(e) => setShowHospitals(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
            <img src="/hospital.png" className="w-4 h-4 object-contain" />
            <span>Fasilitas Kesehatan</span>
          </label>

          <label className="flex items-center gap-3 text-xs font-medium cursor-pointer hover:opacity-80 transition">
            <input type="checkbox" checked={showAirports} onChange={(e) => setShowAirports(e.target.checked)} className="w-3.5 h-3.5 accent-[#EB895B]" />
            <img src="/plane.png" className="w-4 h-4 object-contain" />
            <span>Bandara Udara</span>
          </label>
        </div>
      )}

      {/* 2. Kontrol Navigasi Kanan Bawah: Tombol Bulat Reset Indonesia + Zoom (+ / -) */}
      <div className="absolute bottom-6 right-4 flex flex-col items-center gap-2 z-[500]">
        {/* Tombol Bulat Reset Tampilan Peta ke Seluruh Indonesia (Gaya Maps) */}
        <button
          type="button"
          onClick={handleResetIndonesia}
          className="w-10 h-10 rounded-full shadow-2xl flex items-center justify-center transition cursor-pointer active:scale-95 group"
          style={{
            background: "rgba(245, 239, 227, 0.95)",
            border: "1px solid rgba(235, 137, 91, 0.45)",
            color: "#EB895B"
          }}
          title="Reset Tampilan Peta ke Seluruh Wilayah Indonesia"
        >
          <Compass className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
        </button>

        {/* Tombol Navigasi Zoom (+ dan -) */}
        <div
          className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
          style={{
            background: "rgba(245, 239, 227, 0.95)",
            border: "1px solid rgba(235, 137, 91, 0.35)",
            color: "#140f0e"
          }}
        >
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            className="w-9 h-9 flex items-center justify-center transition cursor-pointer active:scale-95 hover:bg-black/5"
            style={{ borderBottom: "1px solid rgba(0, 0, 0, 0.1)" }}
            title="Perbesar Peta (Zoom In)"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            className="w-9 h-9 flex items-center justify-center transition cursor-pointer active:scale-95 hover:bg-black/5"
            title="Perkecil Peta (Zoom Out)"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
