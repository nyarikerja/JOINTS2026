/**
 * services/api.ts - Klien REST API UdaraSiaga Terenkapsulasi & Type-Safe
 */

import { CONFIG } from "../config/constants";
import { trackBootRequest } from "../utils/bootProgress";
import type {
  HealthResponse,
  SummaryKpiResponse,
  LiveSyncResponse,
  SimulationPayload,
  SimulationResponse,
  ImpactResponse,
  FacilitiesImpactResponse,
  ValidationResponse,
  CarbonEmissionsResponse,
  HotspotRankingResponse,
  ExtinguishResponse,
  LaharWarningResponse,
  SensitivityResponse,
  LimitsResponse,
  SourcesResponse,
  AttributionsResponse,
  LandWaterResponse,
  RainEffectResponse
} from "../types/api";

function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return trackBootRequest(requestRaw<T>(endpoint, options));
}

async function requestRaw<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${CONFIG.API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      ...options
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || `HTTP ${res.status}: Gagal memproses permintaan`);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  getHealth: () => request<HealthResponse>("/health"),
  getSummaryKpi: () => request<SummaryKpiResponse>("/layers/summary-kpi"),
  syncLive: () => request<LiveSyncResponse>("/layers/sync-live", { method: "POST" }),

  getCoastline: () => request<any>("/layers/coastline"),
  getNationalVolcanoes: () => request<any>("/layers/volcanoes-national"),
  getNationalForests: () => request<any>("/layers/forests"),
  getForestBoundaries: () => request<any>("/layers/forest-boundaries"),
  getHotspots: (eventId = "national", bbox?: string) =>
    request<any>(`/layers/hotspots?event_id=${eventId}${bbox ? `&bbox=${bbox}` : ""}`),
  getWind: (level: "10m" | "850hPa" = "10m", hours = 72) => request<any>(`/layers/wind?level=${level}&hours=${hours}`),
  getSmokePaths: (hours = 72) => request<any>(`/layers/smoke-paths?hours=${hours}`),
  getHeatmap: (days = 7) => request<any>(`/layers/heatmap?days=${days}`),
  getFacilities: (query?: { bbox?: string; zoom?: number; facilityType?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.bbox) params.set("bbox", query.bbox);
    if (query?.zoom !== undefined) params.set("zoom", String(query.zoom));
    if (query?.facilityType) params.set("facility_type", query.facilityType);
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();
    return request<any>(`/layers/facilities${qs ? `?${qs}` : ""}`);
  },

  runSimulation: (payload: SimulationPayload) =>
    request<SimulationResponse>("/simulate", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  getRun: (runId: string) => request<SimulationResponse>(`/runs/${runId}`),
  getImpact: (runId: string) => request<ImpactResponse>(`/runs/${runId}/impact`),
  getFacilitiesImpacted: (runId: string) => request<FacilitiesImpactResponse>(`/runs/${runId}/facilities-impacted`),
  getFacilityDecisionCard: (runId: string, facilityId: string) => request<any>(`/runs/${runId}/location/${facilityId}`),
  getValidation: (eventId: string) => request<ValidationResponse>(`/validation/${eventId}`),
  getTiersAtHour: (runId: string, hour: number) => request<any>(`/runs/${runId}/tiers?t=${hour}`),
  getAllTiers: (runId: string) => request<Record<string | number, any>>(`/runs/${runId}/tiers`),
  getHealthGuidance: (runId: string) => request<any>(`/runs/${runId}/health-guidance`),
  getEmergencyAdvisory: (runId: string) => request<any>(`/runs/${runId}/emergency-advisory`),
  getEvacuationRoute: (runId: string, fromLat: number, fromLon: number, toLat: number, toLon: number, fromName: string, toName: string) => 
    request<any>(`/runs/${runId}/evacuation-route?from_lat=${fromLat}&from_lon=${fromLon}&to_lat=${toLat}&to_lon=${toLon}&from_name=${encodeURIComponent(fromName)}&to_name=${encodeURIComponent(toName)}`),
  getEvents: () => request<any>("/events"),
  getEventDetail: (eventId: string) => request<any>(`/events/${eventId}`),
  playDemo: (eventId: string) => request<any>(`/demo/play/${eventId}`),

  // Fitur Lapis 2 & Lapis 3 Tambahan
  getCarbonEmissions: (runId: string) => request<CarbonEmissionsResponse>(`/runs/${runId}/carbon`),
  getHotspotRanking: (runId: string) => request<HotspotRankingResponse>(`/runs/${runId}/ranking`),
  extinguishHotspots: (runId: string, clusterIds: number[]) => 
    request<ExtinguishResponse>("/fire/extinguish", {
      method: "POST",
      body: JSON.stringify({ run_id: runId, extinguish_cluster_ids: clusterIds })
    }),
  getLaharWarning: (runId: string) => request<LaharWarningResponse>(`/runs/${runId}/lahar-warning`),
  getSensitivity: (runId: string, parameterName = "column_height_km") =>
    request<SensitivityResponse>("/runs/sensitivity", {
      method: "POST",
      body: JSON.stringify({ run_id: runId, parameter_name: parameterName })
    }),
  getLimits: () => request<LimitsResponse>("/limits"),
  getSources: () => request<SourcesResponse>("/sources"),
  getAttributions: () => request<AttributionsResponse>("/attributions"),
  getLandWater: (runId: string) => request<LandWaterResponse>(`/runs/${runId}/land-water`),
  getRainEffect: (runId: string) => request<RainEffectResponse>(`/runs/${runId}/rain-effect`),
  getAdvice: (runId: string) => request<any>(`/runs/${runId}/advice`),
  getNearbyAdvice: (lat: number, lon: number, lang = "id") => request<any>(`/advice/nearby?lat=${lat}&lon=${lon}&lang=${lang}`),
  getBrief: (body: any) => request<any>("/api/v1/brief", { method: "POST", body: JSON.stringify(body) }),
  getWindAtHour: (runId: string, hour: number) => request<any>(`/runs/${runId}/wind?t=${hour}`),
  getSeverity: (runId: string, hour = 12) => request<any>(`/runs/${runId}/severity?t=${hour}`),
  getArrival: (runId: string) => request<any>(`/runs/${runId}/arrival`),
  getRunAirQuality: (runId: string) => request<any>(`/runs/${runId}/air-quality`),
  compareRuns: (runA: string, runB: string) =>
    request<any>("/runs/compare", { method: "POST", body: JSON.stringify({ run_id_a: runA, run_id_b: runB }) })
};

