import { api } from "./client";
import { API_ROUTES } from "@/lib/constants";
import type { AnalysisResult } from "@/types";

export interface AnalysisRequest {
  requirements: string;
  client_name?: string;
}

export interface RFPRespondRequest {
  rfp_text: string;
}

export interface RFPGenerateRequest {
  client_brief: string;
  client_name?: string;
}

export interface RFPAnswer {
  question: string;
  answer: string;
  sources: string[];
  confidence: "high" | "medium" | "low" | "not_found";
}

export interface RFPSection {
  title: string;
  content: string;
}

export interface RFPDocument {
  executive_summary?: string;
  sections?: RFPSection[];
  raw?: string;
  [key: string]: unknown;
}

export const analysisApi = {
  run: (data: AnalysisRequest) =>
    api.post<AnalysisResult>(API_ROUTES.ANALYSIS.BASE, data).then((r) => r.data),
};

export const rfpApi = {
  respond: (data: RFPRespondRequest) =>
    api
      .post<{ answers: RFPAnswer[]; total: number }>(API_ROUTES.RFP.RESPOND, data)
      .then((r) => r.data),
  generate: (data: RFPGenerateRequest) =>
    api
      .post<{ rfp: RFPDocument; client_name: string | null }>(API_ROUTES.RFP.GENERATE, data)
      .then((r) => r.data),
};
