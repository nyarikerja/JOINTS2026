/**
 * services/api.ts - Klien REST API UdaraSiaga Terenkapsulasi & Type-Safe
 */

import { CONFIG } from "../config/constants";
import type {
  HealthResponse,
  SummaryKpiResponse,
  LiveSyncResponse,
  SimulationPayload,
  SimulationResponse,
  ImpactResponse,
  FacilitiesImpactResponse,
  ValidationResponse
} from "../types/api";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
  getHotspots: (eventId = "live_kalimantan") => request<any>(`/layers/hotspots?event_id=${eventId}`),
  getFacilities: () => request<any>("/layers/facilities"),

  runSimulation: (payload: SimulationPayload) =>
    request<SimulationResponse>("/simulate", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  getImpact: (runId: string) => request<ImpactResponse>(`/runs/${runId}/impact`),
  getFacilitiesImpacted: (runId: string) => request<FacilitiesImpactResponse>(`/runs/${runId}/facilities-impacted`),
  getValidation: (eventId: string) => request<ValidationResponse>(`/validation/${eventId}`),
  getTiersAtHour: (runId: string, hour: number) => request<any>(`/runs/${runId}/tiers?t=${hour}`),
  getHealthGuidance: (runId: string) => request<any>(`/runs/${runId}/health-guidance`),
  getEmergencyAdvisory: (runId: string) => request<any>(`/runs/${runId}/emergency-advisory`),
  getEvacuationRoute: (runId: string, fromLat: number, fromLon: number, toLat: number, toLon: number, fromName: string, toName: string) => 
    request<any>(`/runs/${runId}/evacuation-route?from_lat=${fromLat}&from_lon=${fromLon}&to_lat=${toLat}&to_lon=${toLon}&from_name=${encodeURIComponent(fromName)}&to_name=${encodeURIComponent(toName)}`),
  getEvents: () => request<any>("/events"),
  getNationalForests: () => request<any>("/layers/forests"),
  playDemo: (eventId: string) => request<any>(`/demo/play/${eventId}`)
};
