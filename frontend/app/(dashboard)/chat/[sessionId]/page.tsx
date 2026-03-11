"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SessionList } from "@/components/chat/SessionList";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { LoadingPage } from "@/components/shared/LoadingPage";
import { chatApi, streamMessage } from "@/lib/api/chat";
import { QUERY_KEYS } from "@/lib/constants";
import { toast } from "sonner";
import type { ChatMessage } from "@/types";

type LocalMessage = ChatMessage & { error?: boolean };

const STREAMING_ID = "streaming-assistant";

export default function ChatSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.session(sessionId)],
    queryFn: () => chatApi.getSession(sessionId),
    enabled: !!sessionId,
    staleTime: 30_000,
  });

  useEffect(() => {
    setLocalMessages([]);
  }, [sessionId]);

  const baseMessages = data?.messages ?? [];
  const allMessages: LocalMessage[] = [...baseMessages, ...localMessages];

  const handleSend = useCallback(async (messageText?: string) => {
    const trimmed = (messageText ?? input).trim();
    if (!trimmed || loading) return;

    setInput("");
    setLoading(true);
    setLastUserMessage(trimmed);

    const tempUserId = `opt-user-${Date.now()}`;
    const userMsg: LocalMessage = {
      id: tempUserId,
      session_id: sessionId,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    // Remove any previous error message, add user message
    setLocalMessages((prev) => [...prev.filter((m) => !m.error), userMsg]);

    // Placeholder streaming bubble
    const streamingMsg: LocalMessage = {
      id: STREAMING_ID,
      session_id: sessionId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, streamingMsg]);
    setStreamingId(STREAMING_ID);

    try {
      let finalContent = "";
      let finalCitations: ChatMessage["citations"] = [];
      let finalConfidence: import("@/types").Confidence | undefined = undefined;

      for await (const event of streamMessage({ message: trimmed, session_id: sessionId })) {
        if (event.type === "token") {
          finalContent += event.text;
          setLocalMessages((prev) =>
            prev.map((m) =>
              m.id === STREAMING_ID ? { ...m, content: finalContent } : m
            )
          );
        } else if (event.type === "done") {
          finalCitations = event.citations ?? [];
          finalConfidence = event.confidence as import("@/types").Confidence | undefined;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }

      // Replace streaming bubble with final message
      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === STREAMING_ID
            ? {
                ...m,
                id: `final-${Date.now()}`,
                content: finalContent,
                citations: finalCitations,
                confidence: finalConfidence,
              }
            : m
        )
      );

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.session(sessionId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sessions });
    } catch {
      // Replace streaming bubble with error message
      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === STREAMING_ID
            ? {
                ...m,
                id: `error-${Date.now()}`,
                content: "Something went wrong. Please try again.",
                error: true,
              }
            : m
        )
      );
      toast.error("Failed to get a response.");
    } finally {
      setStreamingId(null);
      setLoading(false);
    }
  }, [input, loading, sessionId, queryClient]);

  const handleRetry = useCallback(() => {
    if (lastUserMessage) {
      setLocalMessages((prev) => prev.filter((m) => !m.error && m.id !== `opt-user-${sessionId}`));
      handleSend(lastUserMessage);
    }
  }, [lastUserMessage, handleSend, sessionId]);

  return (
    <div className="flex h-full gap-0 -m-6">
      <div className="w-[280px] flex-shrink-0 border-r border-gray-100 bg-white flex flex-col">
        <SessionList />
      </div>
      <div className="flex-1 flex flex-col bg-[#F8F7FC] overflow-hidden">
        {isLoading ? (
          <LoadingPage />
        ) : (
          <>
            <ChatThread
              messages={allMessages}
              streamingMessageId={streamingId}
              loading={loading}
              onSuggestion={(text) => setInput(text)}
              onRetry={handleRetry}
            />
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              loading={loading}
            />
          </>
        )}
      </div>
    </div>
  );
}
