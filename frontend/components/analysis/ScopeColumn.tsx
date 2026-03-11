"use client";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Clock, ExternalLink, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScopeItem } from "@/types";

interface ScopeColumnProps {
  title: string;
  items: ScopeItem[];
  type: "in" | "out" | "future";
  isLoading?: boolean;
}

const TYPE_CONFIG = {
  in: {
    icon: CheckCircle2,
    headerClass: "bg-emerald-50 border-emerald-200",
    titleClass: "text-emerald-800",
    iconClass: "text-emerald-500",
    itemClass: "border-emerald-100 bg-white hover:border-emerald-200",
    dotClass: "bg-emerald-400",
    countClass: "bg-emerald-100 text-emerald-700",
  },
  out: {
    icon: XCircle,
    headerClass: "bg-red-50 border-red-200",
    titleClass: "text-red-800",
    iconClass: "text-red-400",
    itemClass: "border-red-100 bg-white hover:border-red-200",
    dotClass: "bg-red-400",
    countClass: "bg-red-100 text-red-700",
  },
  future: {
    icon: Clock,
    headerClass: "bg-amber-50 border-amber-200",
    titleClass: "text-amber-800",
    iconClass: "text-amber-400",
    itemClass: "border-amber-100 bg-white hover:border-amber-200",
    dotClass: "bg-amber-400",
    countClass: "bg-amber-100 text-amber-700",
  },
};

function SkeletonItem() {
  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-2 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-full" />
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="h-2.5 bg-gray-100 rounded w-1/3 mt-1" />
    </div>
  );
}

export function ScopeColumn({ title, items, type, isLoading }: ScopeColumnProps) {
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Column header */}
      <div className={cn("flex items-center justify-between px-4 py-3 rounded-xl border mb-3", cfg.headerClass)}>
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", cfg.iconClass)} />
          <span className={cn("text-sm font-semibold", cfg.titleClass)}>{title}</span>
        </div>
        {!isLoading && (
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", cfg.countClass)}>
            {items.length}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <SkeletonItem />
            </motion.div>
          ))
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-center">
            <p className="text-xs text-gray-400">No items in this category</p>
          </div>
        ) : (
          <AnimatePresence>
            {items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className={cn(
                  "border rounded-xl p-4 transition-colors cursor-default",
                  cfg.itemClass
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", cfg.dotClass)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 leading-relaxed">{item.point}</p>
                    {item.source && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-[10px] text-gray-400 truncate">{item.source}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
