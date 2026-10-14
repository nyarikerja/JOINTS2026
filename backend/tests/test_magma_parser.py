"""
Parser MAGMA diuji terhadap salinan HTML asli (tests/fixtures), tanpa jaringan.
Bila format situs MAGMA berubah, perbarui fixture lalu jalankan test ini untuk melihat apakah parser masih cocok.
"""

import re
from pathlib import Path

from app.services import magma_status as m

FIX = Path(__file__).parent / "fixtures"


def _html(name: str) -> str:
    return re.sub(r"\s+", " ", (FIX / name).read_text(encoding="utf-8"))


def test_parse_activity_levels():
    levels = m._parse_levels(_html("magma_tingkat_aktivitas.html"))
    assert len(levels) >= 60
    assert all(v["level"] in (1, 2, 3, 4) for v in levels.values())
    assert levels["semeru"]["level"] >= 2
    assert levels["merapi"]["report_url"].startswith("https://magma.esdm.go.id/v1/gunung-api/laporan/")


def test_parse_vona_codes_and_rows():
    codes = m._parse_vona_codes(_html("magma_vona_smr.html"))
    assert codes.get("semeru") == "SMR"
    rows = m._parse_vona_page(_html("magma_vona_smr.html"))
    assert rows, "baris VONA harus terbaca"
    ash = [r for r in rows if r["ash_observed"]]
    assert ash and all(r["ash_top_asl_m"] > 0 for r in ash)


def test_alias_names():
    assert m.norm_name("G. Sindoro") == "sundoro"
    assert m.norm_name("G. Rokatenda (Paluweh)") == "rokatenda"


def test_parse_radius_text():
    html = "<p>Tidak beraktivitas dalam radius 5 Km dari kawah. Sektoral sejauh radius 8 kilometer.</p>"
    res = m._parse_radius(html)
    assert res["radius_km"] == 8.0
