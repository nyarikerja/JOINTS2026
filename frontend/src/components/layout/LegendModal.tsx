import React, { useEffect } from "react";
import { X, Stack, Flame, ShieldWarning, Info } from "@phosphor-icons/react";

interface LegendModalProps {
  isOpen: boolean;
  onClose: () => void;
  showSchools?: boolean;
  onToggleSchools?: (val: boolean) => void;
  showHospitals?: boolean;
  onToggleHospitals?: (val: boolean) => void;
  showAirports?: boolean;
  onToggleAirports?: (val: boolean) => void;
}

export const LegendModal: React.FC<LegendModalProps> = ({
  isOpen,
  onClose,
  showSchools = false,
  onToggleSchools,
  showHospitals = false,
  onToggleHospitals,
  showAirports = false,
  onToggleAirports
}) => {
  // Tutup dengan tombol Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col border transition-all animate-in zoom-in-95 duration-200"
        style={{
          background: "#FFFFFF",
          borderColor: "rgba(0, 0, 0, 0.1)",
          color: "#140f0e"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="px-6 py-4 flex items-center justify-between shrink-0"
          style={{
            borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
            background: "#F5EFE3"
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{
                background: "#EB895B",
                color: "#FFFFFF"
              }}
            >
              <Stack size={20} weight="duotone" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight" style={{ color: "#140f0e" }}>
                Keterangan Peta Status Gunung &amp; Ancaman Udara
              </h2>
              <p className="text-xs font-medium" style={{ color: "rgba(20, 15, 14, 0.6)" }}>
                Berdasarkan data resmi PVMBG dan prediksi hasil simulasi komputer.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer hover:rotate-90 duration-200 hover:bg-black/5"
            style={{
              color: "#140f0e"
            }}
            title="Tutup (Esc)"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs overflow-y-auto" style={{ background: "#FFFFFF" }}>
          {/* Bagian 1: Tingkat Aktivitas Gunungapi */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "#F9F9F9",
              border: "1px solid rgba(0, 0, 0, 0.05)"
            }}
          >
            <div className="flex items-center gap-2">
              <ShieldWarning size={16} weight="duotone" style={{ color: "#EB895B" }} />
              <h3 className="font-bold text-sm tracking-wide" style={{ color: "#140f0e" }}>
                Tingkat Aktivitas Gunungapi (PVMBG ESDM)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Level IV */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-red-100 shadow-sm">
                <img src="/4_awas.png" alt="Awas" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-red-600">
                    Level IV (AWAS)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-slate-600 mt-0.5">
                    Gunung sedang atau akan segera meletus. Wilayah di sekitar gunung dalam radius ≥ 7-10 km sangat berbahaya.
                  </span>
                </div>
              </div>

              {/* Level III */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-orange-100 shadow-sm">
                <img src="/3_siaga.png" alt="Siaga" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-orange-500">
                    Level III (SIAGA)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-slate-600 mt-0.5">
                    Aktivitas gunung meningkat drastis. Letusan abu bisa terjadi sewaktu-waktu.
                  </span>
                </div>
              </div>

              {/* Level II */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-yellow-100 shadow-sm">
                <img src="/2_waspada.png" alt="Waspada" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-yellow-500">
                    Level II (WASPADA)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-slate-600 mt-0.5">
                    Aktivitas gunung mulai di atas normal. Situasi terus dipantau secara ketat.
                  </span>
                </div>
              </div>

              {/* Level I */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-green-100 shadow-sm">
                <img src="/1_normal.png" alt="Normal" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-green-600">
                    Level I (NORMAL)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-slate-600 mt-0.5">
                    Kondisi gunung aman. Tidak ada ancaman letusan dalam waktu dekat.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bagian Baru: Tingkat Bahaya Karhutla & Kawasan Hutan (Icon Pohon) */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "#F9F9F9",
              border: "1px solid rgba(0, 0, 0, 0.05)"
            }}
          >
            <div className="flex items-center gap-2">
              <ShieldWarning size={16} weight="duotone" style={{ color: "#EB895B" }} />
              <h3 className="font-bold text-sm tracking-wide" style={{ color: "#140f0e" }}>
                Tingkat Bahaya Karhutla &amp; Kawasan Hutan (NASA FIRMS 24 Jam)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Level IV */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-red-100 shadow-sm">
                <img src="/hutan_sangat_rawan.png" alt="Awas" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-red-600">
                    Level IV (AWAS &bull; SANGAT RAWAN)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-slate-600 mt-0.5">
                    &ge; 100 titik api aktif. Kebakaran masif gambut/hutan, darurat pelepasan asap PM2.5 pekat.
                  </span>
                </div>
              </div>

              {/* Level III */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-orange-100 shadow-sm">
                <img src="/hutan_rawan.png" alt="Siaga" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-orange-600">
                    Level III (SIAGA &bull; RAWAN)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-slate-600 mt-0.5">
                    10 &ndash; 99 titik api aktif. Klaster kebakaran berkembang, potensi ancaman asap antardaerah.
                  </span>
                </div>
              </div>

              {/* Level II */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-amber-100 shadow-sm">
                <img src="/hutan_waspada.png" alt="Waspada" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-amber-600">
                    Level II (WASPADA)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-slate-600 mt-0.5">
                    1 &ndash; 9 titik api aktif. Terdeteksi anomali panas awal, potensi rambatan lahan gambut.
                  </span>
                </div>
              </div>

              {/* Level I */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-green-100 shadow-sm">
                <img src="/hutan.png" alt="Normal" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-green-600">
                    Level I (NORMAL &bull; BEBAS API)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-slate-600 mt-0.5">
                    0 titik api. Tidak ada kebakaran aktif terdeteksi satelit dalam 24 jam terakhir. Kondisi aman.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bagian 2: Tingkat Peluang Dispersi Abu / Asap */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "#F9F9F9",
              border: "1px solid rgba(0, 0, 0, 0.05)"
            }}
          >
            <div className="flex items-center gap-2">
              <Flame size={16} weight="duotone" style={{ color: "#EB895B" }} />
              <h3 className="font-bold text-sm tracking-wide" style={{ color: "#140f0e" }}>
                Tingkat Peluang Dispersi Abu / Asap
              </h3>
            </div>

            <div className="space-y-2.5">
              {/* P90 */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-red-100 shadow-sm">
                <div
                  className="w-4 h-4 rounded-md shrink-0 mt-0.5 shadow-sm border border-red-700"
                  style={{ background: "#dc2626" }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <strong className="text-xs font-bold text-red-600">
                      P90 (Inti Bahaya - Merah)
                    </strong>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold text-white" style={{ background: "#991b1b" }}>
                      ≥ 90%
                    </span>
                  </div>
                  <span className="text-[11px] leading-relaxed block text-slate-600">
                    Peluang terdampak ≥ 90%. Konsentrasi partikel sangat tinggi & pekat.
                  </span>
                </div>
              </div>

              {/* P50 */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-orange-100 shadow-sm">
                <div
                  className="w-4 h-4 rounded-md shrink-0 mt-0.5 shadow-sm border border-orange-700"
                  style={{ background: "#f97316" }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <strong className="text-xs font-bold text-orange-600">
                      P50 (Area Waspada - Oranye)
                    </strong>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold text-white" style={{ background: "#c2410c" }}>
                      50% – 89%
                    </span>
                  </div>
                  <span className="text-[11px] leading-relaxed block text-slate-600">
                    Peluang terdampak 50%–89%. Area sebaran sedang paling mungkin terjadi.
                  </span>
                </div>
              </div>

              {/* P5 */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-yellow-100 shadow-sm">
                <div
                  className="w-4 h-4 rounded-md shrink-0 mt-0.5 shadow-sm border border-yellow-700"
                  style={{ background: "#eab308" }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <strong className="text-xs font-bold text-yellow-600">
                      P05 (Jangkauan Luas - Kuning)
                    </strong>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold text-white" style={{ background: "#a16207" }}>
                      5% – 49%
                    </span>
                  </div>
                  <span className="text-[11px] leading-relaxed block text-slate-600">
                    Peluang terdampak 5%–49%. Batas terjauh partikel debu/asap tipis tertiup angin.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bagian Baru: Titik Api NASA FIRMS (Hybrid LOD Heatmap & Presisi) */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "#F9F9F9",
              border: "1px solid rgba(0, 0, 0, 0.05)"
            }}
          >
            <div className="flex items-center gap-2">
              <img src="/titik_api.png" alt="Titik Api" className="w-4 h-4 object-contain shrink-0" />
              <h3 className="font-bold text-sm tracking-wide" style={{ color: "#140f0e" }}>
                Titik Api NASA FIRMS (Anomali Termal Hybrid LOD)
              </h3>
            </div>

            <div className="space-y-2.5">
              {/* Skala Makro: Heatmap */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-orange-100 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-yellow-300 via-orange-500 to-red-700 shrink-0 shadow-inner flex items-center justify-center text-[10px] font-bold text-white">
                  &lt; 9
                </div>
                <div className="flex-1">
                  <strong className="text-xs font-bold block text-orange-600 mb-0.5">
                    Peta Panas / Heatmap (Skala Makro Zoom &lt; 9)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-slate-600">
                    Kepadatan daya radiasi api (FRP) deteksi NASA FIRMS 24 jam terakhir seluruh Indonesia.
                  </span>
                </div>
              </div>

              {/* Skala Mikro: Titik Api Presisi */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-orange-100 shadow-sm">
                <img src="/titik_api.png" alt="Titik Api" className="w-8 h-8 shrink-0 object-contain" />
                <div className="flex-1">
                  <strong className="text-xs font-bold block text-red-600 mb-0.5">
                    Titik Api Presisi (Skala Mikro Zoom &ge; 9)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-slate-600">
                    Setiap deteksi FIRMS individual di area tampilan peta beserta sensor (VIIRS/MODIS), radiasi FRP (MW), tingkat keyakinan, dan jam deteksi.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bagian 3: Simbol Fasilitas Publik */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "#F9F9F9",
              border: "1px solid rgba(0, 0, 0, 0.05)"
            }}
          >
            <div className="flex items-center gap-2">
              <Info size={16} weight="duotone" style={{ color: "#359FA0" }} />
              <h3 className="font-bold text-sm tracking-wide" style={{ color: "#140f0e" }}>
                Simbol Fasilitas Publik
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Sekolah */}
              <label className="p-3 rounded-lg flex flex-col gap-1.5 transition bg-white border border-teal-100 hover:border-teal-300 shadow-sm cursor-pointer select-none">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/school.png" alt="Sekolah" className="w-6 h-6 object-contain" />
                    <strong className="text-xs font-bold" style={{ color: "#2a8485" }}>
                      Sekolah
                    </strong>
                  </div>
                  {onToggleSchools && (
                    <input
                      type="checkbox"
                      checked={showSchools}
                      onChange={(e) => onToggleSchools(e.target.checked)}
                      className="w-4 h-4 accent-[#EB895B] rounded cursor-pointer"
                    />
                  )}
                </div>
                <span className="text-[11px] leading-relaxed text-slate-600">
                  Titik fasilitas sekolah. Centang untuk menampilkan titik sebaran sekolah di peta.
                </span>
              </label>

              {/* Faskes */}
              <label className="p-3 rounded-lg flex flex-col gap-1.5 transition bg-white border border-cyan-100 hover:border-cyan-300 shadow-sm cursor-pointer select-none">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/hospital.png" alt="Hospital" className="w-6 h-6 object-contain" />
                    <strong className="text-xs font-bold" style={{ color: "#1e6263" }}>
                      Fasilitas Kesehatan
                    </strong>
                  </div>
                  {onToggleHospitals && (
                    <input
                      type="checkbox"
                      checked={showHospitals}
                      onChange={(e) => onToggleHospitals(e.target.checked)}
                      className="w-4 h-4 accent-[#EB895B] rounded cursor-pointer"
                    />
                  )}
                </div>
                <span className="text-[11px] leading-relaxed text-slate-600">
                  Rumah Sakit dan Puskesmas. Centang untuk menampilkan titik faskes di peta.
                </span>
              </label>

              {/* Bandara */}
              <label className="p-3 rounded-lg flex flex-col gap-1.5 transition bg-white border border-orange-100 hover:border-orange-300 shadow-sm cursor-pointer select-none">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/plane.png" alt="Bandara" className="w-6 h-6 object-contain" />
                    <strong className="text-xs font-bold" style={{ color: "#c25e2d" }}>
                      Bandara
                    </strong>
                  </div>
                  {onToggleAirports && (
                    <input
                      type="checkbox"
                      checked={showAirports}
                      onChange={(e) => onToggleAirports(e.target.checked)}
                      className="w-4 h-4 accent-[#EB895B] rounded cursor-pointer"
                    />
                  )}
                </div>
                <span className="text-[11px] leading-relaxed text-slate-600">
                  Bandar udara nasional. Centang untuk menampilkan titik bandara di peta.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="px-6 py-4 flex items-center justify-center shrink-0 text-[11px]"
          style={{
            borderTop: "1px solid rgba(0, 0, 0, 0.08)",
            background: "#F5EFE3",
            color: "rgba(20, 15, 14, 0.6)"
          }}
        >
          <span>Otoritas: Badan Geologi PVMBG &bull; NASA FIRMS VIIRS &bull; Open-Meteo GFS</span>
        </div>
      </div>
    </div>
  );
};
