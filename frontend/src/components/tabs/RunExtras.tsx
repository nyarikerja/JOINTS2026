import React, { useEffect, useState } from "react";
import { Wind, GitCompare, Link2, Check } from "lucide-react";
import { api } from "../../services/api";

const ISPU_LABEL: Record<string, { text: string; cls: string }> = {
  baik: { text: "Baik", cls: "bg-emerald-500/15 text-emerald-800 border-emerald-500/30" },
  sedang: { text: "Sedang", cls: "bg-sky-500/15 text-sky-800 border-sky-500/30" },
  tidak_sehat: { text: "Tidak sehat", cls: "bg-amber-500/20 text-amber-900 border-amber-500/40" },
  sangat_tidak_sehat: { text: "Sangat tidak sehat", cls: "bg-red-500/15 text-red-800 border-red-500/30" },
  berbahaya: { text: "Berbahaya", cls: "bg-purple-500/15 text-purple-900 border-purple-500/30" }
};

export const IspuBadge: React.FC<{ cat?: string | null }> = ({ cat }) => {
  if (!cat) return <span className="text-[10px] text-[#2b211e]/50">-</span>;
  const s = ISPU_LABEL[cat] || { text: cat, cls: "bg-slate-100 text-slate-700 border-slate-200" };
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${s.cls}`}>{s.text}</span>;
};

/** Kualitas udara nyata di sekitar run: PM2.5 CAMS, stasiun OpenAQ, dan pembanding sebaran model. */
export const AirQualityCard: React.FC<{ runId: string; hazard: string }> = ({ runId, hazard }) => {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    setData(null);
    api.getRunAirQuality(runId).then(setData).catch(() => setData(null));
  }, [runId]);
  if (!data?.available) return null;
  const c = data.center || {};
  const cmp = data.comparison;
  return (
    <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#2b211e]">
        <Wind className="w-3.5 h-3.5 text-[#2a8485]" aria-hidden="true" />
        <span>Kualitas Udara (ISPU PM2.5) di sumber</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-[#f7f3ed] p-1.5 rounded">
          <span className="block text-[9px] text-[#2b211e]/60">24 jam terakhir</span>
          <strong className="font-mono">{c.pm25_24h_now ?? "-"} µg/m³</strong> <IspuBadge cat={c.ispu_now} />
        </div>
        <div className="bg-[#f7f3ed] p-1.5 rounded">
          <span className="block text-[9px] text-[#2b211e]/60">Terburuk 48 jam ke depan</span>
          <strong className="font-mono">{c.pm25_24h_max_forecast ?? "-"} µg/m³</strong> <IspuBadge cat={c.ispu_max_forecast} />
        </div>
      </div>
      {data.stations?.length > 0 && (
        <div className="text-[10px] space-y-0.5">
          <span className="block text-[9px] font-bold uppercase text-[#2b211e]/60">Stasiun terdekat (OpenAQ)</span>
          {data.stations.slice(0, 3).map((s: any) => (
            <div key={s.name} className="flex justify-between gap-2">
              <span className="truncate">{s.name} · {s.distance_km} km</span>
              <span className="shrink-0 font-mono">{s.pm25_24h} µg/m³ <IspuBadge cat={s.ispu} /></span>
            </div>
          ))}
        </div>
      )}
      {hazard === "fire" && cmp?.n_points > 0 && (
        <p className="text-[10px] text-[#2b211e]/75 leading-relaxed border-t border-[#2b211e]/10 pt-1.5">
          Kesesuaian sebaran model dengan peta asap CAMS: <strong>{cmp.agreement_pct}%</strong> dari {cmp.n_points} titik
          ({cmp.hits} sama-sama berasap, {cmp.both_clear} sama-sama bersih). <span className="text-[#2b211e]/55">{cmp.caveat}</span>
        </p>
      )}
      <p className="text-[9px] text-[#2b211e]/50">{data.sources?.model} · {data.sources?.stations}</p>
    </div>
  );
};

/** Salin tautan run aktif (URL memuat ?run=...). */
export const ShareRunButton: React.FC = () => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(window.location.href).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        });
      }}
      className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#2b211e]/15 bg-white text-[10px] font-semibold hover:bg-[#f7f3ed] cursor-pointer"
      aria-label="Salin tautan hasil simulasi"
    >
      {done ? <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" /> : <Link2 className="w-3 h-3" aria-hidden="true" />}
      <span>{done ? "Tersalin" : "Bagikan"}</span>
    </button>
  );
};

/** Bandingkan run aktif dengan run lain dari riwayat (POST /runs/compare). */
export const CompareRuns: React.FC<{ runId: string }> = ({ runId }) => {
  const [hist, setHist] = useState<any[]>([]);
  const [other, setOther] = useState("");
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    try {
      setHist(JSON.parse(localStorage.getItem("runHistory") || "[]").filter((r: any) => r.id !== runId));
    } catch { setHist([]); }
    setRes(null);
  }, [runId]);
  if (hist.length === 0) return null;
  const run = async () => {
    if (!other) return;
    setErr(null);
    try { setRes(await api.compareRuns(other, runId)); } catch (e: any) { setErr(e?.message || "Gagal membandingkan"); }
  };
  const d = res?.deltas;
  const fmt = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString("id-ID")}`;
  return (
    <div className="bg-white border border-[#2b211e]/10 rounded-lg p-2.5 shadow-xs space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#2b211e]">
        <GitCompare className="w-3.5 h-3.5 text-[#c25e2d]" aria-hidden="true" />
        <span>Bandingkan dengan run lain</span>
      </div>
      <div className="flex gap-1.5">
        <label className="sr-only" htmlFor="cmpRun">Run pembanding</label>
        <select id="cmpRun" value={other} onChange={(e) => setOther(e.target.value)}
          className="flex-1 min-w-0 text-[10.5px] py-1 px-1.5 rounded bg-[#f7f3ed] border border-[#2b211e]/20">
          <option value="">Pilih run sebelumnya…</option>
          {hist.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} · {h.mode === "experiment" ? "skenario" : "nyata"} · {new Date(h.t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </option>
          ))}
        </select>
        <button type="button" onClick={run} disabled={!other}
          className="px-2.5 rounded bg-[#EB895B] text-white text-[10px] font-semibold disabled:opacity-40 cursor-pointer">Bandingkan</button>
      </div>
      {err && <p className="text-[10px] text-red-700">{err}</p>}
      {d && (
        <div className="text-[10px] space-y-0.5">
          <p className="text-[9px] text-[#2b211e]/60">Selisih run ini terhadap run terpilih (median, P5–P95):</p>
          <div>Penduduk terpapar: <strong>{fmt(d.population_exposed_diff.median_diff)}</strong> jiwa ({fmt(d.population_exposed_diff.min_diff)} s.d. {fmt(d.population_exposed_diff.max_diff)})</div>
          <div>Luas sebaran: <strong>{fmt(d.area_exposed_diff_km2.median_diff)}</strong> km²</div>
          <div>Sekolah terpapar: <strong>{fmt(d.schools_exposed_diff.median_diff)}</strong></div>
        </div>
      )}
    </div>
  );
};
