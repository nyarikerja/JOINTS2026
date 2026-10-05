"""
tests/test_lapis3.py

Pengujian endpoint dan fitur pembuktian kepercayaan Lapis 3:
1. Validasi lapangan gunung (/validation/anak_krakatau_2026_09)
2. Validasi kebakaran tanpa stasiun (/validation/live_kalimantan -> not_testable)
3. Batasan sistem dan domain (/limits)
4. Katalog sumber terverifikasi (/sources)
5. Urutan playback demo (/demo/play/{event_id})
6. Ekspor ringkasan satu halaman (/runs/{run_id}/export - JSON dan HTML)
7. Peringatan bahaya lahar hujan (/runs/{run_id}/lahar-warning)
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(scope="module")
def sample_volcano_run():
    payload = {
        "hazard": "volcano",
        "mode": "auto",
        "source": {"event_id": "anak_krakatau_2026_09"},
        "horizon_hours": 6,
        "n_members": 5,
        "seed": 42,
    }
    resp = client.post("/simulate", json=payload)
    assert resp.status_code == 200
    return resp.json()["run_id"]


def test_volcano_validation():
    """
    SPEC.md Bagian 14:
    Validasi gunung terhadap reported_impact.geojson, bandara terpisah,
    dan arah abu terhadap VONA.
    """
    resp = client.get("/validation/anak_krakatau_2026_09")
    assert resp.status_code == 200
    data = resp.json()
    assert data["hazard"] == "volcano"
    assert data["resolution"] == "district"
    assert data["district_hit_rate"] >= 0.5
    assert data["fractions_skill_score"] is not None

    # Dampak penerbangan harus berlabel khusus
    aviation = data.get("aviation_impact", {})
    assert aviation.get("label") == "dampak penerbangan"
    assert "Bandara Radin Inten II" in aviation.get("airport_name")

    # Arah vertikal terhadap D05b VONA
    v_check = data.get("vertical_dispersion_directional_check", {})
    assert "upper_layer_status" in v_check
    assert "mid_layer_status" in v_check

    # Grid search 1D spread_inflation
    gs = data.get("grid_search_spread_inflation", [])
    assert len(gs) >= 3

    # Caveat wajib
    assert "confidence_caveat" in data


def test_fire_validation_not_testable():
    """
    SPEC.md Bagian 14:
    Bila stasiun pembanding tidak ada, kebakaran berstatus not_testable
    tanpa klaim akurasi presisi.
    """
    resp = client.get("/validation/live_kalimantan")
    assert resp.status_code == 200
    data = resp.json()
    assert data["hazard"] == "fire"
    assert data["status"] == "not_testable"
    assert data["accuracy_claim"] == "none"
    assert "reason" in data


def test_limits_endpoint():
    """
    SPEC.md Bagian 11 & 16:
    /limits memuat batas komputasi, batas domain, ambang tier, dan status asumsi.
    """
    resp = client.get("/limits")
    assert resp.status_code == 200
    data = resp.json()

    assert "computational_limits" in data
    assert data["computational_limits"]["max_bbox_degrees"] == "6.0 x 6.0"
    assert data["computational_limits"]["max_horizon_hours"] == 48

    assert "tier_thresholds" in data
    assert data["tier_thresholds"]["minimum"]["threshold"] == 0.90
    assert data["tier_thresholds"]["median"]["threshold"] == 0.50
    assert data["tier_thresholds"]["maximum"]["threshold"] == 0.05

    assert "assumptions_summary" in data
    assert data["assumptions_summary"]["total_assumptions"] > 0
    assert "disclaimer" in data


def test_sources_endpoint():
    """
    SPEC.md Bagian 11:
    /sources menyajikan katalog sumber terbuka terverifikasi.
    """
    resp = client.get("/sources")
    assert resp.status_code == 200
    data = resp.json()
    sources = data.get("verified_sources", [])
    source_ids = [s["id"] for s in sources]
    for expected_id in ["D01", "D03", "D04", "D09", "D18", "D24", "D16"]:
        assert expected_id in source_ids


def test_demo_playback_endpoint():
    """
    SPEC.md Bagian 11:
    /demo/play/{event_id} menyajikan rangkaian playback otomatis.
    """
    resp = client.get("/demo/play/anak_krakatau_2026_09")
    assert resp.status_code == 200
    data = resp.json()
    assert data["event_id"] == "anak_krakatau_2026_09"
    assert len(data["steps"]) >= 5
    assert data["total_duration_hours"] == 48


def test_run_export_json_and_html(sample_volcano_run):
    """
    SPEC.md Bagian 11:
    /runs/{run_id}/export menghasilkan ringkasan JSON dan HTML cetak.
    """
    # 1. Format JSON
    resp_json = client.get(f"/runs/{sample_volcano_run}/export?format=json")
    assert resp_json.status_code == 200
    data = resp_json.json()
    assert data["run_id"] == sample_volcano_run
    assert "impact" in data
    assert "assumptions_used" in data
    assert "disclaimer" in data

    # 2. Format HTML
    resp_html = client.get(f"/runs/{sample_volcano_run}/export?format=html")
    assert resp_html.status_code == 200
    html_text = resp_html.text
    assert "<!DOCTYPE html>" in html_text
    assert "UdaraSiaga" in html_text
    assert "@media print" in html_text
    assert sample_volcano_run in html_text


def test_lahar_warning(sample_volcano_run):
    """
    Fitur opsional Lapis 3:
    Peringatan potensi lahar hujan sekunder.
    """
    resp = client.get(f"/runs/{sample_volcano_run}/lahar-warning")
    assert resp.status_code == 200
    data = resp.json()
    assert data["hazard"] == "volcano"
    assert data["lahar_risk_level"] in ["waspada", "siaga", "rendah"]
    assert "rainfall_threshold_trigger_mm_h" in data
    assert len(data.get("vulnerable_drainage_basins", [])) > 0
