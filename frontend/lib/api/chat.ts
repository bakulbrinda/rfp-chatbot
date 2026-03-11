import { api } from "./client";
import type { ChatRequest, ChatResponse, ChatSession, ChatMessage } from "@/types";
import { API_ROUTES } from "@/lib/constants";

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
