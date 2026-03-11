import { api } from "./client";
import { useAuthStore } from "@/store/authStore";
import type { ChatRequest, ChatResponse, ChatSession, ChatMessage } from "@/types";
import { API_ROUTES } from "@/lib/constants";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type StreamEvent =
  | { type: "start"; session_id: string }
  | { type: "token"; text: string }
  | { type: "done"; citations: ChatMessage["citations"]; confidence: string; found: boolean }
  | { type: "error"; message: string };

export async function* streamMessage(data: ChatRequest): AsyncGenerator<StreamEvent> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/api/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!res.ok || !res.body) {
    yield { type: "error", message: `Request failed: ${res.status}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6)) as StreamEvent;
        } catch {
          // malformed line — skip
        }
      }
    }
  }
}

export const chatApi = {
  sendMessage: (data: ChatRequest) =>
    api.post<ChatResponse>(API_ROUTES.CHAT.BASE, data).then((r) => r.data),
  getSessions: () =>
    api.get<ChatSession[]>(API_ROUTES.CHAT.SESSIONS).then((r) => r.data),
  getSession: (id: string) =>
    api
      .get<{ session: ChatSession; messages: ChatMessage[] }>(API_ROUTES.CHAT.SESSION(id))
      .then((r) => r.data),
  deleteSession: (id: string) => api.delete(API_ROUTES.CHAT.SESSION(id)),
};
