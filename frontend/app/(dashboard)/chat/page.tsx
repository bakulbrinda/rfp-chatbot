"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SessionList } from "@/components/chat/SessionList";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatInput } from "@/components/chat/ChatInput";
import { streamMessage } from "@/lib/api/chat";
import { toast } from "sonner";
import type { ChatMessage } from "@/types";

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

    const tempUserMsg: ChatMessage = {
      id: "temp-user",
      session_id: "",
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages([tempUserMsg]);

    try {
      for await (const event of streamMessage({ message: trimmed })) {
        if (event.type === "start") {
          router.push(`/chat/${event.session_id}`);
          return;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
    } catch {
      toast.error("Failed to send message. Please try again.");
      setMessages([]);
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full gap-0 -m-6">
      <div className="w-[280px] flex-shrink-0 border-r border-gray-100 bg-white flex flex-col">
        <SessionList />
      </div>
      <div className="flex-1 flex flex-col bg-[#F8F7FC] overflow-hidden">
        <ChatThread
          messages={messages}
          loading={loading}
          onSuggestion={(text) => setInput(text)}
        />
        <ChatInput value={input} onChange={setInput} onSend={handleSend} loading={loading} />
      </div>
    </div>
  );
}
