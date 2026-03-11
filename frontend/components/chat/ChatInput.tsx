"use client";
import { useRef, useEffect, KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  loading,
  placeholder = "Ask anything about iMocha…",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [value]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !loading && value.trim()) onSend();
    }
  }

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-3">
      <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-[#F05A28]/50 focus-within:ring-1 focus-within:ring-[#F05A28]/20 transition-all">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-800 placeholder:text-gray-400 leading-relaxed py-1 min-h-[24px] max-h-[160px]"
        />
        <Button
          onClick={onSend}
          disabled={disabled || loading || !value.trim()}
          size="sm"
          className={cn(
            "h-8 w-8 p-0 rounded-lg flex-shrink-0 transition-all",
            value.trim() && !disabled && !loading
              ? "bg-[#F05A28] hover:bg-[#d94e20] text-white shadow-sm"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
          aria-label="Send message"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 px-1">
        Press <kbd className="font-mono bg-gray-100 px-1 rounded">Enter</kbd> to send ·{" "}
        <kbd className="font-mono bg-gray-100 px-1 rounded">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
