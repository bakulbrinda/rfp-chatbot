"use client";
import { useState } from "react";
import { MoreHorizontal, Trash2, RefreshCw, Eye, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate, formatFileSize } from "@/lib/utils";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { useDocuments } from "@/hooks/useDocuments";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Document } from "@/types";

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "Word",
  txt: "Text",
};

interface DocumentTableProps {
  onPreview: (doc: Document) => void;
}

export function DocumentTable({ onPreview }: DocumentTableProps) {
  const { data, isLoading, deleteMutation, reindexMutation } = useDocuments();
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);

  const documents: Document[] = Array.isArray(data) ? data : (data?.items ?? []);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 bg-white rounded-lg border border-gray-100">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-48 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!documents.length) return null;

  return (
    <>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span>Document</span>
          <span>Status</span>
          <span>Size</span>
          <span>Uploaded</span>
          <span />
        </div>

        <AnimatePresence initial={false}>
          {documents.map((doc) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
            >
              {/* Name + type */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#F05A28]/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-[#F05A28]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.original_name}</p>
                  <p className="text-[10px] text-gray-400">
                    {FILE_TYPE_LABELS[doc.file_type] ?? doc.file_type}
                    {doc.chunk_count > 0 && ` · ${doc.chunk_count} chunks`}
                    {doc.category && ` · ${doc.category}`}
                  </p>
                </div>
              </div>

              <DocumentStatusBadge status={doc.status} />

              <span className="text-sm text-gray-500">{formatFileSize(doc.file_size_kb * 1024)}</span>

              <span className="text-sm text-gray-500">{formatDate(doc.uploaded_at)}</span>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => onPreview(doc)} className="gap-2 cursor-pointer">
                    <Eye className="w-4 h-4" /> Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => reindexMutation.mutate(doc.id)}
                    disabled={reindexMutation.isPending}
                    className="gap-2 cursor-pointer"
                  >
                    <RefreshCw className={cn("w-4 h-4", reindexMutation.isPending && "animate-spin")} />
                    Re-index
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setPendingDelete(doc)}
                    className="gap-2 cursor-pointer text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.original_name}" will be permanently removed from the knowledge base.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
