import React from "react";
import type { SchoolItem } from "../../types/api";

interface TabSchoolsProps {
  schools: SchoolItem[];
  onFlyTo: (lat: number, lng: number) => void;
  onDrawRoute: (s: SchoolItem) => void;
}

export const TabSchools: React.FC<TabSchoolsProps> = ({
  schools,
  onFlyTo,
  onDrawRoute
}) => {
  return (
    <div className="space-y-3 text-xs">
      <div>
        <span className="inline-block bg-red-950/80 text-red-400 border border-red-600/40 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          PROTOKOL KESELAMATAN SISWA
        </span>
        <h3 className="font-bold text-sm text-white">Triase Sekolah &amp; PJJ Daring</h3>
        <p className="text-[11px] text-slate-400">
          Ambang batas: &ge; 40% dialihkan ke pembelajaran jarak jauh (PJJ) daring untuk mencegah ISPA akut.
        </p>
      </div>

      {schools.length === 0 ? (
        <div className="p-4 text-center text-slate-400 bg-slate-900/50 rounded-lg border border-slate-800 text-xs">
          ✅ Tidak ada sekolah terdeteksi di dalam batas ambang bahaya pada kejadian ini.
        </div>
      ) : (
        <div className="space-y-2.5">
          {schools.map((s) => {
            const prob = s.exposure_pct ?? s.exposure_prob_pct ?? (s.exposure_probability ? Math.round(s.exposure_probability * 100) : 0);
            const isAwas = prob >= 40;
            const isWaspada = prob >= 15 && prob < 40;

            const borderClass = isAwas
              ? "border-red-600/80 bg-red-950/20"
              : isWaspada
              ? "border-amber-600/60 bg-amber-950/20"
              : "border-emerald-600/40 bg-emerald-950/20";

            const badgeText = s.action_code === "PJJ_DARING" || isAwas
              ? "AWAS • ALIHKAN KE PJJ DARING"
              : isWaspada
              ? "WASPADA • HENTIKAN OUTDOOR"
              : "SIAGA DINI (MONITORING)";

            const badgeColor = isAwas
              ? "bg-red-800 text-red-100 animate-pulse"
              : isWaspada
              ? "bg-amber-800 text-amber-200"
              : "bg-emerald-800 text-emerald-200";

            const hospital = s.nearest_safe_hospital || s.nearest_hospital || {
              name: "RSUD Rujukan Terdekat",
              distance_km: 4.5
            };

            const sLat = s.lat ?? s.latitude ?? 0;
            const sLng = s.lng ?? s.longitude ?? 0;
            const eta = s.eta_hours ?? s.arrival_time_earliest_h ?? 4;

            return (
              <div key={s.facility_id || s.id || s.name} className={`border rounded-lg p-3 text-slate-200 ${borderClass}`}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <h4 className="font-bold text-white text-xs">🏫 {s.name}</h4>
                    <div className="text-slate-400 text-[10px]">{s.district || "Kecamatan Terpapar"} &bull; {s.province || ""}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${badgeColor}`}>
                    {badgeText}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 my-2 py-1.5 px-2 bg-slate-950/80 rounded border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Peluang Paparan:</span>
                    <strong className="text-white text-xs font-mono">{prob}%</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Estimasi Tiba (ETA):</span>
                    <strong className="text-amber-300 text-xs font-mono">T + {eta}:00 Jam</strong>
                  </div>
                </div>

                {s.action_detail && (
                  <p className="text-[10px] text-slate-300 mb-2 bg-slate-900/60 p-1.5 rounded">
                    {s.action_detail}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-400 truncate max-w-[170px] text-[10px]">
                    🚑 RS Rujukan: <strong className="text-sky-300">{hospital.name}</strong> ({hospital.distance_km} km)
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onFlyTo(sLat, sLng)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] transition cursor-pointer"
                    >
                      Pusatkan
                    </button>
                    <button
                      onClick={() => onDrawRoute(s)}
                      className="px-2 py-1 bg-sky-700 hover:bg-sky-600 text-white rounded text-[10px] font-medium transition cursor-pointer"
                    >
                      Rute Evakuasi
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
