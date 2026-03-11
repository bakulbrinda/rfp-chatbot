"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { suggestionsApi } from "@/lib/api/documents";
import { toast } from "sonner";

const KEY = ["kb", "suggestions"] as const;

export function useKBSuggestions(enabled: boolean) {
  return useQuery({
    queryKey: KEY,
    queryFn: suggestionsApi.list,
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDismissSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => suggestionsApi.dismiss(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: () => toast.error("Failed to dismiss suggestion"),
  });
}
