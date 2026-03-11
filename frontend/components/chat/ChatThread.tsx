"use client";
import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { StreamingIndicator } from "./StreamingIndicator";
import { EmptyChatState } from "./EmptyChatState";
import type { ChatMessage } from "@/types";

interface ChatThreadProps {
  messages: ChatMessage[];
  loading: boolean;
  onSuggestion: (text: string) => void;
}

export function ChatThread({ messages, loading, onSuggestion }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  if (messages.length === 0 && !loading) {
    return <EmptyChatState onSuggestion={onSuggestion} />;
  }

  return (
    <div className="flex-1 overflow-y-auto py-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {loading && <StreamingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
