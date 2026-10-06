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
    <div className="space-y-3 text-xs text-[#140f0e]">
      <div>
        <span className="inline-block bg-sky-100 text-sky-800 border border-sky-300 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          SISTEM RUJUKAN GAWAT DARURAT
        </span>
        <h3 className="font-bold text-sm text-[#140f0e]">Klasifikasi Zona Rumah Sakit &amp; Faskes</h3>
        <p className="text-[11px] text-slate-600">
          Memastikan korban sesak napas akut &amp; ISPA dirujuk ke faskes dengan udara steril.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <div className="p-2 bg-emerald-50 border border-emerald-300 rounded text-center shadow-xs">
            <span className="text-[10px] text-emerald-800 block font-medium">RS Bebas Bahaya (Aman)</span>
            <strong className="text-emerald-700 text-sm font-mono">{safeCount}</strong>
          </div>
          <div className="p-2 bg-red-50 border border-red-300 rounded text-center shadow-xs">
            <span className="text-[10px] text-red-800 block font-medium">RS Zona Siaga / Bahaya</span>
            <strong className="text-red-700 text-sm font-mono">{impactedCount}</strong>
          </div>
        </div>
      </div>

      {healthcare.length === 0 ? (
        <div className="p-4 text-center text-slate-600 bg-white/80 rounded-lg border border-black/10 text-xs shadow-xs">
          ✅ Seluruh rumah sakit rujukan berada di zona aman bebas partikel.
        </div>
      ) : (
        <div className="space-y-2">
          {healthcare.map((h) => {
            const prob = h.exposure_pct ?? h.exposure_prob_pct ?? (h.exposure_probability ? Math.round(h.exposure_probability * 100) : 0);
            const isSafe = h.is_safe !== undefined ? h.is_safe : prob < 10;
            const isCritical = prob >= 40;

            const badgeClass = isSafe
              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
              : isCritical
              ? "bg-red-50 text-red-800 border-red-300"
              : "bg-amber-50 text-amber-800 border-amber-300";

            const badgeText = h.status_badge || (isSafe
              ? "RUJUKAN UTAMA (BEBAS ABU)"
              : isCritical
              ? "TERPAPAR ABU PEKAT"
              : "RS SIAGA PENYANGGA");

            const hLat = h.lat ?? h.latitude ?? 0;
            const hLng = h.lng ?? h.longitude ?? 0;
            const dist = h.distance_from_epicenter_km ?? h.distance_from_source_km;

            return (
              <div key={h.facility_id || h.id || h.name} className="border border-black/10 bg-white rounded-lg p-2.5 text-[#140f0e] shadow-xs">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <h4 className="font-bold text-[#140f0e] text-xs">🏥 {h.name}</h4>
                    <div className="text-slate-500 text-[10px]">
                      {h.district || "Fasilitas Rujukan"} {dist ? `• ${dist} km dari pusat` : ""}
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${badgeClass}`}>
                    {badgeText}
                  </span>
                </div>

                {h.evac_recommendation && (
                  <p className="text-[10px] text-slate-700 my-1.5 bg-slate-50 p-1.5 rounded border border-black/5">
                    {h.evac_recommendation}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 my-2 py-1 px-2 bg-slate-50 rounded border border-black/5 text-[10px]">
                  <div>
                    <span className="text-slate-500 block">Status Paparan:</span>
                    <strong className={isSafe ? "text-emerald-700" : "text-amber-700"}>
                      {isSafe ? "Aman (0% - 10%)" : `Terpapar ${prob}%`}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Hotline Rujukan:</span>
                    <strong className="text-sky-700">{h.emergency_hotline || "SPGDT 119"}</strong>
                  </div>
                </div>

                {h.capabilities && h.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {h.capabilities.map((c, idx) => (
                      <span key={idx} className="bg-slate-100 text-slate-700 text-[9px] px-1.5 py-0.5 rounded">
                        ✓ {c}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-1 border-t border-black/10">
                  <button
                    onClick={() => onFlyTo(hLat, hLng)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-[#140f0e] border border-black/15 rounded text-[10px] font-medium transition cursor-pointer shadow-xs"
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
