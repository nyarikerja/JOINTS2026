import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowClockwise,
  ShieldWarning,
  CheckCircle
} from "@phosphor-icons/react";
import { api } from "../../services/api";
import type { HazardType } from "../../types/api";

interface TabProtocolAIProps {
  hazard: HazardType;
  advisory?: any;
  currentCoords?: { lat: number; lng: number } | null;
  eventId?: string;
  placeName?: string;
  onOpenGpsModal?: () => void;
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

const EVENT_FALLBACK_COORDS: Record<string, [number, number]> = {
  anak_krakatau_2026_09: [-6.102, 105.423],
  merapi_yogyakarta: [-7.540, 110.446],
  lewotobi_laki_laki: [-8.538, 122.768],
  marapi_sumatera: [-0.381, 100.473],
  semeru: [-8.108, 112.922],
  agung: [-8.343, 115.508],
  rinjani: [-8.420, 116.470],
  sinabung: [3.170, 98.392],
  tambora: [-8.250, 118.000],
  hutan_tambora: [-8.250, 118.000],
  kelud: [-7.930, 112.308],
  bromo: [-7.942, 112.953],
  dukono: [1.693, 127.894],
  ibu: [1.488, 127.630],
  ruang: [2.300, 125.370],
  iya: [-8.897, 121.645],
  awu: [3.682, 125.456],
  arjuno_welirang: [-7.732, 112.580],
  dempo: [-4.030, 103.130],
  lamongan: [-7.979, 113.342],
  papandayan: [-7.320, 107.730],
  sorikmarapi: [0.686, 99.622],
  tandikat: [-0.433, 100.317],
  tangkuban_parahu: [-6.770, 107.600],
  live_kalimantan: [-2.200, 113.900],
  karhutla_sumsel: [-3.250, 104.750],
  karhutla_riau: [1.250, 101.500],
  karhutla_jambi: [-1.600, 103.600],
  karhutla_kalbar: [-0.050, 109.350],
  karhutla_kalsel: [-3.300, 114.600],
  karhutla_papua: [-8.500, 140.400],
  hutan_sebangau: [-2.450, 113.800],
  hutan_tanjung_puting: [-2.950, 111.950],
  hutan_bukit_tigapuluh: [-0.950, 102.550],
  hutan_tesso_nilo: [-0.150, 101.600],
  hutan_kerinci_seblat: [-2.400, 101.500],
  hutan_padang_sugihan: [-3.050, 104.950],
  hutan_meratus: [-2.750, 115.650],
  hutan_eks_plg: [-2.850, 114.250],
  hutan_giam_siak: [1.150, 101.850],
  hutan_meranti_pesisir: [0.950, 102.750],
  hutan_kubu_raya: [-0.550, 109.550],
  hutan_gunung_palung: [-1.200, 110.150],
  hutan_danau_sentarum: [0.850, 112.150],
  hutan_kutai: [0.250, 117.250],
  hutan_sungai_wain: [-1.150, 116.850],
  hutan_lore_lindu: [-1.350, 120.150],
  hutan_bogani: [0.550, 123.950],
  hutan_maros: [-5.000, 119.750],
  hutan_rawa_aopa: [-4.450, 121.950],
  hutan_way_kambas: [-5.050, 105.750],
  hutan_berbak: [-1.450, 104.350],
  hutan_alas_purwo: [-8.650, 114.450],
  hutan_baluran: [-7.850, 114.350],
  hutan_bromo: [-7.940, 112.950],
  hutan_gunung_lawu: [-7.630, 111.190],
  hutan_merbabu: [-7.450, 110.430],
  hutan_ciremai: [-6.890, 108.400],
  hutan_bali_barat: [-8.150, 114.450],
  hutan_rinjani: [-8.420, 116.470],
  hutan_komodo: [-8.550, 119.450],
  hutan_manupeu_sumba: [-9.750, 119.750],
  hutan_wasur: [-8.550, 140.650],
  hutan_mappi_asmat: [-6.250, 139.550],
  hutan_bintuni: [-2.150, 133.550]
};

export const TabProtocolAI: React.FC<TabProtocolAIProps> = ({
  hazard,
  currentCoords,
  eventId,
  placeName
}) => {
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedPointRef = useRef<string | null>(null);

  // Bersihkan teks nama kejadian: hilangkan "Episentrum:", "Kejadian Observasi -", dll
  const cleanPlaceName = (placeName || "")
    .replace(/^(Episentrum|Kejadian Observasi|Skenario Hipotetis|Simulasi)(\s*[:-]\s*)?/i, "")
    .trim();

  // Sinkronisasi koordinat pusat secara otomatis tanpa loop / re-render berlebihan
  useEffect(() => {
    let targetLat: number | null = null;
    let targetLon: number | null = null;

    if (currentCoords) {
      targetLat = currentCoords.lat;
      targetLon = currentCoords.lng;
    } else if (eventId && EVENT_FALLBACK_COORDS[eventId]) {
      const [lat, lon] = EVENT_FALLBACK_COORDS[eventId];
      targetLat = lat;
      targetLon = lon;
    } else if (cleanPlaceName) {
      const lower = cleanPlaceName.toLowerCase();
      for (const [key, coords] of Object.entries(EVENT_FALLBACK_COORDS)) {
        const cleanKey = key.replace(/^(hutan_|karhutla_)/, "").replace(/_/g, " ");
        if (lower.includes(cleanKey)) {
          targetLat = coords[0];
          targetLon = coords[1];
          break;
        }
      }
    }

    if (targetLat !== null && targetLon !== null) {
      setPoint((prev) => {
        if (prev && Math.abs(prev.lat - targetLat!) < 0.0001 && Math.abs(prev.lon - targetLon!) < 0.0001) {
          return prev;
        }
        return { lat: targetLat!, lon: targetLon! };
      });
    }
  }, [currentCoords, eventId, cleanPlaceName]);

  const loadAdvice = useCallback(async (lat: number, lon: number, force = false) => {
    const key = `${lat.toFixed(3)}_${lon.toFixed(3)}`;
    if (!force && lastFetchedPointRef.current === key) return;
    lastFetchedPointRef.current = key;

    setLoading(true);
    setError(null);
    try {
      const res = await api.getNearbyAdvice(lat, lon, "id");
      setData(res);
    } catch (err: any) {
      if (err?.message && !err.message.includes("429")) {
        setData(null);
      }
      setError(`Ringkasan taktis: ${err?.message || "server offline"}.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (point) loadAdvice(point.lat, point.lon);
  }, [point, loadAdvice]);

  const brief = data?.brief;
  const facts = data?.facts;
  const scenarioKey: Scenario = (data?.scenario as Scenario) || (hazard === "volcano" ? "ash_threat" : "prevention");
  const scStyle = SCENARIO_STYLE[scenarioKey] || SCENARIO_STYLE.ash_threat;

  // Fallback brief cerdas jika API sedang memuat atau server offline
  const activeBrief = brief || (point ? {
    headline: hazard === "volcano"
      ? `Panduan mitigasi taktis keselamatan di sekitar ${cleanPlaceName || "kawasan gunung"}`
      : `Panduan pencegahan kebakaran untuk keluarga di dekat ${cleanPlaceName || "kawasan hutan"}`,
    summary: hazard === "volcano"
      ? `Aktivitas di ${cleanPlaceName || "pusat erupsi"} dalam pantauan siaga. Kualitas udara di sumber menunjukkan peningkatan partikulat abu halus. Warga diimbau mematuhi rekomendasi otoritatif PVMBG dan BPBD.`
      : `Kawasan ${cleanPlaceName || "sumber api"} berpotensi memicu lonjakan asap dan emisi termal. Diimbau meningkatkan kewaspadaan sekat bakar dan membatasi kegiatan luar ruang.`,
    actions: hazard === "volcano" ? [
      "Gunakan masker N95/KN95/KF94 saat beraktivitas di luar ruangan untuk mencegah iritasi saluran napas.",
      "Tutup rapat tempat penampungan air bersih dan makanan dari endapan abu vulkanik tajam.",
      "Bersihkan atap bangunan secara berkala dari akumulasi abu basah guna mencegah risiko keruntuhan struktur.",
      "Patuhi radius aman yang ditetapkan PVMBG dan ikuti jalur evakuasi resmi BPBD."
    ] : [
      "Siram tanah dan tanaman di sekitar rumah dan kebun, terutama saat siang hingga sore yang kering.",
      "Bersihkan daun kering, rumput, dan sampah dalam radius sekitar 10 m dari bangunan.",
      "Jangan membakar sampah atau membuka lahan dengan api, gambut bisa membara di bawah tanah berminggu-minggu.",
      "Bantu jaga sekat bakar (jalur bersih tanpa vegetasi) antara kebun, lahan gambut, dan rumah."
    ]
  } : null);

  return (
    <div className="space-y-3.5 text-xs text-[#2b211e]">
      {/* 1. Header Informasi Kejadian (Nama langsung tanpa awalan "Episentrum:") */}
      <div className="bg-white border border-[#2b211e]/10 rounded-xl p-3 shadow-xs">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="text-[#140f0e] font-bold text-xs flex-1 min-w-0 line-clamp-2 leading-snug break-words" title={cleanPlaceName || "Sumber Kejadian"}>
            {cleanPlaceName || "Sumber Kejadian"}
          </div>

          <button
            type="button"
            onClick={() => point && loadAdvice(point.lat, point.lon, true)}
            disabled={loading || !point}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#2b211e]/20 text-[#2b211e]/80 hover:bg-[#2b211e]/5 text-[10px] font-bold cursor-pointer transition shrink-0 mt-0.5"
            title="Muat Ulang AI"
          >
            <ArrowClockwise size={12} weight="bold" className={loading ? "animate-spin text-[#EB895B]" : ""} />
            <span>Segarkan</span>
          </button>
        </div>

        <div className="text-[10px] text-[#2b211e]/60 font-mono">
          Koordinat Pusat: {point ? `${point.lat.toFixed(4)}°, ${point.lon.toFixed(4)}°` : "-"}
          {loading && <span className="ml-2 text-[#EB895B] animate-pulse">· Menganalisis...</span>}
        </div>
      </div>

      {error && !activeBrief && (
        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
          {error}
        </div>
      )}

      {/* 2. Kartu Hasil AI: Protokol Taktis di Zona Episentrum (Menggantikan Draf Siaran Pers & Buletin) */}
      {activeBrief && (
        <div className={`bg-white border rounded-xl p-3 shadow-xs space-y-2.5 ${scStyle.borderCls}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${scStyle.cls}`}>
              {scStyle.id}
            </span>
          </div>

          <h4 className="text-[12px] font-bold text-[#140f0e] leading-snug">
            {activeBrief.headline}
          </h4>

          <p className="text-[10.5px] text-[#2b211e]/80 leading-relaxed bg-[#f7f3ed] p-2.5 rounded-lg border border-[#2b211e]/10">
            {activeBrief.summary}
          </p>

          <div className="pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A14646] block mb-1.5">
              TINDAKAN TAKTIS DI ZONA KEJADIAN:
            </span>
            <ul className="space-y-1.5 text-[10.5px]">
              {(activeBrief.actions || []).map((action: string, idx: number) => (
                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                  <CheckCircle size={15} weight="duotone" className="text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-[#2b211e]/90">{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {facts && (
            <div className="pt-2 border-t border-[#2b211e]/10 space-y-1 text-[10px] text-[#2b211e]/70">
              <span className="font-bold uppercase tracking-wider text-[9px] text-[#2b211e]/60 block mb-0.5">
                TELEMETRI BERBASIS FAKTA:
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

      {/* 3. Standar Efektivitas Masker Resmi Kemenkes RI */}
      <div className="bg-white border border-[#2b211e]/10 rounded-xl p-3 shadow-xs space-y-2">
        <div className="flex items-center gap-1.5 text-[#A14646] font-bold text-[11px]">
          <ShieldWarning size={15} weight="duotone" />
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
    </div>
  );
};

