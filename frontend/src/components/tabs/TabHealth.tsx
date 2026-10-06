import React from "react";
import type { HazardType } from "../../types/api";

interface TabHealthProps {
  hazard?: HazardType;
}

export const TabHealth: React.FC<TabHealthProps> = ({ hazard = "volcano" }) => {
  const isVolcano = hazard === "volcano";

  return (
    <div className="space-y-4 text-xs">
      <div>
        <span className="inline-block bg-red-950/80 text-red-400 border border-red-600/40 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          PERINGATAN MEDIS KRITIS
        </span>
        <h3 className="font-bold text-sm text-red-400">
          {isVolcano ? "Bahaya Fatal Lensa Kontak (Softlens)" : "Bahaya Partikel Halus PM2.5 Asap Gambut"}
        </h3>

        <div className="bg-red-950/40 border border-red-500/80 rounded-lg p-3 text-red-200 mt-2">
          <div className="font-bold text-xs text-red-300 mb-1">
            {isVolcano ? "⚠️ DILARANG KERAS MENGGUNAKAN SOFTLENS!" : "⚠️ ZONA BAHAYA ISPA & KABUT ASAP GABUNGAN"}
          </div>
          <p className="leading-relaxed text-[11px] text-slate-300">
            {isVolcano ? (
              <>
                Abu vulkanik bukanlah debu tanah biasa, melainkan <strong>pecahan kaca silika tajam mikroskopis</strong>. Menggunakan lensa kontak membuat butiran kristal silika terjebak di bawah lensa dan mengikis kornea saat mata berkedip, memicu <strong>abrasi kornea permanen dan risiko kebutaan</strong>.
              </>
            ) : (
              <>
                Asap kebakaran lahan gambut kaya akan <strong>PM2.5, karbon monoksida (CO), dan senyawa organik volatil (VOC)</strong>. Partikel ini berpenetrasi langsung hingga ke kantung udara terdalam (alveolus), memicu <strong>bronkitis akut, eksaserbasi asma, dan serangan hipoksia</strong> terutama pada balita dan lansia.
              </>
            )}
          </p>
          <div className="mt-2 text-white font-medium text-[11px] bg-red-900/60 p-2 rounded">
            {isVolcano ? (
              <>Mandat: Lepas softlens segera. Gunakan <strong>Kacamata Pelindung (Safety Goggles)</strong> yang menutup rapat sekeliling mata.</>
            ) : (
              <>Mandat: Tutup ventilasi rumah rapat-rapat. Nyalakan <strong>Air Purifier HEPA filter</strong> dan larang anak-anak beraktivitas di luar ruang.</>
            )}
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800">
        <span className="inline-block bg-sky-950/80 text-sky-400 border border-sky-600/40 font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider mb-1">
          KOMPARASI RESPIRATOR MEDIS
        </span>
        <h3 className="font-bold text-xs text-white mb-2">Standar Efektivitas Masker Pernapasan</h3>

        <div className="space-y-2.5">
          {/* Masker Kain & Bedah */}
          <div className="border border-red-900/80 bg-slate-900/80 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1">
              <strong className="text-red-400 font-semibold text-xs">❌ Masker Bedah &amp; Masker Kain</strong>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-950 text-red-300 border border-red-800">
                TIDAK EFEKTIF
              </span>
            </div>
            <ul className="list-disc list-inside text-slate-400 text-[10px] space-y-0.5">
              <li>Pori-pori terlalu lebar (3 – 100 &mu;m). Partikel sub-mikron tetap tembus langsung ke paru-paru.</li>
              <li>Kebocoran tepi (seal leak) mencapai 30% – 50% di celah hidung dan pipi.</li>
            </ul>
          </div>

          {/* Masker N95 */}
          <div className="border border-emerald-600/80 bg-emerald-950/20 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1">
              <strong className="text-emerald-300 font-semibold text-xs">✅ Masker N95 / KN95 / FFP2</strong>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-900 text-emerald-200 border border-emerald-700">
                STANDAR RESMI WAJIB
              </span>
            </div>
            <ul className="list-disc list-inside text-slate-300 text-[10px] space-y-0.5">
              <li>Filtrasi partikel mikro &ge; 95% hingga ukuran 0.3 mikron elektrostatik.</li>
              <li>Segel rapat kontur wajah mencegah kebocoran udara samping tanpa penyaringan.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
