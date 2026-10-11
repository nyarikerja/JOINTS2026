import React, { useState, useEffect } from "react";
import { Sparkles, AlertOctagon, CheckCircle2, Loader2 } from "lucide-react";
import { formatCompactRange } from "../../utils/formatters";
import type { 
  ImpactResponse, 
  HazardType, 
  CarbonEmissionsResponse, 
  HotspotRankingResponse, 
  ExtinguishResponse, 
  LaharWarningResponse,
  RainEffectResponse,
  SimulationResponse
} from "../../types/api";
import { api } from "../../services/api";
import { AirQualityCard, CompareRuns, ShareRunButton } from "./RunExtras";

interface TabImpactProps {
  impact: ImpactResponse | null;
  hazard: HazardType;
  rainMm: number;
  currentHour?: number;
  onOpenLegend?: () => void;
  simulatedEventName?: string;
  activeRunId?: string | null;
  runInfo?: SimulationResponse | null;
}

const fmtWib = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " WIB"
    : "-";

export const TabImpact: React.FC<TabImpactProps> = ({
  impact,
  hazard,
  rainMm,
  currentHour = 12,
  onOpenLegend: _onOpenLegend,
  simulatedEventName,
  activeRunId,
  runInfo
}) => {
  // Data Lapis 2 Khusus Karhutla & Vulkanik
  const [carbonData, setCarbonData] = useState<CarbonEmissionsResponse | null>(null);
  const [rankingData, setRankingData] = useState<HotspotRankingResponse | null>(null);
  const [extinguishResult, setExtinguishResult] = useState<ExtinguishResponse | null>(null);
  const [extinguishingClusterId, setExtinguishingClusterId] = useState<number | null>(null);
  const [laharData, setLaharData] = useState<LaharWarningResponse | null>(null);
  const [rainEffectData, setRainEffectData] = useState<RainEffectResponse | null>(null);

  useEffect(() => {
    if (!activeRunId) {
      setCarbonData(null);
      setRankingData(null);
      setExtinguishResult(null);
      setLaharData(null);
      setRainEffectData(null);
      return;
    }

    if (hazard === "fire") {
      api.getCarbonEmissions(activeRunId).then(setCarbonData).catch(() => {});
      api.getHotspotRanking(activeRunId).then(setRankingData).catch(() => {});
      setLaharData(null);
    } else {
      api.getLaharWarning(activeRunId).then(setLaharData).catch(() => {});
      setCarbonData(null);
      setRankingData(null);
    }

    api.getRainEffect(activeRunId).then(setRainEffectData).catch(() => {});
  }, [activeRunId, hazard]);

  const handleSimulateExtinguish = async (clusterId: number) => {
    if (!activeRunId) return;
    setExtinguishingClusterId(clusterId);
    try {
      const res = await api.extinguishHotspots(activeRunId, [clusterId]);
      setExtinguishResult(res);
    } catch (err) {
      console.error("Gagal simulasi pemadaman:", err);
    } finally {
      setExtinguishingClusterId(null);
    }
  };

  // Ambil metrik dinamis jam aktif dari backend (hourly_series) atau fallback ke akumulasi
  const cur: any = (impact?.hourly_series && (impact.hourly_series[String(currentHour)] || impact.hourly_series[currentHour])) || impact;

  const pop = cur?.population_exposed;
  const child = cur?.children_exposed;
  const elder = cur?.elderly_exposed;
  const area = cur?.area_exposed_km2;
  const schools = cur?.schools_exposed;
  const health = cur?.healthcare_exposed;
  const coverage = impact?.facilities_coverage;
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

        {runInfo && (
          <div className="mt-2 p-2.5 rounded-lg bg-white/80 border border-[#2b211e]/15 text-[10px] text-[#2b211e]/80 space-y-0.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#A14646] uppercase tracking-wide">Data masukan run</span>
              <ShareRunButton />
              <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border ${runInfo.scenario_label === "kejadian observasi" ? "bg-emerald-500/10 text-emerald-800 border-emerald-400/40" : "bg-amber-500/10 text-amber-800 border-amber-400/40"}`}>
                {runInfo.scenario_label === "kejadian observasi" ? "Kejadian teramati" : runInfo.scenario_label}
              </span>
            </div>
            {runInfo.source_info && (
              <div>
                Sumber: <strong>{runInfo.source_info.label}</strong>
                {runInfo.source_info.ash_top_asl_m ? ` · puncak abu ${runInfo.source_info.ash_top_asl_m.toLocaleString("id-ID")} m dpl` : ""}
                {runInfo.source_info.issued_utc ? ` · ${fmtWib(runInfo.source_info.issued_utc)}` : ""}
                {runInfo.source_info.url && (
                  <> · <a href={runInfo.source_info.url} target="_blank" rel="noreferrer" className="underline text-[#A14646]">MAGMA</a></>
                )}
              </div>
            )}
            {runInfo.hotspots_used && (
              <div>
                Titik api: {runInfo.hotspots_used.count.toLocaleString("id-ID")} deteksi dari {runInfo.hotspots_used.n_overpasses ?? "-"} lintasan satelit
                {runInfo.hotspots_used.mean_instantaneous_frp_mw !== undefined ? ` · rata-rata FRP ${runInfo.hotspots_used.mean_instantaneous_frp_mw.toLocaleString("id-ID")} MW` : ""}
              </div>
            )}
            {runInfo.weather && (
              <div>
                Cuaca: {runInfo.weather.model} · angin {runInfo.weather.level} · diunduh {fmtWib(runInfo.weather.fetched_at)}
                {runInfo.weather.stale && <strong className="text-amber-700"> (salinan lama)</strong>}
              </div>
            )}
            <div>H+0 = {fmtWib(runInfo.start_utc)} · {runInfo.n_members} anggota ensemble ({runInfo.members_source})</div>
          </div>
        )}

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
        </div>

        <div className="mt-2.5 space-y-2">
          {/* Total Penduduk */}
          <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs relative group cursor-help">
            <div className="flex justify-between text-[#2b211e]/65 text-[11px] mb-1">
              <span>Penduduk Terpapar (Jiwa)</span>
              <span className="bg-[#f7f3ed] text-[#2b211e] px-1.5 py-0.5 rounded text-[9px] font-medium border border-[#2b211e]/10" title={impact?.population_source}>WorldPop 2020</span>
            </div>
            <div className="font-sans text-base font-bold text-[#2b211e]">
              {formatCompactRange(pop?.min, pop?.median, pop?.max)}
            </div>
            <div className="text-[10px] text-[#2b211e]/50">Jiwa di jalur sebaran abu/asap atmosferik</div>
          </div>

          {/* Anak-anak & Lansia */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs relative group cursor-help">
              <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Anak-anak (&lt;15 Th)</span>
              <div className="font-sans text-xs font-bold text-[#2b211e]">
                {formatCompactRange(child?.min, child?.median, child?.max)}
              </div>
            </div>
            <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs relative group cursor-help">
              <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Lansia (&ge;65 Th)</span>
              <div className="font-sans text-xs font-bold text-[#2b211e]">
                {formatCompactRange(elder?.min, elder?.median, elder?.max)}
              </div>
            </div>
          </div>

          {/* Fasilitas Publik Berisiko */}
          <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs">
            <div className="flex justify-between text-[#2b211e]/65 text-[11px] mb-2">
              <span>Fasilitas Publik Berisiko</span>
              <span className="bg-[#f7f3ed] text-[#2b211e] px-1.5 py-0.5 rounded text-[9px] font-medium border border-[#2b211e]/10">OSM</span>
            </div>
            {coverage && !coverage.complete && (
              <p className="text-[9.5px] text-amber-800 bg-amber-500/10 border border-amber-400/30 rounded p-1.5 mb-2 leading-snug">{coverage.note}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#f7f3ed]/50 p-2 rounded border border-[#2b211e]/5">
                <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Sekolah</span>
                <div className="font-sans text-xs font-bold text-[#2b211e]">
                  {schools ? formatCompactRange(schools.min, schools.median, schools.max) : "-"}
                </div>
              </div>
              <div className="bg-[#f7f3ed]/50 p-2 rounded border border-[#2b211e]/5">
                <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Fasilitas Kesehatan</span>
                <div className="font-sans text-xs font-bold text-[#2b211e]">
                  {health ? formatCompactRange(health.min, health.median, health.max) : "-"}
                </div>
              </div>
            </div>
          </div>

          {/* Luas Footprint */}
          <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs">
            <span className="text-[10px] text-[#2b211e]/60 block mb-0.5">Luas Area Footprint (km²)</span>
            <div className="font-sans text-xs font-bold text-[#2b211e]">
              {formatCompactRange(area?.min, area?.median, area?.max)}
            </div>
          </div>

          {activeRunId && <AirQualityCard runId={activeRunId} hazard={hazard} />}

        </div>
      </div>

      {/* 2. FITUR KHUSUS KARHUTLA: EMISI KARBON & PERINGKAT KLASTER (Lapis 2) */}
      {hazard === "fire" && (
        <div className="pt-2 border-t border-[#2b211e]/10 space-y-2.5">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <img src="/titik_api.png" alt="Titik Api" className="w-3.5 h-3.5 object-contain shrink-0" />
              <h3 className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#A14646]">
                EMISI KARBON &amp; KLASTER KARHUTLA
              </h3>
            </div>
            <p className="text-[10px] text-[#2b211e]/70 leading-relaxed">
              Estimasi pelepasan gas rumah kaca (CO₂e) formula Wooster (2005) &amp; Li (2018).
            </p>
          </div>

          {/* Emisi Karbon Gambut vs Non-Gambut */}
          {carbonData && (
            <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs space-y-2" title={carbonData.caveat}>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#2b211e]/70 font-medium">Total Pelepasan CO₂e:</span>
                <strong className="text-[#A14646] font-mono">
                  {formatCompactRange(carbonData.total_co2e_tonnes?.min, carbonData.total_co2e_tonnes?.median, carbonData.total_co2e_tonnes?.max)} Ton
                </strong>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-[#2b211e]/5">
                <div className="bg-[#f7f3ed] p-1.5 rounded">
                  <span className="text-[#2b211e]/60 block text-[9px]">Lahan Gambut:</span>
                  <strong className="text-[#A14646] font-mono text-[10px]">
                    {formatCompactRange(carbonData.peat_emissions_tonnes?.min, carbonData.peat_emissions_tonnes?.median, carbonData.peat_emissions_tonnes?.max)} Ton
                  </strong>
                </div>
                <div className="bg-[#f7f3ed] p-1.5 rounded">
                  <span className="text-[#2b211e]/60 block text-[9px]">Non-Gambut:</span>
                  <strong className="text-[#2a8485] font-mono text-[10px]">
                    {formatCompactRange(carbonData.non_peat_emissions_tonnes?.min, carbonData.non_peat_emissions_tonnes?.median, carbonData.non_peat_emissions_tonnes?.max)} Ton
                  </strong>
                </div>
              </div>
              {carbonData.caveat && (
                <p className="text-[9px] text-[#2b211e]/55 leading-snug">{carbonData.caveat}</p>
              )}
            </div>
          )}

          {/* Peringkat Klaster Titik Api & Simulasi Pemadaman Kontra-faktual */}
          {rankingData && rankingData.ranked_clusters?.length > 0 && (
            <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <img src="/titik_api.png" alt="Titik Api" className="w-3.5 h-3.5 object-contain shrink-0" />
                  <span className="font-bold text-[10px] text-[#2b211e] uppercase tracking-wide">
                    Prioritas Klaster Titik Api
                  </span>
                </div>
                <span className="text-[9px] font-mono text-[#2b211e]/60">
                  {rankingData.ranked_clusters.length} Klaster
                </span>
              </div>

              {/* Hasil Pemadaman Terkini jika Ada */}
              {extinguishResult && (
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 space-y-1">
                  <div className="flex items-center gap-1 font-bold text-[10px] text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Hasil Kontra-faktual Pemadaman:</span>
                  </div>
                  <div className="text-[9px] space-y-0.5 leading-relaxed">
                    <p>Warga Terlindungi: <strong>{formatCompactRange(extinguishResult.population_reduced?.min, extinguishResult.population_reduced?.median, extinguishResult.population_reduced?.max)} Jiwa (-{extinguishResult.reduction_percentage}%)</strong></p>
                    <p>Emisi CO₂e Tercegah: <strong>{formatCompactRange(extinguishResult.carbon_reduced_co2e_tonnes?.min, extinguishResult.carbon_reduced_co2e_tonnes?.median, extinguishResult.carbon_reduced_co2e_tonnes?.max)} Ton</strong></p>
                  </div>
                </div>
              )}

              {/* Daftar Klaster Teratas */}
              <div className="space-y-1.5">
                {rankingData.ranked_clusters.slice(0, 3).map((cl) => {
                  const isOperating = extinguishingClusterId === cl.cluster_id;

                  return (
                    <div key={cl.cluster_id} className="p-2 rounded bg-[#f7f3ed] border border-[#2b211e]/10 flex items-center justify-between text-[10px]">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#A14646]">#Peringkat {cl.rank}</span>
                          <span className="text-[#2b211e]/60 flex items-center gap-1">
                            <img src="/titik_api.png" alt="Titik Api" className="w-3 h-3 object-contain inline-block" />
                            {cl.hotspot_count} titik api
                          </span>
                        </div>
                        <div className="text-[9px] text-[#2b211e]/70 mt-0.5">
                          Total FRP: <strong>{Math.round(cl.total_frp_mw)} MW</strong> &bull; Skor Risiko: <strong>{Math.round(cl.exposure_contribution_score)}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSimulateExtinguish(cl.cluster_id)}
                        disabled={isOperating}
                        className="py-1 px-2 rounded bg-[#2a8485] hover:bg-[#20696a] text-white text-[9px] font-semibold transition cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        {isOperating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        <span>Padamkan</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. FITUR KHUSUS VULKANIK: POTENSI LAHAR HUJAN DARI PRAKIRAAN HUJAN ENSEMBLE */}
      {hazard === "volcano" && laharData?.available && laharData.lahar_risk_level !== "none" && (
        <div className="pt-2 border-t border-[#2b211e]/10">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertOctagon className="w-3.5 h-3.5 text-[#DA6556]" />
            <h3 className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#DA6556]">
              POTENSI LAHAR HUJAN
            </h3>
          </div>
          <div className="bg-white border border-[#DA6556]/30 rounded-lg p-2.5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#2b211e]/70">Tingkat potensi (dari prakiraan hujan):</span>
              <span className="px-1.5 py-0.5 rounded font-bold font-mono bg-red-500/10 text-red-800 border border-red-500/20 uppercase text-[9px]">
                {laharData.lahar_risk_level}
              </span>
            </div>
            <p className="text-[10px] text-[#2b211e]/75 leading-relaxed">
              {laharData.warning_text || laharData.reason}
            </p>
          </div>
        </div>
      )}

      {/* 5. Efek Pencucian Hujan (keluaran model) */}
      {rainEffectData?.available && (
      <div className="pt-2 border-t border-[#2b211e]/10 space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#2b211e]">
            EFEK PENCUCIAN HUJAN
          </h3>
          {rainEffectData?.scavenged_mass_pct && (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
              {rainEffectData.scavenged_mass_pct.median}% massa tercuci
            </span>
          )}
        </div>
        <div className="bg-white border border-[#2b211e]/10 rounded p-2.5 text-[10.5px] text-[#2b211e] shadow-xs space-y-1.5">
          {rainEffectData?.available ? (
            <>
              <p className="leading-relaxed text-[#2b211e]/80">
                Massa partikel yang tercuci hujan selama simulasi:{" "}
                <strong>{rainEffectData.scavenged_mass_pct?.min}% – {rainEffectData.scavenged_mass_pct?.median}% – {rainEffectData.scavenged_mass_pct?.max}%</strong>{" "}
                (P5 – P50 – P95 ensemble).
              </p>
              {rainEffectData.precip_max_mm_h && (
                <p className="text-[10px] text-[#2b211e]/70">
                  Hujan maksimum di sumber: {rainEffectData.precip_max_mm_h.median} mm/jam (rentang {rainEffectData.precip_max_mm_h.min}–{rainEffectData.precip_max_mm_h.max}){isRaining ? `, termasuk tambahan skenario ${rainMm} mm/jam` : ""}.
                </p>
              )}
              {rainEffectData.hazard_specific_warning && (
                <p className="text-[10px] text-[#2b211e]/65 leading-relaxed pt-1 border-t border-[#2b211e]/5">
                  {rainEffectData.hazard_specific_warning}
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
      )}
      {activeRunId && <CompareRuns runId={activeRunId} />}
    </div>
  );
};
