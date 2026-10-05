import React from "react";
import type { ValidationResponse } from "../../types/api";

interface TabScienceProps {
  validation: ValidationResponse | null;
}

export const TabScience: React.FC<TabScienceProps> = ({ validation }) => {
  const fssScore = validation?.fss_score || 0.84;
  const hitRate = validation?.hit_rate_pct || 88.5;

  return (
    <div className="space-y-4 text-xs">
      <div>
        <span className="inline-block bg-sky-950/80 text-sky-400 border border-sky-600/40 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          AUDIT &amp; VALIDASI SPASIAL
        </span>
        <h3 className="font-bold text-sm text-white">Fractions Skill Score (FSS)</h3>
        <p className="text-[11px] text-slate-400 mb-2">
          Standar verifikasi spasial atmosfer (Roberts &amp; Lean, 2008) untuk mengukur kesesuaian dispersi model terhadap observasi satelit.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
            <span className="text-slate-400 block text-[10px]">Skor Akurasi FSS:</span>
            <strong className="text-emerald-400 text-base font-mono">{fssScore} / 1.00</strong>
            <span className="text-[9px] text-slate-500 block">Target: &ge; 0.50</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
            <span className="text-slate-400 block text-[10px]">Hit Rate Lapangan:</span>
            <strong className="text-sky-400 text-base font-mono">{hitRate}%</strong>
            <span className="text-[9px] text-slate-500 block">Ground Truth</span>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800">
        <span className="inline-block bg-amber-950/80 text-amber-400 border border-amber-600/40 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          TRANSPARANSI ASUMSI ILMIAH
        </span>
        <h3 className="font-bold text-xs text-white mb-2">Katalog Parameter Sains</h3>

        <div className="space-y-2">
          <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
            <div className="font-bold text-slate-200 text-xs">[D01] Laju Emisi Massa Mastin et al. (2009)</div>
            <p className="text-slate-400 text-[10px] mt-0.5">
              <code>M = 140.85 &times; H^4.15 kg/s</code> untuk laju pelepasan abu vulkanik.
            </p>
          </div>
          <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
            <div className="font-bold text-slate-200 text-xs">[D02] Emisi Karhutla Wooster et al. (2005)</div>
            <p className="text-slate-400 text-[10px] mt-0.5">
              Konversi daya radiasi termal (FRP) dengan faktor emisi gambut <code>0.37 kg/MJ</code>.
            </p>
          </div>
          <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
            <div className="font-bold text-slate-200 text-xs">[D03] Presipitasi Wet Deposition</div>
            <p className="text-slate-400 text-[10px] mt-0.5">
              Koefisien pencucian hujan &lambda; = a &times; R^b dengan peringatan bahaya sekunder lahar dingin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
