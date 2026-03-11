"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi, type CreateUserBody, type UpdateUserBody, type BotConfigBody } from "@/lib/api/settings";
import { toast } from "sonner";

const USERS_KEY = ["settings", "users"] as const;
const BOT_CONFIG_KEY = ["settings", "bot-config"] as const;

export function useOrgUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: settingsApi.listUsers,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserBody) => settingsApi.createUser(data),
    onSuccess: () => {
      toast.success("User created");
      qc.invalidateQueries({ queryKey: USERS_KEY });
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      toast.error(e?.response?.data?.detail ?? "Failed to create user"),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserBody }) =>
      settingsApi.updateUser(id, data),
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: USERS_KEY });
    },
    onError: () => toast.error("Failed to update user"),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settingsApi.deactivateUser(id),
    onSuccess: () => {
      toast.success("User deactivated");
      qc.invalidateQueries({ queryKey: USERS_KEY });
    },
    onError: () => toast.error("Failed to deactivate user"),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      settingsApi.resetPassword(id, password),
    onSuccess: () => toast.success("Password reset successfully"),
    onError: () => toast.error("Failed to reset password"),
  });
}

export function useBotConfig() {
  return useQuery({
    queryKey: BOT_CONFIG_KEY,
    queryFn: settingsApi.getBotConfig,
  });
}

export function useUpdateBotConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BotConfigBody) => settingsApi.updateBotConfig(data),
    onSuccess: () => {
      toast.success("Bot configuration saved");
      qc.invalidateQueries({ queryKey: BOT_CONFIG_KEY });
    },
    onError: () => toast.error("Failed to save bot configuration"),
  });
}
