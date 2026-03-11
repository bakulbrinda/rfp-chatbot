"use client";
import { useMutation } from "@tanstack/react-query";
import { analysisApi, type AnalysisRequest } from "@/lib/api/analysis";
import { toast } from "sonner";

export function useAnalysis() {
  return useMutation({
    mutationFn: (data: AnalysisRequest) => analysisApi.run(data),
    onError: () => toast.error("Analysis failed. Please try again."),
  });
}
