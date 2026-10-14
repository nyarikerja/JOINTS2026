/**
 * components/layout/MapReadouts.tsx - Camera readout and scale bar.
 * Subscribes directly to Leaflet map events for high-performance zero-re-render map diagnostics.
 * Diadaptasi dari FE-FORGEHACK-2026.
 */

import React, { useEffect, useMemo, useState } from "react";
import type L from "leaflet";

interface MapView {
  lat: number;
  lng: number;
  zoom: number;
}

/** Map centre and zoom; `live` follows every frame of a pan, otherwise only its end. */
function useMapView(map: L.Map | null, live: boolean): MapView | null {
  const [view, setView] = useState<MapView | null>(null);
  useEffect(() => {
    if (!map) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const c = map.getCenter();
      setView({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    const events = live ? "move zoomend" : "moveend zoomend";
    map.on(events, schedule);
    schedule();
    return () => {
      map.off(events, schedule);
      cancelAnimationFrame(raf);
    };
  }, [map, live]);
  return view;
}

export const CameraReadout: React.FC<{ map: L.Map | null; lang?: "id" | "en" }> = ({ map }) => {
  const view = useMapView(map, true);
  if (!view) return null;
  const altitude = Math.round(25_000_000 / Math.pow(2, view.zoom));
  return (
    <div
      className="flex items-center gap-2 text-[10px] font-mono tracking-wide text-[#140f0e] px-2.5 py-1 rounded-full backdrop-blur-xl border shadow-md select-none"
      style={{
        background: "rgba(245, 239, 227, 0.95)",
        borderColor: "rgba(235, 137, 91, 0.35)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
      }}
    >
      <span className="font-semibold text-[#A14646]">{altitude.toLocaleString("id-ID")} m</span>
      <span className="text-[#140f0e]/25">&bull;</span>
      <span className="font-medium text-[#140f0e]/85">
        {Math.abs(view.lat).toFixed(4)}°{view.lat >= 0 ? "LU" : "LS"}{" "}
        {Math.abs(view.lng).toFixed(4)}°{view.lng >= 0 ? "BT" : "BB"}
      </span>
    </div>
  );
};

/** Scale bar for the exposure map: a round distance that spans roughly 70-130 px with North arrow indicator. */
export const ScaleBar: React.FC<{ map: L.Map | null; lang?: "id" | "en" }> = ({ map }) => {
  const view = useMapView(map, false);
  const bar = useMemo(() => {
    if (!view) return null;
    const mpp = (40_075_016.686 * Math.cos((view.lat * Math.PI) / 180)) / (256 * Math.pow(2, view.zoom));
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const km = steps.filter((k) => (k * 1000) / mpp <= 130).pop() ?? 1;
    return { km, px: Math.round((km * 1000) / mpp) };
  }, [view]);
  if (!bar) return null;
  return (
    <div className="flex items-end justify-between gap-3 px-3 py-2 rounded-2xl bg-[#F6F0E2]/95 border border-[#16302A]/20 text-[#140f0e] shadow-xl select-none" aria-hidden="true">
      <div className="flex flex-col items-start gap-1">
        <span className="text-[11px] font-bold tracking-tight font-sans text-[#140f0e]">{bar.km} km</span>
        <span className="block h-[2.5px] bg-[#140f0e] rounded-full" style={{ width: Math.max(28, bar.px) }} />
      </div>
      <div className="flex flex-col items-center leading-none pl-1">
        <svg width="10" height="12" viewBox="-5 -10 10 12" className="drop-shadow-xs">
          <path d="M0 -10L4 2L0 0L-4 2Z" fill="#140f0e" />
        </svg>
        <span className="mt-0.5 font-bold font-sans text-[9px] text-[#140f0e]">U</span>
      </div>
    </div>
  );
};
