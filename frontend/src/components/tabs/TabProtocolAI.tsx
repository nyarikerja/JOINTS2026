import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, LocateFixed, Crosshair, Copy, Check, Printer, ShieldAlert, CheckCircle2 } from "lucide-react";
import { api } from "../../services/api";
import { getWatchedLocation, requestNotifyPermission, setWatchedLocation } from "../../utils/locationWatch";
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
  currentCoords,
  placeName
}) => {
  const center = currentCoords ? { lat: currentCoords.lat, lon: currentCoords.lng } : null;
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(center);

  const [where, setWhere] = useState<"center" | "gps">("center");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [watched, setWatched] = useState(() => getWatchedLocation());

  // Titik episentrum mengikuti pusat simulasi yang sedang aktif
  useEffect(() => {
    if (currentCoords && where === "center") {
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
      // Tanpa respons server tidak ada ringkasan yang ditampilkan (tidak ada teks cadangan karangan)
      setData(null);
      setError(`Ringkasan AI tidak dapat dimuat: ${err?.message || "server tidak dapat dihubungi"}.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (point) loadAdvice(point.lat, point.lon);
  }, [point, loadAdvice]);

  const handleGps = () => {
    if (!navigator.geolocation) {
      setError("Browser tidak mendukung geolokasi GPS.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setWhere("gps");
        setPoint({ lat: latitude, lon: longitude });
      },
      () => {
        setLoading(false);
        setError("Izin akses lokasi ditolak atau tidak ditemukan.");
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const handleResetCenter = () => {
    if (!center) return;
    setWhere("center");
    setPoint(center);
  };

  const brief = data?.brief;
  const facts = data?.facts;
  const scenarioKey: Scenario = (data?.scenario as Scenario) || "clear";
  const scStyle = SCENARIO_STYLE[scenarioKey] || SCENARIO_STYLE.ash_threat;

  const handleCopy = () => {
    if (!brief) return;
    const author = brief.engine === "featherless" ? `AI ${brief.model}` : "template HelaLoka";
    const text = `${brief.headline}\n\n${brief.summary}\n\nYANG PERLU DILAKUKAN:\n${(brief.actions || []).map((a: string) => `• ${a}`).join("\n")}\n\n[Ringkasan HelaLoka (${author}), bukan peringatan resmi. Ikuti arahan PVMBG, BMKG, dan BPBD.]`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3.5 text-xs text-[#2b211e]">
      {/* 1. Header Ringkasan AI (Sesuai ITHACKITS/FE-FORGEHACK-2026) */}
      <div className="bg-white border border-[#2b211e]/10 rounded-xl p-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400 text-slate-900 tracking-wider">
              AI
            </span>
            <div className="flex items-center gap-1.5 text-[#EB895B] font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[#140f0e]">Ringkasan AI untuk Warga</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#EB895B] hover:bg-[#DA6556] text-white transition cursor-pointer shadow-xs"
            title="Salin Ringkasan AI"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Tersalin" : "Salin"}</span>
          </button>
        </div>

        {/* Pemilih Lokasi Titik Observasi */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#2b211e]/10">
          <button
            type="button"
            onClick={handleResetCenter}
            disabled={loading}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold cursor-pointer transition ${
              where === "center"
                ? "bg-[#EB895B]/15 border-[#EB895B] text-[#A14646]"
                : "border-[#2b211e]/20 text-[#2b211e]/70 hover:bg-[#2b211e]/5"
            }`}
          >
            <Crosshair className="w-2.5 h-2.5" />
            <span>Episentrum</span>
          </button>
          <button
            type="button"
            onClick={handleGps}
            disabled={loading}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold cursor-pointer transition ${
              where === "gps"
                ? "bg-[#EB895B]/15 border-[#EB895B] text-[#A14646]"
                : "border-[#2b211e]/20 text-[#2b211e]/70 hover:bg-[#2b211e]/5"
            }`}
          >
            <LocateFixed className="w-2.5 h-2.5" />
            <span>GPS Saya</span>
          </button>
          <button
            type="button"
            onClick={() => point && loadAdvice(point.lat, point.lon)}
            disabled={loading || !point}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#2b211e]/20 text-[#2b211e]/70 hover:bg-[#2b211e]/5 text-[10px] font-bold cursor-pointer ml-auto"
            title="Muat Ulang AI"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${loading ? "animate-spin text-[#EB895B]" : ""}`} />
            <span>Muat Ulang</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (watched) { setWatchedLocation(null); setWatched(null); return; }
              if (!point) return;
              const ok = await requestNotifyPermission();
              const loc = { lat: point.lat, lon: point.lon, name: where === "gps" ? "Lokasi GPS saya" : (placeName || "Lokasi terpantau") };
              setWatchedLocation(loc); setWatched(loc);
              if (!ok) setError("Izin notifikasi ditolak; lokasi tetap dipantau selama aplikasi terbuka.");
            }}
            disabled={!point}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold cursor-pointer ${watched ? "bg-emerald-500/15 border-emerald-500 text-emerald-800" : "border-[#2b211e]/20 text-[#2b211e]/70 hover:bg-[#2b211e]/5"}`}
            aria-pressed={!!watched}
            title="Beri tahu saya bila asap atau abu mengancam lokasi ini (dicek tiap 15 menit selama aplikasi terbuka)"
          >
            <span>{watched ? "Dipantau" : "Pantau lokasi"}</span>
          </button>
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[9.5px] text-[#2b211e]/60 font-mono">
          <span>
            {where === "center" && placeName ? `${placeName} · ` : ""}
            {point ? `${point.lat.toFixed(3)}°, ${point.lon.toFixed(3)}°` : "Lokasi belum ditentukan"}
          </span>
          {loading && <span className="text-[#EB895B] animate-pulse">Menganalisis satelit & LLM...</span>}
        </div>
      </div>

      {error && (
        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
          {error}
        </div>
      )}

      {/* 2. Kartu Skenario & Narasi Ringkasan AI */}
      {brief && (
        <div className={`bg-white border rounded-xl p-3 shadow-xs space-y-2.5 ${scStyle.borderCls}`}>
          {/* Skenario Badge */}
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${scStyle.cls}`}>
              {scStyle.id}
            </span>
            <span className="text-[9.5px] text-[#2b211e]/50 font-mono">
              {brief.engine === "featherless" ? `Model: ${brief.model}` : "Template (LLM tidak tersedia)"}
            </span>
          </div>

          {/* Headline */}
          <h4 className="text-[12.5px] font-bold text-[#140f0e] leading-snug">
            {brief.headline}
          </h4>

          {/* Summary */}
          <p className="text-[11px] text-[#2b211e]/80 leading-relaxed bg-[#f7f3ed] p-2 rounded-lg border border-[#2b211e]/10">
            {brief.summary}
          </p>

          {/* 3. Yang Perlu Dilakukan (Playbook Actions) */}
          <div className="pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A14646] block mb-1.5">
              Yang Perlu Dilakukan (Langkah Taktis Keluarga):
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

          {/* 4. Data Yang Dipakai AI (Grounded Telemetry Facts) */}
          {facts && (
            <div className="pt-2 border-t border-[#2b211e]/10 space-y-1 text-[10px] text-[#2b211e]/70">
              <span className="font-bold uppercase tracking-wider text-[9px] text-[#2b211e]/60 block mb-0.5">
                Data Yang Dipakai AI:
              </span>
              {facts.volcanoes_nearby?.[0] && (
                <div>• Gunung Api: <strong>{facts.volcanoes_nearby[0].name}</strong> (Level {facts.volcanoes_nearby[0].level}) · {facts.volcanoes_nearby[0].distance_km} km</div>
              )}
              {facts.volcanoes_nearby?.[0]?.last_ash_vona_utc && (
                <div>• VONA berabu terakhir: {new Date(facts.volcanoes_nearby[0].last_ash_vona_utc).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} WIB · puncak abu {facts.volcanoes_nearby[0].last_ash_top_asl_m} m dpl</div>
              )}
              {facts.hotspots && (
                <div>• Deteksi Satelit FIRMS (24 jam): <strong>{facts.hotspots.within_50km}</strong> titik api dalam 50 km {facts.hotspots.nearest_km ? `(terdekat ${facts.hotspots.nearest_km} km)` : ""}</div>
              )}
              {facts.hotspots?.crater_thermal_anomalies > 0 && (
                <div>• Anomali termal kawah (bukan kebakaran): {facts.hotspots.crater_thermal_anomalies} deteksi FIRMS ≤ 5 km dari kawah aktif</div>
              )}
              {facts.fire_prone_forest && (
                <div>• Kawasan rawan api terdekat: {facts.fire_prone_forest.name} ({facts.fire_prone_forest.distance_km} km)</div>
              )}
              {facts.ash_forecast && (
                <div>• Proyeksi Abu: {facts.ash_forecast.source} {facts.ash_forecast.near_source ? `berjarak ${facts.ash_forecast.closest_km} km dari lokasi` : `melintas ±${facts.ash_forecast.closest_km} km dalam ~${facts.ash_forecast.hours_from_now} jam`}</div>
              )}
              {facts.smoke_forecast && (
                <div>• Proyeksi Asap: {facts.smoke_forecast.source} {facts.smoke_forecast.near_source ? `berjarak ${facts.smoke_forecast.closest_km} km` : `melintas ±${facts.smoke_forecast.closest_km} km dalam ~${facts.smoke_forecast.hours_from_now} jam`}</div>
              )}
              {data?.data_sources && (
                <div className="text-[9px] text-[#2b211e]/50 pt-1">Sumber: {data.data_sources.fires} · {data.data_sources.volcanoes} · {data.data_sources.trajectories}</div>
              )}
            </div>
          )}

          {/* Engine Disclaimer Footer */}
          <div className="pt-2 border-t border-[#2b211e]/10 text-[9px] text-[#2b211e]/60 space-y-0.5 leading-tight">
            <div>
              {brief.engine === "featherless"
                ? `Ditulis oleh ${brief.model} (Featherless) hanya dari fakta di atas.`
                : "LLM tidak dapat dihubungi; disusun dengan template tetap dari fakta di atas."}
            </div>
            <div className="italic text-[#A14646]">
              Bukan peringatan resmi. Tetap utamakan instruksi otoritatif PVMBG Badan Geologi, BMKG, dan BPBD.
            </div>
          </div>
        </div>
      )}

      {/* 5. Standar Efektivitas Masker Resmi Kemenkes RI */}
      <div className="bg-white border border-[#2b211e]/10 rounded-xl p-3 shadow-xs space-y-2">
        <div className="flex items-center gap-1.5 text-[#A14646] font-bold text-[11px]">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Standar Masker &amp; Respirator (Kemenkes)</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="p-2 rounded bg-rose-50 border border-rose-200">
            <span className="font-bold text-rose-800 block text-[10.5px]">Masker Bedah &amp; Kain</span>
            <span className="text-rose-700/80 text-[9px] leading-tight block mt-0.5">
              Pori-pori terlalu besar (&gt;3 mikron). Tidak mampu menyaring abu silika tajam.
            </span>
            <span className="inline-block mt-1 px-1.5 py-0.2 bg-rose-200 text-rose-900 rounded text-[8.5px] font-bold uppercase">
              Tidak Disarankan
            </span>
          </div>
          <div className="p-2 rounded bg-emerald-50 border border-emerald-200">
            <span className="font-bold text-emerald-800 block text-[10.5px]">N95 / KN95 / KF94</span>
            <span className="text-emerald-700/80 text-[9px] leading-tight block mt-0.5">
              Filtrasi &ge;95% partikel mikro (0.3 mikron). Mencegah silikosis &amp; ISPA akut.
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
        <span>CETAK LEMBAR AKSI KELUARGA (PDF / A4)</span>
      </button>
    </div>
  );
};
