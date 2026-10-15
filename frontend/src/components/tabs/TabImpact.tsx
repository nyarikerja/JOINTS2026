import React, { useState, useEffect } from "react";
import { AlertOctagon } from "lucide-react";
import { 
  ChartLineUp, 
  MapPin, 
  ShieldCheck, 
  CloudRain, 
  Flame, 
  ShieldWarning 
} from "@phosphor-icons/react";
import { formatCompactRange } from "../../utils/formatters";
import type { 
  ImpactResponse, 
  HazardType, 
  LaharWarningResponse, 
  RainEffectResponse 
} from "../../types/api";
import { api } from "../../services/api";

interface TabImpactProps {
  impact: ImpactResponse | null;
  hazard: HazardType;
  rainMm: number;
  currentHour?: number;
  onOpenLegend?: () => void;
  simulatedEventName?: string;
  activeRunId?: string | null;
  onHourChange?: (h: number) => void;
}

const ISPU_CONFIG: Record<string, { label: string; cls: string }> = {
  baik: { label: "Baik", cls: "bg-emerald-500/15 text-emerald-800 border-emerald-500/30" },
  sedang: { label: "Sedang", cls: "bg-sky-500/15 text-sky-800 border-sky-500/30" },
  tidak_sehat: { label: "Tidak Sehat", cls: "bg-amber-500/20 text-amber-900 border-amber-500/40" },
  sangat_tidak_sehat: { label: "Sangat Tidak Sehat", cls: "bg-red-500/15 text-red-800 border-red-500/30" },
  berbahaya: { label: "Berbahaya", cls: "bg-purple-500/15 text-purple-900 border-purple-500/30" }
};

