"use client";
import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/types";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

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

function useElapsed(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

export function DocumentStatusBadge({
  status,
  uploadedAt,
}: {
  status: DocumentStatus;
  uploadedAt?: string;
}) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;

  // Compute elapsed from uploadedAt (server time) so it survives re-renders
  const elapsed = useElapsed(status === "processing");
  const serverElapsed = uploadedAt
    ? Math.floor((Date.now() - new Date(uploadedAt).getTime()) / 1000)
    : elapsed;
  const displaySeconds = status === "processing" ? Math.max(elapsed, serverElapsed) : 0;

  const label =
    status === "processing"
      ? `Processing${displaySeconds > 0 ? ` · ${displaySeconds}s` : "…"}`
      : cfg.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
        cfg.classes
      )}
    >
      <Icon className={cn("w-3 h-3 flex-shrink-0", status === "processing" && "animate-spin")} />
      {label}
    </span>
  );
}
