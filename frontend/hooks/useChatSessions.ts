"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "@/lib/api/chat";
import { QUERY_KEYS } from "@/lib/constants";
import { toast } from "sonner";

export function useChatSessions() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEYS.sessions,
    queryFn: chatApi.getSessions,
  });

  const deleteSession = useMutation({
    mutationFn: chatApi.deleteSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.sessions }),
    onError: () => toast.error("Failed to delete session"),
  });

  return { ...query, deleteSession };
}
