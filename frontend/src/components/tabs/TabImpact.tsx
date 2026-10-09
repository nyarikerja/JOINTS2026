import React from "react";
import { formatCompactRange } from "../../utils/formatters";
import type { ImpactResponse, HazardType } from "../../types/api";

interface TabImpactProps {
  impact: ImpactResponse | null;
  hazard: HazardType;
  rainMm: number;
  currentHour?: number;
  onOpenLegend?: () => void;
  simulatedEventName?: string;
}

export const TabImpact: React.FC<TabImpactProps> = ({
  impact,
  hazard,
  rainMm,
  currentHour = 12,
  onOpenLegend,
  simulatedEventName
}) => {
  // Ambil metrik dinamis jam aktif dari backend (hourly_series) atau fallback ke akumulasi
  const cur: any = (impact?.hourly_series && (impact.hourly_series[String(currentHour)] || impact.hourly_series[currentHour])) || impact;

  const pop = cur?.population_exposed;
  const child = cur?.children_exposed;
  const elder = cur?.elderly_exposed;
  const area = cur?.area_exposed_km2;
  const schools = cur?.schools_exposed;
  const health = cur?.healthcare_exposed;
  const cropland = cur?.cropland_exposed_ha;
  const water = cur?.water_sources_exposed_count;
  const rainPop = cur?.rain_pop_reduced;
  const rainArea = cur?.rain_area_reduced;
  const ispu = impact?.ispu;

  const isRaining = rainMm > 0;

  return (
    <div className="space-y-3.5 text-xs text-[#2b211e]">
      {/* 1. Metrik Populasi & Wilayah */}
      <div>
        <div className="flex items-start justify-between mb-1">
          <div className="flex flex-col">
            <h3 className="font-sans text-[12px] font-bold uppercase tracking-wider text-[#2b211e] truncate max-w-[200px]" title={simulatedEventName || "METRIK POPULASI"}>
              {simulatedEventName 
                ? simulatedEventName.replace(/^(Kejadian Observasi|Skenario Hipotetis|Simulasi)(\s*[:-]\s*)?/i, "") 
                : "METRIK POPULASI"}
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
            <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Luas Area Footprint (km²)</span>
            <div className="font-sans text-xs font-bold text-[#2b211e]">
              {formatCompactRange(area?.min, area?.median, area?.max)}
            </div>
            <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block w-40 bg-[#2b211e] text-[#f7f3ed] text-[9px] p-2 rounded shadow-lg text-left z-10 pointer-events-none">
              Total estimasi luasan wilayah yang tercakup dalam area dampak material.
            </div>
          </div>

          {/* ISPU PM2.5 Tile */}
          <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs relative group cursor-help">
            <div className="flex justify-between items-center text-[11px] mb-1">
              <span className="font-medium text-[#2b211e]/75">Indeks Kualitas Udara (ISPU PM2.5)</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-800 border border-amber-400/30">
                {ispu?.category || "Terkontrol"}
              </span>
            </div>
            <p className="text-[10px] text-[#2b211e]/65 leading-relaxed">
              {ispu?.reason || "Pengecekan standar emisi partikulat troposferik BMKG / KLHK."}
            </p>
            <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block w-48 bg-[#2b211e] text-[#f7f3ed] text-[9px] p-2 rounded shadow-lg text-left z-10 pointer-events-none">
              Indeks Standar Pencemar Udara (ISPU) mengukur tingkat polusi partikel halus (PM2.5) yang berbahaya bagi pernapasan.
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sektor Pertanian & Sumber Air Minum DAS */}
      <div className="pt-2 border-t border-[#2b211e]/10">
        <h3 className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#c25e2d] mb-2">
          SEKTOR PERTANIAN &amp; AIR
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white border border-[#2b211e]/10 rounded p-2 shadow-xs relative group cursor-help">
            <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Sawah &amp; Kebun Tertimpa:</span>
            <div className="font-sans text-xs font-bold text-[#DA6556]">
              {cropland ? `${formatCompactRange(cropland.min, cropland.median, cropland.max)} Ha` : "- Ha"}
            </div>
            <span className="text-[9px] text-[#2b211e]/50">Risiko gagal panen</span>
            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-36 bg-[#2b211e] text-[#f7f3ed] text-[9px] p-2 rounded shadow-lg text-left z-10 pointer-events-none">
              Total area lahan pertanian yang berisiko mengalami kerusakan atau gagal panen.
            </div>
          </div>
          <div className="bg-white border border-[#2b211e]/10 rounded p-2 shadow-xs relative group cursor-help">
            <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Sumber Air Minum DAS:</span>
            <div className="font-sans text-xs font-bold text-[#A14646]">
              {water ? `${formatCompactRange(water.min, water.median, water.max)} Titik` : "- Titik"}
            </div>
            <span className="text-[9px] text-[#2b211e]/50">Potensi asam abu vulkanik</span>
            <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block w-36 bg-[#2b211e] text-[#f7f3ed] text-[9px] p-2 rounded shadow-lg text-left z-10 pointer-events-none">
              Jumlah titik sumber air Daerah Aliran Sungai (DAS) yang berpotensi tercemar material.
            </div>
          </div>
        </div>
      </div>

      {/* 3. Efek Pencucian Hujan (Rain Scavenging) */}
      <div className="pt-2 border-t border-[#2b211e]/10">
        <h3 className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#2b211e] mb-2">
          EFEK HUJAN PADA KUALITAS UDARA
        </h3>
        <div className="bg-white border border-[#2b211e]/10 rounded p-2.5 text-[11px] text-[#2b211e] shadow-xs space-y-1.5">
          {isRaining ? (
            <div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#2a8485] font-semibold">Hujan Aktif ({rainMm} mm/jam)</span>
                <span className="text-[10px] font-mono text-[#2a8485]">
                  &minus;{rainPop ? formatCompactRange(rainPop.min, rainPop.median, rainPop.max) : "22%"} Jiwa
                </span>
              </div>
              <p className="mt-1 text-[10px] text-[#2b211e]/75 leading-relaxed">
                Pencucian presipitasi mengurangi konsentrasi partikel di udara sebesar {rainArea ? formatCompactRange(rainArea.min, rainArea.median, rainArea.max) : "-"} km², namun memicu endapan basah di daratan.
              </p>
              {hazard === "volcano" && (
                <div className="mt-2 bg-[#DA6556]/15 border border-[#DA6556]/40 rounded p-2 text-[#A14646]">
                  <strong className="block mb-0.5 font-bold">Peringatan Bahaya Lahar Dingin:</strong>
                  Hujan lebat di lereng atas berpotensi memicu banjir lahar sekunder di jalur daerah aliran sungai (DAS).
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-[#2b211e]/60">
              Kondisi simulasi tanpa presipitasi hujan (kering). Aktifkan intensitas hujan pada mode &ldquo;Uji Skenario&rdquo; untuk mensimulasikan reduksi partikel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

