/**
 * types/geo.ts - Definisi Tipe Data Spasial & GeoJSON
 */

export interface VolcanoProperties {
  id: string;
  name: string;
  level: number;
  level_name: string;
  color: string;
  province: string;
  elevation_m: number;
  radius_bahaya_km: number;
  last_vona?: string;
  event_id?: string;
}

export interface HotspotProperties {
  frp: number;
  confidence?: string;
  satellite?: string;
  acq_date?: string;
}

export interface FacilityProperties {
  id: string;
  name: string;
  type: "school" | "healthcare" | "hospital" | "airport";
  district?: string;
  province?: string;
}

export interface PlumeTierProperties {
  tier: "p90" | "p50" | "p05" | "min" | "mid" | "max";
  hazard: string;
  hour: number;
}
