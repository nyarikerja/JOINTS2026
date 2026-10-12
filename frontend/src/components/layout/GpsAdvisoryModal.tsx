import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  LocateFixed,
  RefreshCw,
  Copy,
  Check,
  Printer,
  ShieldAlert,
  CheckCircle2,
  MapPin,
  Bell,
  BellOff,
  Navigation
} from "lucide-react";
import { api } from "../../services/api";
import {
  getWatchedLocation,
  requestNotifyPermission,
  setWatchedLocation
} from "../../utils/locationWatch";

interface GpsAdvisoryModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const GpsAdvisoryModal: React.FC<GpsAdvisoryModalProps> = ({
  isOpen,
  onClose
}) => {
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [watched, setWatched] = useState(() => getWatchedLocation());

  // Ambil lokasi GPS secara otomatis saat modal pertama kali dibuka
  const detectGps = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Browser tidak mendukung sensor geolokasi GPS.");
      return;
    }
    setGpsDetecting(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPoint({ lat: latitude, lon: longitude });
        setGpsDetecting(false);
      },
      (err) => {
        setGpsDetecting(false);
        // Fallback default ke wilayah Jakarta jika izin ditolak, agar pengguna tetap dapat melihat demo fungsional
        if (!point) {
          setPoint({ lat: -6.1754, lon: 106.8272 });
          setError("Izin akses GPS tidak diizinkan. Menampilkan simulasi lokasi Jakarta (-6.175°, 106.827°).");
        } else {
          setError(`Gagal mendeteksi lokasi GPS: ${err.message}`);
        }
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }, [point]);

  useEffect(() => {
    if (isOpen && !point) {
      detectGps();
    }
  }, [isOpen, point, detectGps]);

  const loadAdvice = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getNearbyAdvice(lat, lon, "id");
      setData(res);
    } catch (err: any) {
      setData(null);
      setError(`Gagal memuat analisis AI: ${err?.message || "server tidak dapat dihubungi"}.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (point) {
      loadAdvice(point.lat, point.lon);
    }
  }, [point, loadAdvice]);

  if (!isOpen) return null;

  const brief = data?.brief;
  const facts = data?.facts;
  const scenarioKey: Scenario = (data?.scenario as Scenario) || "clear";
  const scStyle = SCENARIO_STYLE[scenarioKey] || SCENARIO_STYLE.clear;

  const handleCopy = () => {
    if (!brief) return;
    const author = brief.engine === "featherless" ? `AI ${brief.model}` : "UdaraSiaga Intelligence";
    const text = `[REKOMENDASI SIAGA WARGA LOKASI GPS]\n${brief.headline}\n\n${brief.summary}\n\nLANGKAH TAKTIS:\n${(brief.actions || []).map((a: string) => `• ${a}`).join("\n")}\n\n[Dianalisis oleh ${author}. Tetap utamakan instruksi otoritatif PVMBG, BMKG, dan BPBD.]`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleWatch = async () => {
    if (watched) {
      setWatchedLocation(null);
      setWatched(null);
      return;
    }
    if (!point) return;
    const ok = await requestNotifyPermission();
    const loc = {
      lat: point.lat,
      lon: point.lon,
      name: "Lokasi GPS Saya Saat Ini"
    };
    setWatchedLocation(loc);
    setWatched(loc);
    if (!ok) {
      setError("Izin notifikasi browser ditolak; lokasi tetap dipantau selama aplikasi terbuka.");
    }
  };

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 font-sans animate-fade-in">
      <div
        className="bg-[#f7f3ed] rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-[#2b211e]/15 overflow-hidden text-[#2b211e]"
        style={{
          boxShadow: "0 25px 50px -12px rgba(20, 15, 14, 0.45)"
        }}
      >
        {/* Header Modal */}
        <div className="bg-white px-5 py-3.5 border-b border-[#2b211e]/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-800">
              <LocateFixed className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-400 text-slate-900 tracking-wider">
                  PERSONAL
                </span>
                <h3 className="font-bold text-sm text-[#140f0e]">AI Siaga Lokasi (GPS Saya)</h3>
              </div>
              <p className="text-[11px] text-[#2b211e]/60">
                Pemeriksaan personal ancaman abu &amp; asap di titik perangkat Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#2b211e]/50 hover:text-[#2b211e] transition cursor-pointer p-1.5 rounded-lg hover:bg-[#2b211e]/5"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Lokasi GPS */}
        <div className="bg-[#ede7dd]/80 px-5 py-2.5 border-b border-[#2b211e]/10 flex items-center justify-between flex-wrap gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#EB895B]" />
            <span className="font-mono text-[11px] font-semibold text-[#2b211e]/80">
              {point
                ? `${point.lat.toFixed(4)}°, ${point.lon.toFixed(4)}°`
                : "Mendeteksi koordinat..."}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={detectGps}
              disabled={gpsDetecting || loading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#2b211e]/15 text-[#2b211e] hover:bg-[#2b211e]/5 text-[11px] font-semibold cursor-pointer shadow-xs transition"
              title="Perbarui koordinat via GPS"
            >
              <Navigation className={`w-3 h-3 text-emerald-600 ${gpsDetecting ? "animate-spin" : ""}`} />
              <span>{gpsDetecting ? "Mencari GPS..." : "Perbarui GPS"}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleWatch}
              disabled={!point}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer shadow-xs transition ${
                watched
                  ? "bg-emerald-600 text-white border-emerald-700"
                  : "bg-white border-[#2b211e]/15 text-[#2b211e] hover:bg-[#2b211e]/5"
              }`}
              title="Aktifkan pemantauan otomatis berkala (tiap 15 menit)"
            >
              {watched ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3 text-[#2b211e]/50" />}
              <span>{watched ? "Dipantau Aktif" : "Pantau Lokasi"}</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#EB895B] animate-spin" />
              <div>
                <h4 className="font-bold text-[#140f0e] text-sm">Menganalisis Telemetri Atmosfer</h4>
                <p className="text-[#2b211e]/60 text-xs mt-0.5">
                  Memeriksa lintasan asap FIRMS &amp; abu vulkanik NOAA di koordinat Anda...
                </p>
              </div>
            </div>
          ) : brief ? (
            <>
              {/* Kartu Status Skenario */}
              <div className={`bg-white border rounded-xl p-4 shadow-xs space-y-3 ${scStyle.borderCls}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${scStyle.cls}`}>
                      {scStyle.id}
                    </span>
                    <span className="text-[10px] text-[#2b211e]/50 font-mono">
                      {brief.engine === "featherless" ? `Model: ${brief.model}` : "Template Terverifikasi"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#EB895B] hover:bg-[#DA6556] text-white transition cursor-pointer shadow-xs"
                    title="Salin Rangkuman"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Tersalin" : "Salin"}</span>
                  </button>
                </div>

                <h4 className="text-sm font-bold text-[#140f0e] leading-snug">
                  {brief.headline}
                </h4>

                <p className="text-xs text-[#2b211e]/85 leading-relaxed bg-[#f7f3ed] p-3 rounded-lg border border-[#2b211e]/10">
                  {brief.summary}
                </p>

                {/* Yang Perlu Dilakukan */}
                <div className="pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#A14646] block mb-2">
                    Yang Perlu Dilakukan (Langkah Taktis Keluarga):
                  </span>
                  <ul className="space-y-2 text-xs">
                    {(brief.actions || []).map((action: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="text-[#2b211e]/90">{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Fakta Telemetri yang Mendasari Keputusan */}
                {facts && (
                  <div className="pt-3 border-t border-[#2b211e]/10 space-y-1.5 text-[11px] text-[#2b211e]/75">
                    <span className="font-bold uppercase tracking-wider text-[9.5px] text-[#2b211e]/60 block mb-1">
                      Data Telemetri Satelit Terdeteksi:
                    </span>
                    {facts.volcanoes_nearby?.[0] && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span>Gunung Api Terdekat: <strong>{facts.volcanoes_nearby[0].name}</strong> (Level {facts.volcanoes_nearby[0].level}) · {facts.volcanoes_nearby[0].distance_km} km</span>
                      </div>
                    )}
                    {facts.hotspots && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Deteksi Titik Api FIRMS (24 Jam): <strong>{facts.hotspots.within_50km}</strong> titik dalam 50 km {facts.hotspots.nearest_km ? `(terdekat ${facts.hotspots.nearest_km} km)` : ""}</span>
                      </div>
                    )}
                    {facts.ash_forecast && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                        <span>Proyeksi Arah Abu: {facts.ash_forecast.source} {facts.ash_forecast.near_source ? `berada di radius ${facts.ash_forecast.closest_km} km` : `melintas ±${facts.ash_forecast.closest_km} km dalam ~${facts.ash_forecast.hours_from_now} jam`}</span>
                      </div>
                    )}
                    {facts.smoke_forecast && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                        <span>Proyeksi Arah Asap: {facts.smoke_forecast.source} {facts.smoke_forecast.near_source ? `berada di radius ${facts.smoke_forecast.closest_km} km` : `melintas ±${facts.smoke_forecast.closest_km} km dalam ~${facts.smoke_forecast.hours_from_now} jam`}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Standar Efektivitas Masker Resmi Kemenkes RI */}
              <div className="bg-white border border-[#2b211e]/10 rounded-xl p-3.5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-[#A14646] font-bold text-xs">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Standar Masker Respirator Resmi (Kemenkes RI)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                    <span className="font-bold text-rose-800 block text-xs">Masker Bedah &amp; Kain</span>
                    <span className="text-rose-700/80 text-[10px] leading-tight block mt-0.5">
                      Pori-pori terlalu besar (&gt;3 mikron). Kebocoran samping hingga 50%.
                    </span>
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-rose-200 text-rose-900 rounded text-[9px] font-bold uppercase">
                      Tidak Efektif
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="font-bold text-emerald-800 block text-xs">N95 / KN95 / KF94</span>
                    <span className="text-emerald-700/80 text-[10px] leading-tight block mt-0.5">
                      Filtrasi &ge;95% mikropartikel PM2.5 &amp; silika tajam. Klip hidung rapat.
                    </span>
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded text-[9px] font-bold uppercase">
                      Wajib Resmi
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-[#2b211e]/60">
              Tidak ada data observasi tersedia untuk titik ini.
            </div>
          )}
        </div>

        {/* Footer Tombol Cetak Dokumen A4 */}
        <div className="bg-white p-3.5 border-t border-[#2b211e]/10 flex items-center justify-between gap-2 shrink-0">
          <p className="text-[10px] text-[#2b211e]/50 italic">
            Bukan dokumen penetapan status hukum. Tetap ikuti komando BPBD setempat.
          </p>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-1.5 rounded-lg bg-[#EB895B] hover:bg-[#DA6556] text-white font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
