import { api } from "./client";
import { API_ROUTES } from "@/lib/constants";
import type { AnalyticsSummary, VolumeDataPoint, ConfidenceDataPoint, QueryEntry } from "@/types";

export const analyticsApi = {
  summary: () =>
    api.get<AnalyticsSummary>(API_ROUTES.ANALYTICS.SUMMARY).then((r) => r.data),
  volume: () =>
    api.get<VolumeDataPoint[]>(API_ROUTES.ANALYTICS.VOLUME).then((r) => r.data),
  confidence: () =>
    api.get<ConfidenceDataPoint[]>("/api/analytics/confidence").then((r) => r.data),
  topQueries: () =>
    api.get<QueryEntry[]>("/api/analytics/top-queries").then((r) => r.data),
  gaps: () =>
    api.get<QueryEntry[]>(API_ROUTES.ANALYTICS.GAPS).then((r) => r.data),
  exportUrl: () => "/api/analytics/export",
};
