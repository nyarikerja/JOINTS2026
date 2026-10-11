import React, { useState, useEffect, useMemo } from "react";
import { 
  School, 
  Hospital, 
  Navigation, 
  MapPin, 
  Search, 
  X, 
  Loader2,
  Building2,
  AlertOctagon
} from "lucide-react";
import type { SchoolItem, HospitalItem, FacilityDecisionCardResponse } from "../../types/api";
import { api } from "../../services/api";

interface TabFacilitiesProps {
  schools: SchoolItem[];
  hospitals: HospitalItem[];
  currentHour?: number;
  onFlyTo: (lat: number, lng: number, name?: string, type?: "school" | "hospital" | string) => void;
  onDrawRoute: (s: SchoolItem) => void;
  activeRouteId?: string;
  activeRunId?: string | null;
  selectedFacilityId?: string | null;
  onSelectFacility?: (id: string | null) => void;
  selectedPlumeTier?: string | null;
  onSelectPlumeTier?: (tier: string | null) => void;
  coverage?: { complete: boolean; note: string; source: string };
  truncated?: boolean;
  totalSchools?: number;
}

// Ambang yang sama dengan backend (app/impact/exposure.py: _school_advice)
const schoolBadge = (prob: number) =>
  prob >= 90
    ? { label: "PERTIMBANGKAN PJJ", cls: "bg-red-500/15 text-red-800 border border-red-500/30" }
    : prob >= 50
      ? { label: "BATASI LUAR RUANG", cls: "bg-amber-500/15 text-amber-800 border border-amber-500/30" }
      : { label: "PANTAU", cls: "bg-emerald-500/15 text-emerald-800 border border-emerald-500/30" };

