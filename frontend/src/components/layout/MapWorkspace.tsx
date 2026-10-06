import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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
}

export const MapWorkspace: React.FC<MapWorkspaceProps> = ({
  hazard,
  eventId,
  currentHour,
  hourlyTiersCache,
  evacuationRoute,
  onSelectEvent,
  resetViewTrigger
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const volcanoesLayerRef = useRef<L.GeoJSON | null>(null);
  const hotspotsLayerRef = useRef<L.GeoJSON | null>(null);
  const facilitiesLayerRef = useRef<L.GeoJSON | null>(null);
  const plumeLayerRef = useRef<L.GeoJSON | null>(null);
  const krbCircleRef = useRef<L.Circle | null>(null);
  const evacRouteLineRef = useRef<L.Polyline | null>(null);

  // Inisialisasi Peta Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const cfg = CONFIG.DEFAULT_MAP_VIEW;
    const map = L.map(mapContainerRef.current, {
      center: [cfg.lat, cfg.lng],
      zoom: cfg.zoom,
      minZoom: cfg.minZoom,
      maxZoom: cfg.maxZoom,
      zoomControl: false
    });

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    // Dark Tiles Basemap
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap | PVMBG &bull; NASA FIRMS &bull; Open-Meteo",
      className: "dark-tiles",
      maxZoom: 18
    }).addTo(map);

    mapRef.current = map;

    // Load Coastline fallback
    api.getCoastline()
      .then((geo) => {
        L.geoJSON(geo, {
          style: { color: "#334155", weight: 1.2, opacity: 0.5 }
        }).addTo(map);
      })
      .catch(() => {});

    // Load Layers
    loadVolcanoes(map);
    loadHotspots(map);
    loadFacilities(map);

    return () => {
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

  // Otomatis arahkan kamera peta ke lokasi kejadian terpilih
  const EVENT_COORDS: Record<string, [number, number, number]> = {
    anak_krakatau_2026_09: [-6.102, 105.423, 9],
    merapi_yogyakarta: [-7.540, 110.446, 10],
    lewotobi_laki_laki: [-8.538, 122.768, 10],
    marapi_sumatera: [-0.381, 100.473, 10],
    semeru: [-8.108, 112.922, 10],
    agung: [-8.343, 115.508, 10],
    rinjani: [-8.420, 116.470, 10],
    sinabung: [3.170, 98.392, 10],
    live_kalimantan: [-2.200, 113.900, 8]
  };

  useEffect(() => {
    if (!mapRef.current || !eventId) return;
    const target = EVENT_COORDS[eventId];
    if (target) {
      mapRef.current.flyTo([target[0], target[1]], target[2], { duration: 1.2 });
      highlightKrb(mapRef.current, target[0], target[1], 5.0);
    }
  }, [eventId]);

  const loadVolcanoes = async (map: L.Map) => {
    try {
      const geo = await api.getNationalVolcanoes();
      const features = geo.features || [];

      if (volcanoesLayerRef.current) map.removeLayer(volcanoesLayerRef.current);

      volcanoesLayerRef.current = L.geoJSON({ type: "FeatureCollection", features } as any, {
        pointToLayer: (feature: any, latlng) => {
          const p = feature.properties;
          const isHighAlert = p.level >= 3;
          const pulseHtml = isHighAlert
            ? `<span class="volcano-pulse-ring ${p.level === 4 ? 'ring-red' : 'ring-orange'}"></span>`
            : "";

          const icon = L.divIcon({
            className: "volcano-div-icon",
            html: `
              <div class="relative flex items-center justify-center">
                ${pulseHtml}
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <polygon points="12,2 2,21 22,21" fill="${p.color}" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
                  <circle cx="12" cy="14" r="2.8" fill="#0f172a"/>
                </svg>
              </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 14],
            popupAnchor: [0, -14]
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
            highlightKrb(map, coords[1], coords[0], p.radius_bahaya_km);
            onSelectEvent(p.event_id || p.id, coords[1], coords[0], p.radius_bahaya_km);
          });
        }
      }).addTo(map);
    } catch {
      // Offline fallback
    }
  };

  const loadHotspots = async (map: L.Map) => {
    try {
      const geo = await api.getHotspots("live_kalimantan");
      const features = geo.features || [];

      if (hotspotsLayerRef.current) map.removeLayer(hotspotsLayerRef.current);

      hotspotsLayerRef.current = L.geoJSON({ type: "FeatureCollection", features } as any, {
        pointToLayer: (feature: any, latlng) => {
          const frp = feature.properties.frp || 20;
          const radius = Math.min(10, Math.max(3, Math.sqrt(frp) * 0.8));

          return L.circleMarker(latlng, {
            radius,
            fillColor: "#ef4444",
            color: "#fbbf24",
            weight: 1,
            opacity: 0.9,
            fillOpacity: 0.75
          });
        },
        onEachFeature: (feature: any, layer) => {
          const p = feature.properties;
          layer.bindTooltip(
            `🔥 <strong>Titik Api VIIRS</strong><br>Daya Panas (FRP): ${p.frp || '-'} MW`,
            { direction: "top" }
          );
        }
      }).addTo(map);
    } catch {
      // Offline fallback
    }
  };

  const loadFacilities = async (map: L.Map) => {
    try {
      const geo = await api.getFacilities();
      const features = geo.features || [];

      if (facilitiesLayerRef.current) map.removeLayer(facilitiesLayerRef.current);

      facilitiesLayerRef.current = L.geoJSON({ type: "FeatureCollection", features } as any, {
        pointToLayer: (feature: any, latlng) => {
          const type = feature.properties.type || "school";
          let color = "#10b981";
          let symbol = "🏫";

          if (type === "healthcare" || type === "hospital") {
            color = "#0ea5e9";
            symbol = "🏥";
          } else if (type === "airport") {
            color = "#eab308";
            symbol = "✈️";
          }

          const icon = L.divIcon({
            className: "fac-icon",
            html: `<div style="background:${color};border:1.5px solid #fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 2px 4px rgba(0,0,0,0.5);">${symbol}</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          return L.marker(latlng, { icon });
        },
        onEachFeature: (feature: any, layer) => {
          const p = feature.properties;
          layer.bindPopup(`
            <div class="text-xs p-1 text-slate-100">
              <div class="font-bold text-white mb-1">${p.name || 'Fasilitas Publik'}</div>
              <div class="text-slate-400">Tipe: <span class="capitalize text-slate-200">${p.type}</span></div>
            </div>
          `);
        }
      }).addTo(map);
    } catch {
      // Offline fallback
    }
  };

  const highlightKrb = (map: L.Map, lat: number, lng: number, radiusKm: number) => {
    if (krbCircleRef.current) map.removeLayer(krbCircleRef.current);

    krbCircleRef.current = L.circle([lat, lng], {
      radius: (radiusKm || 5.0) * 1000,
      color: "#ef4444",
      weight: 1.5,
      dashArray: "4, 4",
      fillColor: "#ef4444",
      fillOpacity: 0.12
    }).addTo(map);

    krbCircleRef.current.bindTooltip(`Zona Rekomendasi Bahaya PVMBG (${radiusKm} km)`, { sticky: true });
  };

  // Render Poligon Plume saat jam berubah atau cache diperbarui
  useEffect(() => {
    if (!mapRef.current || !hourlyTiersCache) return;

    const map = mapRef.current;
    if (plumeLayerRef.current) map.removeLayer(plumeLayerRef.current);

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
  }, [currentHour, hourlyTiersCache, hazard]);

  // Gambar Rute Evakuasi
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (evacRouteLineRef.current) map.removeLayer(evacRouteLineRef.current);

    if (evacuationRoute) {
      evacRouteLineRef.current = L.polyline([evacuationRoute.origin, evacuationRoute.dest], {
        color: "#38bdf8",
        weight: 3,
        dashArray: "6, 8",
        opacity: 0.95
      }).addTo(map);

      evacRouteLineRef.current.bindTooltip(`🚑 ${evacuationRoute.label}`, { permanent: true, direction: "center" });
      map.fitBounds(evacRouteLineRef.current.getBounds(), { padding: [60, 60], maxZoom: 13 });
    }
  }, [evacuationRoute]);

  const colors = CONFIG.COLORS[hazard] || CONFIG.COLORS.volcano;

  return (
    <div className="relative w-full h-full isolate z-0">
      <div ref={mapContainerRef} className="w-full h-full bg-[#0b0f14]" />

      {/* Mini Legenda di Kiri Bawah Peta */}
      <div className="absolute bottom-20 left-3.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-2.5 z-20 text-[10px] text-slate-300 shadow-xl">
        <div className="font-bold text-white mb-1.5">{colors.label}</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: colors.p90 }} />
            <span>{hazard === "volcano" ? "Abu Tebal (P90)" : "Asap Sangat Pekat (P90)"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: colors.p50 }} />
            <span>{hazard === "volcano" ? "Abu Sedang (P50)" : "Asap Sedang (P50)"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: colors.p05 }} />
            <span>{hazard === "volcano" ? "Debu Halus (P05)" : "Asap Tipis (P05)"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
