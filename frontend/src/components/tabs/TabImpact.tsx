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
    <div className="space-y-3.5 text-xs text-[#2b211e]">
      <div>
        <span className="font-sans text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#A14646]/10 text-[#A14646] border border-[#A14646]/20">
          LINGKUP WILAYAH &amp; POPULASI
        </span>
        <h3 className="font-serif text-[15px] font-bold text-[#2b211e] mt-1 mb-0.5">
          Estimasi Paparan Wilayah
        </h3>
        <p className="text-[11px] text-[#2b211e]/70 leading-relaxed">
          Proyeksi rentang ketidakpastian ansambel atmosferik 15 anggota (P5 - P50 - P95).
        </p>

        <div className="mt-2.5 space-y-2">
          {/* Total Penduduk */}
          <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs">
            <div className="flex justify-between text-[#2b211e]/65 text-[11px] mb-1">
              <span>Penduduk Terpapar (Total)</span>
              <span className="bg-[#f7f3ed] text-[#2b211e] px-1.5 py-0.5 rounded text-[9px] font-medium border border-[#2b211e]/10">WorldPop</span>
            </div>
            <div className="font-sans text-base font-bold text-[#2b211e]">
              {formatCompactRange(pop?.min, pop?.median, pop?.max)}
            </div>
            <div className="text-[10px] text-[#2b211e]/50">Jiwa dalam jalur sebaran atmosfer</div>
          </div>

          {/* Anak-anak & Lansia */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs">
              <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Anak-anak (&lt;15 Th)</span>
              <div className="font-sans text-xs font-bold text-[#2b211e]">
                {formatCompactRange(child?.min, child?.median, child?.max)}
              </div>
            </div>
            <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs">
              <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Lansia (&ge;65 Th)</span>
              <div className="font-sans text-xs font-bold text-[#2b211e]">
                {formatCompactRange(elder?.min, elder?.median, elder?.max)}
              </div>
            </div>
          </div>

          {/* Fasilitas Publik Berisiko */}
          <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs">
            <div className="flex justify-between text-[#2b211e]/65 text-[11px] mb-1">
              <span>Fasilitas Publik Berisiko</span>
              <span className="bg-[#f7f3ed] text-[#2b211e] px-1.5 py-0.5 rounded text-[9px] font-medium border border-[#2b211e]/10">OSM</span>
            </div>
            <div className="font-sans text-xs font-bold text-[#2b211e]">
              Sekolah: {schools?.median ?? "-"} | Faskes: {health?.median ?? "-"}
            </div>
          </div>

          {/* Luas Footprint */}
          <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs">
            <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Luas Area Footprint (km²)</span>
            <div className="font-sans text-xs font-bold text-[#2b211e]">
              {formatCompactRange(area?.min, area?.median, area?.max)}
            </div>
          </div>
        </div>
      </div>

      {/* Sektor Pertanian & Air (Khusus Gunung) */}
      {hazard === "volcano" && (
        <div className="pt-2 border-t border-[#2b211e]/10">
          <span className="font-sans text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#EB895B]/15 text-[#c25e2d] border border-[#EB895B]/30 mb-1 inline-block">
            SUMBER AIR &amp; PERTANIAN
          </span>
          <h4 className="font-serif font-bold text-xs text-[#2b211e] mb-1.5">Lahan Sawah &amp; Sumber Air</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border border-[#2b211e]/10 rounded p-2 shadow-xs">
              <span className="text-[10px] text-[#2b211e]/60 block">Sawah Tertimpa Abu:</span>
              <strong className="text-[#DA6556] font-sans text-xs">
                {formatNumber(impact?.agricultural_impact_ha || 3420)} Ha
              </strong>
            </div>
            <div className="bg-white border border-[#2b211e]/10 rounded p-2 shadow-xs">
              <span className="text-[10px] text-[#2b211e]/60 block">Sumber Air Hulu:</span>
              <strong className="text-[#A14646] font-sans text-xs">
                {impact?.water_sources_count || 12} Titik DAS
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Efek Hujan */}
      <div className="pt-2 border-t border-[#2b211e]/10">
        <span className="font-sans text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FDB773]/20 text-[#2b211e] border border-[#FDB773]/30 mb-1 inline-block">
          PRESIPITASI HUJAN
        </span>
        <h4 className="font-serif font-bold text-xs text-[#2b211e] mb-1.5">Pencucian Partikel Udara</h4>
        <div className="bg-white border border-[#2b211e]/10 rounded p-2.5 text-[11px] text-[#2b211e] shadow-xs">
          {isRaining ? (
            <div>
              <span className="text-[#2a8485] font-semibold">Hujan Aktif ({rainMm} mm/jam):</span>
              <p className="mt-0.5 text-[#2b211e]/75">
                Pencucian mempercepat penurunan partikel dari udara sebesar ~{Math.min(65, rainMm * 2.5)}%, namun memicu akumulasi endapan basah di darat.
              </p>
              {hazard === "volcano" && (
                <div className="mt-2 bg-[#DA6556]/15 border border-[#DA6556]/40 rounded p-2 text-[#A14646]">
                  <strong className="block mb-0.5">Peringatan Lahar Hujan:</strong>
                  Hujan lebat di lereng atas berpotensi memicu banjir lahar dingin di daerah aliran sungai (DAS).
                </div>
              )}
            </div>
          ) : (
            <span className="text-[#2b211e]/50">Kondisi meteorologi kering tanpa presipitasi hujan.</span>
          )}
        </div>
      </div>
    </div>
  );
};
