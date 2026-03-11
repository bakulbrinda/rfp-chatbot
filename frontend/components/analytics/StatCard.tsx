"use client";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  trend?: number | null;
  trendLabel?: string;
  isLoading?: boolean;
}

export function StatCard({ label, value, icon: Icon, iconBg, iconColor, trend, trendLabel, isLoading }: StatCardProps) {
  const trendPositive = trend !== null && trend !== undefined && trend > 0;
  const trendNegative = trend !== null && trend !== undefined && trend < 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg ?? "bg-[#F05A28]/10")}>
          <Icon className={cn("w-5 h-5", iconColor ?? "text-[#F05A28]")} />
        </div>
        {trend !== null && trend !== undefined && !isLoading && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
            trendPositive ? "bg-emerald-50 text-emerald-700" :
            trendNegative ? "bg-red-50 text-red-600" :
            "bg-gray-100 text-gray-500"
          )}>
            {trendPositive ? <TrendingUp className="w-3 h-3" /> : trendNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-7 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-3/4" />
        </div>
      ) : (
        <div>
          <p className="text-2xl font-bold text-[#2D1252]">{value}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {label}
            {trendLabel && <span className="text-gray-400"> · {trendLabel}</span>}
          </p>
        </div>
      )}
    </div>
  );
}
