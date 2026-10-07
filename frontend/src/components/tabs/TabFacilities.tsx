import React, { useState } from "react";
import { School, Hospital, Navigation, MapPin } from "lucide-react";
import type { SchoolItem, HospitalItem } from "../../types/api";

interface TabFacilitiesProps {
  schools: SchoolItem[];
  hospitals: HospitalItem[];
  onFlyTo: (lat: number, lng: number) => void;
  onDrawRoute: (s: SchoolItem) => void;
}

export const TabFacilities: React.FC<TabFacilitiesProps> = ({
  schools,
  hospitals,
  onFlyTo,
  onDrawRoute,
}) => {
  const [filterType, setFilterType] = useState<"all" | "schools" | "hospitals">("all");

  const safeHospitals = hospitals.filter((h) => {
    const prob = h.exposure_pct ?? h.exposure_prob_pct ?? (h.exposure_probability ? h.exposure_probability * 100 : 0);
    return h.is_safe !== undefined ? h.is_safe : prob < 10;
  });

  const highRiskSchools = schools.filter((s) => {
    const prob = s.exposure_pct ?? s.exposure_prob_pct ?? (s.exposure_probability ? Math.round(s.exposure_probability * 100) : 0);
    return prob >= 40 || s.action_code === "PJJ_DARING";
  });

  return (
    <div className="space-y-3 text-xs text-[#2b211e]">
      {/* Header Ringkasan Fasilitas */}
      <div>
        <span className="font-sans text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#A14646]/10 text-[#A14646] border border-[#A14646]/20">
          PROTEKSI FASILITAS PUBLIK
        </span>
        <h3 className="font-serif text-[15px] font-bold text-[#2b211e] mt-1 mb-0.5">
          Sekolah &amp; Rumah Sakit Rujukan
        </h3>
        <p className="text-[11px] text-[#2b211e]/70 leading-relaxed">
          Triase keselamatan belajar siswa dan rute evakuasi menuju faskes bebas abu.
        </p>
      </div>

      {/* Mini Stat Card */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2 shadow-xs">
          <span className="text-[10px] text-[#2b211e]/60 block font-medium">Sekolah Wajib PJJ</span>
          <div className="font-sans text-sm font-bold text-[#DA6556] mt-0.5">
            {highRiskSchools.length} <span className="text-[10px] font-normal text-[#2b211e]/50">/ {schools.length}</span>
          </div>
        </div>
        <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2 shadow-xs">
          <span className="text-[10px] text-[#2b211e]/60 block font-medium">RS Bebas Bahaya</span>
          <div className="font-sans text-sm font-bold text-[#2a8485] mt-0.5">
            {safeHospitals.length} <span className="text-[10px] font-normal text-[#2b211e]/50">/ {hospitals.length}</span>
          </div>
        </div>
      </div>

      {/* Filter Switcher */}
      <div className="grid grid-cols-3 rounded p-0.5 bg-white border border-[#2b211e]/12 text-[10px] font-medium text-center">
        <button
          type="button"
          onClick={() => setFilterType("all")}
          className={`py-1 rounded transition cursor-pointer ${
            filterType === "all" ? "bg-[#EB895B] text-white font-semibold" : "text-[#2b211e]/70 hover:text-[#2b211e]"
          }`}
        >
          Semua ({schools.length + hospitals.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType("schools")}
          className={`py-1 rounded transition cursor-pointer ${
            filterType === "schools" ? "bg-[#EB895B] text-white font-semibold" : "text-[#2b211e]/70 hover:text-[#2b211e]"
          }`}
        >
          Sekolah ({schools.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType("hospitals")}
          className={`py-1 rounded transition cursor-pointer ${
            filterType === "hospitals" ? "bg-[#EB895B] text-white font-semibold" : "text-[#2b211e]/70 hover:text-[#2b211e]"
          }`}
        >
          RS &amp; Faskes ({hospitals.length})
        </button>
      </div>

      {/* List Fasilitas */}
      <div className="space-y-2">
        {/* Render Sekolah */}
        {(filterType === "all" || filterType === "schools") &&
          schools.map((s) => {
            const prob = s.exposure_pct ?? s.exposure_prob_pct ?? (s.exposure_probability ? Math.round(s.exposure_probability * 100) : 0);
            const isHigh = prob >= 40;
            const hospital = s.nearest_safe_hospital || s.nearest_hospital || { name: "RSUD Rujukan Terdekat", distance_km: 4.5 };
            const sLat = s.lat ?? s.latitude ?? 0;
            const sLng = s.lng ?? s.longitude ?? 0;
            const eta = s.eta_hours ?? s.arrival_time_earliest_h ?? 4;

            return (
              <div
                key={`school-${s.facility_id || s.id || s.name}`}
                className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs text-[#2b211e]"
              >
                <div className="flex items-start justify-between gap-1.5 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <School className="w-3.5 h-3.5 text-[#DA6556] shrink-0" />
                    <h4 className="font-bold text-[11px] truncate">{s.name}</h4>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${
                      isHigh
                        ? "bg-[#DA6556]/15 text-[#A14646] border border-[#DA6556]/30"
                        : "bg-[#FDB773]/20 text-[#2b211e] border border-[#FDB773]/40"
                    }`}
                  >
                    {isHigh ? "PJJ DARING" : "WASPADA"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[10px] text-[#2b211e]/70 py-1 px-1.5 bg-[#f7f3ed] rounded mb-1.5">
                  <span>Paparan: <strong className="text-[#2b211e] font-sans">{prob}%</strong></span>
                  <span>Tiba: <strong className="text-[#2b211e] font-sans">+{eta} Jam</strong></span>
                </div>

                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#2b211e]/5">
                  <span className="text-[#2b211e]/60 truncate max-w-[140px]">
                    RS: {hospital.name} ({hospital.distance_km} km)
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onFlyTo(sLat, sLng)}
                      className="px-1.5 py-0.5 bg-white hover:bg-neutral-100 border border-[#2b211e]/15 rounded text-[10px] cursor-pointer"
                      title="Pusatkan di peta"
                    >
                      <MapPin className="w-3 h-3 text-[#2b211e]/70" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDrawRoute(s)}
                      className="px-2 py-0.5 bg-[#EB895B] hover:bg-[#DA6556] text-white rounded text-[10px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Navigation className="w-2.5 h-2.5" />
                      <span>Rute</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

        {/* Render Rumah Sakit */}
        {(filterType === "all" || filterType === "hospitals") &&
          hospitals.map((h) => {
            const prob = h.exposure_pct ?? h.exposure_prob_pct ?? (h.exposure_probability ? Math.round(h.exposure_probability * 100) : 0);
            const isSafe = h.is_safe !== undefined ? h.is_safe : prob < 10;
            const hLat = h.lat ?? h.latitude ?? 0;
            const hLng = h.lng ?? h.longitude ?? 0;

            return (
              <div
                key={`hosp-${h.facility_id || h.id || h.name}`}
                className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs text-[#2b211e]"
              >
                <div className="flex items-start justify-between gap-1.5 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Hospital className="w-3.5 h-3.5 text-[#2a8485] shrink-0" />
                    <h4 className="font-bold text-[11px] truncate">{h.name}</h4>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${
                      isSafe
                        ? "bg-[#2a8485]/15 text-[#1f6667] border border-[#2a8485]/30"
                        : "bg-[#DA6556]/15 text-[#A14646] border border-[#DA6556]/30"
                    }`}
                  >
                    {isSafe ? "BEBAS BAHAYA" : "TERPAPAR"}
                  </span>
                </div>

                <div className="text-[10px] text-[#2b211e]/70 py-1 px-1.5 bg-[#f7f3ed] rounded mb-1.5 flex justify-between">
                  <span>Status: <strong className={isSafe ? "text-[#2a8485]" : "text-[#DA6556]"}>{isSafe ? "Zona Bersih" : `Paparan ${prob}%`}</strong></span>
                  <span>Hotline: <strong className="text-[#2b211e]">{h.emergency_hotline || "119"}</strong></span>
                </div>

                <div className="flex justify-end pt-1 border-t border-[#2b211e]/5">
                  <button
                    type="button"
                    onClick={() => onFlyTo(hLat, hLng)}
                    className="px-2 py-0.5 bg-white hover:bg-neutral-100 border border-[#2b211e]/15 rounded text-[10px] cursor-pointer flex items-center gap-1 text-[#2b211e]/80"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Pusatkan</span>
                  </button>
                </div>
              </div>
            );
          })}

        {schools.length === 0 && hospitals.length === 0 && (
          <div className="p-4 text-center text-[#2b211e]/60 bg-white/70 rounded-lg border border-[#2b211e]/10 text-xs">
            Belum ada fasilitas terdeteksi di dalam zona bahaya simulasi ini.
          </div>
        )}
      </div>
    </div>
  );
};
