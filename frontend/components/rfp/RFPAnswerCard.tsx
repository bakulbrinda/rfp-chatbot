"use client";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfidencePill } from "./ConfidencePill";
import type { RFPAnswer } from "@/lib/api/analysis";

interface RFPAnswerCardProps {
  item: RFPAnswer;
  index: number;
}

export function RFPAnswerCard({ item, index }: RFPAnswerCardProps) {
  const isNotFound = item.confidence === "not_found";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className={cn(
        "border rounded-xl p-5 space-y-3",
        isNotFound ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"
      )}
    >
      {/* Question */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[#2D1252] leading-snug flex-1">{item.question}</p>
        <ConfidencePill level={item.confidence} />
      </div>

      {/* Answer */}
      <p className={cn(
        "text-sm leading-relaxed",
        isNotFound ? "text-gray-400 italic" : "text-gray-700"
      )}>
        {item.answer}
      </p>

      {/* Sources */}
      {item.sources && item.sources.length > 0 && !isNotFound && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
          <BookOpen className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
          {item.sources.map((src, i) => (
            <span key={i} className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
              {src}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
