import { api } from "./client";

export interface StartAnalysisResponse {
  analysis_id: string;
  status: string;
}

export interface ClassificationOut {
  scope: string;
  justification: string | null;
  confidence: number | null;
  conditions: string | null;
  user_override: string | null;
  override_reason: string | null;
}

export interface RequirementOut {
  req_id: string;
  text: string;
  raw_quote: string | null;
  category: string | null;
  priority: string | null;
  source_page: number | null;
  source_section: string | null;
  classification: ClassificationOut | null;
}

export interface AnalysisReport {
  analysis_id: string;
  status: "processing" | "complete" | "error";
  original_name: string;
  client_name: string | null;
  country: string | null;
  sector: string | null;
  tender_id: string | null;
  submission_deadline: string | null;
  evaluation_split: Record<string, string> | null;
  budget_indication: string | null;
  currency: string | null;
  language: string | null;
  error_message: string | null;
  requirements: RequirementOut[];
  created_at: string;
}

export interface AnalysisListItem {
  analysis_id: string;
  status: string;
  original_name: string;
  client_name: string | null;
  created_at: string;
  requirement_count: number;
}

export const rfpAnalyzerApi = {
  start: async (
    file: File,
    companyContext: string,
    analysisId: string
  ): Promise<StartAnalysisResponse> => {
    const form = new FormData();
    form.append("file", file);
    form.append("analysis_id", analysisId);
    form.append("company_context", companyContext);
    // axios auto-sets Content-Type: multipart/form-data with boundary when FormData is passed
    const { data } = await api.post<StartAnalysisResponse>("/api/rfp-analyzer", form);
    return data;
  },

  get: async (analysisId: string): Promise<AnalysisReport> => {
    const { data } = await api.get<AnalysisReport>(`/api/rfp-analyzer/${analysisId}`);
    return data;
  },

  history: async (): Promise<AnalysisListItem[]> => {
    const { data } = await api.get<AnalysisListItem[]>("/api/rfp-analyzer/history");
    return data;
  },

  override: async (
    analysisId: string,
    reqId: string,
    scope: string,
    reason?: string
  ): Promise<{ req_id: string; scope: string; saved: boolean }> => {
    const { data } = await api.patch(`/api/rfp-analyzer/${analysisId}/scope`, {
      req_id: reqId,
      scope,
      reason,
    });
    return data;
  },

  delete: async (analysisId: string): Promise<{ deleted: boolean }> => {
    const { data } = await api.delete(`/api/rfp-analyzer/${analysisId}`);
    return data;
  },

  exportPdfUrl: (analysisId: string): string =>
    `/api/rfp-analyzer/${analysisId}/export/pdf`,

  exportDocxUrl: (analysisId: string): string =>
    `/api/rfp-analyzer/${analysisId}/export/docx`,
};
