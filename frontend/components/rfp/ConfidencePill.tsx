"use client";
import { cn } from "@/lib/utils";

const CONFIG = {
  high: { label: "High confidence", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700" },
  medium: { label: "Medium confidence", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-700" },
  low: { label: "Low confidence", dot: "bg-red-400", pill: "bg-red-50 text-red-700" },
  not_found: { label: "Not in KB", dot: "bg-gray-400", pill: "bg-gray-100 text-gray-500" },
} as const;

type ConfidenceLevel = keyof typeof CONFIG;

export function ConfidencePill({ level }: { level: ConfidenceLevel }) {
  const cfg = CONFIG[level] ?? CONFIG.not_found;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full", cfg.pill)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
