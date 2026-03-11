export const QUERY_KEYS = {
  sessions: ["chat", "sessions"] as const,
  session: (id: string) => ["chat", "session", id] as const,
  documents: ["documents"] as const,
  document: (id: string) => ["documents", id] as const,
  analytics: ["analytics"] as const,
} as const;

export const API_ROUTES = {
  AUTH: {
    LOGIN: "/auth/login",
    REFRESH: "/auth/refresh",
    LOGOUT: "/auth/logout",
    ME: "/auth/me",
  },
  CHAT: {
    BASE: "/api/chat",
    SESSIONS: "/api/chat/sessions",
    SESSION: (id: string) => `/api/chat/sessions/${id}`,
  },
  KB: {
    UPLOAD: "/api/kb/upload",
    FILES: "/api/kb/files",
    FILE: (id: string) => `/api/kb/files/${id}`,
    PREVIEW: (id: string) => `/api/kb/files/${id}/preview`,
  },
  ANALYSIS: {
    BASE: "/api/analysis",
    COMPARE: "/api/analysis/compare",
    HISTORY: "/api/analysis/history",
    ITEM: (id: string) => `/api/analysis/${id}`,
  },
  RFP: {
    RESPOND: "/api/rfp/respond",
    GENERATE: "/api/rfp/generate",
    HISTORY: "/api/rfp/history",
  },
  ANALYTICS: {
    SUMMARY: "/api/analytics/summary",
    VOLUME: "/api/analytics/volume",
    GAPS: "/api/analytics/gaps",
  },
} as const;

export const CONFIDENCE_THRESHOLDS = { HIGH: 0.85, MEDIUM: 0.60 } as const;

export const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
} as const;
