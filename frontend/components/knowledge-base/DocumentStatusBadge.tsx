import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/types";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const CONFIG: Record<DocumentStatus, { label: string; classes: string; icon: React.ElementType }> = {
  processing: {
    label: "Processing",
    classes: "bg-blue-50 text-blue-600 border-blue-200",
    icon: Loader2,
  },
  indexed: {
    label: "Indexed",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    classes: "bg-red-50 text-red-600 border-red-200",
    icon: XCircle,
  },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
      cfg.classes
    )}>
      <Icon className={cn("w-3 h-3 flex-shrink-0", status === "processing" && "animate-spin")} />
      {cfg.label}
    </span>
  );
}
