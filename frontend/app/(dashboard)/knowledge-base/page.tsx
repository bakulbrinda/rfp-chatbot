"use client";
import { useState } from "react";
import { Database, Upload } from "lucide-react";
import { useDocuments } from "@/hooks/useDocuments";
import { UploadDropzone } from "@/components/knowledge-base/UploadDropzone";
import { DocumentTable } from "@/components/knowledge-base/DocumentTable";
import { DocumentPreviewSheet } from "@/components/knowledge-base/DocumentPreviewSheet";
import { KBSuggestionsBanner } from "@/components/knowledge-base/KBSuggestionsBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAuthStore } from "@/store/authStore";
import type { Document } from "@/types";

export default function KnowledgeBasePage() {
  const { isAdmin } = useAuthStore();
  const { data, isLoading } = useDocuments();
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  const documents: Document[] = Array.isArray(data) ? data : (data?.items ?? []);
  const hasDocuments = !isLoading && documents.length > 0;
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2D1252]">Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {hasDocuments
              ? `${documents.length} document${documents.length !== 1 ? "s" : ""} · ${totalChunks.toLocaleString()} indexed chunks`
              : "Upload documents to ground your AI responses"}
          </p>
        </div>

        {/* Stats pill */}
        {hasDocuments && (
          <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm">
            <Database className="w-4 h-4 text-[#F05A28]" />
            <span className="text-sm font-semibold text-[#2D1252]">{totalChunks.toLocaleString()}</span>
            <span className="text-xs text-gray-400">chunks indexed</span>
          </div>
        )}
      </div>

      {/* KB Suggestions banner — admin only */}
      <KBSuggestionsBanner isAdmin={isAdmin()} />

      {/* Upload section — admin only */}
      {isAdmin() && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="w-4 h-4 text-[#F05A28]" />
            <h2 className="text-sm font-semibold text-[#2D1252]">Upload Documents</h2>
          </div>
          <UploadDropzone />
        </div>
      )}

      {/* Document list */}
      <div className="space-y-3">
        {hasDocuments ? (
          <DocumentTable onPreview={setPreviewDoc} />
        ) : !isLoading ? (
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
            <EmptyState
              icon={Database}
              title="No documents yet"
              description={
                isAdmin()
                  ? "Upload your first PDF, DOCX, or TXT file to start building your knowledge base."
                  : "Your admin hasn't uploaded any documents yet."
              }
            />
          </div>
        ) : null}
      </div>

      {/* Preview sheet */}
      <DocumentPreviewSheet doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
