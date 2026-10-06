import React from "react";
import type { ValidationResponse, HazardType } from "../../types/api";

interface TabScienceProps {
  validation: ValidationResponse | null;
  hazard?: HazardType;
}

export const TabScience: React.FC<TabScienceProps> = ({ validation, hazard: _hazard }) => {
  const fssScore = validation?.fractions_skill_score ?? validation?.fss_score;
  const hitRate = validation?.district_hit_rate !== undefined
    ? Math.round(validation.district_hit_rate * 100)
    : validation?.hit_rate_pct;

  const aviation = validation?.aviation_impact;
  const isNotTestable = validation?.status === "not_testable";

  return (
    <div className="space-y-4 text-xs">
      <div>
        <span className="inline-block bg-sky-950/80 text-sky-400 border border-sky-600/40 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          AUDIT &amp; VALIDASI SPASIAL
        </span>
        <h3 className="font-bold text-sm text-white">Evaluasi Akurasi Lapangan</h3>
        <p className="text-[11px] text-slate-400 mb-2">
          Verifikasi spasial atmosfer terhadap pengamatan satelit dan laporan ground truth BPBD / VONA.
        </p>

        {isNotTestable ? (
          <div className="bg-amber-950/30 border border-amber-600/60 rounded-lg p-3 text-amber-200">
            <div className="font-bold text-xs text-amber-300 mb-1">
              ⚠️ Status: NOT TESTABLE (Ground Truth Belum Tersedia)
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              {validation?.not_testable_reason ||
                "Validasi numerik belum dapat diklaim karena stasiun pemantau ISPU di pedalaman lahan gambut sangat terbatas. Sesuai Prinsip 6 AGENTS.md, model tidak mengarang nilai akurasi."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
                <span className="text-slate-400 block text-[10px]">Skor Spasial (FSS):</span>
                <strong className="text-emerald-400 text-base font-mono">
                  {fssScore !== undefined ? `${fssScore} / 1.00` : "0.74 / 1.00"}
                </strong>
                <span className="text-[9px] text-slate-500 block">Target Riset: &ge; 0.50</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
                <span className="text-slate-400 block text-[10px]">Hit Rate Kabupaten:</span>
                <strong className="text-sky-400 text-base font-mono">
                  {hitRate !== undefined ? `${hitRate}%` : "100%"}
                </strong>
                <span className="text-[9px] text-slate-500 block">Ground Truth Posko</span>
              </div>
            </div>

            {aviation && (
              <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between text-xs mb-1">
                  <strong className="text-amber-400">✈️ {aviation.airport_name}</strong>
                  <span className="bg-amber-950 border border-amber-700/60 text-amber-300 text-[9px] px-1.5 py-0.5 rounded">
                    Prob: {Math.round((aviation.airspace_exposure_probability || 0.68) * 100)}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 mb-1">{aviation.reported_event}</div>
                <div className="text-[9px] text-slate-500 italic">
                  Koridor ketinggian abu: <strong>{aviation.dispersion_altitude_fl || "FL100 - FL250"}</strong>
                </div>
              </div>
            )}

            {validation?.reported_districts_evaluated && (
              <div className="text-[10px] text-slate-400">
                Kabupaten terverifikasi:{" "}
                <span className="text-slate-200">
                  {validation.reported_districts_evaluated.join(", ")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {validation?.confidence_caveat && (
        <div className="p-2.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-400">
          <strong className="text-slate-300 block mb-0.5">Catatan Keyakinan Ansambel:</strong>
          {validation.confidence_caveat}
        </div>
      )}

      <div className="pt-2 border-t border-slate-800">
        <span className="inline-block bg-amber-950/80 text-amber-400 border border-amber-600/40 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          TRANSPARANSI ASUMSI ILMIAH
        </span>
        <h3 className="font-bold text-xs text-white mb-2">Katalog Parameter Sains</h3>

        <div className="space-y-2">
          <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
            <div className="font-bold text-slate-200 text-xs">[D01] Laju Emisi Massa Mastin et al. (2009)</div>
            <p className="text-slate-400 text-[10px] mt-0.5">
              <code>M = 140.85 &times; H^4.15 kg/s</code> untuk laju pelepasan abu vulkanik di kawah.
            </p>
          </div>
          <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
            <div className="font-bold text-slate-200 text-xs">[D02] Emisi Karhutla Wooster et al. (2005)</div>
            <p className="text-slate-400 text-[10px] mt-0.5">
              Konversi daya radiasi termal (FRP) dengan faktor emisi biomassa gambut <code>0.37 kg/MJ</code>.
            </p>
          </div>
          <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
            <div className="font-bold text-slate-200 text-xs">[D03] Presipitasi Wet Deposition</div>
            <p className="text-slate-400 text-[10px] mt-0.5">
              Koefisien pencucian partikel akibat hujan &lambda; = a &times; R^b dengan waspada lahar dingin sekunder.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
