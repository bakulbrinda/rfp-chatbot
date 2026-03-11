export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "sales";
}

export interface LoginRequest { email: string; password: string; }
export interface LoginResponse { access_token: string; user: User; }

export type DocumentStatus = "processing" | "indexed" | "failed";
export interface Document {
  id: string;
  original_name: string;
  file_type: "pdf" | "docx" | "txt";
  category: string;
  file_size_kb: number;
  status: DocumentStatus;
  chunk_count: number;
  uploaded_at: string;
}

export interface Citation {
  doc_name: string;
  section: string;
  page_number?: number;
  quote: string;
}

export type Confidence = "high" | "medium" | "low" | "not_found";

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence?: Confidence;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatRequest { session_id?: string; message: string; }
export interface ChatResponse {
  session_id: string;
  answer: string;
  citations: Citation[];
  confidence: Confidence;
}

// Analytics
export interface AnalyticsSummary {
  total_queries: number;
  total_queries_last_week: number;
  total_queries_prev_week: number;
  answer_rate: number;
  answer_rate_last_week: number;
  avg_confidence_pct: number;
  documents_total: number;
  documents_indexed: number;
}
export interface VolumeDataPoint { date: string; count: number; }
export interface ConfidenceDataPoint { confidence: string; count: number; }
export interface QueryEntry { query: string; count: number; }

// Settings / User management
export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "sales";
  is_active: boolean;
  created_at: string;
}

export interface ScopeItem { point: string; source: string | null; }
export interface AnalysisResult {
  id: string;
  client_name?: string;
  in_scope: ScopeItem[];
  out_of_scope: ScopeItem[];
  future_scope: ScopeItem[];
  created_at: string;
}
