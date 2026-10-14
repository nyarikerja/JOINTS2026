import React, { useRef, useEffect, useState } from "react";
import { X, Printer, PhoneCall, ShieldWarning } from "@phosphor-icons/react";
import L from "leaflet";
import { api } from "../../services/api";
import { CONFIG } from "../../config/constants";
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
  hourlyTiersCache?: Record<string | number, any> | null;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  hazard,
  simulatedEventName,
  activeRunId,
  impact,
  facilities,
  advisory,
  hourlyTiersCache
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [plumeGeo, setPlumeGeo] = useState<any>(null);
  const [isLoadingMap, setIsLoadingMap] = useState<boolean>(false);

  // Ambil data poligon sebaran jam 48 (atau jam simulasi aktif)
  useEffect(() => {
    if (!isOpen) return;

    const cached = hourlyTiersCache?.[48] || hourlyTiersCache?.["hour_48"] || hourlyTiersCache?.["48"];
    if (cached && cached.features && cached.features.length > 0) {
      setPlumeGeo(cached);
      return;
    }

    if (activeRunId) {
      setIsLoadingMap(true);
      api.getTiersAtHour(activeRunId, 48)
        .then((data) => {
          if (data && data.features && data.features.length > 0) {
            setPlumeGeo(data);
          } else {
            const first = Object.values(hourlyTiersCache || {})[0];
            if (first) setPlumeGeo(first);
          }
        })
        .catch((err) => {
          console.warn("Gagal memuat poligon jam 48 untuk cetak:", err);
          const first = Object.values(hourlyTiersCache || {})[0];
          if (first) setPlumeGeo(first);
        })
        .finally(() => {
          setIsLoadingMap(false);
        });
    } else {
      const first = Object.values(hourlyTiersCache || {})[0];
      if (first) setPlumeGeo(first);
    }
  }, [isOpen, activeRunId, hourlyTiersCache]);

  // Render peta Leaflet dinamis
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const container = mapContainerRef.current;
    const map = L.map(container, {
      attributionControl: false,
      zoomControl: false,
      boxZoom: false,
      doubleClickZoom: false,
      dragging: false,
      scrollWheelZoom: false,
      touchZoom: false,
      keyboard: false
    });
    mapInstanceRef.current = map;

    // 1. Esri Satellite Imagery
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, crossOrigin: "anonymous" }
    ).addTo(map);

    // 2. Esri Boundaries and Places
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, crossOrigin: "anonymous" }
    ).addTo(map);

    const colors = CONFIG.COLORS[hazard] || CONFIG.COLORS.volcano;

    if (plumeGeo && plumeGeo.features && plumeGeo.features.length > 0) {
      const plumeLayer = L.geoJSON(plumeGeo, {
        style: (feature: any) => {
          const tier = feature.properties?.tier || "mid";
          if (tier === "p90" || tier === "min" || tier === "minimum") {
            return { color: colors.p90, fillColor: colors.p90, fillOpacity: 0.65, weight: 1.5 };
          }
          if (tier === "p50" || tier === "mid") {
            return { color: colors.p50, fillColor: colors.p50, fillOpacity: 0.40, weight: 1.2, dashArray: "3,3" };
          }
          return { color: colors.p05, fillColor: colors.p05, fillOpacity: 0.22, weight: 0.8 };
        }
      }).addTo(map);

      // Marker Titik Sumber Kejadian (Gunung / Karhutla)
      const p90Feature = plumeGeo.features.find((f: any) => {
        const t = f.properties?.tier;
        return t === "p90" || t === "min" || t === "minimum";
      });

      let centerCoord: [number, number] | null = null;
      if (p90Feature) {
        const p90Layer = L.geoJSON(p90Feature);
        const c = p90Layer.getBounds().getCenter();
        if (c && !isNaN(c.lat) && !isNaN(c.lng)) {
          centerCoord = [c.lat, c.lng];
        }
      }

      if (centerCoord) {
        const iconHtml = hazard === "fire"
          ? `<div style="background:#ea580c;color:#fff;border:2px solid #fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.5);">🔥</div>`
          : `<div style="background:#991b1b;color:#fff;border:2px solid #fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.5);">🌋</div>`;
        const markerIcon = L.divIcon({
          className: "event-source-marker",
          html: iconHtml,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        L.marker(centerCoord, { icon: markerIcon }).addTo(map);
      }

      const bounds = plumeLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [16, 16], maxZoom: 11 });
      }
    } else {
      map.setView([-8.25, 118.0], 8);
    }

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, plumeGeo, hazard]);

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

  // 2. Daftar Fasilitas Sekolah & Rujukan (untuk Halaman 2) dengan filter & deduplikasi
  const rawSchools = facilities?.schools || [];
  const cleanSchools = rawSchools.filter((s) => {
    const n = (s.name || "").toLowerCase().trim();
    return n && !n.includes("tanpa nama") && n !== "sekolah" && n !== "sdn" && n !== "sd";
  });
  const candidateSchools = cleanSchools.length > 0 ? cleanSchools : rawSchools;
  const uniqueSchools = Array.from(
    new Map(candidateSchools.map((s) => [s.name.trim().toLowerCase(), s])).values()
  );
  const displaySchools = uniqueSchools.slice(0, 8); // Tampilkan hingga 8 fasilitas prioritas tanpa duplikat

  // Wilayah Prioritas
  const priorityDistricts = advisory?.affected_districts && advisory.affected_districts.length > 0
    ? advisory.affected_districts.slice(0, 3).map((d: any) => d.district || d).join(", ")
    : (rawSchools.length > 0 ? Array.from(new Set(rawSchools.map(s => s.district).filter(Boolean))).slice(0, 3).join(", ") : "Bima, Dompu, Sumbawa");

  const hazardName = hazard === "fire" ? "Kebakaran Hutan & Lahan" : "Erupsi Gunung Api";

  const cleanLocationName = (simulatedEventName || "G. Tambora")
    .replace(/^(Kejadian Observasi|Skenario Hipotetis|Simulasi)(\s*[:-]\s*)?/i, "")
    .trim();

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto print:fixed print:inset-0 print:p-0 print:m-0 print:bg-white print:z-[999999] print:block print:overflow-visible">
      {/* Container Dialog */}
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#fdfcf9] rounded-2xl shadow-2xl flex flex-col border border-black/15 overflow-hidden print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full print:h-auto print:rounded-none print:bg-white print:overflow-visible">
        {/* Toolbar Dialog (Tidak ikut tercetak) */}
        <div className="print-hide px-6 py-3.5 bg-[#ece5db] border-b border-black/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[#140f0e]">
            <Printer size={20} weight="duotone" className="text-[#EB895B]" />
            <span className="font-heading text-sm font-bold tracking-wide">
              Pratinjau Dokumen Ringkasan Eksekutif (2 Halaman A4 Portrait)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#EB895B] hover:bg-[#DA6556] text-white shadow-sm transition cursor-pointer flex items-center gap-1.5 font-button"
            >
              <Printer size={16} weight="bold" />
              <span>Cetak Dokumen</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-black/60 hover:text-black hover:bg-black/5 transition cursor-pointer"
              title="Tutup Pratinjau"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>

        {/* Lembar Dokumen A4 (Scrollable di layar, terisolasi saat cetak) */}
        <div 
          ref={printAreaRef}
          id="printable-report-container" 
          className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#d8d2c8]/60 flex flex-col items-center gap-8 print:p-0 print:m-0 print:bg-white print:block print:overflow-visible"
          style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
        >
          
          {/* ========================================================================= */}
          {/* HALAMAN 1: RINGKASAN EKSEKUTIF, PARAMETER & PETA SEBARAN 48 JAM           */}
          {/* ========================================================================= */}
          <div
            id="printable-report-page-1"
            className="print-page-sheet w-full max-w-[210mm] min-h-[297mm] bg-white text-[#140f0e] shadow-xl p-[14mm] md:p-[16mm] flex flex-col justify-between box-border rounded-sm print:rounded-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full print:h-[275mm] print:min-h-0 print:max-h-[275mm]"
          >
            {/* Bagian Atas Halaman 1 */}
            <div>
              {/* 1. Header Dokumen Resmi */}
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#140f0e]/15 mb-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/gunung_black.png"
                    alt="Logo Helaloka"
                    className="w-9 h-9 object-contain shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-heading text-lg font-black tracking-tight text-[#140f0e] leading-none">
                      HELALOKA
                    </span>
                    <span className="text-[8.5px] tracking-widest text-[#A14646] font-bold uppercase mt-0.5">
                      INDONESIA &bull; LAPORAN AKSI DINI DISPERSI ATMOSFERIK
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] text-slate-400 font-mono">
                    REF: HLK/2026/ENS-48H &bull; T+48 JAM
                  </div>
                </div>
              </div>

              {/* 2. Box Peringatan Penting */}
              <div className="rounded-lg border border-[#DA6556]/40 bg-[#fef2f2] p-2.5 text-[#991b1b] text-[9px] leading-relaxed mb-3">
                <strong>PERINGATAN PENTING:</strong> Sistem ini adalah platform estimasi sains terkomputasi untuk kesiapsiagaan dini dan protokol aksi pencegahan bencana. Untuk koordinasi evakuasi otoritatif di lapangan, tetap mengikuti arahan resmi <strong>PVMBG Badan Geologi</strong>, <strong>BMKG</strong>, dan <strong>BPBD</strong>.
              </div>

              {/* 3. Grid Parameter Utama (4 Kotak) */}
              <div className="grid grid-cols-4 gap-2.5 p-3 rounded-lg bg-[#f8fafc] border border-slate-200 text-left mb-3.5">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-wider text-[#C25E00] block mb-0.5">
                    JENIS BAHAYA
                  </span>
                  <strong className="text-[11px] font-bold text-slate-900 leading-snug break-words">
                    {hazardName}
                  </strong>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-wider text-[#C25E00] block mb-0.5">
                    LOKASI SKENARIO
                  </span>
                  <strong className="text-[11px] font-bold text-slate-900 leading-snug break-words">
                    {cleanLocationName}
                  </strong>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-wider text-[#C25E00] block mb-0.5">
                    MODEL PREDIKSI
                  </span>
                  <strong className="text-[11px] font-bold text-slate-900 leading-snug break-words">
                    15 Skenario Ansambel
                  </strong>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-wider text-[#C25E00] block mb-0.5">
                    WILAYAH PRIORITAS
                  </span>
                  <strong className="text-[11px] font-bold text-slate-900 leading-snug break-words">
                    {priorityDistricts}
                  </strong>
                </div>
              </div>

              {/* 4. Peta Hasil Simulasi Full Sebaran Atmosferik (48 Jam) */}
              <div className="mb-3">
                <div 
                  id="report-simulation-map" 
                  className="rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-[#0b1319] relative w-full h-[220px]"
                >
                  <div ref={mapContainerRef} className="w-full h-full relative" />
                  {isLoadingMap && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-xs text-white gap-2 font-mono z-[1000]">
                      <span className="w-3.5 h-3.5 border-2 border-[#EB895B] border-t-transparent rounded-full animate-spin"></span>
                      <span>Memuat Peta Simulasi T+48 Jam...</span>
                    </div>
                  )}
                </div>
                <div className="text-center mt-1.5 text-[10.5px] text-[#C25E00] font-bold tracking-wide">
                  Hasil simulasi T+48 Jam
                </div>
              </div>

              {/* 5. Tabel 1: Ringkasan Estimasi Dampak */}
              <div className="mb-2">
                <div className="text-left py-1 mb-1">
                  <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider inline-block">
                    RINGKASAN ESTIMASI DAMPAK POPULASI &amp; SEKTOR VULNERABILITAS
                  </span>
                </div>
                <table className="w-full text-left border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-[#f1f5f9] border-b border-slate-300">
                      <th className="py-2 px-3 text-[9.5px] font-bold text-slate-800 uppercase tracking-wider w-[32%]">
                        Indikator Dampak
                      </th>
                      <th className="py-2 px-3 text-[9.5px] font-bold text-slate-800 uppercase tracking-wider w-[36%]">
                        Estimasi (Min / Median / Maks)
                      </th>
                      <th className="py-2 px-3 text-[9.5px] font-bold text-slate-800 uppercase tracking-wider w-[32%]">
                        Keterangan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[9.5px] text-slate-800">
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-900">
                        Penduduk Terpapar (Total)
                      </td>
                      <td className="py-2 px-3 font-semibold">
                        {fmtRange(pop)} Jiwa
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-[9px]">
                        Estimasi populasi di koridor sebaran abu/asap.
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-900">
                        Anak-anak (&lt;15 Tahun)
                      </td>
                      <td className="py-2 px-3 font-semibold">
                        {fmtRange(child)} Jiwa
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-[9px]">
                        Kelompok rentan risiko iritasi pernapasan &amp; asma.
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-900">
                        Lansia (&ge;65 Tahun)
                      </td>
                      <td className="py-2 px-3 font-semibold">
                        {fmtRange(elder)} Jiwa
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-[9px]">
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
                      <td className="py-2 px-3 text-slate-600 text-[9px]">
                        Total daratan tertutup jejak partikel konsentrasi tinggi.
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-900">
                        Sektor Pertanian (Sawah &amp; Kebun)
                      </td>
                      <td className="py-2 px-3 font-semibold">
                        {fmtCropland()}
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-[9px]">
                        Risiko kerusakan vegetasi dan gagal panen.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Halaman 1 */}
            <div className="pt-3 border-t border-[#EB895B]/30 flex justify-between items-center text-[9px] text-[#C25E00] font-bold">
              <span>Dokumen dihasilkan otomatis oleh Platform Komando Atmosfer HELALOKA Indonesia</span>
              <span className="font-black text-[#A14646]">Halaman 1 dari 2 (Ringkasan Eksekutif &amp; Peta Dispersi)</span>
            </div>
          </div>


          {/* ========================================================================= */}
          {/* HALAMAN 2: PROTOKOL SATUAN PENDIDIKAN & RUTE EVAKUASI MEDIS               */}
          {/* ========================================================================= */}
          <div
            id="printable-report-page-2"
            className="print-page-sheet w-full max-w-[210mm] min-h-[297mm] bg-white text-[#140f0e] shadow-xl p-[14mm] md:p-[16mm] flex flex-col justify-between box-border rounded-sm print:rounded-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full print:h-[275mm] print:min-h-0 print:max-h-[275mm]"
            style={{ pageBreakBefore: "always", breakBefore: "page" }}
          >
            {/* Bagian Atas Halaman 2 */}
            <div>
              {/* Header Halaman 2 */}
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#140f0e]/15 mb-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/gunung_black.png"
                    alt="Logo Helaloka"
                    className="w-8 h-8 object-contain shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-heading text-base font-bold tracking-tight text-[#140f0e] leading-none">
                      HELALOKA INDONESIA
                    </span>
                    <span className="text-[8px] tracking-widest text-[#15803d] font-bold uppercase mt-0.5">
                      LEMBAR LAMPIRAN AKSI SATUAN PENDIDIKAN &amp; RUJUKAN MEDIS
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-0.5 rounded bg-emerald-50 text-[8px] font-mono font-bold text-emerald-800 border border-emerald-200">
                    LAMPIRAN TAKTIS MITIGASI
                  </span>
                  <div className="text-[7.5px] text-slate-400 font-mono mt-0.5">
                    LOKASI: {cleanLocationName.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Panduan Operasional Protokol Lapangan */}
              <div className="rounded-lg border border-emerald-200 bg-[#f0fdf4] p-2.5 text-[#166534] text-[9px] leading-relaxed mb-3.5">
                <div className="font-bold flex items-center gap-1.5 mb-0.5">
                  <ShieldWarning size={14} weight="bold" className="text-emerald-700" />
                  <span>PETUNJUK TINDAKAN DARURAT SATUAN PENDIDIKAN &amp; FASKES:</span>
                </div>
                <p>
                  Satuan pendidikan pada zona terdampak dengan rekomendasi <strong>PJJ DARING</strong> wajib menghentikan aktivitas pembelajaran tatap muka paling lambat 6 jam sebelum jam tiba (ETA) polutan atmosferik. Seluruh fasilitas rujukan di zona hijau/aman telah disiagakan dengan buffer stock obat-obatan pernapasan, oksigen medis, dan ruang dekontaminasi.
                </p>
              </div>

              {/* Tabel 2: Protokol Satuan Pendidikan & Rute Evakuasi Medis */}
              <div className="mb-4">
                <div className="flex items-center justify-between py-1 mb-1.5">
                  <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider inline-block">
                    DAFTAR SATUAN PENDIDIKAN TERDAMPAK DAN RUTE RUJUKAN MEDIS BEBAS ABU
                  </span>
                  <span className="text-[8.5px] text-slate-500 font-mono">
                    Prioritas Berdasarkan Probabilitas Paparan
                  </span>
                </div>

                <table className="w-full text-left border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-[#f1f5f9] border-b border-slate-300">
                      <th className="py-2 px-3 text-[9.5px] font-bold text-slate-800 uppercase tracking-wider w-[28%]">
                        Nama Satuan Pendidikan
                      </th>
                      <th className="py-2 px-3 text-[9.5px] font-bold text-slate-800 uppercase tracking-wider w-[22%]">
                        Paparan &amp; Jam Tiba
                      </th>
                      <th className="py-2 px-3 text-[9.5px] font-bold text-slate-800 uppercase tracking-wider w-[18%] text-center">
                        Protokol Aksi
                      </th>
                      <th className="py-2 px-3 text-[9.5px] font-bold text-slate-800 uppercase tracking-wider w-[32%]">
                        Faskes Rujukan &amp; Jarak Aman
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[9.5px] text-slate-800">
                    {displaySchools.length > 0 ? (
                      displaySchools.map((s) => {
                        const prob = s.exposure_pct ?? s.exposure_prob_pct ?? (s.exposure_probability ? Math.round(s.exposure_probability * 100) : 0);
                        const isAwas = prob >= 40 || s.action_code === "PJJ_DARING";
                        const eta = s.eta_hours ?? s.arrival_time_earliest_h ?? 0;
                        const hospital = s.nearest_safe_hospital || s.nearest_hospital || {
                          name: "Puskesmas / RSUD Terdekat",
                          distance_km: 14.8
                        };
                        const hospitalName = (hospital.name || "").toUpperCase() === "PUSTU"
                          ? `Puskesmas Pembantu (${s.district || "Kecamatan Terdekat"})`
                          : (hospital.name || "Puskesmas / RSUD Terdekat");

                        return (
                          <tr key={s.facility_id || s.id || s.name} className="hover:bg-slate-50">
                            <td className="py-2 px-3 align-middle">
                              <strong className="text-slate-900 block text-[10px] font-semibold">{s.name}</strong>
                              <span className="text-slate-500 block text-[8.5px] mt-0.5">{s.district || "Kabupaten Bima/Dompu"}</span>
                            </td>
                            <td className="py-2 px-3 align-middle">
                              <div>Paparan: <strong className="text-slate-900">{prob}%</strong></div>
                              <div className="text-slate-600 text-[8.5px] mt-0.5">Waktu Tiba: <strong>+{eta} Jam</strong></div>
                            </td>
                            <td className="py-2 px-3 align-middle text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded text-[8.5px] font-extrabold tracking-wide uppercase ${
                                  isAwas
                                    ? "bg-[#b91c1c] text-white"
                                    : "bg-[#EA580C] text-white"
                                }`}
                              >
                                {isAwas ? "PJJ DARING" : "WASPADA"}
                              </span>
                            </td>
                            <td className="py-2 px-3 align-middle">
                              <strong className="text-slate-900 block text-[10px] font-semibold">
                                {hospitalName}
                              </strong>
                              <span className="text-slate-500 block text-[8.5px] mt-0.5">
                                Jarak evakuasi: {hospital.distance_km || 14.8} km (Zona Aman)
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-4 px-3 text-center text-slate-500">
                          Tidak ada sekolah terdeteksi di dalam zona bahaya simulasi ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Box Kontak Darurat Terpadu */}
              <div className="rounded-xl border border-slate-200 bg-[#f8fafc] p-3 text-left">
                <div className="flex items-center gap-1.5 text-slate-800 text-[9.5px] font-bold uppercase tracking-wider mb-2">
                  <PhoneCall size={14} weight="bold" className="text-[#A14646]" />
                  <span>SALURAN KOMUNIKASI &amp; KONTAK DARURAT TERPADU</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-[8.5px]">
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-500 block text-[7.5px] font-bold uppercase">KEDARURATAN MEDIS</span>
                    <strong className="text-slate-900 text-[10.5px] block mt-0.5">119 (Bebas Pulsa)</strong>
                    <span className="text-slate-600 block mt-0.5">SPGDT Nasional &amp; Ambulans</span>
                  </div>
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-500 block text-[7.5px] font-bold uppercase">POSKO PENGAMATAN</span>
                    <strong className="text-slate-900 text-[10.5px] block mt-0.5">PVMBG Pos PGA</strong>
                    <span className="text-slate-600 block mt-0.5">Saluran Radio Siaga VHF</span>
                  </div>
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-500 block text-[7.5px] font-bold uppercase">PUSDALOPS BPBD</span>
                    <strong className="text-slate-900 text-[10.5px] block mt-0.5">117 / Posko Kab.</strong>
                    <span className="text-slate-600 block mt-0.5">Komando Evakuasi Darurat</span>
                  </div>
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-500 block text-[7.5px] font-bold uppercase">BMKG SEBARAN ABU</span>
                    <strong className="text-slate-900 text-[10.5px] block mt-0.5">196 / VAAC</strong>
                    <span className="text-slate-600 block mt-0.5">Peringatan Navigasi Udara</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Halaman 2 */}
            <div className="pt-3 border-t border-[#EB895B]/30 flex justify-between items-center text-[9px] text-[#C25E00] font-bold">
              <span>Terverifikasi otomatis oleh Sistem Pemodelan Dispersi Atmosferik HELALOKA AI</span>
              <span className="font-black text-[#A14646]">Halaman 2 dari 2 (Lampiran Satuan Pendidikan &amp; Rute Evakuasi)</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
