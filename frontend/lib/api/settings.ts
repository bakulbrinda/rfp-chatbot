import { api } from "./client";
import type { OrgUser } from "@/types";

export interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  role: "admin" | "sales";
}

export interface UpdateUserBody {
  name?: string;
  role?: "admin" | "sales";
  is_active?: boolean;
}

export interface BotConfigBody {
  bot_name?: string;
  instructions?: string | null;
}

export interface BotConfig {
  bot_name: string;
  instructions: string | null;
}

export const settingsApi = {
  listUsers: () => api.get<OrgUser[]>("/api/settings/users").then((r) => r.data),
  createUser: (data: CreateUserBody) =>
    api.post<OrgUser>("/api/settings/users", data).then((r) => r.data),
  updateUser: (id: string, data: UpdateUserBody) =>
    api.patch<OrgUser>(`/api/settings/users/${id}`, data).then((r) => r.data),
  deactivateUser: (id: string) => api.delete(`/api/settings/users/${id}`),
  resetPassword: (id: string, password: string) =>
    api.post(`/api/settings/users/${id}/reset-password`, { password }),
  getBotConfig: () => api.get<BotConfig>("/api/settings/bot-config").then((r) => r.data),
  updateBotConfig: (data: BotConfigBody) =>
    api.put<BotConfig>("/api/settings/bot-config", data).then((r) => r.data),
};
