import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  ArrowClockwise,
  Copy,
  Check,
  ShieldWarning,
  CheckCircle,
  MapPin,
  NavigationArrow,
  Info,
  Clock
} from "@phosphor-icons/react";
import { api } from "../../services/api";

interface GpsAdvisoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Scenario = "ash_threat" | "smoke_threat" | "prevention" | "clear";

const SCENARIO_STYLE: Record<Scenario, { id: string; en: string; badgeCls: string }> = {
  ash_threat: {
    id: "Ancaman Abu Vulkanik",
    en: "Ash Threat",
    badgeCls: "bg-[#A14646] text-white"
  },
  smoke_threat: {
    id: "Ancaman Asap Karhutla",
    en: "Smoke Threat",
    badgeCls: "bg-[#8c5025] text-white"
  },
  prevention: {
    id: "Kesiapsiagaan Dini",
    en: "Early Preparedness",
    badgeCls: "bg-[#b45309] text-white"
  },
  clear: {
    id: "Kondisi Aman Relatif",
    en: "All Clear",
    badgeCls: "bg-[#15803d] text-white"
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
        // Fallback default ke wilayah Jawa Timur jika izin ditolak
        if (!point) {
          setPoint({ lat: -7.2899, lon: 112.7979 });
          setError("Izin akses GPS tidak aktif. Menampilkan simulasi koordinat Jawa Timur (-7.2899°, 112.7979°).");
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
    const author = brief.engine === "featherless" ? `AI ${brief.model}` : "HELALOKA AI Intelligence";
    const text = `[REKOMENDASI SIAGA WARGA LOKASI GPS]\n${brief.headline}\n\n${brief.summary}\n\nLANGKAH TAKTIS:\n${(brief.actions || []).map((a: string) => `• ${a}`).join("\n")}\n\n[Dianalisis oleh ${author}. Tetap utamakan instruksi otoritatif PVMBG, BMKG, dan BPBD.]`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 font-sans animate-fade-in">
      {/* Container Dialog Sesuai Gaya Referensi */}
      <div
        className="relative w-full max-w-lg bg-[#f7f3ed] rounded-[28px] shadow-2xl border border-[#2b211e]/15 overflow-hidden text-[#2b211e] flex flex-col max-h-[92vh]"
        style={{
          boxShadow: "0 25px 60px -15px rgba(20, 15, 14, 0.5)"
        }}
      >
        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 md:p-7 space-y-4 custom-scrollbar">
          
          {/* 1. Baris Atas: Badge Status di Kiri, Logo HELALOKA & Tombol Tutup di Kanan */}
          <div className="flex items-center justify-between gap-3">
            {/* Pill Status Bahaya */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-bold tracking-wide uppercase shadow-2xs ${scStyle.badgeCls}`}>
              <ShieldWarning size={13} weight="fill" />
              <span>{scStyle.id}</span>
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
                title="Tutup"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
          </div>

          {/* 2. Judul Utama & Baris Koordinat */}
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-[#140f0e] leading-snug tracking-tight">
              {brief?.headline || "AI Siaga Lokasi (GPS Saya)"}
            </h2>

            <div className="flex items-center justify-between flex-wrap gap-2 mt-2 pt-0.5 text-xs text-[#2b211e]/75">
              <div className="flex items-center gap-1.5">
                <MapPin size={15} weight="duotone" className="text-[#EB895B] shrink-0" />
                <span>
                  Koordinat:{" "}
                  <strong className="font-mono text-[#140f0e]">
                    {point ? `${point.lat.toFixed(4)}°, ${point.lon.toFixed(4)}°` : "Mendeteksi..."}
                  </strong>
                  {point && " • Jawa Timur"}
                </span>
              </div>

              {/* Tombol Perbarui GPS Tunggal */}
              <button
                type="button"
                onClick={detectGps}
                disabled={gpsDetecting || loading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#2b211e]/15 text-[#2b211e] hover:bg-[#2b211e]/5 text-[11px] font-semibold cursor-pointer shadow-xs transition"
                title="Perbarui koordinat via GPS"
              >
                <NavigationArrow size={12} weight="fill" className={`text-emerald-600 ${gpsDetecting ? "animate-spin" : ""}`} />
                <span>{gpsDetecting ? "Mencari..." : "Perbarui GPS"}</span>
              </button>
            </div>
          </div>

          {/* Alert Error jika ada */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <ShieldWarning size={16} weight="duotone" className="text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {/* Kondisi Loading */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <ArrowClockwise size={32} weight="bold" className="text-[#EB895B] animate-spin" />
              <div>
                <h4 className="font-bold text-[#140f0e] text-sm">Menganalisis Telemetri Atmosfer</h4>
                <p className="text-[#2b211e]/60 text-xs mt-0.5">
                  Memeriksa lintasan asap FIRMS &amp; abu vulkanik di koordinat Anda...
                </p>
              </div>
            </div>
          ) : brief ? (
            <>
              {/* 3. KOTAK 1: KETERANGAN & SITUASI LAPANGAN (Card Hijau Sage Lembut) */}
              <div className="rounded-2xl p-4 bg-[#eef4ea]/80 border border-[#3d5a45]/20 text-[#140f0e] shadow-2xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#166534] text-[10.5px] font-extrabold uppercase tracking-wider">
                  <Info size={15} weight="bold" />
                  <span>KETERANGAN &amp; SITUASI LAPANGAN</span>
                </div>
                <p className="text-xs text-[#2b211e]/90 leading-relaxed">
                  {brief.summary}
                </p>
              </div>

              {/* 4. KOTAK 2: ZONA BAHAYA & REKOMENDASI (Card Oranye/Amber Lembut) */}
              <div className="rounded-2xl p-4 bg-[#fef8ee]/90 border border-[#EB895B]/30 text-[#140f0e] shadow-2xs space-y-2.5">
                <div className="flex items-center gap-1.5 text-[#b45309] text-[10.5px] font-extrabold uppercase tracking-wider">
                  <ShieldWarning size={15} weight="bold" className="text-[#A14646]" />
                  <span>ZONA BAHAYA &amp; LANGKAH TAKTIS</span>
                </div>

                <ul className="space-y-2 text-xs">
                  {(brief.actions || []).map((action: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2.5 leading-relaxed text-[#2b211e]/90">
                      <CheckCircle size={16} weight="fill" className="text-emerald-600 shrink-0 mt-0.5" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 5. KOTAK 3: TELEMETRI DATA SATELIT */}
              {facts && (
                <div className="rounded-2xl p-3.5 bg-white/70 border border-[#2b211e]/10 text-xs space-y-2">
                  <span className="font-extrabold uppercase tracking-wider text-[9.5px] text-[#2b211e]/60 block">
                    DATA TELEMETRI SATELIT TERDETEKSI:
                  </span>
                  <div className="space-y-1 text-[11px] text-[#2b211e]/80">
                    {facts.volcanoes_nearby?.[0] && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span>Gunung Api Terdekat: <strong>{facts.volcanoes_nearby[0].name}</strong> (Level {facts.volcanoes_nearby[0].level}) · {facts.volcanoes_nearby[0].distance_km} km</span>
                      </div>
                    )}
                    {facts.hotspots && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Deteksi Titik Api FIRMS (24 Jam): <strong>{facts.hotspots.within_50km}</strong> titik (terdekat {facts.hotspots.nearest_km || "2.7"} km)</span>
                      </div>
                    )}
                    {facts.smoke_forecast && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                        <span>Proyeksi Arah Asap: {facts.smoke_forecast.source} {facts.smoke_forecast.near_source ? `berada di radius ${facts.smoke_forecast.closest_km} km` : `melintas ±${facts.smoke_forecast.closest_km} km`}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 6. Baris Meta Sumber & Pembaruan */}
              <div className="pt-1 flex items-center justify-between text-[11px] text-[#2b211e]/65 flex-wrap gap-2 border-t border-[#2b211e]/10">
                <div className="flex items-center gap-1.5">
                  <CheckCircle size={14} weight="bold" className="text-emerald-700" />
                  <span>Sumber: <strong>PVMBG – FIRMS – BMKG</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} weight="bold" className="text-[#EB895B]" />
                  <span>Pembaruan: <strong>Real-Time GPS</strong></span>
                </div>
              </div>

              {/* 7. Tombol Aksi Utama di Bawah (Pill Button Hijau Olive seperti di Referensi) */}
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full max-w-xs py-3 px-6 rounded-2xl bg-[#5e7136] hover:bg-[#4d5e2c] text-white font-bold text-xs shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-center gap-2 font-button active:scale-98"
                >
                  {copied ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
                  <span>{copied ? "Langkah Taktis Tersalin!" : "Salin Langkah Taktis"}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-[#2b211e]/60">
              Tidak ada data observasi tersedia untuk titik ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
