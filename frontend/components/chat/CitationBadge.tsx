"use client";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Citation } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CitationBadgeProps {
  citation: Citation;
  index: number;
  className?: string;
}

export function CitationBadge({ citation, index, className }: CitationBadgeProps) {
  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                "bg-[#F05A28]/10 text-[#F05A28] border border-[#F05A28]/20 hover:bg-[#F05A28]/20 transition-colors",
                "align-baseline cursor-pointer",
                className
              )}
              aria-label={`Source: ${citation.doc_name}`}
            >
              [{index + 1}]
            </button>
          }
        />
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-0.5">
            <p className="font-semibold text-xs text-[#2D1252] flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              {citation.doc_name}
            </p>
            {citation.section && (
              <p className="text-[10px] text-gray-500">{citation.section}</p>
            )}
            {citation.page_number && (
              <p className="text-[10px] text-gray-500">Page {citation.page_number}</p>
            )}
            {citation.quote && (
              <p className="text-[10px] text-gray-600 mt-1 line-clamp-3 italic">"{citation.quote}"</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
