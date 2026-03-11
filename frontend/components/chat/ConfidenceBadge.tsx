import { cn } from "@/lib/utils";
import type { Confidence } from "@/types";

const CONFIG: Record<Confidence, { label: string; classes: string; dot: string }> = {
  high: {
    label: "High confidence",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  medium: {
    label: "Medium confidence",
    classes: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-400",
  },
  low: {
    label: "Low confidence",
    classes: "bg-red-50 text-red-600 border-red-200",
    dot: "bg-red-400",
  },
  not_found: {
    label: "Not in knowledge base",
    classes: "bg-gray-50 text-gray-500 border-gray-200",
    dot: "bg-gray-400",
  },
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const cfg = CONFIG[confidence];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border", cfg.classes)}>
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
