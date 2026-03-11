"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SessionList } from "@/components/chat/SessionList";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { chatApi } from "@/lib/api/chat";
import { toast } from "sonner";
import type { ChatMessage } from "@/types";

// New chat page — shows empty state, then creates session on first message
export default function ChatPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    setLoading(true);

    // Optimistically show user message
    const tempUserMsg: ChatMessage = {
      id: "temp-user",
      session_id: "",
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages([tempUserMsg]);

    try {
      const response = await chatApi.sendMessage({ message: trimmed });
      // Navigate to the new session
      router.push(`/chat/${response.session_id}`);
    } catch {
      toast.error("Failed to send message. Please try again.");
      setMessages([]);
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
        <ChatThread
          messages={messages}
          loading={loading}
          onSuggestion={(text) => { setInput(text); }}
        />
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          loading={loading}
        />
      </div>
    </div>
  );
}
