/**
 * components/layout/NationalModes.tsx - Panel Mode Peta Nasional:
 * "Histori" (heatmap titik api 7 hari), "Saat ini" (titik api terbaru + aliran angin nasional saat ini),
 * dan "Prediksi" (aliran angin 16 hari dengan lintasan trajektori sebaran asap/abu 72 jam).
 * Diadaptasi langsung dari ITHACKITS/FE-FORGEHACK-2026.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { History, Radio, TrendingUp, CircleOff, RefreshCw } from "lucide-react";
import { api } from "../../services/api";
import { WindLeafletLayer, WIND_SPEED_BINS } from "../../simulation/windLayer";
import { HeatLeafletLayer, HEAT_STOPS } from "../../simulation/heatLayer";
import { CompassInstrument } from "../ui/CompassInstrument";

export type NationalMode = "off" | "history" | "now" | "forecast";
type Level = "10m" | "850hPa";

interface NationalModesProps {
  map: L.Map | null;
  lang?: "id" | "en";
  onModeChange?: (mode: NationalMode) => void;
  windInfo?: {
    cardinal?: string;
    cardinal_from?: string;
    cardinal_to?: string;
    speed_ms: number;
    speed_kmh: number;
    direction_deg: number;
    bearing_motion_deg: number;
  } | null;
  currentHour?: number;
}

const FORECAST_HOURS = 72; // Batasi prediksi sampai 72 jam (3 hari)
const NOW_WIND_HOURS = 24;
const HISTORY_DAYS = 7;
const PATH_COLORS = { fire: "#f97316", volcano: "#c4b5fd" } as const;

function formatWib(iso: string, lang = "id"): string {
  try {
    const d = new Date(iso);
    const s = d.toLocaleString(lang === "id" ? "id-ID" : "en-GB", {
      timeZone: "Asia/Jakarta",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
    return `${s} WIB`;
  } catch {
    return iso;
  }
}

function textNode(text: string): HTMLElement {
  const el = document.createElement("span");
  el.textContent = text;
  return el;
}

function sumDetections(heat: any): number {
  return heat?.cells ? heat.cells.reduce((n: number, c: any) => n + (c.count || 0), 0) : 0;
}

export const NationalModes: React.FC<NationalModesProps> = ({
  map,
  lang = "id",
  onModeChange,
  windInfo,
  currentHour = 0
}) => {
  const id = lang === "id";
  const [mode, setMode] = useState<NationalMode>("off");
  const [level, setLevel] = useState<Level>("10m");
  const [wind, setWind] = useState<any>(null);
  const [paths, setPaths] = useState<any>(null);
  const [heat, setHeat] = useState<any>(null);
  const [timeIdx, setTimeIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const windLayerRef = useRef<WindLeafletLayer | null>(null);
  const heatLayerRef = useRef<HeatLeafletLayer | null>(null);
  const pathsGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;
    windLayerRef.current = new WindLeafletLayer(map);
    heatLayerRef.current = new HeatLeafletLayer(map);
    pathsGroupRef.current = L.layerGroup();
    return () => {
      windLayerRef.current?.destroy();
      heatLayerRef.current?.destroy();
      pathsGroupRef.current?.remove();
      windLayerRef.current = heatLayerRef.current = null;
      pathsGroupRef.current = null;
    };
  }, [map]);

  const startLoading = () => {
    setLoading(true);
    setError(null);
  };

  const changeMode = useCallback((next: NationalMode) => {
    setMode(next);
    setError(null);
    setLoading(next !== "off");
    onModeChange?.(next);
  }, [onModeChange]);

  useEffect(() => {
    if (mode === "off") return;
    let cancelled = false;
    let job: Promise<void>;
    if (mode === "history") {
      job = api.getHeatmap(HISTORY_DAYS).then((h) => {
        if (cancelled) return;
        if (!h.available) throw new Error(h.reason || "heatmap unavailable");
        setHeat(h);
      });
    } else if (mode === "now") {
      job = Promise.all([api.getWind(level, NOW_WIND_HOURS), api.getHeatmap(1).catch(() => null)]).then(([w, h]) => {
        if (cancelled) return;
        if (!w.available) throw new Error(w.reason || "wind unavailable");
        setWind(w);
        setHeat(h?.available ? h : null);
        setTimeIdx(0);
      });
    } else {
      job = Promise.all([api.getWind(level, FORECAST_HOURS), api.getSmokePaths(FORECAST_HOURS)]).then(([w, p]) => {
        if (cancelled) return;
        if (!w.available) throw new Error(w.reason || "wind unavailable");
        setWind(w);
        setPaths(p.available ? p : null);
        setTimeIdx(0);
      });
    }
    job
      .catch((err: Error) => { if (!cancelled) setError(err.message || "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, level, reload]);

  const windOn = (mode === "now" || mode === "forecast") && !!wind?.grid && !error && !loading;
  const heatOn = (mode === "history" || mode === "now") && !!heat && !error && !loading;

  const times = wind?.times ?? [];
  const stepH = wind?.step_hours ?? 3;
  const leadH = timeIdx * stepH;
  const windSourceLine = wind
    ? `${wind.source || "Open-Meteo"} · diunduh ${wind.fetched_at ? formatWib(wind.fetched_at, lang) : "-"}${wind.stale || wind.origin === "snapshot" ? " · data lama" : ""}`
    : "";

  // Layer Aliran Angin Nasional
  useEffect(() => {
    const layer = windLayerRef.current;
    if (!map || !layer) return;
    layer.setField(windOn ? { grid: wind!.grid!, u: wind!.u!, v: wind!.v! } : null);
    layer.setVisible(windOn);
  }, [map, wind, windOn]);

  // Update Waktu Aliran Angin
  useEffect(() => {
    windLayerRef.current?.setTime(timeIdx);
  }, [timeIdx]);

  // Lintasan Sebaran Asap & Abu Dinamis (Sinkron dengan Slider Waktu)
  useEffect(() => {
    const group = pathsGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (windOn && mode === "forecast" && paths) {
      const every = paths.marks_every_h ?? 24;
      const formattedTime = times[timeIdx] ? formatWib(times[timeIdx], lang) : "";

      for (const p of paths.paths || []) {
        const color = PATH_COLORS[p.source_type as keyof typeof PATH_COLORS] || "#c4b5fd";
        if (!p.coords || p.coords.length === 0) continue;

        const maxAvailableH = p.coords.length - 1;
        const currentStep = Math.min(maxAvailableH, leadH);

        // 1. Proyeksi Keseluruhan (Garis Tipis Transparan sebagai Panduan Trajektori Penuh)
        if (p.coords.length > 1) {
          L.polyline(p.coords, {
            color,
            weight: 1.5,
            opacity: 0.25,
            dashArray: "4 6",
            interactive: false
          }).addTo(group);
        }

        // 2. Jalur Aktif yang Telah Ditempuh hingga +leadH jam (Garis Tebal Menonjol)
        if (currentStep >= 1) {
          const activeCoords = p.coords.slice(0, currentStep + 1);
          L.polyline(activeCoords, {
            color,
            weight: 3,
            opacity: 0.95,
            dashArray: "6 4",
            interactive: false
          }).addTo(group);
        }

        // 3. Titik Sumber Awal (Gunung Api atau Pusat Karhutla)
        L.circleMarker(p.coords[0], {
          radius: 5,
          color: "#0f172a",
          weight: 1.5,
          fillColor: color,
          fillOpacity: 1
        })
          .bindTooltip(textNode(`${p.name} (${id ? "Sumber Awal" : "Source"})`), { direction: "top" })
          .addTo(group);

        // 4. Milestone Waktu Terjadwal (+24j, +48j, +72j, dst.)
        for (let h = every; h < p.coords.length; h += every) {
          const isReached = h <= leadH;
          L.circleMarker(p.coords[h], {
            radius: isReached ? 3.5 : 2.5,
            color: isReached ? color : "rgba(255,255,255,0.4)",
            weight: isReached ? 1.5 : 1,
            fillColor: isReached ? "#ffffff" : color,
            fillOpacity: isReached ? 0.95 : 0.35
          })
            .bindTooltip(
              textNode(`${p.name} · +${h} ${id ? "jam" : "h"}${isReached ? (id ? " (Tercapai)" : " (Reached)") : ""}`),
              { direction: "top" }
            )
            .addTo(group);
        }

        // 5. Kepala Sebaran Terdepan (Plume Front) pada Horizon Waktu Terpilih
        if (currentStep > 0) {
          const headPos = p.coords[currentStep];

          // Aura / Halo Luar
          L.circleMarker(headPos, {
            radius: 8,
            color,
            weight: 1.5,
            fillColor: color,
            fillOpacity: 0.3,
            interactive: false
          }).addTo(group);

          // Inti Titik Terdepan
          L.circleMarker(headPos, {
            radius: 4.5,
            color: "#ffffff",
            weight: 2,
            fillColor: color,
            fillOpacity: 1
          })
            .bindTooltip(
              textNode(
                `${p.name} · ${id ? "Posisi Terkini" : "Position"}: +${leadH}${id ? " jam" : "h"} ${formattedTime ? `(${formattedTime})` : ""}`
              ),
              { direction: "top" }
            )
            .addTo(group);
        }
      }
      group.addTo(map);
    } else {
      group.remove();
    }
  }, [map, mode, paths, windOn, timeIdx, leadH, lang, times, id]);

  useEffect(() => {
    const layer = heatLayerRef.current;
    if (!layer) return;
    if (heatOn) layer.setData(heat!.cells || [], heat!.max_frp_sum ?? 1, heat!.cell_deg ?? 0.25);
    layer.setVisible(heatOn);
  }, [heat, heatOn]);

  const modes: [NationalMode, React.ElementType, string][] = [
    ["off", CircleOff, id ? "Mati" : "Off"],
    ["history", History, id ? "Histori" : "History"],
    ["now", Radio, id ? "Saat ini" : "Now"],
    ["forecast", TrendingUp, id ? "Prediksi" : "Forecast"]
  ];

  const levelSwitch = (
    <fieldset
      className="flex rounded-full p-0.5 border self-start shadow-xs"
      style={{
        background: "rgba(0, 0, 0, 0.05)",
        borderColor: "rgba(20, 15, 14, 0.12)"
      }}
    >
      <legend className="sr-only">{id ? "Ketinggian angin" : "Wind level"}</legend>
      {([["10m", id ? "Asap · 10 m" : "Smoke · 10 m"], ["850hPa", id ? "Abu · 1,5 km" : "Ash · 1.5 km"]] as const).map(([value, label]) => (
        <label key={value} className="cursor-pointer">
          <input type="radio" name="wind-level" value={value} checked={level === value} onChange={() => { startLoading(); setLevel(value); }} className="sr-only peer" />
          <span className="block px-2.5 py-1 rounded-full text-[10px] font-bold text-[#140f0e]/75 peer-checked:bg-[#EB895B] peer-checked:text-white transition shadow-xs">
            {label}
          </span>
        </label>
      ))}
    </fieldset>
  );

  const windLegend = (
    <div className="flex items-center gap-1.5 flex-wrap" aria-label={id ? "Legenda kecepatan angin (m/s)" : "Wind speed legend (m/s)"}>
      {WIND_SPEED_BINS.map((b) => (
        <span key={b.label} className="flex items-center gap-1 font-mono text-[10px] text-[#140f0e]">
          <i className="inline-block w-3 h-1.5 rounded-sm" style={{ background: b.color }} />
          {b.label}
        </span>
      ))}
      <span className="text-[#140f0e]/60 text-[10px]">m/s</span>
    </div>
  );

  const heatLegend = (
    <div aria-label={id ? "Legenda intensitas api" : "Fire intensity legend"}>
      <div className="h-2 rounded-full" style={{ background: `linear-gradient(to right, ${HEAT_STOPS.map(([s, c]) => `${c} ${s * 100}%`).join(", ")})` }} />
      <div className="flex justify-between text-[10px] text-[#140f0e]/60 mt-0.5 font-medium">
        <span>{id ? "Rendah" : "Low"}</span>
        <span>{id ? "Daya radiasi api (FRP) tinggi" : "High fire radiative power (FRP)"}</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-end gap-2 max-w-[min(340px,calc(100vw-1rem))] select-none">
      {/* 1. HUD Vektor Angin Simulasi dengan Kompas Presisi Tinggi (Diletakkan di Atas Card History / National Modes) */}
      {windInfo && (
        <div
          className="w-full rounded-2xl p-2.5 sm:p-3 shadow-2xl backdrop-blur-xl border flex items-center gap-3 transition-all duration-300"
          style={{
            background: "rgba(245, 239, 227, 0.98)",
            borderColor: "rgba(235, 137, 91, 0.4)",
            color: "#140f0e",
            boxShadow: "0 10px 25px -4px rgba(0,0,0,0.15)"
          }}
        >
          {/* Kompas Presisi Tinggi */}
          <CompassInstrument bearingDeg={windInfo.bearing_motion_deg} size={46} />

          {/* Info Detail Arah & Kecepatan Angin */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[9px] font-extrabold tracking-wider uppercase text-[#A14646] px-1.5 py-0.5 rounded bg-[#EB895B]/15 border border-[#EB895B]/35">
                Angin rata-rata ensemble di sumber · H+{String(currentHour ?? 0).padStart(2, "0")}
              </span>
            </div>
            <div className="text-[11.5px] font-semibold text-[#140f0e] flex items-center gap-1.5 flex-wrap">
              <span className="text-[#140f0e]/75 text-[11px]">Dari {windInfo.cardinal_from}</span>
              <span className="text-[#EB895B] font-bold">→</span>
              <span className="text-[#140f0e] font-extrabold">Ke {windInfo.cardinal_to || windInfo.cardinal}</span>
              <span className="text-[#0284c7] font-mono text-[10.5px] font-bold">
                ({Math.round(windInfo.bearing_motion_deg)}°)
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#140f0e]/70 flex items-center gap-2 mt-0.5 font-medium">
              <span>{windInfo.speed_ms} m/s</span>
              <span className="text-[#140f0e]/30">•</span>
              <span>{windInfo.speed_kmh} km/j</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Card Info Mode Nasional (Histori Titik Api / Saat ini / Prediksi) */}
      {mode !== "off" && (
        <section
          className="w-full rounded-2xl p-3 backdrop-blur-xl border shadow-2xl text-[11px] leading-snug"
          style={{
            background: "rgba(245, 239, 227, 0.98)",
            borderColor: "rgba(235, 137, 91, 0.4)",
            color: "#140f0e",
            boxShadow: "0 10px 25px -4px rgba(0,0,0,0.15)"
          }}
          aria-label={id ? "Data seluruh Indonesia" : "Data across Indonesia"}
        >
          {loading && <p role="status" className="text-[#140f0e]/80">{id ? "Memuat data cuaca & sebaran…" : "Loading data…"}</p>}

          {error && (
            <div role="alert" className="flex items-center gap-2 text-amber-700">
              <span className="font-bold uppercase tracking-wide text-[9px] px-1.5 py-0.5 rounded border border-amber-500/60 bg-amber-500/10">
                {id ? "Data tidak tersedia" : "Data unavailable"}
              </span>
              <button
                type="button"
                onClick={() => { startLoading(); setReload((n) => n + 1); }}
                className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full hover:bg-black/5 cursor-pointer text-[#140f0e]"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" /> {id ? "Coba lagi" : "Retry"}
              </button>
            </div>
          )}

          {!loading && !error && mode === "history" && heat && (
            <div className="flex flex-col gap-2">
              <strong className="text-[#140f0e] font-bold">{id ? "Histori titik api, 7 hari terakhir" : "Fire history, last 7 days"}</strong>
              {heatLegend}
              <p className="text-[#140f0e]/80">
                {sumDetections(heat).toLocaleString(id ? "id-ID" : "en-US")} {id ? "deteksi satelit di" : "satellite detections in"} {(heat.cells || []).length} {id ? "sel 0,25°" : "0.25° cells"}
                {heat.window_start && heat.as_of ? `, ${formatWib(heat.window_start, lang)} – ${formatWib(heat.as_of, lang)}` : ""}.
              </p>
              <p className="text-[#140f0e]/60 text-[10px]">
                NASA FIRMS (VIIRS & MODIS) · {id ? "diunduh" : "fetched"} {heat.fetched_at ? formatWib(heat.fetched_at, lang) : "-"}{heat.stale ? (id ? " · data lama" : " · stale") : ""}
              </p>
            </div>
          )}

          {!loading && !error && mode === "now" && wind && times.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-[#140f0e] font-bold">{id ? "Kondisi saat ini" : "Right now"}</strong>
                <span className="font-mono text-[10px] text-[#A14646] font-bold">{formatWib(times[0], lang)}</span>
              </div>
              {levelSwitch}
              {windLegend}
              {heat ? (
                <>
                  {heatLegend}
                  <p className="text-[#140f0e]/80">
                    {sumDetections(heat).toLocaleString(id ? "id-ID" : "en-US")} {id ? "titik api terdeteksi dalam 24 jam terakhir" : "fire detections in the last 24 h"}
                    {heat.as_of ? ` (${id ? "terbaru" : "latest"} ${formatWib(heat.as_of, lang)})` : ""}.
                  </p>
                </>
              ) : (
                <p className="text-amber-700">{id ? "Data titik api terbaru belum tersedia." : "Latest fire detections are not available."}</p>
              )}
              <p className="text-[#140f0e]/60 text-[10px]">{windSourceLine}</p>
            </div>
          )}

          {!loading && !error && mode === "forecast" && wind && times.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-[#140f0e] font-bold">{id ? "Prediksi angin & sebaran asap" : "Wind & smoke forecast"}</strong>
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-emerald-500/60 text-emerald-800 bg-emerald-500/10">
                  {id ? "Prakiraan (72 Jam)" : "Forecast (72h)"}
                </span>
              </div>

              {levelSwitch}

              <label className="flex flex-col gap-1">
                <span className="flex justify-between gap-2 font-mono text-[10px]">
                  <span className="font-bold text-[#140f0e]">{formatWib(times[timeIdx], lang)}</span>
                  <span className="text-[#140f0e]/60">+{leadH} {id ? "jam" : "h"}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={times.length - 1}
                  step={1}
                  value={timeIdx}
                  onChange={(e) => setTimeIdx(Number(e.target.value))}
                  className="w-full accent-[#EB895B]"
                />
              </label>

              {windLegend}

              {paths && (
                <div className="flex flex-col gap-1 text-[10px] text-[#140f0e]/80">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: PATH_COLORS.fire }} />{id ? "Asap kebakaran" : "Fire smoke"}</span>
                    <span className="flex items-center gap-1"><i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: PATH_COLORS.volcano }} />{id ? "Abu gunung api" : "Volcanic ash"}</span>
                    <span className="text-[#140f0e]/60">● {id ? "Penanda tiap 24 jam" : "24h milestones"}</span>
                  </div>
                </div>
              )}

              <p className="text-[#140f0e]/60 text-[10px]">{windSourceLine}</p>
              <p className="text-[#140f0e]/75 text-[10.5px]">
                {id
                  ? `Lintasan dari klaster api aktif 24 jam terakhir dan gunung api Level II ke atas (MAGMA), dengan asumsi emisi terus berlangsung. Garis tebal & titik kepala bergerak: posisi trajektori sebaran asap/abu pada +${leadH} jam (${times[timeIdx] ? formatWib(times[timeIdx], lang) : ""}). Garis tipis: lintasan proyeksi ke depan.`
                  : `Bold line & moving plume head: smoke/ash drift at +${leadH} h (${times[timeIdx] ? formatWib(times[timeIdx], lang) : ""}). Faint line: future projected trajectory.`}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Selector Mode Nasional */}
      <fieldset
        className="flex rounded-full p-1 backdrop-blur-xl border shadow-2xl"
        style={{
          background: "rgba(245, 239, 227, 0.98)",
          borderColor: "rgba(235, 137, 91, 0.4)",
          boxShadow: "0 8px 20px -3px rgba(0,0,0,0.15)"
        }}
      >
        <legend className="sr-only">{id ? "Kerangka waktu data nasional" : "Data time frame"}</legend>
        {modes.map(([value, Icon, label]) => (
          <label key={value} className="cursor-pointer" title={label}>
            <input type="radio" name="national-mode" value={value} checked={mode === value} onChange={() => changeMode(value)} className="sr-only peer" />
            <span className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] font-bold text-[#140f0e]/75 hover:bg-black/5 hover:text-[#140f0e] peer-checked:bg-[#EB895B] peer-checked:text-white peer-checked:shadow-md transition">
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span className={value === "off" ? "sr-only sm:not-sr-only" : ""}>{label}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
};

export default NationalModes;
