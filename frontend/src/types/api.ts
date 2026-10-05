/**
 * types/api.ts - Definisi Tipe Data REST API Backend UdaraSiaga
 */

export type HazardType = "volcano" | "fire";
export type ModelingMode = "auto" | "experiment";

export interface HealthResponse {
  status: string;
  project: string;
  version: string;
  disclaimer: string;
}

export interface SummaryKpiResponse {
  volcanoes?: {
    total_monitored: number;
    level_4_awas: number;
    level_3_siaga: number;
    level_2_waspada: number;
    level_1_normal: number;
  };
  wildfire_hotspots?: {
    active_24h_firms: number;
    source: string;
  };
}

export interface LiveSyncResponse {
  status: string;
  sources: Record<string, string>;
  latency_ms: number;
  timestamp: string;
}

export interface SimulationOverrides {
  column_height_km?: number;
  frp_scale?: number;
  wind_reverse_troposphere?: boolean;
  rain_scavenging_mm_h?: number;
}

export interface SimulationPayload {
  hazard: HazardType;
  mode: ModelingMode;
  source: {
    event_id: string;
  };
  horizon_hours: number;
  n_members: number;
  seed: number;
  thresholds: {
    min: number;
    mid: number;
    max: number;
  };
  overrides?: SimulationOverrides | null;
}

export interface SimulationResponse {
  run_id: string;
  hazard: HazardType;
  status: string;
  n_members: number;
  scenario_label: string;
  hourly_tiers?: Record<string, any>;
}

export interface ImpactRange {
  min: number;
  median: number;
  max: number;
}

export interface ImpactResponse {
  run_id: string;
  population_exposed: ImpactRange;
  children_exposed: ImpactRange;
  elderly_exposed: ImpactRange;
  area_exposed_km2: ImpactRange;
  schools_exposed: ImpactRange;
  healthcare_exposed: ImpactRange;
  agricultural_impact_ha?: number;
  water_sources_count?: number;
}

export interface SchoolItem {
  id: string;
  name: string;
  district?: string;
  province?: string;
  lat: number;
  lng: number;
  exposure_prob_pct: number;
  eta_hours: number;
  nearest_hospital?: {
    name: string;
    distance_km: number;
    lat?: number;
    lng?: number;
  };
}

export interface HospitalItem {
  id: string;
  name: string;
  district?: string;
  province?: string;
  lat: number;
  lng: number;
  exposure_prob_pct: number;
  distance_from_source_km?: number;
}

export interface FacilitiesImpactResponse {
  total_schools_at_risk: number;
  total_healthcare_at_risk: number;
  schools: SchoolItem[];
  healthcare: HospitalItem[];
}

export interface ValidationResponse {
  fss_score: number;
  hit_rate_pct: number;
  reference_observation: string;
  timestamp: string;
}
