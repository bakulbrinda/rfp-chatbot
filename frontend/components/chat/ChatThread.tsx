"use client";
import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { EmptyChatState } from "./EmptyChatState";
import type { ChatMessage } from "@/types";

interface ChatThreadProps {
  messages: (ChatMessage & { error?: boolean })[];
  streamingMessageId?: string | null;
  loading: boolean;
  onSuggestion: (text: string) => void;
  onRetry?: () => void;
}

export function ChatThread({ messages, streamingMessageId, loading, onSuggestion, onRetry }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  // Also scroll while streaming content grows
  useEffect(() => {
    if (streamingMessageId) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  });

  if (messages.length === 0 && !loading) {
    return <EmptyChatState onSuggestion={onSuggestion} />;
  }

  return (
    <div className="flex-1 overflow-y-auto py-4">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isStreaming={msg.id === streamingMessageId}
          onRetry={msg.error ? onRetry : undefined}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
