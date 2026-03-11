"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsApi } from "@/lib/api/documents";
import { QUERY_KEYS } from "@/lib/constants";
import { toast } from "sonner";
import type { Document } from "@/types";

export function useDocuments() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEYS.documents,
    queryFn: () => documentsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: documentsApi.delete,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QUERY_KEYS.documents });
      const prev = qc.getQueryData(QUERY_KEYS.documents);
      qc.setQueryData(QUERY_KEYS.documents, (old: { items: Document[]; total: number } | undefined) => ({
        items: old?.items?.filter((d) => d.id !== id) ?? [],
        total: (old?.total ?? 1) - 1,
      }));
      return { prev };
    },
    onError: (_, __, ctx) => {
      qc.setQueryData(QUERY_KEYS.documents, ctx?.prev);
      toast.error("Failed to delete document");
    },
    onSuccess: () => {
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: QUERY_KEYS.documents });
    },
  });

  const reindexMutation = useMutation({
    mutationFn: documentsApi.reindex,
    onSuccess: () => {
      toast.success("Re-indexing started");
      qc.invalidateQueries({ queryKey: QUERY_KEYS.documents });
    },
    onError: () => toast.error("Re-index failed"),
  });

  return { ...query, deleteMutation, reindexMutation };
}
