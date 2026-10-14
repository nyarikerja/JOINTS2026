"""
app/impact/volcano_features.py

Dampak lahan pertanian dan sumber air (D17, D20).
Data tutupan lahan (ESA WorldCover) dan jaringan sungai belum terintegrasi ke backend,
sehingga endpoint menjawab available: false (Prinsip 4: tanpa angka karangan).
"""

from typing import Any, Dict

from app.engine.grid import SimulationGrid


def calculate_land_water_impact(run_output: Dict[str, Any], grid: SimulationGrid) -> Dict[str, Any]:
    return {
        "run_id": run_output["run_id"],
        "hazard": run_output.get("hazard", "volcano"),
        "available": False,
        "reason": (
            "Luas sawah/kebun dan jumlah sumber air terdampak belum dihitung: data tutupan lahan "
            "ESA WorldCover dan jaringan sungai OSM belum terintegrasi."
        ),
        "ash_wetness_warning": (
            "Abu basah jauh lebih berat di atap bangunan dan endapan abu di lereng dapat terbawa hujan menjadi lahar."
        ),
        "scenario_label": run_output["scenario_label"],
        "disclaimer": run_output["disclaimer"],
    }