export const TabFacilities: React.FC<TabFacilitiesProps> = ({
  schools: rawSchools,
  hospitals: rawHospitals,
  currentHour = 12,
  onFlyTo,
  onDrawRoute,
  activeRouteId,
  activeRunId,
  selectedFacilityId,
  onSelectFacility,
  selectedPlumeTier,
  onSelectPlumeTier,
  coverage,
  truncated,
  totalSchools
}) => {
  // Filter Cepat Tingkat Bahaya Zona (all | minimum / P90 | mid / P50 | maximum / P05)
  const [tierFilter, setTierFilter] = useState<string>(selectedPlumeTier || "all");
  const [filterType, setFilterType] = useState<"all" | "schools" | "hospitals">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // State untuk Kartu Evaluasi Keputusan Fasilitas (GET /runs/{id}/location/{facilityId})
  const [decisionCard, setDecisionCard] = useState<FacilityDecisionCardResponse | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState<boolean>(false);

  // Sinkronkan tierFilter jika selectedPlumeTier dari klik peta berubah
  useEffect(() => {
    if (selectedPlumeTier) {
      const normalized = selectedPlumeTier === "max" ? "maximum" : selectedPlumeTier === "min" ? "minimum" : selectedPlumeTier;
      setTierFilter(normalized);
    }
  }, [selectedPlumeTier]);

  // Muat detail fasilitas saat selectedFacilityId aktif
  useEffect(() => {
    if (!selectedFacilityId || !activeRunId) {
      setDecisionCard(null);
      return;
    }

    setIsLoadingCard(true);
    api.getFacilityDecisionCard(activeRunId, selectedFacilityId)
      .then((res) => setDecisionCard(res))
      .catch((err) => {
        console.error("Gagal memuat kartu keputusan fasilitas:", err);
        setDecisionCard(null);
      })
      .finally(() => setIsLoadingCard(false));
  }, [selectedFacilityId, activeRunId]);

  // Deduplikasi data fasilitas
  const schools = useMemo(() => {
    return Array.from(new Map(rawSchools.map(s => [s.facility_id || s.id || s.name, s])).values());
  }, [rawSchools]);

  const hospitals = useMemo(() => {
    return Array.from(new Map(rawHospitals.map(h => [h.facility_id || h.id || h.name, h])).values());
  }, [rawHospitals]);

  // Filter fasilitas sesuai jam aktif dan tier
  const isFacilityExposedAtActiveHour = (fac: any, isHospital = false) => {
    if (isHospital && fac.is_safe) {
      return tierFilter === "all";
    }

    // Cek waktu tiba: asap/abu harus sudah tiba sebelum atau pada jam aktif ini
    if (fac.arrival_time_earliest_h !== null && fac.arrival_time_earliest_h !== undefined) {
      if (fac.arrival_time_earliest_h > currentHour) return false;
    }

    const expPct = fac.exposure_pct ?? fac.exposure_prob_pct ?? (fac.exposure_probability ? Math.round(fac.exposure_probability * 100) : 0);
    if (expPct < 5) return false;

    // Filter berdasarkan tingkat bahaya aktif
    if (tierFilter === "minimum" || tierFilter === "p90") {
      return expPct >= 90;
    } else if (tierFilter === "mid" || tierFilter === "p50") {
      return expPct >= 50 && expPct < 90;
    } else if (tierFilter === "maximum" || tierFilter === "p05") {
      return expPct >= 5 && expPct < 50;
    }

    return true;
  };

  // Grouping Spasial Berbasis Kecamatan (Sesuai renderDistrictHierarchy frontend-dummy)
  const districtGroups = useMemo(() => {
    const map = new Map<string, {
      name: string;
      schools: SchoolItem[];
      hospitals: HospitalItem[];
      maxExposure: number;
    }>();

    const getOrInitDistrict = (rawName?: string) => {
      let norm = (rawName || "Wilayah Sekitar").trim();
      if (!norm.toLowerCase().startsWith("kecamatan") && !norm.toLowerCase().startsWith("kec.")) {
        norm = `Kecamatan ${norm}`;
      }
      if (!map.has(norm)) {
        map.set(norm, {
          name: norm,
          schools: [],
          hospitals: [],
          maxExposure: 0
        });
      }
      return map.get(norm)!;
    };

    // Filter fasilitas sesuai jam & tier
    const activeSchools = schools.filter(s => isFacilityExposedAtActiveHour(s, false));
    const activeHospitals = hospitals.filter(h => isFacilityExposedAtActiveHour(h, true));

    activeSchools.forEach(sch => {
      const dObj = getOrInitDistrict(sch.district);
      dObj.schools.push(sch);
      const exp = sch.exposure_pct ?? sch.exposure_prob_pct ?? (sch.exposure_probability ? Math.round(sch.exposure_probability * 100) : 0);
      if (exp > dObj.maxExposure) dObj.maxExposure = exp;
    });

    activeHospitals.forEach(h => {
      const dObj = getOrInitDistrict(h.district);
      dObj.hospitals.push(h);
      const exp = h.exposure_pct ?? h.exposure_prob_pct ?? (h.exposure_probability ? Math.round(h.exposure_probability * 100) : 0);
      if (exp > dObj.maxExposure) dObj.maxExposure = exp;
    });

    // Urutkan kecamatan berdasarkan tingkat bahaya / paparan tertinggi
    return Array.from(map.values())
      .filter(d => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const matchName = d.name.toLowerCase().includes(q);
        const matchSch = d.schools.some(s => s.name.toLowerCase().includes(q));
        const matchHosp = d.hospitals.some(h => h.name.toLowerCase().includes(q));
        return matchName || matchSch || matchHosp;
      })
      .sort((a, b) => b.maxExposure - a.maxExposure);
  }, [schools, hospitals, currentHour, tierFilter, searchQuery]);

  const highRiskCount = schools.filter(s => {
    const p = s.exposure_pct ?? s.exposure_prob_pct ?? (s.exposure_probability ? Math.round(s.exposure_probability * 100) : 0);
    return p >= 90;
  }).length;

  const safeHospCount = hospitals.filter(h => {
    const p = h.exposure_pct ?? h.exposure_prob_pct ?? (h.exposure_probability ? Math.round(h.exposure_probability * 100) : 0);
    return h.is_safe !== undefined ? h.is_safe : p < 10;
  }).length;

  return (
    <div className="space-y-3 text-xs text-[#2b211e]">
      {(coverage || truncated) && (
        <div className="text-[9.5px] leading-snug text-[#2b211e]/70 bg-white/80 border border-[#2b211e]/10 rounded-lg p-2 space-y-0.5">
          <div>Data fasilitas: {coverage?.source || "OpenStreetMap"}</div>
          {coverage && !coverage.complete && <div className="text-amber-800">{coverage.note}</div>}
          {truncated && <div>Daftar dipotong ke 500 sekolah teratas dari {totalSchools?.toLocaleString("id-ID")} sekolah berpeluang terpapar.</div>}
        </div>
      )}
      {/* 1. Header & Ringkasan Cepat */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Building2 className="w-3.5 h-3.5 text-[#EB895B]" />
          <h3 className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#A14646]">
            LINGKUP WILAYAH &amp; FASILITAS PUBLIK
          </h3>
        </div>
        <p className="text-[10px] text-[#2b211e]/70 leading-relaxed mb-2">
          Fasilitas OSM di jalur sebaran, dikelompokkan per wilayah (tag alamat OSM), dengan rute jalan OSRM ke RS rujukan di luar jalur paparan.
        </p>

        {/* Mini KPI Fasilitas */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2 shadow-xs">
            <span className="text-[9px] text-[#2b211e]/60 block font-medium">Sekolah peluang ≥ 90% (pertimbangkan PJJ)</span>
            <div className="font-sans text-xs font-bold text-[#DA6556] mt-0.5">
              {highRiskCount} <span className="text-[9px] font-normal text-[#2b211e]/50">/ {schools.length} Unit</span>
            </div>
          </div>
          <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2 shadow-xs">
            <span className="text-[9px] text-[#2b211e]/60 block font-medium">RS rujukan di luar jalur (&lt; 10%)</span>
            <div className="font-sans text-xs font-bold text-[#2a8485] mt-0.5">
              {safeHospCount} <span className="text-[9px] font-normal text-[#2b211e]/50">/ {hospitals.length} Unit</span>
            </div>
          </div>
        </div>

        {/* Panduan Cepat Standar Tindakan Sekolah */}
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-2 text-[10px] space-y-1">
          <strong className="text-sky-900 font-bold block">Panduan Standar Perlindungan Siswa:</strong>
          <ul className="space-y-0.5 text-[#2b211e]/80 pl-3 list-disc">
            <li>
              <strong>Peluang &ge; 90%:</strong> <span className="text-red-700 font-semibold">[PELUANG SANGAT TINGGI]</span> Pertimbangkan PJJ daring bersama dinas pendidikan/BPBD; siapkan masker N95.
            </li>
            <li>
              <strong>Peluang 50%&ndash;89%:</strong> <span className="text-amber-800 font-semibold">[PELUANG SEDANG]</span> Batasi olahraga/upacara di luar gedung.
            </li>
          </ul>
        </div>
      </div>

      {/* 2. Banner Zona Plume yang Diklik di Peta (Jika Ada) */}
      {tierFilter !== "all" && (
        <div className="p-2.5 rounded-lg border text-[10px] space-y-1 bg-amber-500/10 border-amber-500/30 text-amber-900">
          <div className="flex items-center justify-between">
            <strong className="font-bold flex items-center gap-1 text-[11px] text-[#A14646]">
              <AlertOctagon className="w-3.5 h-3.5 text-[#DA6556]" />
              <span>
                {tierFilter === "minimum" || tierFilter === "p90" 
                  ? "Zona peluang ≥ 90% (inti)" 
                  : tierFilter === "mid" || tierFilter === "p50" 
                  ? "Zona peluang ≥ 50%" 
                  : "Zona peluang ≥ 5% (jangkauan terjauh)"}
              </span>
            </strong>
            <button
              type="button"
              onClick={() => {
                setTierFilter("all");
                onSelectPlumeTier?.("all");
              }}
              className="px-1.5 py-0.5 bg-white border border-[#2b211e]/15 rounded text-[9px] font-semibold text-[#2b211e] hover:bg-neutral-100 cursor-pointer"
            >
              Semua Tingkat &times;
            </button>
          </div>
          <p className="text-[9px] text-[#2b211e]/75 leading-relaxed">
            Menampilkan kecamatan dan fasilitas yang berada di dalam zona peluang paparan terpilih pada peta.
          </p>
        </div>
      )}

      {/* 3. Detail Kartu Evaluasi Fasilitas (Decision Card via /runs/{id}/location/{facilityId}) */}
      {(decisionCard || isLoadingCard) && (
        <div className="bg-white border-2 border-[#0284c7] rounded-xl p-3 shadow-md space-y-2 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-800 font-bold uppercase">
                KARTU EVALUASI TITIK TERPILIH
              </span>
              <h4 className="font-bold text-xs text-[#2b211e] mt-1 leading-snug">
                {decisionCard?.name || "Memuat Fasilitas..."}
              </h4>
              <span className="text-[9px] text-[#2b211e]/60 block">
                {decisionCard?.district} • {decisionCard?.facility_type?.toUpperCase()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSelectFacility?.(null)}
              className="text-[#2b211e]/50 hover:text-[#2b211e] p-1 cursor-pointer"
              title="Tutup Kartu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {isLoadingCard ? (
            <div className="flex items-center justify-center p-4 text-[#2b211e]/50 gap-1.5 text-[10px]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0284c7]" />
              <span>Mengevaluasi risiko spasial fasilitas...</span>
            </div>
          ) : decisionCard && (
            <div className="space-y-1.5 text-[10px]">
              <div className="grid grid-cols-2 gap-1.5 bg-[#f7f3ed] p-2 rounded-lg">
                <div>
                  <span className="text-[9px] text-[#2b211e]/60 block">Peluang Paparan:</span>
                  <strong className={`font-mono text-xs ${
                    decisionCard.exposure_probability >= 0.9 
                      ? "text-red-700" 
                      : decisionCard.exposure_probability >= 0.5 
                      ? "text-amber-700" 
                      : "text-emerald-700"
                  }`}>
                    {Math.round(decisionCard.exposure_probability * 100)}%
                  </strong>
                </div>
                <div>
                  <span className="text-[9px] text-[#2b211e]/60 block">Waktu Tiba Tercepat:</span>
                  <strong className="font-mono text-xs text-[#2b211e]">
                    {decisionCard.arrival_time_earliest_h !== null 
                      ? `T + ${Math.round(decisionCard.arrival_time_earliest_h)} jam` 
                      : "Di luar jejak"}
                  </strong>
                </div>
              </div>

              {/* Rekomendasi Operasional Pencegahan */}
              <div className="p-2 rounded bg-sky-500/10 border-l-3 border-[#0284c7] text-[#2b211e] space-y-0.5">
                <strong className="text-sky-900 font-bold block text-[10px]">
                  REKOMENDASI OPERASIONAL PENCEGAHAN:
                </strong>
                <p className="text-[9.5px] leading-relaxed text-[#2b211e]/85">
                  {decisionCard.exposure_probability >= 0.9
                    ? (decisionCard.facility_type === "school"
                        ? "[PELUANG SANGAT TINGGI] Pertimbangkan PJJ daring bersama dinas pendidikan/BPBD sebelum sebaran tiba; siapkan masker N95/KN95."
                        : "[PELUANG SANGAT TINGGI] Periksa stok oksigen, nebulizer, dan masker N95 untuk nakes.")
                    : decisionCard.exposure_probability >= 0.5
                    ? (decisionCard.facility_type === "school"
                        ? "[PELUANG SEDANG] Batasi olahraga/upacara di luar gedung dan siapkan masker N95 di UKS."
                        : "[PELUANG SEDANG] Pastikan masker partikulat dan obat pernapasan tersedia.")
                    : "[PELUANG RENDAH] Pantau informasi resmi BMKG/PVMBG/BPBD."}
                </p>
              </div>

              {/* Rujukan Terdekat */}
              {decisionCard.nearest_safe_hospital && (
                <div className="flex items-center justify-between p-1.5 bg-[#f7f3ed] rounded text-[9.5px]">
                  <span className="text-[#2b211e]/70">
                    RS Rujukan Aman: <strong>{decisionCard.nearest_safe_hospital.name}</strong> ({decisionCard.nearest_safe_hospital.distance_km} km)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const matched = schools.find(s => (s.id || s.facility_id) === decisionCard.facility_id);
                      if (matched) onDrawRoute(matched);
                    }}
                    className="px-2 py-0.5 bg-[#EB895B] hover:bg-[#DA6556] text-white rounded font-medium flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Navigation className="w-2.5 h-2.5" />
                    <span>Rute</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Filter Tingkat Bahaya Zona & Jenis Fasilitas */}
      <div className="space-y-1.5 pt-1 border-t border-[#2b211e]/10">
        <div>
          <span className="text-[9px] font-bold text-[#2b211e]/60 uppercase tracking-wide block mb-1">
            Filter Tingkat Bahaya Zona:
          </span>
          <div className="grid grid-cols-4 gap-1 text-[9px] font-medium">
            <button
              type="button"
              onClick={() => {
                setTierFilter("all");
                onSelectPlumeTier?.("all");
              }}
              className={`py-1 px-1 rounded transition cursor-pointer border text-center ${
                tierFilter === "all"
                  ? "bg-[#EB895B] border-[#EB895B] text-white font-bold"
                  : "bg-white border-[#2b211e]/15 text-[#2b211e]/70 hover:bg-black/5"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => {
                setTierFilter("minimum");
                onSelectPlumeTier?.("minimum");
              }}
              className={`py-1 px-1 rounded transition cursor-pointer border text-center ${
                tierFilter === "minimum" || tierFilter === "p90"
                  ? "bg-[#DA6556] border-[#DA6556] text-white font-bold"
                  : "bg-white border-red-300 text-red-700 hover:bg-red-50"
              }`}
            >
              ≥ 90%
            </button>
            <button
              type="button"
              onClick={() => {
                setTierFilter("mid");
                onSelectPlumeTier?.("mid");
              }}
              className={`py-1 px-1 rounded transition cursor-pointer border text-center ${
                tierFilter === "mid" || tierFilter === "p50"
                  ? "bg-amber-600 border-amber-600 text-white font-bold"
                  : "bg-white border-amber-300 text-amber-700 hover:bg-amber-50"
              }`}
            >
              ≥ 50%
            </button>
            <button
              type="button"
              onClick={() => {
                setTierFilter("maximum");
                onSelectPlumeTier?.("maximum");
              }}
              className={`py-1 px-1 rounded transition cursor-pointer border text-center ${
                tierFilter === "maximum" || tierFilter === "p05"
                  ? "bg-amber-500 border-amber-500 text-white font-bold"
                  : "bg-white border-yellow-300 text-yellow-800 hover:bg-yellow-50"
              }`}
            >
              ≥ 5%
            </button>
          </div>
        </div>

        {/* Filter Jenis Fasilitas */}
        <div className="grid grid-cols-3 gap-1 pt-1 text-[9.5px]">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`py-1 rounded transition cursor-pointer border text-center ${
              filterType === "all" ? "bg-[#2b211e] text-white font-bold border-[#2b211e]" : "bg-white border-[#2b211e]/15 text-[#2b211e]/70"
            }`}
          >
            Semua Fasilitas
          </button>
          <button
            type="button"
            onClick={() => setFilterType("schools")}
            className={`py-1 rounded transition cursor-pointer border text-center ${
              filterType === "schools" ? "bg-[#2b211e] text-white font-bold border-[#2b211e]" : "bg-white border-[#2b211e]/15 text-[#2b211e]/70"
            }`}
          >
            Hanya Sekolah
          </button>
          <button
            type="button"
            onClick={() => setFilterType("hospitals")}
            className={`py-1 rounded transition cursor-pointer border text-center ${
              filterType === "hospitals" ? "bg-[#2b211e] text-white font-bold border-[#2b211e]" : "bg-white border-[#2b211e]/15 text-[#2b211e]/70"
            }`}
          >
            Hanya RS &amp; Faskes
          </button>
        </div>

        {/* Input Pencarian Nama */}
        <div className="relative pt-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kecamatan, nama sekolah atau rumah sakit..."
            className="w-full bg-white border border-[#2b211e]/20 rounded-lg p-1.5 pl-7 text-[10px] text-[#2b211e] focus:outline-none focus:border-[#EB895B]"
          />
          <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-[#2b211e]/40" />
        </div>
      </div>

      {/* 4. Banner Zona Bahaya Terpilih di Peta */}
      {tierFilter !== "all" && (
        <div
          className="p-2.5 rounded-lg border text-[11px] select-none transition-all"
          style={{
            background:
              tierFilter === "minimum" || tierFilter === "p90"
                ? "rgba(220, 38, 38, 0.12)"
                : tierFilter === "mid" || tierFilter === "p50"
                ? "rgba(245, 158, 11, 0.12)"
                : "rgba(251, 191, 36, 0.12)",
            borderColor:
              tierFilter === "minimum" || tierFilter === "p90"
                ? "#dc2626"
                : tierFilter === "mid" || tierFilter === "p50"
                ? "#f59e0b"
                : "#fbbf24",
            borderLeftWidth: "4px"
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <strong
              style={{
                color:
                  tierFilter === "minimum" || tierFilter === "p90"
                    ? "#b91c1c"
                    : tierFilter === "mid" || tierFilter === "p50"
                    ? "#b45309"
                    : "#a16207"
              }}
            >
              {tierFilter === "minimum" || tierFilter === "p90"
                ? "Zona peluang ≥ 90%"
                : tierFilter === "mid" || tierFilter === "p50"
                ? "Zona peluang ≥ 50%"
                : "Zona peluang ≥ 5%"}
            </strong>
            <button
              type="button"
              onClick={() => {
                setTierFilter("all");
                onSelectPlumeTier?.("all");
              }}
              className="text-[9.5px] px-1.5 py-0.5 rounded bg-white/80 hover:bg-white border text-neutral-800 cursor-pointer font-medium"
            >
              Semua Tingkat &times;
            </button>
          </div>
          <p className="text-[10px] text-[#2b211e]/80 leading-relaxed">
            {tierFilter === "minimum" || tierFilter === "p90"
              ? "Peluang paparan ≥ 90%. Wilayah inti konsentrasi partikel sangat tinggi. Mandat PJJ daring dan masker N95."
              : tierFilter === "mid" || tierFilter === "p50"
              ? "Peluang paparan 50% - 89%. Potensi sebaran lebat. Batasi aktivitas luar ruang siswa."
              : "Peluang paparan 5% - 49%. Area terluar sebaran abu halus tertiup angin."}
          </p>
        </div>
      )}

      {/* 5. Kontainer Utama Hierarki Spasial Berbasis Kecamatan */}
      <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar pt-1">
        {districtGroups.length === 0 ? (
          <div className="p-4 text-center text-[#2b211e]/60 bg-white border border-[#2b211e]/10 rounded-lg text-xs">
            {searchQuery 
              ? "Tidak ada wilayah atau fasilitas yang cocok dengan filter pencarian."
              : "Tidak ada sekolah atau fasilitas kesehatan di zona risiko paparan saat jam ini."}
          </div>
        ) : (
          districtGroups.map((d) => {
            const displaySchools = filterType === "hospitals" ? [] : d.schools;
            const displayHospitals = filterType === "schools" ? [] : d.hospitals;

            if (displaySchools.length === 0 && displayHospitals.length === 0) return null;

            // Tentukan status badge kecamatan
            let badgeBg = "bg-sky-500/15 text-sky-800 border-sky-500/30";
            let badgeLabel = "[PELUANG RENDAH]";
            if (d.maxExposure >= 90) {
              badgeBg = "bg-red-500/15 text-red-800 border-red-500/30 font-bold";
              badgeLabel = "[PELUANG SANGAT TINGGI]";
            } else if (d.maxExposure >= 50) {
              badgeBg = "bg-amber-500/15 text-amber-800 border-amber-500/30 font-bold";
              badgeLabel = "[PELUANG SEDANG]";
            }

            return (
              <div 
                key={d.name}
                className="bg-white border border-[#2b211e]/10 rounded-xl p-2.5 shadow-xs space-y-2 text-[#2b211e]"
              >
                {/* Header Kecamatan */}
                <div className="flex items-center justify-between border-b border-[#2b211e]/5 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#EB895B]" />
                    <strong className="text-[11px] text-[#2b211e] font-bold">
                      {d.name}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-[#2b211e]/60">
                      {displaySchools.length > 0 && `${displaySchools.length} Sekolah`}
                      {displaySchools.length > 0 && displayHospitals.length > 0 && " • "}
                      {displayHospitals.length > 0 && `${displayHospitals.length} Faskes`}
                    </span>
                    <span className={`text-[8.5px] px-1.5 py-0.2 rounded border font-mono ${badgeBg}`}>
                      {badgeLabel}
                    </span>
                  </div>
                </div>

                {/* Sub-seksi Sekolah di Kecamatan Ini */}
                {displaySchools.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-[#DA6556] uppercase tracking-wider block">
                      Satuan Pendidikan:
                    </span>
                    <div className="space-y-1">
                      {displaySchools.map((s) => {
                        const prob = s.exposure_pct ?? s.exposure_prob_pct ?? (s.exposure_probability ? Math.round(s.exposure_probability * 100) : 0);
                        const badge = schoolBadge(prob);
                        const sLat = s.lat ?? s.latitude ?? 0;
                        const sLng = s.lng ?? s.longitude ?? 0;
                        const eta = s.arrival_time_earliest_h ?? null;
                        const hospital = s.nearest_safe_hospital || s.nearest_hospital || null;
                        const isSelected = selectedFacilityId === (s.facility_id || s.id);

                        return (
                          <div 
                            key={`sch-${s.facility_id || s.id || s.name}`}
                            className={`p-2 rounded-lg border transition text-[10px] space-y-1 ${
                              isSelected 
                                ? "bg-sky-500/10 border-[#0284c7]" 
                                : "bg-[#f7f3ed]/60 hover:bg-[#f7f3ed] border-[#2b211e]/8"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-start gap-1">
                                <School className="w-3.5 h-3.5 text-[#DA6556] shrink-0 mt-0.5" />
                                <span className="font-semibold text-[#2b211e] leading-snug">
                                  {s.name}
                                </span>
                              </div>
                              <span className={`text-[8.5px] px-1 py-0.2 rounded font-semibold shrink-0 ${badge.cls}`}>{badge.label}</span>
                            </div>

                            <div className="flex items-center justify-between text-[9px] text-[#2b211e]/70">
                              <span>Paparan: <strong className="font-mono text-[#2b211e]">{prob}%</strong></span>
                              <span>Tiba: <strong className="font-mono text-[#2b211e]">{eta !== null ? `+${eta} jam` : "-"}</strong></span>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-[#2b211e]/5 text-[9px]">
                              <span className="text-[#2b211e]/60 truncate max-w-[150px]" title={hospital ? `${hospital.name} (${hospital.distance_km} km garis lurus)` : undefined}>
                                {hospital ? `RS: ${hospital.name} (${hospital.distance_km} km)` : "RS rujukan OSM tidak ditemukan"}
                              </span>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectFacility?.(s.facility_id || s.id || null);
                                    onFlyTo(sLat, sLng, s.name, "school");
                                  }}
                                  className="px-1.5 py-0.5 bg-white border border-[#2b211e]/15 rounded hover:bg-neutral-100 cursor-pointer flex items-center gap-1"
                                  title="Pusatkan dan lihat detail sekolah di peta"
                                >
                                  <MapPin className="w-2.5 h-2.5" />
                                  <span>Pusatkan</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDrawRoute(s)}
                                  disabled={!hospital}
                                  className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 cursor-pointer text-white ${
                                    activeRouteId === (s.id || s.facility_id || s.name)
                                      ? "bg-[#DA6556]"
                                      : "bg-[#EB895B] hover:bg-[#DA6556]"
                                  }`}
                                  title="Rute evakuasi ke RS"
                                >
                                  <Navigation className="w-2.5 h-2.5" />
                                  <span>{activeRouteId === (s.id || s.facility_id || s.name) ? "Tutup" : "Rute"}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub-seksi Rumah Sakit di Kecamatan Ini */}
                {displayHospitals.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-[#2b211e]/5">
                    <span className="text-[9px] font-bold text-[#2a8485] uppercase tracking-wider block">
                      Fasilitas Pelayanan Kesehatan:
                    </span>
                    <div className="space-y-1">
                      {displayHospitals.map((h) => {
                        const prob = h.exposure_pct ?? h.exposure_prob_pct ?? (h.exposure_probability ? Math.round(h.exposure_probability * 100) : 0);
                        const isSafe = h.is_safe !== undefined ? h.is_safe : prob < 10;
                        const hLat = h.lat ?? h.latitude ?? 0;
                        const hLng = h.lng ?? h.longitude ?? 0;
                        const isSelected = selectedFacilityId === (h.facility_id || h.id);

                        return (
                          <div 
                            key={`hosp-${h.facility_id || h.id || h.name}`}
                            className={`p-2 rounded-lg border transition text-[10px] space-y-1 ${
                              isSelected 
                                ? "bg-sky-500/10 border-[#0284c7]" 
                                : "bg-[#f7f3ed]/60 hover:bg-[#f7f3ed] border-[#2b211e]/8"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-start gap-1">
                                <Hospital className="w-3.5 h-3.5 text-[#2a8485] shrink-0 mt-0.5" />
                                <span className="font-semibold text-[#2b211e] leading-snug">
                                  {h.name}
                                </span>
                              </div>
                              <span className={`text-[8.5px] px-1 py-0.2 rounded font-semibold shrink-0 ${
                                isSafe
                                  ? "bg-emerald-500/15 text-emerald-800 border border-emerald-500/30"
                                  : "bg-red-500/15 text-red-800 border border-red-500/30"
                              }`}>
                                {isSafe ? "DI LUAR JALUR" : `TERPAPAR ${prob}%`}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[9px] text-[#2b211e]/70">
                              <span>Darurat: <strong className="text-[#2b211e]">{h.emergency_hotline || "119 / 112"}</strong></span>
                              <span>Dari sumber: <strong className="font-mono text-[#2b211e]">{(h.distance_from_source_km ?? h.distance_from_epicenter_km) !== undefined ? `${Math.round((h.distance_from_source_km ?? h.distance_from_epicenter_km) as number)} km` : "-"}</strong></span>
                            </div>

                            <div className="flex justify-end pt-1 border-t border-[#2b211e]/5">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectFacility?.(h.facility_id || h.id || null);
                                  onFlyTo(hLat, hLng, h.name, "hospital");
                                }}
                                className="px-2 py-0.5 bg-white border border-[#2b211e]/15 rounded hover:bg-neutral-100 text-[9px] font-medium cursor-pointer flex items-center gap-1"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                                <span>Pusatkan di Peta</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
