"use client";
import { motion } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { RFPDocument } from "@/lib/api/analysis";

interface RFPDocumentViewProps {
  doc: RFPDocument;
  clientName?: string | null;
}

export function RFPDocumentView({ doc, clientName }: RFPDocumentViewProps) {
  const [copied, setCopied] = useState(false);

  // Build markdown text for copy
  const buildText = () => {
    if (doc.raw) return doc.raw;
    const lines: string[] = [];
    if (clientName) lines.push(`# RFP Response — ${clientName}\n`);
    if (doc.executive_summary) {
      lines.push("## Executive Summary\n");
      lines.push(doc.executive_summary + "\n");
    }
    if (doc.sections && Array.isArray(doc.sections)) {
      for (const sec of doc.sections) {
        lines.push(`## ${sec.title}\n`);
        lines.push(sec.content + "\n");
      }
    }
    // Fallback: dump any other string keys
    if (lines.length === 0) {
      return JSON.stringify(doc, null, 2);
    }
    return lines.join("\n");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="border border-gray-200 rounded-xl bg-white overflow-hidden"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm font-semibold text-[#2D1252]">
          {clientName ? `RFP Response — ${clientName}` : "Generated RFP Response"}
        </p>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy all
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
        {doc.raw ? (
          <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
            {doc.raw}
          </pre>
        ) : (
          <>
            {doc.executive_summary && (
              <section>
                <h2 className="text-sm font-bold text-[#2D1252] mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-[#F05A28]" />
                  Executive Summary
                </h2>
                <p className="text-sm text-gray-700 leading-relaxed">{doc.executive_summary}</p>
              </section>
            )}

            {doc.sections && Array.isArray(doc.sections) && doc.sections.map((sec, i) => (
              <section key={i}>
                <h2 className="text-sm font-bold text-[#2D1252] mb-2 flex items-center gap-2">
                  <span className={cn(
                    "w-1 h-4 rounded-full",
                    i % 3 === 0 ? "bg-[#F05A28]" : i % 3 === 1 ? "bg-[#2D1252]" : "bg-emerald-500"
                  )} />
                  {sec.title}
                </h2>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sec.content}</p>
              </section>
            ))}

            {/* Fallback: render remaining string/number keys */}
            {!doc.executive_summary && !doc.sections && (
              <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                {JSON.stringify(doc, null, 2)}
              </pre>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
