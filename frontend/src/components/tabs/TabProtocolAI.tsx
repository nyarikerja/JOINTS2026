import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  Crosshair,
  Copy,
  Check,
  Printer,
  ShieldAlert,
  CheckCircle2,
  FileText,
  MessageSquare,
  AlertTriangle
} from "lucide-react";
import { api } from "../../services/api";
import type { HazardType } from "../../types/api";

interface TabProtocolAIProps {
  hazard: HazardType;
  advisory?: any;
  currentCoords?: { lat: number; lng: number } | null;
  eventId?: string;
  placeName?: string;
}

type Scenario = "ash_threat" | "smoke_threat" | "prevention" | "clear";

const SCENARIO_STYLE: Record<Scenario, { id: string; en: string; cls: string; borderCls: string }> = {
  ash_threat: {
    id: "Ancaman Abu Vulkanik",
    en: "Ash Threat",
    cls: "bg-rose-500/20 text-rose-700 border-rose-400/40",
    borderCls: "border-rose-400/50"
  },
  smoke_threat: {
    id: "Ancaman Asap Karhutla",
    en: "Smoke Threat",
    cls: "bg-orange-500/20 text-orange-800 border-orange-400/40",
    borderCls: "border-orange-400/50"
  },
  prevention: {
    id: "Pencegahan Dini",
    en: "Prevention",
    cls: "bg-emerald-500/20 text-emerald-800 border-emerald-400/40",
    borderCls: "border-emerald-400/50"
  },
  clear: {
    id: "Kondisi Aman",
    en: "All Clear",
    cls: "bg-sky-500/20 text-sky-800 border-sky-400/40",
    borderCls: "border-sky-400/50"
  }
};

