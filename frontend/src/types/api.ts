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
  [key: string]: any;
}

export interface SimulationPayload {
  hazard: HazardType;
  mode: ModelingMode;
  source: {
    event_id: string;
    latitude?: number;
    longitude?: number;
    name?: string;
  };
  horizon_hours: number;
  n_members: number;
  seed: number;
  thresholds: {
    min: number;
    mid: number;
    max: number;
  };
  overrides?: Record<string, any> | null;
}

export interface SimulationResponse {
  run_id: string;
  hazard: HazardType;
  status: string;
  n_members: number;
  scenario_label: string;
  hourly_tiers?: Record<string, any>;
  center_coords?: { latitude: number; longitude: number };
  hotspots?: any[];
}

export interface ImpactRange {
  min: number;
  median: number;
  max: number;
}

export interface ImpactResponse {
  run_id: string;
  scenario_label?: string;
  disclaimer?: string;
  population_exposed: ImpactRange;
  children_exposed: ImpactRange;
  elderly_exposed: ImpactRange;
  area_exposed_km2: ImpactRange;
  schools_exposed: ImpactRange;
  healthcare_exposed: ImpactRange;
  airports_exposed?: ImpactRange;
  cropland_exposed_ha?: ImpactRange;
  water_sources_exposed_count?: ImpactRange;
  rain_pop_reduced?: ImpactRange;
  rain_area_reduced?: ImpactRange;
  ispu?: {
    available?: boolean;
    reason?: string;
    category?: string;
    relative_risk_index?: ImpactRange;
  };
  hourly_series?: Record<string, {
    population_exposed: ImpactRange;
    children_exposed: ImpactRange;
    elderly_exposed: ImpactRange;
    area_exposed_km2: ImpactRange;
    schools_exposed: ImpactRange;
    healthcare_exposed: ImpactRange;
    cropland_exposed_ha?: ImpactRange;
    water_sources_exposed_count?: ImpactRange;
    rain_pop_reduced?: ImpactRange;
    rain_area_reduced?: ImpactRange;
  }>;
}

export interface SchoolItem {
  id?: string;
  facility_id?: string;
  name: string;
  district?: string;
  province?: string;
  lat?: number;
  latitude?: number;
  lng?: number;
  longitude?: number;
  exposure_prob_pct?: number;
  exposure_pct?: number;
  exposure_probability?: number;
  eta_hours?: number;
  arrival_time_earliest_h?: number | null;
  arrival_time_most_likely_h?: number | null;
  action_code?: string;
  recommendation?: string;
  action_detail?: string;
  nearest_hospital?: {
    name: string;
    distance_km: number;
    lat?: number;
    latitude?: number;
    lng?: number;
    longitude?: number;
  };
  nearest_safe_hospital?: {
    name: string;
    distance_km: number;
    lat?: number;
    latitude?: number;
    lng?: number;
    longitude?: number;
    district?: string;
  };
}

export interface HospitalItem {
  id?: string;
  facility_id?: string;
  name: string;
  district?: string;
  province?: string;
  lat?: number;
  latitude?: number;
  lng?: number;
  longitude?: number;
  exposure_prob_pct?: number;
  exposure_pct?: number;
  exposure_probability?: number;
  distance_from_source_km?: number;
  distance_from_epicenter_km?: number;
  is_safe?: boolean;
  evacuation_status?: string;
  status_badge?: string;
  badge_color?: string;
  evac_recommendation?: string;
  emergency_hotline?: string;
  capabilities?: string[];
  arrival_time_earliest_h?: number | null;
}

export interface FacilitiesImpactResponse {
  summary?: any;
  total_schools_at_risk?: number;
  total_healthcare_at_risk?: number;
  schools: SchoolItem[];
  hospitals?: HospitalItem[];
  healthcare?: HospitalItem[];
  evacuation_referral_hospitals?: HospitalItem[];
  airports?: any[];
}

export interface ValidationResponse {
  event_id?: string;
  hazard?: string;
  resolution?: string;
  validation_note?: string;
  status?: string;
  not_testable_reason?: string;
  members_source?: string;
  reported_districts_evaluated?: string[];
  district_hit_rate?: number;
  hit_rate_pct?: number;
  fractions_skill_score?: number;
  fss_score?: number;
  aviation_impact?: {
    airport_name?: string;
    label?: string;
    reported_event?: string;
    airspace_exposure_probability?: number;
    dispersion_altitude_fl?: string;
    consistency?: string;
    caveat?: string;
  };
  confidence_caveat?: string;
  grid_search_spread_inflation?: Array<{
    inflation_factor: number;
    fss: number;
    district_overlap_pct: number;
  }>;
  reference_observation?: string;
  timestamp?: string;
}

export interface LaharWarningResponse {
  run_id: string;
  hazard: string;
  available?: boolean;
  reason?: string;
  lahar_risk_level: string;
  prob_rain_above_trigger?: number;
  forecast_precip_max_mm_h?: ImpactRange;
  forecast_precip_total_mm?: ImpactRange;
  rainfall_threshold_trigger_mm_h?: number;
  warning_text?: string;
  source?: string;
  weather_model?: string;
}

export interface RainEffectResponse {
  run_id: string;
  hazard: string;
  available?: boolean;
  reason?: string;
  scavenged_mass_pct?: ImpactRange;
  precip_max_mm_h?: ImpactRange | null;
  precip_total_mm?: ImpactRange | null;
  weather_model?: string;
  hazard_specific_warning?: string;
}


