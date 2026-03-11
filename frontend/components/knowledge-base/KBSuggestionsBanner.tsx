"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, X, ChevronDown, ChevronUp } from "lucide-react";
import { useKBSuggestions, useDismissSuggestion } from "@/hooks/useKBSuggestions";

export function KBSuggestionsBanner({ isAdmin }: { isAdmin: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { data: suggestions } = useKBSuggestions(isAdmin);
  const dismiss = useDismissSuggestion();

  if (!isAdmin || !suggestions || suggestions.length === 0) return null;

  const totalQueries = suggestions.reduce((s, sg) => s + sg.query_count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-amber-200 bg-amber-50 rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-800">
            {suggestions.length} KB Gap{suggestions.length > 1 ? "s" : ""} Detected
          </span>
          <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
            {totalQueries} unanswered quer{totalQueries === 1 ? "y" : "ies"}
          </span>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-amber-500" />
          : <ChevronDown className="w-4 h-4 text-amber-500" />
        }
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2 border-t border-amber-200 pt-3">
              {suggestions.map((sg) => (
                <div
                  key={sg.id}
                  className="flex items-start justify-between gap-3 bg-white rounded-lg px-3 py-2.5 border border-amber-100"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-amber-900">{sg.topic}</p>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        ×{sg.query_count} queries
                      </span>
                    </div>
                    {sg.examples.length > 0 && (
                      <p className="text-xs text-amber-600 truncate">
                        e.g. &ldquo;{sg.examples[0]}&rdquo;
                        {sg.examples.length > 1 && ` +${sg.examples.length - 1} more`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => dismiss.mutate(sg.id)}
                    className="flex-shrink-0 p-1 rounded hover:bg-amber-100 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5 text-amber-500" />
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-amber-500 pt-1">
                Upload documents to address these gaps. Suggestions refresh weekly.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
