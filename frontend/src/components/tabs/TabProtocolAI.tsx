import React, { useState } from "react";
import { Copy, Check, ShieldAlert, Bot, FileText, MessageSquare } from "lucide-react";
import type { HazardType } from "../../types/api";

interface TabProtocolAIProps {
  hazard: HazardType;
  advisory?: any;
}

export const TabProtocolAI: React.FC<TabProtocolAIProps> = ({ hazard, advisory }) => {
  const [docType, setDocType] = useState<"press" | "whatsapp">("whatsapp");
  const [copied, setCopied] = useState(false);
  const isVolcano = hazard === "volcano";

  const defaultPrMessage = `SIARAN PERS RESMI TANGGAP DARURAT PUSDALOPS BNPB/BPBD\n\nBerdasarkan pantauan model dispersi atmosferik 15 anggota ensemble, erupsi aktif memicu sebaran abu vulkanik berisiko tinggi. Pusdalops menginstruksikan:\n1. Evakuasi bertahap pada zona bahaya KRB terdekat.\n2. Mandat pembelajaran jarak jauh (PJJ) daring bagi sekolah dalam lintasan.\n3. Rujukan fasilitas kesehatan dialihkan ke rumah sakit koridor aman bebas abu.`;

  const defaultWaMessage = isVolcano
    ? `[PERINGATAN DINI PVMBG/BPBD]\nTerjadi peningkatan aktivitas vulkanik. Warga dalam radius KRB dihimbau:\n1. DILARANG menggunakan lensa kontak (softlens) karena abu silika tajam dapat merobek kornea mata.\n2. Wajib memakai kacamata pelindung dan masker N95/KN95 saat keluar rumah.\n3. Jangan mendekati bantaran sungai aliran lahar dingin.\nInformasi resmi hubungi SPGDT 119.`
    : `[PERINGATAN KABUT ASAP KARHUTLA]\nIndeks partikel udara PM2.5 meningkat berbahaya. Himbauan warga:\n1. Tutup rapat ventilasi rumah & nyalakan penyaring udara (HEPA).\n2. Wajib menggunakan respirator N95 jika harus beraktivitas di luar.\n3. Anak-anak dan lansia dilarang beraktivitas luar ruang.\nHubungi posko darurat 119 bila mengalami sesak napas.`;

  const prText = advisory?.gemini_briefing?.press_release_body || advisory?.press_release || defaultPrMessage;
  const waText = advisory?.gemini_briefing?.whatsapp_broadcast || advisory?.wa_broadcast || advisory?.broadcast_text || defaultWaMessage;

  const currentText = docType === "press" ? prText : waText;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const priorityDistricts: string[] = advisory?.population_summary?.priority_districts || [];
  const alertLevel = advisory?.alert_level || "SIAGA TANGGAP DARURAT";

  return (
    <div className="space-y-3.5 text-xs text-[#2b211e]">
      {/* 1. Incident Command Header */}
      <div>
        <h3 className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#A14646] mb-0.5">
          TANGGAP DARURAT &amp; EDUKASI
        </h3>
        <span className="text-[10px] text-[#d97706] font-bold uppercase block mb-1.5">
          {alertLevel}
        </span>
        <p className="text-[11px] text-[#2b211e]/70 leading-relaxed mb-2">
          Instruksi keselamatan warga dan diseminasi komunikasi darurat multi-kanal.
        </p>
      </div>

      {/* 2. Wilayah Prioritas Pengawasan (Jika Ada) */}
      {priorityDistricts.length > 0 && (
        <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs">
          <span className="text-[10px] font-bold text-[#2b211e]/60 uppercase tracking-wider block mb-1.5">
            Wilayah Prioritas Terdampak
          </span>
          <div className="flex flex-wrap gap-1">
            {priorityDistricts.map((d) => (
              <span
                key={d}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EB895B]/15 text-[#A14646] border border-[#EB895B]/30"
              >
                Kec./Kab. {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Box Peringatan Kritis Kemenkes (Anti-Softlens / PM2.5) */}
      <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs text-[#2b211e]">
        <div className="flex items-center gap-1.5 text-[#A14646] font-bold text-[11px] mb-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-[#A14646] shrink-0" />
          <span>{isVolcano ? "Peringatan Bahaya Lensa Kontak (Softlens)" : "Peringatan Bahaya Partikel PM2.5"}</span>
        </div>
        <p className="text-[10px] leading-relaxed text-[#2b211e]/75">
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
        <div className="mt-2 text-[10px] font-semibold text-[#A14646] bg-[#DA6556]/10 py-1 px-1.5 rounded border border-[#DA6556]/20">
          Mandat: {isVolcano ? "Lepas softlens, gunakan kacamata pelindung & masker N95." : "Tutup ventilasi, nyalakan air purifier & pakai masker N95."}
        </div>
      </div>

      {/* 4. Draf Siaran Darurat AI (Switcher: Siaran Pers vs WhatsApp Warga) */}
      <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-[#EB895B]" />
            <span className="font-bold text-[11px] text-[#2b211e]">Draf Komunikasi Darurat AI</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#EB895B] hover:bg-[#DA6556] text-white transition cursor-pointer shadow-xs"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Tersalin" : "Salin Dokumen"}</span>
          </button>
        </div>

        {/* Switcher Tabs */}
        <div className="grid grid-cols-2 gap-1 p-0.5 rounded bg-[#f7f3ed] border border-[#2b211e]/10 text-[10px] mb-2 font-medium">
          <button
            type="button"
            onClick={() => setDocType("whatsapp")}
            className={`py-1 px-1.5 rounded flex items-center justify-center gap-1 transition cursor-pointer ${
              docType === "whatsapp"
                ? "bg-[#EB895B] text-white font-semibold shadow-xs"
                : "text-[#2b211e]/70 hover:text-[#2b211e]"
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            <span>Pesan WA Warga</span>
          </button>
          <button
            type="button"
            onClick={() => setDocType("press")}
            className={`py-1 px-1.5 rounded flex items-center justify-center gap-1 transition cursor-pointer ${
              docType === "press"
                ? "bg-[#EB895B] text-white font-semibold shadow-xs"
                : "text-[#2b211e]/70 hover:text-[#2b211e]"
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Siaran Pers Media</span>
          </button>
        </div>

        <pre className="text-[10px] leading-relaxed text-[#2b211e]/80 whitespace-pre-wrap font-sans bg-[#f7f3ed] p-2 rounded border border-[#2b211e]/10 max-h-48 overflow-y-auto custom-scrollbar">
          {currentText}
        </pre>
      </div>

      {/* 5. Standar Efektivitas Masker */}
      <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs space-y-1.5">
        <span className="text-[10px] font-bold text-[#2b211e]/60 uppercase tracking-wider block">
          Standar Efektivitas Masker (Kemenkes)
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
