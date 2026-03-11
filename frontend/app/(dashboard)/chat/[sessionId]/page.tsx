"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SessionList } from "@/components/chat/SessionList";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { LoadingPage } from "@/components/shared/LoadingPage";
import { chatApi } from "@/lib/api/chat";
import { QUERY_KEYS } from "@/lib/constants";
import { toast } from "sonner";
import type { ChatMessage } from "@/types";

export default function ChatSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.session(sessionId)],
    queryFn: () => chatApi.getSession(sessionId),
    enabled: !!sessionId,
    staleTime: 30_000,
  });

  // Reset optimistic messages when session changes
  useEffect(() => {
    setOptimisticMessages([]);
  }, [sessionId]);

  const baseMessages = data?.messages ?? [];
  const allMessages = [...baseMessages, ...optimisticMessages];

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    setLoading(true);

    const tempId = `opt-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: tempId,
      session_id: sessionId,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setOptimisticMessages((prev) => [...prev, userMsg]);

    try {
      const response = await chatApi.sendMessage({ message: trimmed, session_id: sessionId });

      const assistantMsg: ChatMessage = {
        id: `opt-assistant-${Date.now()}`,
        session_id: sessionId,
        role: "assistant",
        content: response.answer,
        confidence: response.confidence,
        citations: response.citations,
        created_at: new Date().toISOString(),
      };

      setOptimisticMessages((prev) => [...prev, assistantMsg]);

      // Invalidate to refresh from server in background
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.session(sessionId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sessions });
    } catch {
      toast.error("Failed to get a response. Please try again.");
      // Remove the optimistic user message on failure
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full gap-0 -m-6">
      {/* Session sidebar */}
      <div className="w-[280px] flex-shrink-0 border-r border-gray-100 bg-white flex flex-col">
        <SessionList />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-[#F8F7FC] overflow-hidden">
        {isLoading ? (
          <LoadingPage />
        ) : (
          <>
            <ChatThread
              messages={allMessages}
              loading={loading}
              onSuggestion={(text) => setInput(text)}
            />
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              loading={loading}
            />
          </>
        )}
      </div>
    </div>
  );
}
