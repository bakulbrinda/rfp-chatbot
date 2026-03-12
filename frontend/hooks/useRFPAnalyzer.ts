import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rfpAnalyzerApi, AnalysisReport } from "@/lib/api/rfpAnalyzer";

export function useStartAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      context,
      analysisId,
    }: {
      file: File;
      context: string;
      analysisId: string;
    }) => rfpAnalyzerApi.start(file, context, analysisId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rfp-analyzer", "history"] });
    },
  });
}

export function usePollAnalysis(analysisId: string | null) {
  return useQuery<AnalysisReport>({
    queryKey: ["rfp-analyzer", analysisId],
    queryFn: () => rfpAnalyzerApi.get(analysisId!),
    enabled: !!analysisId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return data.status === "processing" ? 2000 : false; // Stop polling on complete or error
    },
    staleTime: 0,
  });
}

export function useAnalysisHistory() {
  return useQuery({
    queryKey: ["rfp-analyzer", "history"],
    queryFn: rfpAnalyzerApi.history,
  });
}

export function useOverrideScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      analysisId,
      reqId,
      scope,
      reason,
    }: {
      analysisId: string;
      reqId: string;
      scope: string;
      reason?: string;
    }) => rfpAnalyzerApi.override(analysisId, reqId, scope, reason),
    onMutate: async ({ analysisId, reqId, scope }) => {
      // Optimistic update (spec rule 9.3)
      await qc.cancelQueries({ queryKey: ["rfp-analyzer", analysisId] });
      const previous = qc.getQueryData<AnalysisReport>(["rfp-analyzer", analysisId]);
      if (previous) {
        qc.setQueryData<AnalysisReport>(["rfp-analyzer", analysisId], {
          ...previous,
          requirements: previous.requirements.map((r) =>
            r.req_id === reqId
              ? {
                  ...r,
                  classification: r.classification
                    ? { ...r.classification, user_override: scope }
                    : r.classification,
                }
              : r
          ),
        });
      }
      return { previous };
    },
    onError: (_, { analysisId }, ctx) => {
      // Revert on failure
      if (ctx?.previous) {
        qc.setQueryData(["rfp-analyzer", analysisId], ctx.previous);
      }
    },
    onSettled: (_, __, { analysisId }) => {
      qc.invalidateQueries({ queryKey: ["rfp-analyzer", analysisId] });
    },
  });
}

export function useDeleteAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (analysisId: string) => rfpAnalyzerApi.delete(analysisId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rfp-analyzer", "history"] });
    },
  });
}
