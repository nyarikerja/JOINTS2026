"""
app/impact/export.py

Generator ekspor satu halaman (ringkasan JSON dan HTML cetak)
sesuai SPEC.md Bagian 11 (/runs/{run_id}/export).
"""

from typing import Any, Dict


def generate_printable_html(export_data: Dict[str, Any]) -> str:
    """
    Menghasilkan HTML mandiri siap cetak (print-ready) yang rapi, padat informasi,
    bebas gaya klise, dan mematuhi prinsip transparansi UdaraSiaga.
    """
    run_id = export_data.get("run_id", "-")
    hazard = export_data.get("hazard", "-").upper()
    mode = export_data.get("mode", "auto")
    scenario_label = export_data.get("scenario_label", "-")
    disclaimer = export_data.get("disclaimer", "")
    n_members = export_data.get("n_members", "-")
    horizon = export_data.get("horizon_hours", "-")
    members_source = export_data.get("members_source", "-")

    impact = export_data.get("impact", {})
    pop = impact.get("population_exposed", {"min": 0, "median": 0, "max": 0})
    child = impact.get("children_exposed", {"min": 0, "median": 0, "max": 0})
    elder = impact.get("elderly_exposed", {"min": 0, "median": 0, "max": 0})
    area = impact.get("area_exposed_km2", {"min": 0, "median": 0, "max": 0})

    def fmt_r(m: dict) -> str:
        return f"{m.get('min', 0):,.0f} &ndash; <strong>{m.get('median', 0):,.0f}</strong> &ndash; {m.get('max', 0):,.0f}"

    assumptions = export_data.get("assumptions_used", [])
    assumptions_rows = "".join(
        f"<tr><td><code>{a.get('parameter')}</code></td><td><span class='badge'>{a.get('status')}</span></td><td>{a.get('source') or '-'}</td><td><small>{a.get('caveat') or '-'}</small></td></tr>"
        for a in assumptions
    )

    advice_list = export_data.get("advice", {}).get("sourced_advice", [])
    advice_items = "".join(
        f"<li><strong>{adv.get('action')}</strong><br><small>Sumber: {adv.get('source')} ({adv.get('verified_on')})</small></li>"
        for adv in advice_list
    ) or "<li>Tidak ada saran khusus.</li>"

    html = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Laporan Ringkasan Skenario UdaraSiaga - {run_id}</title>
  <style>
    @page {{ size: A4; margin: 15mm; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #111827;
      margin: 0;
      padding: 0;
    }}
    .header {{
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }}
    .brand {{ font-size: 18pt; font-weight: 800; letter-spacing: -0.5px; }}
    .subtitle {{ font-size: 10pt; color: #475569; }}
    .mono {{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }}
    .disclaimer-box {{
      background: #fef2f2;
      border-left: 4px solid #b91c1c;
      padding: 8px 12px;
      font-size: 9pt;
      margin-bottom: 14px;
    }}
    .meta-grid {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
      background: #f8fafc;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      font-size: 9.5pt;
    }}
    .meta-item strong {{ display: block; font-size: 8pt; text-transform: uppercase; color: #64748b; }}
    h2 {{ font-size: 12pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 14px; margin-bottom: 8px; }}
    table {{ width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9.5pt; }}
    th, td {{ border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; }}
    th {{ background: #f1f5f9; font-weight: 600; }}
    .badge {{
      display: inline-block;
      padding: 1px 6px;
      font-size: 8pt;
      border: 1px solid #94a3b8;
      border-radius: 3px;
      background: #f8fafc;
      font-family: monospace;
    }}
    .footer {{
      margin-top: 20px;
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      font-size: 8pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }}
    @media print {{
      body {{ font-size: 10pt; }}
      .no-print {{ display: none; }}
    }}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <span class="brand">UdaraSiaga</span>
      <span class="subtitle"> | Ringkasan Simulasi Bahaya Atmosfer</span>
    </div>
    <div class="mono" style="font-size:9pt;">ID: {run_id}</div>
  </div>

  <div class="disclaimer-box">
    <strong>DISCLAIMER RESMI:</strong> {disclaimer}
  </div>

  <div class="meta-grid">
    <div class="meta-item"><strong>Bahaya:</strong> {hazard}</div>
    <div class="meta-item"><strong>Mode / Skenario:</strong> {mode} ({scenario_label})</div>
    <div class="meta-item"><strong>Horizon Waktu:</strong> T + {horizon} jam</div>
    <div class="meta-item"><strong>Ansambel:</strong> {n_members} anggota ({members_source})</div>
  </div>

  <h2>Estimasi Dampak Paparan (Rentang P5 &ndash; P50 &ndash; P95)</h2>
  <table>
    <thead>
      <tr>
        <th>Indikator Dampak</th>
        <th>Rentang Peluang {{Min &ndash; Median &ndash; Maks}}</th>
        <th>Satuan</th>
        <th>Catatan Metodologi</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Penduduk Terpapar (Total)</td>
        <td class="mono">{fmt_r(pop)}</td>
        <td>Jiwa</td>
        <td>Tumpang-tindih grid WorldPop 100m dengan poligon plume</td>
      </tr>
      <tr>
        <td>Anak-anak (&lt;15 Tahun)</td>
        <td class="mono">{fmt_r(child)}</td>
        <td>Jiwa</td>
        <td>Kelompok rentan respirasi</td>
      </tr>
      <tr>
        <td>Lansia (&ge;65 Tahun)</td>
        <td class="mono">{fmt_r(elder)}</td>
        <td>Jiwa</td>
        <td>Kelompok risiko kardiopulmoner tinggi</td>
      </tr>
      <tr>
        <td>Luas Footprint Terpapar</td>
        <td class="mono">{fmt_r(area)}</td>
        <td>km&sup2;</td>
        <td>Area kumulatif sel pernah terlewati konsentrasi</td>
      </tr>
    </tbody>
  </table>

  <h2>Saran Tindakan Terverifikasi (D16)</h2>
  <ul style="font-size: 9.5pt; padding-left: 20px;">
    {advice_items}
  </ul>

  <h2>Transparansi Parameter &amp; Asumsi Pemodelan</h2>
  <table>
    <thead>
      <tr>
        <th>Parameter</th>
        <th>Status Bukti</th>
        <th>Sumber Literatur</th>
        <th>Caveat / Keterbatasan</th>
      </tr>
    </thead>
    <tbody>
      {assumptions_rows}
    </tbody>
  </table>

  <div class="footer">
    <div>Dicetak secara otomatis oleh Mesin Simulasi UdaraSiaga (JOINTS UGM 2026).</div>
    <div>Atribusi: Open-Meteo &bull; NASA FIRMS &bull; WorldPop &bull; OpenStreetMap</div>
  </div>
</body>
</html>
"""
    return html