const IspuBadge: React.FC<{ cat?: string | null }> = ({ cat }) => {
  if (!cat) return <span className="text-[10px] text-[#2b211e]/50">-</span>;
  const key = cat.toLowerCase().replace(/\s+/g, "_");
  const c = ISPU_CONFIG[key] || { label: cat.toUpperCase(), cls: "bg-slate-100 text-slate-700 border-slate-300" };
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase inline-block max-w-full truncate text-center tracking-wider leading-tight ${c.cls}`}>
      {c.label}
    </span>
  );
};

export const TabImpact: React.FC<TabImpactProps> = ({
  impact,
  hazard,
  rainMm: _rainMm,
  currentHour = 12,
  onOpenLegend: _onOpenLegend,
  simulatedEventName,
  activeRunId,
  onHourChange
}) => {
  const [airQualityData, setAirQualityData] = useState<any>(null);
  const [laharData, setLaharData] = useState<LaharWarningResponse | null>(null);
  const [rainEffectData, setRainEffectData] = useState<RainEffectResponse | null>(null);

  useEffect(() => {
    if (!activeRunId) {
      setAirQualityData(null);
      setLaharData(null);
      setRainEffectData(null);
      return;
    }

    api.getRunAirQuality(activeRunId).then(setAirQualityData).catch(() => setAirQualityData(null));

    if (hazard === "volcano") {
      api.getLaharWarning(activeRunId).then(setLaharData).catch(() => setLaharData(null));
    } else {
      setLaharData(null);
    }

    api.getRainEffect(activeRunId).then(setRainEffectData).catch(() => setRainEffectData(null));
  }, [activeRunId, hazard]);

  // Ambil metrik dinamis jam aktif dari backend (hourly_series) atau fallback ke akumulasi
  const cur: any = (impact?.hourly_series && (impact.hourly_series[String(currentHour)] || impact.hourly_series[currentHour])) || impact;

  const pop = cur?.population_exposed;
  const child = cur?.children_exposed;
  const elder = cur?.elderly_exposed;
  const area = cur?.area_exposed_km2;
  const schools = cur?.schools_exposed;
  const health = cur?.healthcare_exposed;

  const cleanEventName = simulatedEventName
    ? simulatedEventName.replace(/^(Kejadian Observasi|Skenario Hipotetis|Simulasi)(\s*[:-]\s*)?/i, "")
    : "";

  // Sample 17 jam interval untuk grafik batang proyeksi tren paparan
  const sampleHours = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48];
  const maxPopInSeries = Math.max(
    ...sampleHours.map((h) => {
      const item = impact?.hourly_series?.[String(h)] || impact?.hourly_series?.[h];
      return item?.population_exposed?.median || 0;
    }),
    1
  );

  return (
    <div className="space-y-3.5 text-xs text-[#2b211e]">
      {/* 1. Metrik Populasi & Wilayah */}
      <div>
        <div className="flex items-start justify-between mb-1">
          <div className="flex flex-col">
            <h3 className="font-sans text-[12px] font-bold uppercase tracking-wider text-[#2b211e] line-clamp-2 max-w-[210px] leading-tight break-words" title={simulatedEventName || "METRIK POPULASI"}>
              {cleanEventName || "METRIK POPULASI"}
            </h3>
            {simulatedEventName && (
              <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#A14646] mt-0.5">
                METRIK POPULASI
              </span>
            )}
          </div>
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-800 border border-sky-400/30 font-semibold mt-0.5">
            Jam T+{currentHour < 10 ? `0${currentHour}` : currentHour}:00
          </span>
        </div>

        {/* Kotak Panduan Format P5 / P50 / P95 & Keterangan Legenda */}
        <div className="mt-2 p-2.5 rounded-lg bg-white/80 border border-[#2b211e]/15 text-[#2b211e] space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-bold text-[#A14646] uppercase tracking-wide">
              Format Pembacaan Angka:
            </span>
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#f7f3ed] text-[#2b211e] border border-[#2b211e]/15 font-semibold">
              Min / Median / Maks
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center pt-0.5">
            <div className="bg-[#f7f3ed] p-1.5 rounded border border-[#2b211e]/10">
              <span className="font-bold text-[#2a8485] block text-[10px]">P5 (Minimal)</span>
              <span className="text-[9px] text-[#2b211e]/65 leading-tight block">Risiko Terendah</span>
            </div>
            <div className="bg-[#EB895B]/15 p-1.5 rounded border border-[#EB895B]/40 shadow-xs">
              <span className="font-bold text-[#A14646] block text-[10px]">P50 (Median)</span>
              <span className="text-[9px] text-[#A14646]/85 font-semibold leading-tight block">Paling Mungkin</span>
            </div>
            <div className="bg-[#f7f3ed] p-1.5 rounded border border-[#2b211e]/10">
              <span className="font-bold text-[#DA6556] block text-[10px]">P95 (Maksimal)</span>
              <span className="text-[9px] text-[#2b211e]/65 leading-tight block">Skenario Terburuk</span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-[#2b211e]/10 flex items-center justify-between text-[10px] text-[#2b211e]/75">
            <span className="leading-tight">
              Catatan: Penjelasan lengkap terkait P5, P50, dan P95 tersedia di menu <strong>Legenda</strong> pada bilah atas.
            </span>
          </div>
        </div>

        <div className="mt-2.5 space-y-2">
          {/* Total Penduduk */}
          <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs relative group cursor-help">
            <div className="flex justify-between text-[#2b211e]/65 text-[11px] mb-1">
              <span>Penduduk Terpapar (Jiwa)</span>
              <span className="bg-[#f7f3ed] text-[#2b211e] px-1.5 py-0.5 rounded text-[9px] font-medium border border-[#2b211e]/10">WorldPop</span>
            </div>
            <div className="font-sans text-base font-bold text-[#2b211e]">
              {formatCompactRange(pop?.min, pop?.median, pop?.max)}
            </div>
            <div className="text-[10px] text-[#2b211e]/50">Jiwa di jalur sebaran abu/asap atmosferik</div>
            <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block w-48 bg-[#2b211e] text-[#f7f3ed] text-[9px] p-2 rounded shadow-lg text-left z-10 pointer-events-none">
              Total populasi penduduk yang diproyeksikan terdampak, berdasarkan estimasi demografi spasial WorldPop.
            </div>
          </div>

          {/* Anak-anak & Lansia */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs relative group cursor-help">
              <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Anak-anak (&lt;15 Th)</span>
              <div className="font-sans text-xs font-bold text-[#2b211e]">
                {formatCompactRange(child?.min, child?.median, child?.max)}
              </div>
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-36 bg-[#2b211e] text-[#f7f3ed] text-[9px] p-2 rounded shadow-lg text-left z-10 pointer-events-none">
                Jumlah penduduk rentan usia di bawah 15 tahun (balita &amp; anak-anak).
              </div>
            </div>
            <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs relative group cursor-help">
              <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Lansia (&ge;65 Th)</span>
              <div className="font-sans text-xs font-bold text-[#2b211e]">
                {formatCompactRange(elder?.min, elder?.median, elder?.max)}
              </div>
              <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block w-36 bg-[#2b211e] text-[#f7f3ed] text-[9px] p-2 rounded shadow-lg text-left z-10 pointer-events-none">
                Jumlah penduduk rentan lanjut usia 65 tahun ke atas.
              </div>
            </div>
          </div>

          {/* Fasilitas Publik Berisiko */}
          <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs">
            <div className="flex justify-between text-[#2b211e]/65 text-[11px] mb-2">
              <span>Fasilitas Publik Berisiko</span>
              <span className="bg-[#f7f3ed] text-[#2b211e] px-1.5 py-0.5 rounded text-[9px] font-medium border border-[#2b211e]/10">OSM</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#f7f3ed]/50 p-2 rounded border border-[#2b211e]/5 relative group cursor-help">
                <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Sekolah</span>
                <div className="font-sans text-xs font-bold text-[#2b211e]">
                  {schools ? formatCompactRange(schools.min, schools.median, schools.max) : "-"}
                </div>
                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-36 bg-[#2b211e] text-[#f7f3ed] text-[9px] p-2 rounded shadow-lg text-left z-10 pointer-events-none">
                  Jumlah fasilitas pendidikan (TK, SD, SMP, SMA, Kampus) dalam radius bahaya.
                </div>
              </div>
              <div className="bg-[#f7f3ed]/50 p-2 rounded border border-[#2b211e]/5 relative group cursor-help">
                <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Fasilitas Kesehatan</span>
                <div className="font-sans text-xs font-bold text-[#2b211e]">
                  {health ? formatCompactRange(health.min, health.median, health.max) : "-"}
                </div>
                <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block w-36 bg-[#2b211e] text-[#f7f3ed] text-[9px] p-2 rounded shadow-lg text-left z-10 pointer-events-none">
                  Jumlah rumah sakit, puskesmas, klinik, dan apotek dalam radius bahaya.
                </div>
              </div>
            </div>
            <div className="text-[10px] text-[#2b211e]/50 mt-2">Fasilitas publik dalam zona bahaya aktif</div>
          </div>

          {/* Luas Footprint */}
          <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs relative group cursor-help">
            <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">
              Luas Area Footprint (km<sup className="text-[8px] font-semibold">2</sup>)
            </span>
            <div className="font-sans text-xs font-bold text-[#2b211e]">
              {formatCompactRange(area?.min, area?.median, area?.max)}
            </div>
            <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block w-40 bg-[#2b211e] text-[#f7f3ed] text-[9px] p-2 rounded shadow-lg text-left z-10 pointer-events-none">
              Total estimasi luasan wilayah yang tercakup dalam area dampak material.
            </div>
          </div>

          {/* ======================================================== */}
          {/* CARD 0: GRAFIK PROYEKSI TREN PAPARAN 48 JAM (CHART)      */}
          {/* ======================================================== */}
          {impact?.hourly_series && (
            <div className="bg-white border border-[#2b211e]/15 rounded-xl p-3 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ChartLineUp size={16} weight="duotone" className="text-[#EB895B]" />
                  <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#2b211e]">
                    Grafik Tren Paparan (H+0 s/d H+48)
                  </span>
                </div>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#f7f3ed] text-[#2b211e]/80 border border-[#2b211e]/10 font-bold">
                  P50 Median
                </span>
              </div>

              <div className="text-[10px] text-[#2b211e]/70 flex justify-between items-baseline">
                <span>Laju akumulasi penduduk di jalur dispersi:</span>
                <span className="font-mono font-bold text-[#A14646]">
                  {formatCompactRange(cur?.population_exposed?.min, cur?.population_exposed?.median, cur?.population_exposed?.max)} Jiwa
                </span>
              </div>

              {/* Line Chart Container */}
              <div className="pt-1.5">
                {(() => {
                  const svgWidth = 320;
                  const svgHeight = 70;
                  const padX = 14;
                  const padYTop = 8;
                  const padYBottom = 18;
                  const chartW = svgWidth - padX * 2;
                  const chartH = svgHeight - padYTop - padYBottom;

                  const points = sampleHours.map((h) => {
                    const item = impact.hourly_series?.[String(h)] || impact.hourly_series?.[h];
                    const pop = item?.population_exposed?.median || 0;
                    const x = padX + (h / 48) * chartW;
                    const y = padYTop + chartH - (pop / maxPopInSeries) * chartH;
                    return { h, pop, x, y };
                  });

                  let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
                  for (let i = 1; i < points.length; i++) {
                    const prev = points[i - 1];
                    const curr = points[i];
                    const cp1x = (prev.x + (curr.x - prev.x) / 2).toFixed(1);
                    const cp2x = cp1x;
                    linePath += ` C ${cp1x} ${prev.y.toFixed(1)}, ${cp2x} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
                  }

                  const lastPt = points[points.length - 1];
                  const firstPt = points[0];
                  const baseY = (padYTop + chartH).toFixed(1);
                  const areaPath = `${linePath} L ${lastPt.x.toFixed(1)} ${baseY} L ${firstPt.x.toFixed(1)} ${baseY} Z`;

                  const clampedCurHour = Math.max(0, Math.min(48, currentHour));
                  const curPt = points.reduce((prev, curr) => 
                    Math.abs(curr.h - clampedCurHour) < Math.abs(prev.h - clampedCurHour) ? curr : prev
                  );
                  const curX = (padX + (clampedCurHour / 48) * chartW).toFixed(1);
                  const curY = curPt.y;

                  return (
                    <div className="relative w-full bg-[#f7f3ed]/70 rounded-lg border border-[#2b211e]/10 p-2">
                      <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="w-full h-24 overflow-visible select-none"
                      >
                        <defs>
                          <linearGradient id="popAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#EB895B" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#EB895B" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>

                        {/* Garis Grid Horizontal */}
                        <line x1={padX} y1={padYTop} x2={padX + chartW} y2={padYTop} stroke="rgba(43, 33, 30, 0.08)" strokeDasharray="3 3" />
                        <line x1={padX} y1={padYTop + chartH / 2} x2={padX + chartW} y2={padYTop + chartH / 2} stroke="rgba(43, 33, 30, 0.08)" strokeDasharray="3 3" />
                        <line x1={padX} y1={padYTop + chartH} x2={padX + chartW} y2={padYTop + chartH} stroke="rgba(43, 33, 30, 0.15)" />

                        {/* Area Gradient Fill */}
                        <path d={areaPath} fill="url(#popAreaGrad)" />

                        {/* Line Chart Curve */}
                        <path
                          d={linePath}
                          fill="none"
                          stroke="#EB895B"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Titik Sampel Data (Setiap 6 Jam) */}
                        {points
                          .filter((p) => p.h % 6 === 0)
                          .map((p) => (
                            <circle
                              key={p.h}
                              cx={p.x}
                              cy={p.y}
                              r="2.5"
                              fill="#2a8485"
                              stroke="#ffffff"
                              strokeWidth="1.2"
                            />
                          ))}

                        {/* Garis & Titik Penunjuk Jam Aktif */}
                        <line
                          x1={curX}
                          y1={padYTop - 2}
                          x2={curX}
                          y2={padYTop + chartH}
                          stroke="#DA6556"
                          strokeWidth="1.8"
                          strokeDasharray="3 2"
                        />
                        <circle
                          cx={curX}
                          cy={curY}
                          r="4"
                          fill="#DA6556"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />

                        {/* Label Sumbu X Konsisten: H+0, H+12, H+24, H+36, H+48 */}
                        {[0, 12, 24, 36, 48].map((h) => {
                          const x = padX + (h / 48) * chartW;
                          const isMatch = Math.abs(currentHour - h) <= 3;
                          return (
                            <g key={h}>
                              <line
                                x1={x}
                                y1={padYTop + chartH}
                                x2={x}
                                y2={padYTop + chartH + 3}
                                stroke="rgba(43, 33, 30, 0.3)"
                              />
                              <text
                                x={x}
                                y={svgHeight - 2}
                                textAnchor="middle"
                                fontSize="8"
                                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                                fill={isMatch ? "#DA6556" : "rgba(43, 33, 30, 0.65)"}
                                fontWeight={isMatch ? "bold" : "normal"}
                              >
                                H+{h}
                              </text>
                            </g>
                          );
                        })}

                        {/* Click target interaktif per horizon jam */}
                        {points.map((p) => (
                          <rect
                            key={p.h}
                            x={p.x - chartW / (sampleHours.length * 2)}
                            y={0}
                            width={chartW / sampleHours.length}
                            height={svgHeight}
                            fill="transparent"
                            className="cursor-pointer"
                            onClick={() => onHourChange?.(p.h)}
                          >
                            <title>{`Horizon H+${p.h}:00 - ${p.pop.toLocaleString("id-ID")} jiwa (Klik untuk lompat jam)`}</title>
                          </rect>
                        ))}
                      </svg>
                    </div>
                  );
                })()}

                <div className="flex justify-between items-center text-[9px] text-[#2b211e]/55 mt-1 px-0.5">
                  <span className="font-mono">H+00 (Awal)</span>
                  <span className="text-[8px] italic text-[#2b211e]/60">Klik garis untuk melompat jam</span>
                  <span className="font-mono">H+48 (Penuh)</span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CARD 1: KUALITAS UDARA (ISPU PM2.5) - INFOGRAFIS SIMPLE   */}
          {/* ======================================================== */}
          {airQualityData?.available && (
            <div className="bg-white border border-[#2b211e]/15 rounded-xl p-3 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#2b211e]">
                  Kualitas Udara (ISPU PM2.5)
                </span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#f7f3ed] text-[#2b211e]/70 border border-[#2b211e]/10">
                  Episentrum Sumber
                </span>
              </div>

              {/* 2 Infographic Stat Tiles */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#f7f3ed] p-2.5 rounded-lg border border-[#2b211e]/10 flex flex-col justify-between gap-1.5 min-w-0">
                  <span className="text-[9px] text-[#2b211e]/60 font-semibold block uppercase tracking-wider truncate">
                    24 Jam Terakhir
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-base font-bold text-[#2b211e]">
                      {airQualityData.center?.pm25_24h_now != null ? airQualityData.center.pm25_24h_now : "-"}
                    </span>
                    <span className="text-[9px] text-[#2b211e]/60">
                      µg/m<sup className="text-[7px]">3</sup>
                    </span>
                  </div>
                  <div className="pt-0.5">
                    <IspuBadge cat={airQualityData.center?.ispu_now} />
                  </div>
                </div>

                <div className="bg-[#f7f3ed] p-2.5 rounded-lg border border-[#2b211e]/10 flex flex-col justify-between gap-1.5 min-w-0">
                  <span className="text-[9px] text-[#2b211e]/60 font-semibold block uppercase tracking-wider truncate">
                    Terburuk 48 Jam
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-base font-bold text-[#2b211e]">
                      {airQualityData.center?.pm25_24h_max_forecast != null ? airQualityData.center.pm25_24h_max_forecast : "-"}
                    </span>
                    <span className="text-[9px] text-[#2b211e]/60">
                      µg/m<sup className="text-[7px]">3</sup>
                    </span>
                  </div>
                  <div className="pt-0.5">
                    <IspuBadge cat={airQualityData.center?.ispu_max_forecast} />
                  </div>
                </div>
              </div>

              {/* Infographic Micro Footer: Source tags & nearest station */}
              <div className="flex items-center justify-between pt-1 border-t border-[#2b211e]/10 text-[9px] text-[#2b211e]/60">
                <span className="truncate">Copernicus CAMS &bull; Stasiun OpenAQ</span>
                {airQualityData.stations && airQualityData.stations.length > 0 && (
                  <span className="shrink-0 font-medium text-[#2a8485]">
                    {airQualityData.stations[0].name} ({airQualityData.stations[0].distance_km} km)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CARD 2: POTENSI LAHAR HUJAN - INFOGRAFIS SIMPLE          */}
          {/* ======================================================== */}
          {hazard === "volcano" && laharData?.available && laharData.lahar_risk_level !== "none" && (
            <div className="bg-white border border-[#DA6556]/30 rounded-xl p-3 shadow-xs space-y-2.5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-[#DA6556]" />
                  <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#DA6556]">
                    POTENSI LAHAR HUJAN
                  </span>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider font-mono ${
                  laharData.lahar_risk_level === "tinggi"
                    ? "bg-red-500/15 text-red-800 border-red-500/30"
                    : laharData.lahar_risk_level === "waspada"
                    ? "bg-amber-500/15 text-amber-800 border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-800 border-emerald-500/30"
                }`}>
                  {laharData.lahar_risk_level}
                </span>
              </div>

              {/* 2 Infographic Stat Tiles */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#f7f3ed] p-2 rounded-lg border border-[#2b211e]/10 space-y-1">
                  <span className="text-[9px] text-[#2b211e]/60 font-semibold block uppercase tracking-wider">
                    Hujan Maks 48 Jam
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-base font-bold text-[#2b211e]">
                      {laharData.forecast_precip_max_mm_h?.median ?? 0}
                    </span>
                    <span className="text-[9px] text-[#2b211e]/60">mm/jam</span>
                  </div>
                  <div className="text-[9px] text-[#2b211e]/60 truncate">
                    Rentang: {laharData.forecast_precip_max_mm_h?.min ?? 0} – {laharData.forecast_precip_max_mm_h?.max ?? 0} mm/j
                  </div>
                </div>

                <div className="bg-[#f7f3ed] p-2 rounded-lg border border-[#2b211e]/10 space-y-1">
                  <span className="text-[9px] text-[#2b211e]/60 font-semibold block uppercase tracking-wider truncate">
                    Peluang Picu (&ge;{laharData.rainfall_threshold_trigger_mm_h || 20} mm/j)
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-base font-bold text-[#DA6556]">
                      {Math.round((laharData.prob_rain_above_trigger || 0) * 100)}%
                    </span>
                  </div>
                  <div className="text-[9px] text-[#2b211e]/60 truncate">
                    Ambang Lahar Dingin
                  </div>
                </div>
              </div>

              {/* Infographic Visual Gauge Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] text-[#2b211e]/70 font-medium">
                  <span>Probabilitas Pemicu Lahar</span>
                  <span className="font-mono font-bold text-[#DA6556]">
                    {Math.round((laharData.prob_rain_above_trigger || 0) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#2b211e]/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(6, Math.min(100, (laharData.prob_rain_above_trigger || 0) * 100))}%`,
                      background: (laharData.prob_rain_above_trigger || 0) >= 0.5 
                        ? "#ef4444" 
                        : (laharData.prob_rain_above_trigger || 0) >= 0.2 
                        ? "#f59e0b" 
                        : "#10b981"
                    }}
                  />
                </div>
              </div>

              {/* Infographic Quick Chips (No paragraphs!) */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#2b211e]/10 text-[9px]">
                <div className="bg-[#f7f3ed] px-2 py-1 rounded text-[#2b211e]/75 border border-[#2b211e]/5 truncate flex items-center gap-1.5">
                  <MapPin size={12} weight="duotone" className="text-[#EB895B] shrink-0" />
                  <span className="truncate">{cleanEventName || "Puncak Gunung"}</span>
                </div>
                <div className="bg-[#f7f3ed] px-2 py-1 rounded text-[#2b211e]/75 border border-[#2b211e]/5 truncate flex items-center gap-1.5">
                  <ShieldCheck size={12} weight="duotone" className="text-[#2a8485] shrink-0" />
                  <span className="truncate">Rujukan: PVMBG &amp; BPBD</span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CARD 3: EFEK PENCUCIAN HUJAN - INFOGRAFIS SIMPLE         */}
          {/* ======================================================== */}
          {rainEffectData?.available && (
            <div className="bg-white border border-[#2b211e]/15 rounded-xl p-3 shadow-xs space-y-2.5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#2b211e]">
                  EFEK PENCUCIAN HUJAN
                </span>
                {rainEffectData.scavenged_mass_pct && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
                    {rainEffectData.scavenged_mass_pct.median}% massa tercuci
                  </span>
                )}
              </div>

              {/* 2 Infographic Stat Tiles */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#f7f3ed] p-2 rounded-lg border border-[#2b211e]/10 space-y-1">
                  <span className="text-[9px] text-[#2b211e]/60 font-semibold block uppercase tracking-wider">
                    Massa Tercuci
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-base font-bold text-emerald-700">
                      {rainEffectData.scavenged_mass_pct?.median ?? 0}%
                    </span>
                  </div>
                  <div className="text-[9px] text-[#2b211e]/60 truncate">
                    P5–P95: {rainEffectData.scavenged_mass_pct?.min ?? 0}% – {rainEffectData.scavenged_mass_pct?.max ?? 0}%
                  </div>
                </div>

                <div className="bg-[#f7f3ed] p-2 rounded-lg border border-[#2b211e]/10 space-y-1">
                  <span className="text-[9px] text-[#2b211e]/60 font-semibold block uppercase tracking-wider">
                    Hujan Maks Sumber
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-base font-bold text-[#2b211e]">
                      {rainEffectData.precip_max_mm_h?.median ?? 0}
                    </span>
                    <span className="text-[9px] text-[#2b211e]/60">mm/jam</span>
                  </div>
                  <div className="text-[9px] text-[#2b211e]/60 truncate">
                    Rentang: {rainEffectData.precip_max_mm_h?.min ?? 0} – {rainEffectData.precip_max_mm_h?.max ?? 0} mm/j
                  </div>
                </div>
              </div>

              {/* Infographic Visual Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] text-[#2b211e]/70 font-medium">
                  <span>Pembersihan Partikel Atmosferik</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {rainEffectData.scavenged_mass_pct?.median ?? 0}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#2b211e]/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-[#2a8485] transition-all duration-500"
                    style={{
                      width: `${Math.max(5, Math.min(100, rainEffectData.scavenged_mass_pct?.median ?? 0))}%`
                    }}
                  />
                </div>
              </div>

              {/* Infographic Action/Impact Chips (No paragraphs!) */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#2b211e]/10 text-[9px]">
                {hazard === "volcano" ? (
                  <>
                    <div className="bg-emerald-500/10 px-2 py-1 rounded text-emerald-800 border border-emerald-500/20 truncate flex items-center gap-1.5">
                      <CloudRain size={13} weight="duotone" className="text-emerald-700 shrink-0" />
                      <span className="truncate">Abu Jatuh Dekat Kawah</span>
                    </div>
                    <div className="bg-amber-500/10 px-2 py-1 rounded text-amber-900 border border-amber-500/20 truncate flex items-center gap-1.5">
                      <ShieldWarning size={13} weight="duotone" className="text-amber-700 shrink-0" />
                      <span className="truncate">Waspada Beban Atap</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-emerald-500/10 px-2 py-1 rounded text-emerald-800 border border-emerald-500/20 truncate flex items-center gap-1.5">
                      <CloudRain size={13} weight="duotone" className="text-emerald-700 shrink-0" />
                      <span className="truncate">Asap Udara Berkurang</span>
                    </div>
                    <div className="bg-amber-500/10 px-2 py-1 rounded text-amber-900 border border-amber-500/20 truncate flex items-center gap-1.5">
                      <Flame size={13} weight="duotone" className="text-amber-700 shrink-0" />
                      <span className="truncate">Api Gambut Tetap Aktif</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


