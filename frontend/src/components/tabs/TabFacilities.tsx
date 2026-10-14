import React, { useState } from "react";
import { GraduationCap, FirstAid, NavigationArrow, MapPin, MagnifyingGlass } from "@phosphor-icons/react";
import type { SchoolItem, HospitalItem } from "../../types/api";

interface TabFacilitiesProps {
  schools: SchoolItem[];
  hospitals: HospitalItem[];
  currentHour?: number;
  onFlyTo: (lat: number, lng: number) => void;
  onDrawRoute: (s: SchoolItem) => void;
  activeRouteId?: string;
}

export const TabFacilities: React.FC<TabFacilitiesProps> = ({
  schools: rawSchools,
  hospitals: rawHospitals,
  currentHour: _currentHour,
  onFlyTo,
  onDrawRoute,
  activeRouteId,
}) => {
  const [filterType, setFilterType] = useState<"all" | "schools" | "hospitals">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const schools = Array.from(new Map(rawSchools.map(s => [s.facility_id || s.id || s.name, s])).values());
  const hospitals = Array.from(new Map(rawHospitals.map(h => [h.facility_id || h.id || h.name, h])).values());

  const filteredSchools = schools.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredHospitals = hospitals.filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
        <h3 className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#A14646]">
          PROTEKSI FASILITAS PUBLIK
        </h3>
        <p className="text-[11px] text-[#2b211e]/70 leading-relaxed mt-1.5 mb-2">
          Pantau status keamanan fasilitas sekolah serta panduan rute evakuasi menuju rumah sakit terdekat yang diproyeksikan aman dari abu vulkanik.
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

      {/* Search Input */}
      <div className="relative mb-2 mt-2">
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama fasilitas..."
          className="w-full bg-white border border-[#2b211e]/15 rounded-lg p-2 pl-7 text-[10px] focus:outline-none focus:border-[#EB895B] focus:ring-1 focus:ring-[#EB895B]"
        />
        <MagnifyingGlass size={14} weight="bold" className="absolute left-2 top-1/2 -translate-y-1/2 text-[#2b211e]/40" />
      </div>

      {/* List Fasilitas */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
        {/* Render Sekolah */}
        {(filterType === "all" || filterType === "schools") &&
          filteredSchools.map((s) => {
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
                  <div className="flex items-start gap-1.5 min-w-0 pt-0.5">
                    <GraduationCap size={15} weight="duotone" className="text-[#DA6556] shrink-0" />
                    <h4 className="font-bold text-[11px] leading-tight pr-1">{s.name}</h4>
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
                  <span className="text-[#2b211e]/60 leading-tight pr-2">
                    RS: {hospital.name} ({hospital.distance_km} km)
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onFlyTo(sLat, sLng)}
                      className="px-1.5 py-0.5 bg-white hover:bg-neutral-100 border border-[#2b211e]/15 rounded text-[10px] cursor-pointer"
                      title="Pusatkan di peta"
                    >
                      <MapPin size={12} weight="duotone" className="text-[#2b211e]/70" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDrawRoute(s)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 cursor-pointer border ${
                        activeRouteId === (s.id || s.facility_id || s.name)
                          ? "bg-[#DA6556] border-[#DA6556] text-white" 
                          : "bg-[#EB895B] hover:bg-[#DA6556] border-[#EB895B] hover:border-[#DA6556] text-white"
                      }`}
                      title={activeRouteId === (s.id || s.facility_id || s.name) ? "Tutup rute evakuasi" : "Lihat rute evakuasi"}
                    >
                      <NavigationArrow size={11} weight="fill" />
                      <span>{activeRouteId === (s.id || s.facility_id || s.name) ? "Tutup" : "Rute"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

        {/* Render Rumah Sakit */}
        {(filterType === "all" || filterType === "hospitals") &&
          filteredHospitals.map((h) => {
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
                  <div className="flex items-start gap-1.5 min-w-0 pt-0.5">
                    <FirstAid size={15} weight="duotone" className="text-[#2a8485] shrink-0" />
                    <h4 className="font-bold text-[11px] leading-tight pr-1">{h.name}</h4>
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
                    <MapPin size={12} weight="duotone" />
                    <span>Pusatkan</span>
                  </button>
                </div>
              </div>
            );
          })}

        {filteredSchools.length === 0 && filteredHospitals.length === 0 && (
          <div className="p-4 text-center text-[#2b211e]/60 bg-white/70 rounded-lg border border-[#2b211e]/10 text-xs">
            {searchQuery ? "Tidak ada fasilitas yang cocok dengan pencarian Anda." : "Belum ada fasilitas terdeteksi di dalam zona bahaya simulasi ini."}
          </div>
        )}
      </div>
    </div>
  );
};
