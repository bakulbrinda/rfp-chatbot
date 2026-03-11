"use client";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";
import { QUERY_KEYS } from "@/lib/constants";

const STALE = 5 * 60 * 1000; // 5 minutes

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: [...QUERY_KEYS.analytics, "summary"],
    queryFn: analyticsApi.summary,
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

export function useAnalyticsVolume() {
  return useQuery({
    queryKey: [...QUERY_KEYS.analytics, "volume"],
    queryFn: analyticsApi.volume,
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

export function useAnalyticsConfidence() {
  return useQuery({
    queryKey: [...QUERY_KEYS.analytics, "confidence"],
    queryFn: analyticsApi.confidence,
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

export function useAnalyticsGaps() {
  return useQuery({
    queryKey: [...QUERY_KEYS.analytics, "gaps"],
    queryFn: analyticsApi.gaps,
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

export function useAnalyticsTopQueries() {
  return useQuery({
    queryKey: [...QUERY_KEYS.analytics, "top-queries"],
    queryFn: analyticsApi.topQueries,
    staleTime: STALE,
    refetchInterval: STALE,
  });
}