export const TabProtocolAI: React.FC<TabProtocolAIProps> = ({
  advisory,
  currentCoords,
  placeName
}) => {
  const center = currentCoords ? { lat: currentCoords.lat, lon: currentCoords.lng } : null;
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(center);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPr, setCopiedPr] = useState(false);
  const [copiedWa, setCopiedWa] = useState(false);

  // Titik episentrum mengikuti pusat simulasi yang sedang aktif
  useEffect(() => {
    if (currentCoords) {
      setPoint({ lat: currentCoords.lat, lon: currentCoords.lng });
    }
  }, [currentCoords?.lat, currentCoords?.lng]);

  const loadAdvice = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getNearbyAdvice(lat, lon, "id");
      setData(res);
    } catch (err: any) {
      setData(null);
      setError(`Ringkasan taktis tidak dapat dimuat: ${err?.message || "server offline"}.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (point) loadAdvice(point.lat, point.lon);
  }, [point, loadAdvice]);

  const brief = data?.brief;
  const facts = data?.facts;
  const scenarioKey: Scenario = (data?.scenario as Scenario) || "clear";
  const scStyle = SCENARIO_STYLE[scenarioKey] || SCENARIO_STYLE.ash_threat;

  const handleCopyPr = () => {
    if (!advisory) return;
    const text = `${advisory.press_release_title}\n\n${advisory.press_release_body}\n\nCatatan Penting: ${advisory.key_callout}`;
    navigator.clipboard.writeText(text);
    setCopiedPr(true);
    setTimeout(() => setCopiedPr(false), 2000);
  };

  const handleCopyWa = () => {
    if (!advisory) return;
    navigator.clipboard.writeText(advisory.whatsapp_broadcast);
    setCopiedWa(true);
    setTimeout(() => setCopiedWa(false), 2000);
  };

  return (
    <div className="space-y-3.5 text-xs text-[#2b211e]">
      {/* 1. Header Informasi Episentrum Simulasi */}
      <div className="bg-white border border-[#2b211e]/10 rounded-xl p-3 shadow-xs">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#EB895B] text-white tracking-wider">
              SIMULASI
            </span>
            <div className="flex items-center gap-1 text-[#140f0e] font-bold text-xs">
              <Crosshair className="w-3.5 h-3.5 text-[#A14646]" />
              <span>Episentrum: {placeName || "Sumber Kejadian"}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => point && loadAdvice(point.lat, point.lon)}
            disabled={loading || !point}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#2b211e]/20 text-[#2b211e]/70 hover:bg-[#2b211e]/5 text-[10px] font-bold cursor-pointer transition"
            title="Muat Ulang AI"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${loading ? "animate-spin text-[#EB895B]" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>

        <div className="text-[10px] text-[#2b211e]/60 font-mono">
          Koordinat Pusat: {point ? `${point.lat.toFixed(4)}°, ${point.lon.toFixed(4)}°` : "-"}
          {loading && <span className="ml-2 text-[#EB895B] animate-pulse">· Menganalisis...</span>}
        </div>
      </div>

      {error && (
        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
          {error}
        </div>
      )}

      {/* 2. Draf Siaran Pers Resmi & Buletin Darurat (Google Gemini AI) */}
      {advisory && (
        <div className="bg-white border border-[#2b211e]/15 rounded-xl p-3.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#2b211e]/10 pb-2">
            <div className="flex items-center gap-1.5 text-[#140f0e] font-bold text-xs">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Draf Siaran Pers &amp; Buletin (Gemini AI)</span>
            </div>
            <span className="text-[9.5px] font-mono text-[#2b211e]/60">
              {advisory.engine || "Google Gemini"}
            </span>
          </div>

          {/* Pernyataan Kunci Kedudukan Kebijakan */}
          {advisory.key_callout && (
            <div className="bg-amber-50 border border-amber-200/80 rounded-lg p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-900 leading-snug font-medium">
                <strong>Fokus Kebijakan:</strong> {advisory.key_callout}
              </div>
            </div>
          )}

          {/* Siaran Pers Resmi Media */}
          {advisory.press_release_body && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#A14646]">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Siaran Pers Resmi Media (BPBD)</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPr}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#EB895B] hover:bg-[#DA6556] text-white transition cursor-pointer shadow-xs"
                >
                  {copiedPr ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-white" />}
                  <span>{copiedPr ? "Tersalin" : "Salin Siaran Pers"}</span>
                </button>
              </div>
              <p className="text-[10.5px] text-[#2b211e]/85 leading-relaxed bg-[#f7f3ed] p-2.5 rounded-lg border border-[#2b211e]/10 whitespace-pre-line font-sans">
                {advisory.press_release_body}
              </p>
            </div>
          )}

          {/* Pesan Siaran Darurat Warga WhatsApp */}
          {advisory.whatsapp_broadcast && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Buletin Siaran Darurat Warga (WhatsApp)</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyWa}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer shadow-xs"
                >
                  {copiedWa ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-white" />}
                  <span>{copiedWa ? "Tersalin" : "Salin Buletin"}</span>
                </button>
              </div>
              <pre className="text-[10px] text-[#2b211e]/85 leading-relaxed bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200/60 whitespace-pre-wrap font-sans">
                {advisory.whatsapp_broadcast}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 3. Kartu Protokol Taktis di Zona Episentrum */}
      {brief && (
        <div className={`bg-white border rounded-xl p-3 shadow-xs space-y-2.5 ${scStyle.borderCls}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${scStyle.cls}`}>
              {scStyle.id}
            </span>
            <span className="text-[9.5px] text-[#2b211e]/50 font-mono">
              Zona Episentrum Kejadian
            </span>
          </div>

          <h4 className="text-[12px] font-bold text-[#140f0e] leading-snug">
            {brief.headline}
          </h4>

          <p className="text-[10.5px] text-[#2b211e]/80 leading-relaxed bg-[#f7f3ed] p-2 rounded-lg border border-[#2b211e]/10">
            {brief.summary}
          </p>

          <div className="pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A14646] block mb-1.5">
              Tindakan Taktis di Zona Kejadian:
            </span>
            <ul className="space-y-1.5 text-[10.5px]">
              {(brief.actions || []).map((action: string, idx: number) => (
                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-[#2b211e]/90">{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {facts && (
            <div className="pt-2 border-t border-[#2b211e]/10 space-y-1 text-[10px] text-[#2b211e]/70">
              <span className="font-bold uppercase tracking-wider text-[9px] text-[#2b211e]/60 block mb-0.5">
                Telemetri Berbasis Fakta:
              </span>
              {facts.volcanoes_nearby?.[0] && (
                <div>• Gunung Terdekat: <strong>{facts.volcanoes_nearby[0].name}</strong> (Level {facts.volcanoes_nearby[0].level}) · {facts.volcanoes_nearby[0].distance_km} km</div>
              )}
              {facts.hotspots && (
                <div>• Deteksi Titik Api Satelit: <strong>{facts.hotspots.within_50km}</strong> titik api dalam 50 km</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Standar Efektivitas Masker Resmi Kemenkes RI */}
      <div className="bg-white border border-[#2b211e]/10 rounded-xl p-3 shadow-xs space-y-2">
        <div className="flex items-center gap-1.5 text-[#A14646] font-bold text-[11px]">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Standar Masker &amp; Respirator (Kemenkes RI)</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="p-2 rounded bg-rose-50 border border-rose-200">
            <span className="font-bold text-rose-800 block text-[10.5px]">Masker Bedah &amp; Kain</span>
            <span className="text-rose-700/80 text-[9px] leading-tight block mt-0.5">
              Kebocoran samping 30-50%. Tidak mampu menyaring abu silika tajam.
            </span>
            <span className="inline-block mt-1 px-1.5 py-0.2 bg-rose-200 text-rose-900 rounded text-[8.5px] font-bold uppercase">
              Tidak Disarankan
            </span>
          </div>
          <div className="p-2 rounded bg-emerald-50 border border-emerald-200">
            <span className="font-bold text-emerald-800 block text-[10.5px]">N95 / KN95 / KF94</span>
            <span className="text-emerald-700/80 text-[9px] leading-tight block mt-0.5">
              Filtrasi partikel &ge;95%. Mencegah silikosis &amp; ISPA akut.
            </span>
            <span className="inline-block mt-1 px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded text-[8.5px] font-bold uppercase">
              Wajib Resmi
            </span>
          </div>
        </div>
      </div>

      {/* Tombol Cetak / PDF */}
      <button
        type="button"
        onClick={() => window.print()}
        className="w-full py-2 px-3 rounded-lg bg-[#EB895B] hover:bg-[#DA6556] text-white font-bold text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
      >
        <Printer className="w-3.5 h-3.5" />
        <span>CETAK DOKUMEN MITIGASI (PDF / A4)</span>
      </button>
    </div>
  );
};
