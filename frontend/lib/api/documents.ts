import { api } from "./client";
import type { Document } from "@/types";
import { API_ROUTES } from "@/lib/constants";

export interface KBSuggestion {
  id: string;
  topic: string;
  query_count: number;
  examples: string[];
  generated_at: string;
}

export const suggestionsApi = {
  list: () => api.get<KBSuggestion[]>("/api/kb/suggestions").then((r) => r.data),
  dismiss: (id: string) => api.post(`/api/kb/suggestions/${id}/dismiss`),
};

export const documentsApi = {
  list: (params?: { skip?: number; limit?: number; category?: string }) =>
    api.get<{ items: Document[]; total: number }>(API_ROUTES.KB.FILES, { params }).then((r) => r.data),
  upload: (formData: FormData, onUploadProgress?: (p: number) => void) =>
    api.post<Document>(API_ROUTES.KB.UPLOAD, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) =>
        onUploadProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
    }).then((r) => r.data),
  delete: (id: string) => api.delete(API_ROUTES.KB.FILE(id)),
  reindex: (id: string) => api.put(API_ROUTES.KB.FILE(id)),
  preview: (id: string) =>
    api.get<{ text: string }>(API_ROUTES.KB.PREVIEW(id)).then((r) => r.data),
};
