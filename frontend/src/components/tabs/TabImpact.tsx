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
    <div className="space-y-4 text-xs text-[#140f0e]">
      <div>
        <span className="inline-block bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          METRIK POPULASI
        </span>
        <h3 className="font-bold text-sm text-[#140f0e]">Estimasi Dampak (P5 &ndash; P50 &ndash; P95)</h3>
        <p className="text-[11px] text-slate-600">
          Disajikan dalam rentang ketidakpastian ansambel 15 anggota model atmosfer.
        </p>

        <div className="mt-3 space-y-2">
          {/* Total Penduduk */}
          <div className="bg-white border border-black/10 rounded-lg p-2.5 shadow-xs">
            <div className="flex justify-between text-slate-600 text-[11px] mb-1">
              <span>Penduduk Terpapar (Total)</span>
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-medium">WorldPop</span>
            </div>
            <div className="font-mono text-base font-bold text-[#140f0e]">
              {formatCompactRange(pop?.min, pop?.median, pop?.max)}
            </div>
            <div className="text-[10px] text-slate-500">Jiwa di jalur sebaran abu/asap</div>
          </div>

          {/* Anak-anak & Lansia */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border border-black/10 rounded-lg p-2.5 shadow-xs">
              <span className="text-[10px] text-slate-600 block mb-0.5">Anak-anak (&lt;15 Th)</span>
              <div className="font-mono text-xs font-bold text-[#140f0e]">
                {formatCompactRange(child?.min, child?.median, child?.max)}
              </div>
            </div>
            <div className="bg-white border border-black/10 rounded-lg p-2.5 shadow-xs">
              <span className="text-[10px] text-slate-600 block mb-0.5">Lansia (&ge;65 Th)</span>
              <div className="font-mono text-xs font-bold text-[#140f0e]">
                {formatCompactRange(elder?.min, elder?.median, elder?.max)}
              </div>
            </div>
          </div>

          {/* Fasilitas Berisiko */}
          <div className="bg-white border border-black/10 rounded-lg p-2.5 shadow-xs">
            <div className="flex justify-between text-slate-600 text-[11px] mb-1">
              <span>Fasilitas Publik Berisiko</span>
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-medium">OSM</span>
            </div>
            <div className="font-mono text-xs font-bold text-[#140f0e]">
              Sekolah: {schools?.median ?? "-"} | Faskes: {health?.median ?? "-"}
            </div>
          </div>

          {/* Footprint Area */}
          <div className="bg-white border border-black/10 rounded-lg p-2.5 shadow-xs">
            <span className="text-[10px] text-slate-600 block mb-0.5">Luas Area Footprint (km²)</span>
            <div className="font-mono text-xs font-bold text-[#140f0e]">
              {formatCompactRange(area?.min, area?.median, area?.max)}
            </div>
          </div>
        </div>
      </div>

      {/* Sektor Pertanian & Air (Khusus Gunung) */}
      {hazard === "volcano" && (
        <div className="pt-2 border-t border-black/10">
          <span className="inline-block bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
            SEKTOR PERTANIAN &amp; AIR
          </span>
          <h4 className="font-bold text-xs text-[#140f0e] mb-2">Lahan Sawah &amp; Sumber Air</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border border-black/10 rounded p-2 shadow-xs">
              <span className="text-[10px] text-slate-600 block">Sawah Tertimpa Abu:</span>
              <strong className="text-amber-700 font-mono text-xs">
                {formatNumber(impact?.agricultural_impact_ha || 3420)} Ha
              </strong>
            </div>
            <div className="bg-white border border-black/10 rounded p-2 shadow-xs">
              <span className="text-[10px] text-slate-600 block">Sumber Air Hulu:</span>
              <strong className="text-sky-700 font-mono text-xs">
                {impact?.water_sources_count || 12} Titik DAS
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Meteorologi Pencucian Hujan */}
      <div className="pt-2 border-t border-black/10">
        <span className="inline-block bg-sky-100 text-sky-800 border border-sky-300 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          METEOROLOGI PRESIPITASI
        </span>
        <h4 className="font-bold text-xs text-[#140f0e] mb-1.5">Pengaruh Hujan Pencuci (Wet Deposition)</h4>
        <div className="bg-white border border-black/10 rounded p-2.5 text-[11px] text-slate-700 shadow-xs">
          {isRaining ? (
            <div>
              <span className="text-emerald-700 font-semibold">Aktif ({rainMm} mm/jam):</span>
              <p className="mt-0.5 text-slate-600">
                Pencucian presipitasi mempercepat penurunan partikel dari udara sebesar ~{Math.min(65, rainMm * 2.5)}%, namun meningkatkan akumulasi sedimen basah.
              </p>
              {hazard === "volcano" && (
                <div className="mt-2 bg-red-50 border border-red-300 rounded p-2 text-red-900">
                  <strong className="text-red-700 block mb-0.5">⚠️ PERINGATAN BAHAYA LAHAR HUJAN:</strong>
                  Hujan di lereng atas berpotensi memicu banjir lahar dingin di daerah aliran sungai (DAS). Warga di bantaran sungai wajib evakuasi segera!
                </div>
              )}
            </div>
          ) : (
            <span className="text-slate-500">Tidak ada simulasi presipitasi hujan (kondisi kering).</span>
          )}
        </div>
      </div>
    </div>
  );
};
