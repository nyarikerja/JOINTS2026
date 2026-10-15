import React, { useEffect } from "react";
import {
  X,
  Stack,
  Flame,
  ShieldWarning,
  Info,
  CheckCircle,
  Clock,
  TreeEvergreen
} from "@phosphor-icons/react";

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
  showSchools: _showSchools = false,
  onToggleSchools: _onToggleSchools,
  showHospitals: _showHospitals = false,
  onToggleHospitals: _onToggleHospitals,
  showAirports: _showAirports = false,
  onToggleAirports: _onToggleAirports
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
      className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 font-sans animate-fade-in"
      onClick={onClose}
    >
      {/* Container Dialog Sesuai Gaya Referensi GpsAdvisoryModal */}
      <div
        className="relative w-full max-w-2xl bg-[#f7f3ed] rounded-[28px] shadow-2xl border border-[#2b211e]/15 overflow-hidden text-[#2b211e] flex flex-col max-h-[92vh]"
        style={{
          boxShadow: "0 25px 60px -15px rgba(20, 15, 14, 0.5)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 md:p-7 space-y-4 custom-scrollbar">
          {/* 1. Baris Atas: Badge Kategori di Kiri, Logo HELALOKA & Tombol Tutup di Kanan */}
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-bold tracking-wide uppercase shadow-2xs bg-[#EB895B] text-white">
              <Stack size={13} weight="bold" />
              <span>PANDUAN LEGENDA TAKTIS</span>
            </span>

            {/* Logo & Close Button */}
            <div className="flex items-center gap-1.5">
              <img
                src="/gunung_black.png"
                alt="Logo HELALOKA"
                className="w-8 h-8 object-contain shrink-0"
              />
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#2b211e]/50 hover:text-[#2b211e] hover:bg-[#2b211e]/10 transition cursor-pointer"
                title="Tutup (Esc)"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
          </div>

          {/* 2. Judul Utama & Subjudul */}
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-[#140f0e] leading-snug tracking-tight">
              Keterangan Peta &amp; Legenda Taktis
            </h2>
            <p className="text-xs text-[#2b211e]/75 mt-1 leading-relaxed">
              Panduan klasifikasi status gunung api PVMBG, anomali titik api FIRMS, peluang dispersi atmosferik, dan fasilitas keselamatan warga.
            </p>
          </div>

          {/* 3. Bagian 1: Tingkat Aktivitas Gunungapi (Card Bersih) */}
          <div className="rounded-2xl p-4 bg-white/75 border border-[#2b211e]/12 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-[#A14646] text-[11px] font-extrabold uppercase tracking-wider">
              <ShieldWarning size={16} weight="bold" />
              <span>Tingkat Aktivitas Gunungapi (PVMBG ESDM)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Level IV */}
              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-red-200/80 shadow-2xs">
                <img src="/4_awas.png" alt="Awas" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-red-600">
                    Level IV (AWAS)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80 mt-0.5">
                    Gunung sedang atau akan segera meletus. Wilayah radius &ge; 7&ndash;10 km sangat berbahaya.
                  </span>
                </div>
              </div>

              {/* Level III */}
              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-orange-200/80 shadow-2xs">
                <img src="/3_siaga.png" alt="Siaga" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-orange-600">
                    Level III (SIAGA)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80 mt-0.5">
                    Aktivitas gunung meningkat drastis. Letusan abu tebal bisa terjadi sewaktu-waktu.
                  </span>
                </div>
              </div>

              {/* Level II */}
              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-amber-200/80 shadow-2xs">
                <img src="/2_waspada.png" alt="Waspada" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-amber-600">
                    Level II (WASPADA)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80 mt-0.5">
                    Aktivitas gunung mulai di atas normal. Situasi terus dipantau secara ketat.
                  </span>
                </div>
              </div>

              {/* Level I */}
              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-emerald-200/80 shadow-2xs">
                <img src="/1_normal.png" alt="Normal" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-emerald-700">
                    Level I (NORMAL)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80 mt-0.5">
                    Kondisi gunung aman. Tidak ada ancaman letusan dalam waktu dekat.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Bagian 2: Tingkat Bahaya Karhutla & Kawasan Hutan */}
          <div className="rounded-2xl p-4 bg-white/75 border border-[#2b211e]/12 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-[#b45309] text-[11px] font-extrabold uppercase tracking-wider">
              <TreeEvergreen size={16} weight="bold" />
              <span>Tingkat Bahaya Karhutla &amp; Kawasan Hutan (NASA FIRMS 24 Jam)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Level IV */}
              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-red-200/80 shadow-2xs">
                <img src="/hutan_sangat_rawan.png" alt="Awas" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-red-600">
                    Level IV (AWAS &bull; SANGAT RAWAN)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80 mt-0.5">
                    &ge; 100 titik api aktif. Kebakaran masif gambut/hutan, darurat pelepasan asap PM2.5 pekat.
                  </span>
                </div>
              </div>

              {/* Level III */}
              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-orange-200/80 shadow-2xs">
                <img src="/hutan_rawan.png" alt="Siaga" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-orange-600">
                    Level III (SIAGA &bull; RAWAN)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80 mt-0.5">
                    10 &ndash; 99 titik api aktif. Klaster kebakaran berkembang, potensi ancaman asap antardaerah.
                  </span>
                </div>
              </div>

              {/* Level II */}
              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-amber-200/80 shadow-2xs">
                <img src="/hutan_waspada.png" alt="Waspada" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-amber-600">
                    Level II (WASPADA)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80 mt-0.5">
                    1 &ndash; 9 titik api aktif. Terdeteksi anomali panas awal, potensi rambatan lahan gambut.
                  </span>
                </div>
              </div>

              {/* Level I */}
              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-emerald-200/80 shadow-2xs">
                <img src="/hutan.png" alt="Normal" className="w-8 h-8 shrink-0 object-contain" />
                <div>
                  <strong className="text-xs font-bold block text-emerald-700">
                    Level I (NORMAL &bull; BEBAS API)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80 mt-0.5">
                    0 titik api. Tidak ada kebakaran aktif terdeteksi satelit dalam 24 jam terakhir. Kondisi aman.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Bagian 3: Tingkat Peluang Dispersi Abu / Asap */}
          <div className="rounded-2xl p-4 bg-white/75 border border-[#2b211e]/12 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-[#DA6556] text-[11px] font-extrabold uppercase tracking-wider">
              <Flame size={16} weight="bold" />
              <span>Tingkat Peluang Dispersi Abu / Asap</span>
            </div>

            <div className="space-y-2">
              {/* P90 */}
              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-red-200/80 shadow-2xs">
                <div
                  className="w-4 h-4 rounded-md shrink-0 mt-0.5 shadow-xs border border-red-700"
                  style={{ background: "#dc2626" }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <strong className="text-xs font-bold text-red-600">
                      P90 (Inti Bahaya - Merah Pekat)
                    </strong>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold text-white bg-[#991b1b]">
                      &ge; 90%
                    </span>
                  </div>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80">
                    Peluang terpapar material &ge; 90%. Konsentrasi partikel sangat tinggi dan berbahaya bagi pernapasan.
                  </span>
                </div>
              </div>

              {/* P50 */}
              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-orange-200/80 shadow-2xs">
                <div
                  className="w-4 h-4 rounded-md shrink-0 mt-0.5 shadow-xs border border-orange-700"
                  style={{ background: "#f97316" }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <strong className="text-xs font-bold text-orange-600">
                      P50 (Area Waspada - Oranye)
                    </strong>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold text-white bg-[#c2410c]">
                      50% – 89%
                    </span>
                  </div>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80">
                    Peluang terpapar 50%–89%. Koridor sebaran sedang yang paling mungkin terjadi di lapangan.
                  </span>
                </div>
              </div>

              {/* P05 */}
              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-amber-200/80 shadow-2xs">
                <div
                  className="w-4 h-4 rounded-md shrink-0 mt-0.5 shadow-xs border border-yellow-700"
                  style={{ background: "#eab308" }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <strong className="text-xs font-bold text-amber-700">
                      P05 (Jangkauan Luas - Kuning)
                    </strong>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold text-white bg-[#a16207]">
                      5% – 49%
                    </span>
                  </div>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80">
                    Peluang terpapar 5%–49%. Batas terjauh partikel debu halus atau asap tipis yang tertiup angin.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Bagian 4: Titik Api NASA FIRMS (Anomali Termal Hybrid LOD) */}
          <div className="rounded-2xl p-4 bg-white/75 border border-[#2b211e]/12 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-[#EB895B] text-[11px] font-extrabold uppercase tracking-wider">
              <img src="/titik_api.png" alt="Titik Api" className="w-4 h-4 object-contain shrink-0" />
              <span>Titik Api NASA FIRMS (Anomali Termal Hybrid LOD)</span>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-orange-200/80 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-yellow-300 via-orange-500 to-red-700 shrink-0 shadow-inner flex items-center justify-center text-[10px] font-bold text-white">
                  &lt; 9
                </div>
                <div className="flex-1">
                  <strong className="text-xs font-bold block text-orange-600 mb-0.5">
                    Peta Panas / Heatmap (Skala Makro Zoom &lt; 9)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80">
                    Kepadatan daya radiasi api (FRP) deteksi NASA FIRMS 24 jam terakhir seluruh Indonesia.
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl flex items-start gap-3 bg-white border border-orange-200/80 shadow-2xs">
                <img src="/titik_api.png" alt="Titik Api" className="w-8 h-8 shrink-0 object-contain" />
                <div className="flex-1">
                  <strong className="text-xs font-bold block text-red-600 mb-0.5">
                    Titik Api Presisi (Skala Mikro Zoom &ge; 9)
                  </strong>
                  <span className="text-[11px] leading-relaxed block text-[#2b211e]/80">
                    Deteksi FIRMS individual di area tampilan peta beserta sensor (VIIRS/MODIS), radiasi FRP (MW), tingkat keyakinan, dan jam deteksi.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 7. Bagian 5: Simbol Fasilitas Publik */}
          <div className="rounded-2xl p-4 bg-white/75 border border-[#2b211e]/12 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-[#2a8485] text-[11px] font-extrabold uppercase tracking-wider">
              <Info size={16} weight="bold" />
              <span>Simbol Fasilitas Publik</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Sekolah */}
              <div className="p-3 rounded-xl flex flex-col gap-1.5 bg-white border border-teal-200/80 shadow-2xs transition">
                <div className="flex items-center gap-2">
                  <img src="/school.png" alt="Sekolah" className="w-6 h-6 object-contain" />
                  <strong className="text-xs font-bold text-[#2a8485]">
                    Sekolah
                  </strong>
                </div>
                <span className="text-[11px] leading-relaxed text-[#2b211e]/75">
                  Titik fasilitas pendidikan dan sekolah terdaftar dari basis data OpenStreetMap (OSM).
                </span>
              </div>

              {/* Faskes */}
              <div className="p-3 rounded-xl flex flex-col gap-1.5 bg-white border border-cyan-200/80 shadow-2xs transition">
                <div className="flex items-center gap-2">
                  <img src="/hospital.png" alt="Hospital" className="w-6 h-6 object-contain" />
                  <strong className="text-xs font-bold text-[#1e6263]">
                    Fasilitas Kesehatan
                  </strong>
                </div>
                <span className="text-[11px] leading-relaxed text-[#2b211e]/75">
                  Rumah sakit rujukan, puskesmas, dan pos layanan kesehatan tanggap darurat.
                </span>
              </div>

              {/* Bandara */}
              <div className="p-3 rounded-xl flex flex-col gap-1.5 bg-white border border-orange-200/80 shadow-2xs transition">
                <div className="flex items-center gap-2">
                  <img src="/plane.png" alt="Bandara" className="w-6 h-6 object-contain" />
                  <strong className="text-xs font-bold text-[#c25e2d]">
                    Bandara
                  </strong>
                </div>
                <span className="text-[11px] leading-relaxed text-[#2b211e]/75">
                  Bandar udara nasional yang dipantau terhadap risiko sebaran abu vulkanik.
                </span>
              </div>
            </div>
          </div>

          {/* 8. Footer Meta Sumber Resmi */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-[#2b211e]/65 flex-wrap gap-2 border-t border-[#2b211e]/10">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} weight="bold" className="text-emerald-700" />
              <span>Otoritas Data: <strong>PVMBG ESDM &bull; NASA FIRMS &bull; ECMWF</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} weight="bold" className="text-[#EB895B]" />
              <span>Status: <strong>Sinkronisasi Spasial Aktif</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
