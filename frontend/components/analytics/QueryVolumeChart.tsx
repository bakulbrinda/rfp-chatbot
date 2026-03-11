"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { VolumeDataPoint } from "@/types";

interface Props {
  data: VolumeDataPoint[];
  isLoading?: boolean;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function QueryVolumeChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="w-full h-full bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center">
        <p className="text-xs text-gray-400">No query volume data yet</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, date: formatDate(d.date) }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          labelStyle={{ fontWeight: 600, color: "#2D1252" }}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#F05A28"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#F05A28" }}
          name="Queries"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
