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
    total_active_monitored: number;
    level_4_awas: number;
    level_3_siaga: number;
    level_2_waspada: number;
    level_1_normal: number;
    source?: string;
    fetched_at?: string | null;
    stale?: boolean;
  };
  wildfire_hotspots?: {
    active_24h_firms: number;
    high_confidence_pct?: number;
    clusters_24h?: number;
    source: string;
    fetched_at?: string | null;
    latest_detection_utc?: string | null;
    stale?: boolean;
  };
  generated_at_utc?: string;
}

export interface LiveSyncResponse {
  status: "synchronized" | "partial" | "failed" | string;
  timestamp_utc: string;
  sources: Record<string, { latency_ms?: number; error?: string | null; fetched_at?: string | null; [k: string]: any }>;
  kpi?: SummaryKpiResponse;
  latency_ms?: number;
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

export interface RunSourceInfo {
  type: "vona" | "firms" | "firms_modified" | "scenario" | string;
  label: string;
  issued_utc?: string;
  ash_top_asl_m?: number;
  url?: string;
  [k: string]: any;
}

export interface RunWeatherSummary {
  model?: string;
  level?: string;
  fetched_at?: string;
  valid_from?: string;
  stale?: boolean;
  precip_max_mm_h?: ImpactRange | null;
  precip_total_mm?: ImpactRange | null;
}

export interface SimulationResponse {
  run_id: string;
  hazard: HazardType;
  mode?: ModelingMode;
  status: string;
  event_id?: string;
  event_name?: string;
  n_members: number;
  members_source?: string;
  scenario_label: string;
  start_utc?: string;
  horizon_hours?: number;
  center_coords?: { latitude: number; longitude: number };
  source_info?: RunSourceInfo;
  weather?: RunWeatherSummary;
  hotspots_used?: { count: number; n_overpasses?: number; mean_instantaneous_frp_mw?: number; window_h?: number };
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
  };
  population_source?: string;
  facilities_coverage?: { source: string; complete: boolean; missing_tiles: number[][]; note: string };
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
  total_airports_at_risk?: number;
  total_evacuation_hospitals?: number;
  list_truncated?: boolean;
  facilities_coverage?: { source: string; complete: boolean; missing_tiles: number[][]; note: string };
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

export interface CarbonEmissionsResponse {
  run_id: string;
  hazard?: string;
  caveat?: string;
  duration_hours?: number;
  peat_fraction_assumed?: number;
  n_hotspots?: number;
  n_overpasses?: number;
  mean_instantaneous_frp_mw?: number;
  total_co2e_tonnes: ImpactRange;
  peat_emissions_tonnes: ImpactRange;
  non_peat_emissions_tonnes: ImpactRange;
  source?: string;
  disclaimer?: string;
}

export interface HotspotClusterItem {
  cluster_id: number;
  rank: number;
  center_lat: number;
  center_lon: number;
  hotspot_count: number;
  total_frp_mw: number;
  peat_fraction: number;
  exposure_contribution_score: number;
}

export interface HotspotRankingResponse {
  run_id: string;
  hazard: string;
  ranked_clusters: HotspotClusterItem[];
  disclaimer?: string;
}

export interface ExtinguishResponse {
  original_run_id: string;
  extinguished_clusters: number[];
  population_reduced: ImpactRange;
  carbon_reduced_co2e_tonnes: ImpactRange;
  reduction_percentage: number;
  disclaimer?: string;
}

export interface LandWaterResponse {
  run_id: string;
  hazard: string;
  available?: boolean;
  reason?: string;
  cropland_exposed_ha?: ImpactRange;
  water_sources_exposed_count?: ImpactRange;
  ash_wetness_warning?: string;
  source?: string;
  scenario_label?: string;
  disclaimer?: string;
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
  scenario_label?: string;
  disclaimer?: string;
}

export interface FacilityDecisionCardResponse {
  facility_id: string;
  name: string;
  facility_type: "school" | "hospital" | "airport" | string;
  district: string;
  province?: string;
  latitude: number;
  longitude: number;
  exposure_probability: number;
  arrival_time_earliest_h: number | null;
  arrival_time_most_likely_h: number | null;
  nearest_safe_hospital?: {
    name: string;
    distance_km: number;
    latitude?: number;
    longitude?: number;
    district?: string;
  };
  recommendation?: string;
  reason?: string;
}

export interface LaharWarningResponse {
  run_id: string;
  hazard: string;
  available?: boolean;
  reason?: string;
  lahar_risk_level: string;
  prob_rain_above_trigger?: number;
  forecast_precip_max_mm_h?: ImpactRange;
  rainfall_threshold_trigger_mm_h?: number;
  critical_ash_thickness_mm?: number;
  vulnerable_drainage_basins?: Array<{
    river_name: string;
    risk: string;
  }>;
  warning_text?: string;
  message?: string;
  source?: string;
}

export interface SensitivityCurvePoint {
  multiplier: number;
  value: number;
  population_exposed_median: number;
}

export interface SensitivityResponse {
  run_id: string;
  parameter: string;
  sensitivity_curve: SensitivityCurvePoint[];
}

export interface AssumptionItem {
  name: string;
  parameter?: string;
  status: string;
  source?: string | null;
  caveat?: string | null;
  value?: any;
}

export interface LimitsResponse {
  computational_limits: {
    max_bbox_degrees: string;
    max_horizon_hours: number;
    max_ensemble_members: number;
    max_concurrent_runs: number;
    firms_rate_limit_per_10min: number;
    firms_max_query_span_days: number;
  };
  physical_domain_bounds: {
    latitude_bounds: [number, number];
    longitude_bounds: [number, number];
    vertical_levels_hpa: number[];
    particle_capacity: number;
    advection_integrator: string;
  };
  tier_thresholds: {
    minimum: { threshold: number; label: string };
    median: { threshold: number; label: string };
    maximum: { threshold: number; label: string };
  };
  assumptions_summary: {
    total_assumptions: number;
    by_status: Record<string, number>;
    all_assumptions: AssumptionItem[];
  };
  disclaimer?: string;
}

export interface AttributionItem {
  source: string;
  data: string;
  license: string;
  url: string;
}

export interface AttributionsResponse {
  project: string;
  description: string;
  attributions: AttributionItem[];
}

export interface VerifiedSourceItem {
  id: string;
  name: string;
  type?: string;
  url?: string;
  license: string;
  status: string;
  verified_on?: string;
}

export interface SourcesResponse {
  title: string;
  verified_sources: VerifiedSourceItem[];
  markdown_documentation?: string;
}

