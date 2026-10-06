import React, { useEffect } from "react";
import { X, Layers, Flame, ShieldAlert, Info } from "lucide-react";

interface LegendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegendModal: React.FC<LegendModalProps> = ({ isOpen, onClose }) => {
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
              <Layers className="w-5 h-5" />
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
            <X className="w-4 h-4" />
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
              <ShieldAlert className="w-4 h-4" style={{ color: "#EB895B" }} />
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

          {/* Bagian 2: Tingkat Peluang Dispersi Abu / Asap */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "#F9F9F9",
              border: "1px solid rgba(0, 0, 0, 0.05)"
            }}
          >
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4" style={{ color: "#EB895B" }} />
              <h3 className="font-bold text-sm tracking-wide" style={{ color: "#140f0e" }}>
                Tingkat Peluang Dispersi Abu / Asap
              </h3>
            </div>

            <div className="space-y-2.5">
              {/* P90 */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-red-100 shadow-sm">
                <div
                  className="w-4 h-4 rounded-md shrink-0 mt-0.5 shadow-sm"
                  style={{ background: "#DA6556" }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <strong className="text-xs font-bold text-red-600">
                      P90 (Inti Bahaya)
                    </strong>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold text-white" style={{ background: "#A14646" }}>
                      ≥ 90%
                    </span>
                  </div>
                  <span className="text-[11px] leading-relaxed block text-slate-600">
                    Peluang terdampak ≥ 90%. Sangat berbahaya bagi pernapasan. Wajib gunakan masker N95 atau segera evakuasi.
                  </span>
                </div>
              </div>

              {/* P50 */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-orange-100 shadow-sm">
                <div
                  className="w-4 h-4 rounded-md shrink-0 mt-0.5 shadow-sm"
                  style={{ background: "#EB895B" }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <strong className="text-xs font-bold text-orange-500">
                      P50 (Area Waspada)
                    </strong>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold" style={{ background: "rgba(235, 137, 91, 0.15)", color: "#c25e2d" }}>
                      50% – 89%
                    </span>
                  </div>
                  <span className="text-[11px] leading-relaxed block text-slate-600">
                    Peluang terdampak 50%–89%. Waspada hujan abu tebal dan udara kotor.
                  </span>
                </div>
              </div>

              {/* P5 */}
              <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-yellow-100 shadow-sm">
                <div
                  className="w-4 h-4 rounded-md shrink-0 mt-0.5 shadow-sm"
                  style={{ background: "#FDB773" }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <strong className="text-xs font-bold text-yellow-500">
                      P5 (Jangkauan Maksimum)
                    </strong>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold" style={{ background: "rgba(253, 183, 115, 0.2)", color: "#b97a31" }}>
                      5% – 49%
                    </span>
                  </div>
                  <span className="text-[11px] leading-relaxed block text-slate-600">
                    Peluang terdampak 5%–49%. Batas terjauh sebaran abu tipis yang terbawa angin.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bagian Baru: Titik Api NASA FIRMS */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "#F9F9F9",
              border: "1px solid rgba(0, 0, 0, 0.05)"
            }}
          >
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4" style={{ color: "#EB895B" }} />
              <h3 className="font-bold text-sm tracking-wide" style={{ color: "#140f0e" }}>
                Titik Api NASA FIRMS (Anomali Termal)
              </h3>
            </div>

            <div className="p-3 rounded-lg flex items-start gap-3 transition bg-white border border-orange-100 shadow-sm">
              <img src="/titik_api.png" alt="Titik Api" className="w-8 h-8 shrink-0 object-contain" />
              <div className="flex-1">
                <strong className="text-xs font-bold block text-orange-600 mb-0.5">
                  Titik Panas (Hotspot) Aktif
                </strong>
                <span className="text-[11px] leading-relaxed block text-slate-600">
                  Titik api yang terdeteksi satelit. Semakin besar lingkaran merah, semakin besar energi api (dalam Megawatt) yang menyala.
                </span>
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
              <Info className="w-4 h-4" style={{ color: "#359FA0" }} />
              <h3 className="font-bold text-sm tracking-wide" style={{ color: "#140f0e" }}>
                Simbol Fasilitas Publik
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Sekolah */}
              <div className="p-3 rounded-lg flex flex-col gap-1.5 transition bg-white border border-teal-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <img src="/school.png" alt="Sekolah" className="w-6 h-6 object-contain" />
                  <strong className="text-xs font-bold" style={{ color: "#2a8485" }}>
                    Sekolah
                  </strong>
                </div>
                <span className="text-[11px] leading-relaxed text-slate-600">
                  Lokasi sekolah. Jika masuk zona bahaya, sekolah direkomendasikan libur atau belajar dari rumah (PJJ).
                </span>
              </div>

              {/* Faskes */}
              <div className="p-3 rounded-lg flex flex-col gap-1.5 transition bg-white border border-cyan-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <img src="/hospital.png" alt="Hospital" className="w-6 h-6 object-contain" />
                  <strong className="text-xs font-bold" style={{ color: "#1e6263" }}>
                    Fasilitas Kesehatan
                  </strong>
                </div>
                <span className="text-[11px] leading-relaxed text-slate-600">
                  Rumah Sakit dan Puskesmas. Menjadi tujuan evakuasi warga yang sesak napas di area yang aman dari abu.
                </span>
              </div>

              {/* Bandara */}
              <div className="p-3 rounded-lg flex flex-col gap-1.5 transition bg-white border border-orange-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <img src="/plane.png" alt="Bandara" className="w-6 h-6 object-contain" />
                  <strong className="text-xs font-bold" style={{ color: "#c25e2d" }}>
                    Bandara
                  </strong>
                </div>
                <span className="text-[11px] leading-relaxed text-slate-600">
                  Lokasi bandara. Sangat rawan jika terkena abu karena dapat merusak mesin pesawat.
                </span>
              </div>
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
