import React, { useState } from "react";
import { Copy, Check, ShieldAlert, Bot } from "lucide-react";
import type { HazardType } from "../../types/api";

interface TabProtocolAIProps {
  hazard: HazardType;
  advisory?: any;
}

export const TabProtocolAI: React.FC<TabProtocolAIProps> = ({ hazard, advisory }) => {
  const [copied, setCopied] = useState(false);
  const isVolcano = hazard === "volcano";

  const defaultWaMessage = isVolcano
    ? `[PERINGATAN DINI PVMBG/BPBD]\nTerjadi peningkatan aktivitas vulkanik. Warga dalam radius KRB dihimbau:\n1. DILARANG menggunakan lensa kontak (softlens) karena abu silika tajam dapat merobek kornea mata.\n2. Wajib memakai kacamata pelindung dan masker N95/KN95 saat keluar rumah.\n3. Jangan mendekati bantaran sungai aliran lahar dingin.\nInformasi resmi hubungi SPGDT 119.`
    : `[PERINGATAN KABUT ASAP KARHUTLA]\nIndeks partikel udara PM2.5 meningkat berbahaya. Himbauan warga:\n1. Tutup rapat ventilasi rumah & nyalakan penyaring udara (HEPA).\n2. Wajib menggunakan respirator N95 jika harus beraktivitas di luar.\n3. Anak-anak dan lansia dilarang beraktivitas luar ruang.\nHubungi posko darurat 119 bila mengalami sesak napas.`;

  const waText = advisory?.wa_broadcast || advisory?.broadcast_text || defaultWaMessage;

  const handleCopy = () => {
    navigator.clipboard.writeText(waText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-3.5 text-xs text-[#2b211e]">
      {/* Header Protokol */}
      <div>
        <span className="font-sans text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#A14646]/10 text-[#A14646] border border-[#A14646]/20">
          TANGGAP DARURAT &amp; EDUKASI
        </span>
        <h3 className="font-serif text-[15px] font-bold text-[#2b211e] mt-1 mb-0.5">
          Protokol Medis &amp; Siaran AI
        </h3>
        <p className="text-[11px] text-[#2b211e]/70 leading-relaxed">
          Instruksi keselamatan warga dan draf pesan darurat otomatis berbasis AI.
        </p>
      </div>

      {/* Box Peringatan Kritis Kemenkes (Anti-Softlens / PM2.5) */}
      <div className="bg-[#DA6556]/10 border border-[#DA6556]/30 rounded-lg p-3 text-[#2b211e]">
        <div className="flex items-center gap-1.5 text-[#A14646] font-bold text-xs mb-1">
          <ShieldAlert className="w-4 h-4 text-[#A14646] shrink-0" />
          <span>{isVolcano ? "Peringatan Bahaya Lensa Kontak" : "Peringatan Bahaya Partikel PM2.5"}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-[#2b211e]/85">
          {isVolcano ? (
            <>
              Abu vulkanik mengandung pecahan kaca silika mikroskopis tajam. Penggunaan <strong>lensa kontak (softlens)</strong> dapat menjebak kristal silika dan mengikis kornea saat berkedip, memicu abrasi kornea permanen.
            </>
          ) : (
            <>
              Asap gambut membawa partikel halus PM2.5 dan karbon monoksida yang menembus kantung udara paru-paru terdalam, memicu hipoksia dan serangan ISPA akut pada anak dan lansia.
            </>
          )}
        </p>
        <div className="mt-2 text-[10px] font-semibold text-[#A14646] bg-white/70 py-1 px-2 rounded border border-[#DA6556]/20">
          Mandat: {isVolcano ? "Lepas softlens, gunakan kacamata pelindung & masker N95." : "Tutup ventilasi, nyalakan air purifier & pakai masker N95."}
        </div>
      </div>

      {/* Draf Siaran Darurat AI (WhatsApp Warga) */}
      <div className="bg-white border border-[#2b211e]/15 rounded-lg p-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-[#EB895B]" />
            <span className="font-bold text-[11px] text-[#2b211e]">Draf Pesan Siaran Warga</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#EB895B] hover:bg-[#DA6556] text-white transition cursor-pointer shadow-xs"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Tersalin" : "Salin Pesan"}</span>
          </button>
        </div>
        <pre className="text-[10px] leading-relaxed text-[#2b211e]/80 whitespace-pre-wrap font-sans bg-[#f7f3ed] p-2.5 rounded border border-[#2b211e]/8 max-h-48 overflow-y-auto">
          {waText}
        </pre>
      </div>

      {/* Standar Efektivitas Masker */}
      <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs space-y-1.5">
        <span className="text-[10px] font-bold text-[#2b211e]/60 uppercase tracking-wider block">
          Standar Efektivitas Masker
        </span>
        <div className="flex justify-between items-center text-[11px] p-1.5 bg-[#DA6556]/10 rounded">
          <span className="text-[#A14646] font-medium">Masker Kain &amp; Bedah</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-[#A14646]">Tidak Efektif</span>
        </div>
        <div className="flex justify-between items-center text-[11px] p-1.5 bg-[#2a8485]/10 rounded">
          <span className="text-[#1f6667] font-semibold">Respirator N95 / KN95 / FFP2</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-[#1f6667]">Standar Medis</span>
        </div>
      </div>
    </div>
  );
};
