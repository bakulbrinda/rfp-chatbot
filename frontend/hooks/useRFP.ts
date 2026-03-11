"use client";
import { useMutation } from "@tanstack/react-query";
import { rfpApi, type RFPRespondRequest, type RFPGenerateRequest } from "@/lib/api/analysis";
import { toast } from "sonner";

export function useRFPRespond() {
  return useMutation({
    mutationFn: (data: RFPRespondRequest) => rfpApi.respond(data),
    onError: () => toast.error("RFP response failed. Please try again."),
  });
}

export function useRFPGenerate() {
  return useMutation({
    mutationFn: (data: RFPGenerateRequest) => rfpApi.generate(data),
    onError: () => toast.error("RFP generation failed. Please try again."),
  });
}
