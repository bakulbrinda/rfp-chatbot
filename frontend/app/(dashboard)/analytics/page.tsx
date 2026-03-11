"use client";
import { MessageSquare, CheckCircle2, Zap, Database, Download, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/analytics/StatCard";
import { QueryVolumeChart } from "@/components/analytics/QueryVolumeChart";
import { ConfidenceDistChart } from "@/components/analytics/ConfidenceDistChart";
import { GapTable } from "@/components/analytics/GapTable";
import {
  useAnalyticsSummary,
  useAnalyticsVolume,
  useAnalyticsConfidence,
  useAnalyticsGaps,
  useAnalyticsTopQueries,
} from "@/hooks/useAnalytics";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/constants";

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/chat");
  }, [user, router]);

  const summary = useAnalyticsSummary();
  const volume = useAnalyticsVolume();
  const confidence = useAnalyticsConfidence();
  const gaps = useAnalyticsGaps();
  const topQueries = useAnalyticsTopQueries();

  const isLoading = summary.isLoading;
  const s = summary.data;

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.analytics });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#2D1252]">Analytics Dashboard</h1>
            <p className="text-xs text-gray-500 mt-0.5">Query intelligence across all modules · Admin only</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/analytics/export"
              download
              className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Queries"
            value={s?.total_queries.toLocaleString() ?? "—"}
            icon={MessageSquare}
            trend={pctChange(s?.total_queries_last_week ?? 0, s?.total_queries_prev_week ?? 0)}
            trendLabel="vs last week"
            isLoading={isLoading}
          />
          <StatCard
            label="Answer Rate"
            value={s ? `${s.answer_rate}%` : "—"}
            icon={CheckCircle2}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            trend={s ? s.answer_rate_last_week - s.answer_rate : null}
            trendLabel="pp vs last week"
            isLoading={isLoading}
          />
          <StatCard
            label="Avg. Confidence"
            value={s ? `${s.avg_confidence_pct}%` : "—"}
            icon={Zap}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            isLoading={isLoading}
          />
          <StatCard
            label="Documents in KB"
            value={s ? `${s.documents_indexed} / ${s.documents_total}` : "—"}
            icon={Database}
            iconBg="bg-[#2D1252]/10"
            iconColor="text-[#2D1252]"
            trendLabel="indexed"
            isLoading={isLoading}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#2D1252]">Query Volume</h2>
              <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">Last 30 days</span>
            </div>
            <QueryVolumeChart data={volume.data ?? []} isLoading={volume.isLoading} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#2D1252]">Confidence Distribution</h2>
              <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">All time</span>
            </div>
            <ConfidenceDistChart data={confidence.data ?? []} isLoading={confidence.isLoading} />
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-[#2D1252]">Knowledge Base Gaps</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">Unanswered queries — add docs to close these gaps</p>
            </div>
            <GapTable data={gaps.data ?? []} isLoading={gaps.isLoading} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-[#2D1252]">Top Queries</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">Most frequently asked questions</p>
            </div>
            {topQueries.isLoading ? (
              <div className="space-y-2 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-100 rounded-full w-8" />
                  </div>
                ))}
              </div>
            ) : !topQueries.data || topQueries.data.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-gray-400">No queries logged yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {topQueries.data.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
                      <span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}</span>
                      <p className="text-sm text-gray-700 truncate">{item.query}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F05A28]/10 text-[#F05A28] flex-shrink-0">
                      ×{item.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
