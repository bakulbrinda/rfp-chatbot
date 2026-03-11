"use client";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, AlertCircle } from "lucide-react";
import { documentsApi } from "@/lib/api/documents";
import { formatDate, formatFileSize } from "@/lib/utils";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import type { Document } from "@/types";

interface DocumentPreviewSheetProps {
  doc: Document | null;
  onClose: () => void;
}

export function DocumentPreviewSheet({ doc, onClose }: DocumentPreviewSheetProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["document-preview", doc?.id],
    queryFn: () => documentsApi.preview(doc!.id),
    enabled: !!doc,
    staleTime: 60_000,
  });

  return (
    <Sheet open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        {doc && (
          <>
            <SheetHeader className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F05A28]/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-[#F05A28]" />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-sm font-semibold text-[#2D1252] truncate">
                    {doc.original_name}
                  </SheetTitle>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <DocumentStatusBadge status={doc.status} uploadedAt={doc.uploaded_at} />
                    <span className="text-xs text-gray-400">{formatFileSize(doc.file_size_kb * 1024)}</span>
                    <span className="text-xs text-gray-400">Uploaded {formatDate(doc.uploaded_at)}</span>
                    {doc.chunk_count > 0 && (
                      <span className="text-xs text-gray-400">{doc.chunk_count} chunks</span>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1 px-6 py-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-4" style={{ width: `${60 + Math.random() * 40}%` }} />
                  ))}
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertCircle className="w-10 h-10 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">Failed to load preview</p>
                </div>
              ) : (
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {(data as { content?: string })?.content ?? "No preview available."}
                </pre>
              )}
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
