"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { ConfidenceDataPoint } from "@/types";

const COLORS: Record<string, string> = {
  high: "#10b981",
  medium: "#f59e0b",
  low: "#f87171",
  not_found: "#9ca3af",
};

const LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  not_found: "Not Found",
};

interface Props {
  data: ConfidenceDataPoint[];
  isLoading?: boolean;
}

export function ConfidenceDistChart({ data, isLoading }: Props) {
  if (isLoading) {
    return <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center">
        <p className="text-xs text-gray-400">No confidence data yet</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: LABELS[d.confidence] ?? d.confidence,
    count: d.count,
    key: d.confidence,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          cursor={{ fill: "#f9fafb" }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Queries">
          {chartData.map((entry, i) => (
            <Cell key={i} fill={COLORS[entry.key] ?? "#9ca3af"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
