"use client";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, Loader2, CheckCircle2 } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import { documentsApi } from "@/lib/api/documents";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, ACCEPTED_FILE_TYPES } from "@/lib/constants";
import { toast } from "sonner";

interface UploadFile {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export function UploadDropzone() {
  const [queue, setQueue] = useState<UploadFile[]>([]);
  const qc = useQueryClient();

  const uploadFile = useCallback(async (item: UploadFile, index: number) => {
    setQueue((prev) => prev.map((q, i) => i === index ? { ...q, status: "uploading" } : q));
    try {
      const fd = new FormData();
      fd.append("file", item.file);
      await documentsApi.upload(fd);
      setQueue((prev) => prev.map((q, i) => i === index ? { ...q, status: "done" } : q));
      qc.invalidateQueries({ queryKey: QUERY_KEYS.documents });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Upload failed";
      setQueue((prev) => prev.map((q, i) => i === index ? { ...q, status: "error", error: msg } : q));
      toast.error(msg);
    }
  }, [qc]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const newItems: UploadFile[] = accepted.map((file) => ({ file, status: "pending" }));
      setQueue((prev) => {
        const combined = [...prev, ...newItems];
        // kick off uploads
        newItems.forEach((item, i) => {
          const idx = prev.length + i;
          setTimeout(() => uploadFile({ ...item }, idx), 0);
        });
        return combined;
      });
    },
    [uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: 50 * 1024 * 1024, // 50 MB
    onDropRejected: (files) => {
      files.forEach(({ errors }) => toast.error(errors[0]?.message ?? "File rejected"));
    },
  });

  function removeItem(index: number) {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-[#F05A28] bg-[#F05A28]/5"
            : "border-gray-200 hover:border-[#F05A28]/50 hover:bg-gray-50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
            isDragActive ? "bg-[#F05A28] text-white" : "bg-gray-100 text-gray-400"
          )}>
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#2D1252]">
              {isDragActive ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">or click to browse · PDF, DOCX, TXT · max 50 MB</p>
          </div>
        </div>
      </div>

      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-[#F05A28]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#F05A28]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{item.file.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{formatFileSize(item.file.size)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.status === "uploading" && (
                  <Loader2 className="w-4 h-4 text-[#F05A28] animate-spin" />
                )}
                {item.status === "done" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
                {item.status === "error" && (
                  <span className="text-[10px] text-red-500">{item.error}</span>
                )}
                {item.status !== "uploading" && (
                  <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-gray-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
