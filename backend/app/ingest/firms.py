"""
app/ingest/firms.py

Modul ingest untuk titik api dan FRP dari NASA FIRMS (D09).
Mendukung pemuatan CSV lokal dan penyesuaian (tambah/hapus) di mode experiment.
"""

from typing import Any, Dict, List

import pandas as pd

from app.core.config import EVENTS_DIR


class FirmsIngest:
    @staticmethod
    def load_event_hotspots(event_id: str, overrides: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
        csv_path = EVENTS_DIR / event_id / "hotspots.csv"
        if not csv_path.exists() or csv_path.stat().st_size == 0:
            return []

        df = pd.read_csv(csv_path)
        # Standarisasi kolom
        records = []
        for idx, row in df.iterrows():
            rec = {
                "id": f"hotspot_{idx}",
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "frp": float(row.get("frp", 25.0)),
                "confidence": str(row.get("confidence", "nominal")),
                "acq_date": str(row.get("acq_date", "")),
                "acq_time": str(row.get("acq_time", "")),
                "is_active": True,
            }
            records.append(rec)

        # Proses overrides (tambah / padamkan titik api)
        if overrides and "hotspots" in overrides and overrides["hotspots"]:
            h_ovr = overrides["hotspots"]
            remove_ids = set(h_ovr.get("remove", []))
            if remove_ids:
                records = [r for r in records if r["id"] not in remove_ids]

            for new_pt in h_ovr.get("add", []):
                records.append({
                    "id": f"added_{len(records)}",
                    "latitude": float(new_pt["latitude"]),
                    "longitude": float(new_pt["longitude"]),
                    "frp": float(new_pt.get("frp", 30.0)),
                    "confidence": "high",
                    "acq_date": "experiment",
                    "acq_time": "0000",
                    "is_active": True,
                })

        return records
