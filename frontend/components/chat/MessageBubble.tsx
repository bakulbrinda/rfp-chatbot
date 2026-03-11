"use client";
import { motion } from "framer-motion";
import { RotateCcw, AlertCircle } from "lucide-react";
import { cn, formatRelativeTime, getInitials } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { CopyButton } from "@/components/shared/CopyButton";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { CitationBadge } from "./CitationBadge";
import { useAuthStore } from "@/store/authStore";
import type { ChatMessage } from "@/types";

interface MessageBubbleProps {
  message: ChatMessage & { error?: boolean };
  isStreaming?: boolean;
  onRetry?: () => void;
}

export function MessageBubble({ message, isStreaming, onRetry }: MessageBubbleProps) {
  const { user } = useAuthStore();
  const isUser = message.role === "user";
  const isError = message.error;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-3 px-4 py-2 group", isUser && "flex-row-reverse")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1",
          isUser ? "bg-[#2D1252]" : isError ? "bg-red-400" : "bg-[#F05A28]"
        )}
      >
        {isUser
          ? getInitials(user?.name ?? "U")
          : isError
          ? <AlertCircle className="w-3.5 h-3.5" />
          : "i"}
      </div>

      {/* Bubble */}
      <div className={cn("flex flex-col gap-1.5 max-w-[80%]", isUser && "items-end")}>
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm",
            isUser
              ? "bg-[#2D1252] text-white rounded-tr-sm"
              : isError
              ? "bg-red-50 border border-red-200 text-red-700 rounded-tl-sm"
              : "bg-white border border-gray-100 shadow-sm rounded-tl-sm"
          )}
        >
          {isUser ? (
            <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="relative">
              <MarkdownRenderer content={message.content} />
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-[#F05A28] rounded-sm ml-0.5 animate-pulse align-text-bottom" />
              )}
            </div>
          )}
        </div>

        {/* Metadata row — only when fully done */}
        {!isUser && !isError && !isStreaming && (
          <div className="flex items-center flex-wrap gap-2 px-1">
            {message.confidence && <ConfidenceBadge confidence={message.confidence} />}
            {message.citations && message.citations.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400">Sources:</span>
                {message.citations.map((c, i) => (
                  <CitationBadge key={(c.doc_name ?? "") + i} citation={c} index={i} />
                ))}
              </div>
            )}
            <CopyButton
              text={message.content}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
            />
          </div>
        )}

        {/* Retry button on error */}
        {isError && onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Retry
          </button>
        )}

        {!isError && (
          <span className="text-[10px] text-gray-400 px-1">
            {formatRelativeTime(message.created_at)}
          </span>
        )}
      </div>
    </motion.div>
  );
}
