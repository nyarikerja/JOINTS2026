import React from "react";
import type { HospitalItem } from "../../types/api";

interface TabEvacProps {
  healthcare: HospitalItem[];
  onFlyTo: (lat: number, lng: number) => void;
}

export const TabEvac: React.FC<TabEvacProps> = ({ healthcare, onFlyTo }) => {
  const safeCount = healthcare.filter((h) => {
    const prob = h.exposure_pct ?? h.exposure_prob_pct ?? (h.exposure_probability ? h.exposure_probability * 100 : 0);
    return h.is_safe !== undefined ? h.is_safe : prob < 10;
  }).length;
  const impactedCount = healthcare.length - safeCount;

  return (
    <div className="space-y-3 text-xs">
      <div>
        <span className="inline-block bg-sky-950/80 text-sky-400 border border-sky-600/40 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          SISTEM RUJUKAN GAWAT DARURAT
        </span>
        <h3 className="font-bold text-sm text-white">Klasifikasi Zona Rumah Sakit &amp; Faskes</h3>
        <p className="text-[11px] text-slate-400">
          Memastikan korban sesak napas akut &amp; ISPA dirujuk ke faskes dengan udara steril.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <div className="p-2 bg-emerald-950/30 border border-emerald-600/60 rounded text-center">
            <span className="text-[10px] text-emerald-300 block">RS Bebas Bahaya (Aman)</span>
            <strong className="text-emerald-400 text-sm font-mono">{safeCount}</strong>
          </div>
          <div className="p-2 bg-red-950/30 border border-red-600/60 rounded text-center">
            <span className="text-[10px] text-red-300 block">RS Zona Siaga / Bahaya</span>
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
            const prob = h.exposure_pct ?? h.exposure_prob_pct ?? (h.exposure_probability ? Math.round(h.exposure_probability * 100) : 0);
            const isSafe = h.is_safe !== undefined ? h.is_safe : prob < 10;
            const isCritical = prob >= 40;

            const badgeClass = isSafe
              ? "bg-emerald-900/60 text-emerald-300 border-emerald-600"
              : isCritical
              ? "bg-red-900/60 text-red-300 border-red-600"
              : "bg-amber-900/60 text-amber-300 border-amber-600";

            const badgeText = h.status_badge || (isSafe
              ? "RUJUKAN UTAMA (BEBAS ABU)"
              : isCritical
              ? "TERPAPAR ABU PEKAT"
              : "RS SIAGA PENYANGGA");

            const hLat = h.lat ?? h.latitude ?? 0;
            const hLng = h.lng ?? h.longitude ?? 0;
            const dist = h.distance_from_epicenter_km ?? h.distance_from_source_km;

            return (
              <div key={h.facility_id || h.id || h.name} className="border border-slate-800 bg-slate-900/60 rounded-lg p-2.5 text-slate-200">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <h4 className="font-bold text-white text-xs">🏥 {h.name}</h4>
                    <div className="text-slate-400 text-[10px]">
                      {h.district || "Fasilitas Rujukan"} {dist ? `• ${dist} km dari pusat` : ""}
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${badgeClass}`}>
                    {badgeText}
                  </span>
                </div>

                {h.evac_recommendation && (
                  <p className="text-[10px] text-slate-300 my-1.5 bg-slate-950/60 p-1.5 rounded">
                    {h.evac_recommendation}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 my-2 py-1 px-2 bg-slate-950/80 rounded border border-slate-800 text-[10px]">
                  <div>
                    <span className="text-slate-400 block">Status Paparan:</span>
                    <strong className={isSafe ? "text-emerald-400" : "text-amber-400"}>
                      {isSafe ? "Aman (0% - 10%)" : `Terpapar ${prob}%`}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Hotline Rujukan:</span>
                    <strong className="text-sky-400">{h.emergency_hotline || "SPGDT 119"}</strong>
                  </div>
                </div>

                {h.capabilities && h.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {h.capabilities.map((c, idx) => (
                      <span key={idx} className="bg-slate-800 text-slate-300 text-[9px] px-1.5 py-0.5 rounded">
                        ✓ {c}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-1 border-t border-slate-800/80">
                  <button
                    onClick={() => onFlyTo(hLat, hLng)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-medium transition cursor-pointer"
                  >
                    Pusatkan di Peta
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
