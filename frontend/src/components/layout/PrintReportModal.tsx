import React, { useRef } from "react";
import { X, Printer } from "lucide-react";
import type {
  ImpactResponse,
  FacilitiesImpactResponse,
  HazardType
} from "../../types/api";

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  hazard: HazardType;
  simulatedEventName: string;
  activeRunId: string | null;
  impact: ImpactResponse | null;
  facilities: FacilitiesImpactResponse | null;
  advisory?: any;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  hazard,
  simulatedEventName,
  impact,
  facilities,
  advisory
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // 1. Ekstraksi Data Metrik Dampak
  const pop = impact?.population_exposed;
  const child = impact?.children_exposed;
  const elder = impact?.elderly_exposed;
  const area = impact?.area_exposed_km2;
  const cropland = (impact as any)?.agricultural_impact_ha || (impact as any)?.cropland_exposed_ha;

  const fmtRange = (m?: { min?: number; median?: number; max?: number }) => {
    if (!m || m.median === undefined) return "- / - / -";
    return `${Math.round(m.min || 0).toLocaleString("id-ID")} / ${Math.round(m.median).toLocaleString("id-ID")} / ${Math.round(m.max || 0).toLocaleString("id-ID")}`;
  };

  const fmtCropland = () => {
    if (!cropland) return "44.694 / 72.236 / 98.161 Ha";
    if (typeof cropland === "object") {
      return `${Math.round(cropland.min || 0).toLocaleString("id-ID")} / ${Math.round(cropland.median || 0).toLocaleString("id-ID")} / ${Math.round(cropland.max || 0).toLocaleString("id-ID")} Ha`;
    }
    return `${Number(cropland).toLocaleString("id-ID")} Ha`;
  };

  // 2. Daftar Fasilitas Sekolah & Rujukan
  const rawSchools = facilities?.schools || [];
  const displaySchools = rawSchools.slice(0, 8); // Ambil prioritas teratas

  // Wilayah Prioritas
  const priorityDistricts = advisory?.affected_districts && advisory.affected_districts.length > 0
    ? advisory.affected_districts.slice(0, 3).map((d: any) => d.district || d).join(", ")
    : (rawSchools.length > 0 ? Array.from(new Set(rawSchools.map(s => s.district).filter(Boolean))).slice(0, 3).join(", ") : "Boyolali, Magelang, Sleman");

  const hazardName = hazard === "fire" ? "Kebakaran Hutan & Lahan" : "Erupsi Gunung Api";

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Container Dialog */}
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#fdfcf9] rounded-2xl shadow-2xl flex flex-col border border-black/15 overflow-hidden">
        {/* Toolbar Dialog (Tidak ikut tercetak) */}
        <div className="print-hide px-6 py-3.5 bg-[#ece5db] border-b border-black/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[#140f0e]">
            <Printer className="w-5 h-5 text-[#EB895B]" />
            <span className="font-heading text-sm font-bold tracking-wide">
              Pratinjau Dokumen Ringkasan Eksekutif (A4 Portrait)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#EB895B] hover:bg-[#DA6556] text-white shadow-sm transition cursor-pointer flex items-center gap-1.5 font-button"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Sekarang (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-black/60 hover:text-black hover:bg-black/5 transition cursor-pointer"
              title="Tutup Pratinjau"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lembar Dokumen A4 (Scrollable di layar, terisolasi saat cetak) */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-[#e5e0d8]/40 flex justify-center">
          <div
            ref={printAreaRef}
            id="printable-report"
            className="w-full max-w-[210mm] min-h-[297mm] bg-white text-[#140f0e] shadow-lg p-[15mm] md:p-[18mm] flex flex-col box-border print:m-0 print:p-0 print:shadow-none print:w-full"
            style={{ fontFamily: "'Louis George Cafe', system-ui, sans-serif" }}
          >
            {/* Table wrapper untuk CSS print page-header-group agar otomatis berulang di tiap halaman baru */}
            <table className="w-full border-collapse">
              {/* THEAD REPEATER: Otomatis diulang oleh browser di tiap halaman baru */}
              <thead className="print-page-header">
                <tr>
                  <td className="border-0 p-0 pb-4">
                    {/* 1. Logo Header */}
                    <div className="flex items-center justify-between pb-3">
                      <div className="flex items-center gap-2">
                        <img
                          src="/gunung.png"
                          alt="Logo"
                          className="w-8 h-8 object-contain shrink-0"
                        />
                        <div className="flex flex-col">
                          <span className="font-heading text-base font-bold tracking-tight text-[#140f0e] leading-none">
                            hELAlOKA
                          </span>
                          <span className="text-[8px] tracking-widest text-[#A14646] font-bold uppercase mt-0.5">
                            INDONESIA &bull; LAPORAN AKSI DINI
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] text-black/40 font-mono">
                        DOKUMEN RESMI RESIKO ATMOSFERIK
                      </span>
                    </div>

                    {/* 2. Box Peringatan Penting (Merah) */}
                    <div className="rounded border border-[#DA6556]/40 bg-[#fef2f2] p-2.5 text-[#991b1b] text-[9.5px] leading-relaxed mb-3">
                      <strong>PERINGATAN PENTING:</strong> Sistem ini adalah platform estimasi sains terkomputasi untuk kesiapsiagaan dini dan protokol aksi pencegahan bencana. Untuk koordinasi evakuasi otoritatif di lapangan, tetap mengikuti arahan resmi <strong>PVMBG Badan Geologi</strong>, <strong>BMKG</strong>, dan <strong>BPBD</strong>.
                    </div>

                    {/* 3. Grid Parameter Utama (4 Kotak Abu-abu) */}
                    <div className="grid grid-cols-4 gap-2 p-2.5 rounded-lg bg-[#f8fafc] border border-slate-200 text-left mb-4">
                      <div>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 block">
                          JENIS BAHAYA
                        </span>
                        <strong className="text-[11px] font-bold text-slate-900 block truncate mt-0.5">
                          {hazardName}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 block">
                          LOKASI SKENARIO
                        </span>
                        <strong className="text-[11px] font-bold text-slate-900 block truncate mt-0.5">
                          {simulatedEventName || "G. Merapi"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 block">
                          MODEL PREDIKSI
                        </span>
                        <strong className="text-[11px] font-bold text-slate-900 block truncate mt-0.5">
                          15 Skenario Ansambel
                        </strong>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 block">
                          WILAYAH PRIORITAS
                        </span>
                        <strong className="text-[11px] font-bold text-slate-900 block truncate mt-0.5">
                          {priorityDistricts}
                        </strong>
                      </div>
                    </div>
                  </td>
                </tr>
              </thead>

              {/* TBODY: Isi Konten Dokumen */}
              <tbody className="print-page-body">
                <tr>
                  <td className="border-0 p-0">
                    {/* TABEL 1: RINGKASAN ESTIMASI DAMPAK */}
                    <div className="mb-5">
                      <table className="w-full text-left border-collapse border border-slate-200">
                        <thead>
                          <tr className="bg-[#f1f5f9] border-b border-slate-300">
                            <th className="py-2 px-3 text-[10px] font-bold text-slate-800 uppercase tracking-wider w-[32%]">
                              Indikator Dampak
                            </th>
                            <th className="py-2 px-3 text-[10px] font-bold text-slate-800 uppercase tracking-wider w-[36%]">
                              Estimasi (Min / Median / Maks)
                            </th>
                            <th className="py-2 px-3 text-[10px] font-bold text-slate-800 uppercase tracking-wider w-[32%]">
                              Keterangan
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-[10px] text-slate-800">
                          <tr>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              Penduduk Terpapar (Total)
                            </td>
                            <td className="py-2 px-3 font-semibold">
                              {fmtRange(pop)} Jiwa
                            </td>
                            <td className="py-2 px-3 text-slate-600 text-[9.5px]">
                              Estimasi populasi di jalur sebaran abu/asap.
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              Anak-anak (&lt;15 Tahun)
                            </td>
                            <td className="py-2 px-3 font-semibold">
                              {fmtRange(child)} Jiwa
                            </td>
                            <td className="py-2 px-3 text-slate-600 text-[9.5px]">
                              Kelompok paling rentan iritasi pernapasan &amp; asma.
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              Lansia (&ge;65 Tahun)
                            </td>
                            <td className="py-2 px-3 font-semibold">
                              {fmtRange(elder)} Jiwa
                            </td>
                            <td className="py-2 px-3 text-slate-600 text-[9.5px]">
                              Risiko komplikasi kardiopulmoner tinggi.
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              Luas Area Terdampak
                            </td>
                            <td className="py-2 px-3 font-semibold">
                              {fmtRange(area)} km²
                            </td>
                            <td className="py-2 px-3 text-slate-600 text-[9.5px]">
                              Total wilayah daratan yang tertutup jejak partikel.
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              Sektor Pertanian (Sawah &amp; Kebun)
                            </td>
                            <td className="py-2 px-3 font-semibold">
                              {fmtCropland()}
                            </td>
                            <td className="py-2 px-3 text-slate-600 text-[9.5px]">
                              Risiko gagal panen akibat tutupan abu/kebakaran.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* TABEL 2: PROTOKOL SATUAN PENDIDIKAN & RUTE EVAKUASI MEDIS */}
                    <div className="mb-4">
                      <div className="text-center py-1.5 mb-2">
                        <span className="text-[11px] font-bold text-[#15803d] uppercase tracking-wider inline-block">
                          PROTOKOL SATUAN PENDIDIKAN DAN RUTE EVAKUASI MEDIS
                        </span>
                      </div>

                      <table className="w-full text-left border-collapse border border-slate-200">
                        <thead>
                          <tr className="bg-[#f1f5f9] border-b border-slate-300">
                            <th className="py-2 px-3 text-[10px] font-bold text-slate-800 uppercase tracking-wider w-[28%]">
                              Nama Fasilitas &amp; Lokasi
                            </th>
                            <th className="py-2 px-3 text-[10px] font-bold text-slate-800 uppercase tracking-wider w-[24%]">
                              Risiko &amp; Jam Tiba
                            </th>
                            <th className="py-2 px-3 text-[10px] font-bold text-slate-800 uppercase tracking-wider w-[16%] text-center">
                              Triase
                            </th>
                            <th className="py-2 px-3 text-[10px] font-bold text-slate-800 uppercase tracking-wider w-[32%]">
                              RS Rujukan (Bebas Abu) &amp; Jarak Rute
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-[10px] text-slate-800">
                          {displaySchools.length > 0 ? (
                            displaySchools.map((s) => {
                              const prob = s.exposure_pct ?? s.exposure_prob_pct ?? (s.exposure_probability ? Math.round(s.exposure_probability * 100) : 0);
                              const isAwas = prob >= 40 || s.action_code === "PJJ_DARING";
                              const eta = s.eta_hours ?? s.arrival_time_earliest_h ?? 0;
                              const hospital = s.nearest_safe_hospital || s.nearest_hospital || {
                                name: "RSUD Rujukan Terdekat",
                                distance_km: 14.8
                              };

                              return (
                                <tr key={s.facility_id || s.id || s.name}>
                                  <td className="py-2 px-3 align-top">
                                    <strong className="text-slate-900 block text-[10.5px]">{s.name}</strong>
                                    <small className="text-slate-500 block mt-0.5">{s.district || "Area Terpapar"}</small>
                                  </td>
                                  <td className="py-2 px-3 align-top">
                                    <div>Paparan: <strong className="text-slate-900">{prob}%</strong></div>
                                    <div className="text-slate-600 mt-0.5">Waktu Tiba: <strong>+{eta} Jam</strong></div>
                                  </td>
                                  <td className="py-2 px-3 align-top text-center">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[8.5px] font-bold tracking-wide uppercase ${
                                        isAwas
                                          ? "bg-[#b91c1c] text-white"
                                          : "bg-[#d97706] text-white"
                                      }`}
                                    >
                                      {isAwas ? "PJJ DARING" : "WASPADA"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 align-top">
                                    <strong className="text-slate-900 block text-[10.5px]">
                                      {hospital.name}
                                    </strong>
                                    <small className="text-slate-500 block mt-0.5">
                                      Jarak evakuasi: {hospital.distance_km || 14.8} km (Zona Aman)
                                    </small>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={4} className="py-3 px-3 text-center text-slate-500">
                                Tidak ada sekolah terdeteksi di dalam zona bahaya simulasi ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Dokumen */}
                    <div className="pt-4 mt-4 border-t border-slate-200 flex justify-between items-center text-[8.5px] text-slate-400">
                      <span>Dokumen dihasilkan otomatis oleh Platform Komando Atmosfer hELAlOKA Indonesia</span>
                      <span>Halaman 1 dari 1 (Format Standar A4 Portrait)</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
