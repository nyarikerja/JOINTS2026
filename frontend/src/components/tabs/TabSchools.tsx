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
  // Filter & deduplikasi fasilitas sekolah agar tidak ada baris ganda
  const cleanSchools = schools.filter((s) => {
    const n = (s.name || "").toLowerCase().trim();
    return n && !n.includes("tanpa nama") && n !== "sekolah" && n !== "sdn" && n !== "sd";
  });
  const candidateSchools = cleanSchools.length > 0 ? cleanSchools : schools;
  const uniqueSchools = Array.from(
    new Map(candidateSchools.map((s) => [s.name.trim().toLowerCase(), s])).values()
  );

  return (
    <div className="space-y-3 text-xs text-[#140f0e]">
      <div>
        <span className="inline-block bg-red-100 text-red-800 border border-red-300 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          PROTOKOL KESELAMATAN SISWA
        </span>
        <h3 className="font-bold text-sm text-[#140f0e]">Triase Sekolah &amp; PJJ Daring</h3>
        <p className="text-[11px] text-slate-600">
          Ambang batas: &ge; 40% dialihkan ke pembelajaran jarak jauh (PJJ) daring untuk mencegah ISPA akut.
        </p>
      </div>

      {uniqueSchools.length === 0 ? (
        <div className="p-4 text-center text-slate-600 bg-white/80 rounded-lg border border-black/10 text-xs shadow-xs">
          ✅ Tidak ada sekolah terdeteksi di dalam batas ambang bahaya pada kejadian ini.
        </div>
      ) : (
        <div className="space-y-2.5">
          {uniqueSchools.map((s) => {
            const prob = s.exposure_pct ?? s.exposure_prob_pct ?? (s.exposure_probability ? Math.round(s.exposure_probability * 100) : 0);
            const isAwas = prob >= 40;
            const isWaspada = prob >= 15 && prob < 40;

            const borderClass = isAwas
              ? "border-red-300 bg-red-50/70"
              : isWaspada
              ? "border-amber-300 bg-amber-50/70"
              : "border-emerald-300 bg-emerald-50/70";

            const badgeText = s.action_code === "PJJ_DARING" || isAwas
              ? "AWAS • ALIHKAN KE PJJ DARING"
              : isWaspada
              ? "WASPADA • HENTIKAN OUTDOOR"
              : "SIAGA DINI (MONITORING)";

            const badgeColor = isAwas
              ? "bg-red-600 text-white font-bold animate-pulse"
              : isWaspada
              ? "bg-amber-600 text-white font-bold"
              : "bg-emerald-600 text-white font-bold";

            const hospital = s.nearest_safe_hospital || s.nearest_hospital || {
              name: "RSUD Rujukan Terdekat",
              distance_km: 4.5
            };

            const sLat = s.lat ?? s.latitude ?? 0;
            const sLng = s.lng ?? s.longitude ?? 0;
            const eta = s.eta_hours ?? s.arrival_time_earliest_h ?? 4;

            return (
              <div key={s.facility_id || s.id || s.name} className={`border rounded-lg p-3 text-[#140f0e] shadow-xs ${borderClass}`}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <h4 className="font-bold text-[#140f0e] text-xs font-sans tracking-tight" style={{ fontFamily: "'Poppins', 'Manrope', system-ui, -apple-system, sans-serif" }}>🏫 {s.name}</h4>
                    <div className="text-slate-500 text-[10px]">{s.district || "Kecamatan Terpapar"} &bull; {s.province || ""}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 shadow-xs ${badgeColor}`}>
                    {badgeText}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 my-2 py-1.5 px-2 bg-white/90 rounded border border-black/10">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Peluang Paparan:</span>
                    <strong className="text-[#140f0e] text-xs font-mono">{prob}%</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Estimasi Tiba (ETA):</span>
                    <strong className="text-amber-800 text-xs font-mono">T + {eta}:00 Jam</strong>
                  </div>
                </div>

                {s.action_detail && (
                  <p className="text-[10px] text-slate-700 mb-2 bg-white/90 p-1.5 rounded border border-black/5">
                    {s.action_detail}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-black/10 text-[11px]">
                  <span className="text-slate-600 truncate max-w-[170px] text-[10px]">
                    🚑 RS Rujukan: <strong className="text-sky-700">{hospital.name}</strong> ({hospital.distance_km} km)
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onFlyTo(sLat, sLng)}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-[#140f0e] border border-black/15 rounded text-[10px] transition cursor-pointer shadow-xs"
                    >
                      Pusatkan
                    </button>
                    <button
                      onClick={() => onDrawRoute(s)}
                      className="px-2 py-1 bg-[#EB895B] hover:bg-[#d97746] text-white rounded text-[10px] font-medium transition cursor-pointer shadow-xs"
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
