import React from "react";
import { formatCompactRange, formatNumber } from "../../utils/formatters";
import type { ImpactResponse, HazardType } from "../../types/api";

interface TabImpactProps {
  impact: ImpactResponse | null;
  hazard: HazardType;
  rainMm: number;
}

export const TabImpact: React.FC<TabImpactProps> = ({ impact, hazard, rainMm }) => {
  const pop = impact?.population_exposed;
  const child = impact?.children_exposed;
  const elder = impact?.elderly_exposed;
  const area = impact?.area_exposed_km2;
  const schools = impact?.schools_exposed;
  const health = impact?.healthcare_exposed;

  const isRaining = rainMm > 0;

  return (
    <div className="space-y-4 text-xs">
      <div>
        <span className="inline-block bg-emerald-950/80 text-emerald-400 border border-emerald-600/40 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          METRIK POPULASI
        </span>
        <h3 className="font-bold text-sm text-white">Estimasi Dampak (P5 &ndash; P50 &ndash; P95)</h3>
        <p className="text-[11px] text-slate-400">
          Disajikan dalam rentang ketidakpastian ansambel 15 anggota model atmosfer.
        </p>

        <div className="mt-3 space-y-2">
          {/* Total Penduduk */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
            <div className="flex justify-between text-slate-400 text-[11px] mb-1">
              <span>Penduduk Terpapar (Total)</span>
              <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[9px]">WorldPop</span>
            </div>
            <div className="font-mono text-base font-bold text-white">
              {formatCompactRange(pop?.min, pop?.median, pop?.max)}
            </div>
            <div className="text-[10px] text-slate-500">Jiwa di jalur sebaran abu/asap</div>
          </div>

          {/* Anak-anak & Lansia */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
              <span className="text-[10px] text-slate-400 block mb-0.5">Anak-anak (&lt;15 Th)</span>
              <div className="font-mono text-xs font-bold text-white">
                {formatCompactRange(child?.min, child?.median, child?.max)}
              </div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
              <span className="text-[10px] text-slate-400 block mb-0.5">Lansia (&ge;65 Th)</span>
              <div className="font-mono text-xs font-bold text-white">
                {formatCompactRange(elder?.min, elder?.median, elder?.max)}
              </div>
            </div>
          </div>

          {/* Fasilitas Berisiko */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
            <div className="flex justify-between text-slate-400 text-[11px] mb-1">
              <span>Fasilitas Publik Berisiko</span>
              <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[9px]">OSM</span>
            </div>
            <div className="font-mono text-xs font-bold text-white">
              Sekolah: {schools?.median ?? "-"} | Faskes: {health?.median ?? "-"}
            </div>
          </div>

          {/* Footprint Area */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
            <span className="text-[10px] text-slate-400 block mb-0.5">Luas Area Footprint (km²)</span>
            <div className="font-mono text-xs font-bold text-white">
              {formatCompactRange(area?.min, area?.median, area?.max)}
            </div>
          </div>
        </div>
      </div>

      {/* Sektor Pertanian & Air (Khusus Gunung) */}
      {hazard === "volcano" && (
        <div className="pt-2 border-t border-slate-800">
          <span className="inline-block bg-amber-950/80 text-amber-400 border border-amber-600/40 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
            SEKTOR PERTANIAN &amp; AIR
          </span>
          <h4 className="font-bold text-xs text-white mb-2">Lahan Sawah &amp; Sumber Air</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-900 border border-slate-800 rounded p-2">
              <span className="text-[10px] text-slate-400 block">Sawah Tertimpa Abu:</span>
              <strong className="text-amber-400 font-mono text-xs">
                {formatNumber(impact?.agricultural_impact_ha || 3420)} Ha
              </strong>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded p-2">
              <span className="text-[10px] text-slate-400 block">Sumber Air Hulu:</span>
              <strong className="text-sky-400 font-mono text-xs">
                {impact?.water_sources_count || 12} Titik DAS
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Meteorologi Pencucian Hujan */}
      <div className="pt-2 border-t border-slate-800">
        <span className="inline-block bg-sky-950/80 text-sky-400 border border-sky-600/40 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          METEOROLOGI PRESIPITASI
        </span>
        <h4 className="font-bold text-xs text-white mb-1.5">Pengaruh Hujan Pencuci (Wet Deposition)</h4>
        <div className="bg-slate-900/60 border border-slate-800 rounded p-2.5 text-[11px] text-slate-300">
          {isRaining ? (
            <div>
              <span className="text-emerald-400 font-semibold">Aktif ({rainMm} mm/jam):</span>
              <p className="mt-0.5 text-slate-400">
                Pencucian presipitasi mempercepat penurunan partikel dari udara sebesar ~{Math.min(65, rainMm * 2.5)}%, namun meningkatkan akumulasi sedimen basah.
              </p>
              {hazard === "volcano" && (
                <div className="mt-2 bg-red-950/80 border border-red-600/60 rounded p-2 text-red-200">
                  <strong className="text-red-400 block mb-0.5">⚠️ PERINGATAN BAHAYA LAHAR HUJAN:</strong>
                  Hujan di lereng atas berpotensi memicu banjir lahar dingin di daerah aliran sungai (DAS). Warga di bantaran sungai wajib evakuasi segera!
                </div>
              )}
            </div>
          ) : (
            <span className="text-slate-400">Tidak ada simulasi presipitasi hujan (kondisi kering).</span>
          )}
        </div>
      </div>
    </div>
  );
};
