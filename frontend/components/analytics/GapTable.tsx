"use client";
import { AlertCircle } from "lucide-react";
import type { QueryEntry } from "@/types";

interface Props {
  data: QueryEntry[];
  isLoading?: boolean;
}

export function GapTable({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-100">
            <div className="h-3 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-100 rounded-full w-8" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
          <AlertCircle className="w-5 h-5 text-emerald-500" />
        </div>
        <p className="text-sm font-medium text-gray-700">No knowledge gaps detected</p>
        <p className="text-xs text-gray-400 mt-0.5">All queries are being answered from the KB</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {data.map((item, i) => (
        <div key={i} className="flex items-center justify-between py-2.5 group">
          <p className="text-sm text-gray-700 leading-snug flex-1 mr-3 truncate">{item.query}</p>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex-shrink-0">
            ×{item.count}
          </span>
        </div>
      ))}
    </div>
  );
}
