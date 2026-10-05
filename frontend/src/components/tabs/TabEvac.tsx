import React from "react";
import type { HospitalItem } from "../../types/api";

interface TabEvacProps {
  healthcare: HospitalItem[];
  onFlyTo: (lat: number, lng: number) => void;
}

export const TabEvac: React.FC<TabEvacProps> = ({ healthcare, onFlyTo }) => {
  const safeCount = healthcare.filter((h) => (h.exposure_prob_pct || 0) < 10).length;
  const impactedCount = healthcare.filter((h) => (h.exposure_prob_pct || 0) >= 10).length;

  return (
    <div className="space-y-3 text-xs">
      <div>
        <span className="inline-block bg-sky-950/80 text-sky-400 border border-sky-600/40 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          SISTEM RUJUKAN GAWAT DARURAT
        </span>
        <h3 className="font-bold text-sm text-white">Klasifikasi Zona Rumah Sakit</h3>
        <p className="text-[11px] text-slate-400">
          Memastikan korban sesak napas akut &amp; ISPA dirujuk ke faskes dengan udara steril.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <div className="p-2 bg-emerald-950/30 border border-emerald-600/60 rounded text-center">
            <span className="text-[10px] text-emerald-300 block">RS Bebas Abu (Aman)</span>
            <strong className="text-emerald-400 text-sm font-mono">{safeCount}</strong>
          </div>
          <div className="p-2 bg-red-950/30 border border-red-600/60 rounded text-center">
            <span className="text-[10px] text-red-300 block">RS Terpapar Bahaya</span>
            <strong className="text-red-400 text-sm font-mono">{impactedCount}</strong>
          </div>
        </div>
      </div>

      {healthcare.length === 0 ? (
        <div className="p-4 text-center text-slate-400 bg-slate-900/50 rounded-lg border border-slate-800 text-xs">
          ✅ Seluruh rumah sakit rujukan berada di zona aman bebas partikel.
        </div>
      ) : (
        <div className="space-y-2">
          {healthcare.map((h) => {
            const prob = h.exposure_prob_pct || 0;
            const isSafe = prob < 10;
            const isCritical = prob >= 40;

            const badgeClass = isSafe
              ? "bg-emerald-900/60 text-emerald-300 border-emerald-600"
              : isCritical
              ? "bg-red-900/60 text-red-300 border-red-600"
              : "bg-sky-900/60 text-sky-300 border-sky-600";

            const badgeText = isSafe
              ? "RUJUKAN UTAMA (BEBAS ABU)"
              : isCritical
              ? "TERPAPAR ABU PEKAT"
              : "RS SIAGA PENYANGGA";

            return (
              <div key={h.id || h.name} className="border border-slate-800 bg-slate-900/60 rounded-lg p-2.5 text-slate-200">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <h4 className="font-bold text-white text-xs">🏥 {h.name}</h4>
                    <div className="text-slate-400 text-[10px]">{h.district || ""} &bull; {h.province || ""}</div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${badgeClass}`}>
                    {badgeText}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 my-2 py-1 px-2 bg-slate-950/80 rounded border border-slate-800 text-[10px]">
                  <div>
                    <span className="text-slate-400 block">Oksigen Medis:</span>
                    <strong className="text-emerald-400">Siaga Pasokan</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Hotline SPGDT:</span>
                    <strong className="text-amber-400">119</strong>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => onFlyTo(h.lat, h.lng)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] transition cursor-pointer"
                  >
                    Pusatkan Peta
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
