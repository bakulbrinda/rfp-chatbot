"use client";
import { useState, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download, RotateCcw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStartAnalysis, usePollAnalysis, useOverrideScope } from "@/hooks/useRFPAnalyzer";
import type { RequirementOut } from "@/lib/api/rfpAnalyzer";

type UploadState = "idle" | "uploading" | "processing" | "complete" | "error";
type ReportTab = "summary" | "requirements" | "scope";
const SCOPE_LABELS = { in: "In Scope", conditional: "Conditional", out: "Out of Scope" };
const SCOPE_COLORS = {
  in: "bg-emerald-50 border-emerald-200 text-emerald-800",
  conditional: "bg-amber-50 border-amber-200 text-amber-800",
  out: "bg-red-50 border-red-200 text-red-700",
};

export default function RFPAnalyzerPage() {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState("");
  const [activeTab, setActiveTab] = useState<ReportTab>("summary");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const startAnalysis = useStartAnalysis();
  const { data: report } = usePollAnalysis(analysisId);
  const overrideScope = useOverrideScope();

  // Sync upload state with polling result
  const effectiveState: UploadState =
    uploadState === "processing" && report?.status === "complete" ? "complete" :
    uploadState === "processing" && report?.status === "error" ? "error" :
    uploadState;

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx"].includes(ext || "")) {
      alert("Only PDF and DOCX files are supported.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      alert("File must be under 20 MB.");
      return;
    }
    setFile(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleSubmit = async () => {
    if (!file) return;
    const aid = uuidv4();
    setAnalysisId(aid);
    setUploadState("uploading");
    try {
      await startAnalysis.mutateAsync({ file, context, analysisId: aid });
      setUploadState("processing");
    } catch {
      setUploadState("error");
    }
  };

  const handleReset = () => {
    setUploadState("idle");
    setAnalysisId(null);
    setFile(null);
    setContext("");
    setActiveTab("summary");
  };

  if (effectiveState === "idle") {
    return (
      <div className="max-w-2xl mx-auto pt-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#2D1252]">RFP / RFI Analyzer</h1>
          <p className="text-sm text-gray-500 mt-1">Upload a procurement document to extract requirements and classify scope automatically.</p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all",
            dragOver ? "border-[#F05A28] bg-[#F05A28]/5" : "border-gray-200 hover:border-[#F05A28]/50 hover:bg-gray-50",
            file && "border-emerald-400 bg-emerald-50/40"
          )}
        >
          <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {file ? (
            <>
              <FileText className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-emerald-700">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB — click to change</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">Drag & drop or click to upload</p>
              <p className="text-xs text-gray-400 mt-1">PDF or DOCX, up to 20 MB</p>
            </>
          )}
        </div>

        {/* Company context */}
        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Company Capabilities <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={5}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={"Describe your company's solution capabilities. This is used to classify each requirement as In Scope, Conditional, or Out of Scope.\n\nExample: We provide AI-powered talent assessment and skills intelligence software. Key capabilities include pre-hire screening, AI interviews (Tara AI), SSO integrations, ISO 27001:2022 certification..."}
            className="w-full px-4 py-3 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28] resize-none placeholder:text-gray-400"
          />
          {!context.trim() && (
            <p className="text-xs text-amber-600 mt-1">⚠ Without capabilities context, scope classification will use a generic fallback.</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!file || startAnalysis.isPending}
          className={cn(
            "mt-5 w-full py-3 rounded-xl text-sm font-semibold transition-all",
            file ? "bg-[#F05A28] hover:bg-[#d94e22] text-white shadow-sm" : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          {startAnalysis.isPending ? "Starting..." : "Analyse Document"}
        </button>
      </div>
    );
  }

  if (effectiveState === "uploading" || effectiveState === "processing") {
    const steps = [
      { label: "Parsing document", done: effectiveState !== "uploading" },
      { label: "Extracting client profile", done: !!report?.client_name },
      { label: "Identifying requirements", done: (report?.requirements?.length || 0) > 0 },
      { label: "Classifying scope", done: report?.status === "complete" },
    ];
    return (
      <div className="max-w-md mx-auto pt-16 text-center">
        <Loader2 className="w-10 h-10 text-[#F05A28] mx-auto mb-5 animate-spin" />
        <h2 className="text-lg font-bold text-[#2D1252] mb-6">Analysing {file?.name}</h2>
        <div className="space-y-3 text-left">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                step.done ? "bg-emerald-100" : "bg-gray-100")}>
                {step.done
                  ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                  : <div className="w-2 h-2 rounded-full bg-gray-300" />}
              </div>
              <span className={cn("text-sm", step.done ? "text-emerald-700 font-medium" : "text-gray-500")}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (effectiveState === "error") {
    return (
      <div className="max-w-md mx-auto pt-16 text-center">
        <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-[#2D1252] mb-2">Analysis failed</h2>
        <p className="text-sm text-gray-500 mb-2">{report?.error_message || "An unexpected error occurred."}</p>
        <button onClick={handleReset} className="mt-4 flex items-center gap-2 mx-auto px-5 py-2.5 bg-[#F05A28] text-white text-sm font-semibold rounded-xl hover:bg-[#d94e22]">
          <RotateCcw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  // Complete — show report
  const requirements = report?.requirements || [];
  const inScope = requirements.filter(r => (r.classification?.user_override || r.classification?.scope) === "in");
  const conditional = requirements.filter(r => (r.classification?.user_override || r.classification?.scope) === "conditional");
  const outScope = requirements.filter(r => (r.classification?.user_override || r.classification?.scope) === "out");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-1 pb-4">
        <div>
          <h1 className="text-lg font-bold text-[#2D1252]">{report?.client_name || report?.original_name}</h1>
          <p className="text-xs text-gray-500">{requirements.length} requirements · {inScope.length} in scope · {conditional.length} conditional · {outScope.length} out</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`${API_URL}/api/rfp-analyzer/${analysisId}/export/pdf`} target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-3.5 h-3.5" /> PDF
          </a>
          <a href={`${API_URL}/api/rfp-analyzer/${analysisId}/export/docx`} target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-3.5 h-3.5" /> DOCX
          </a>
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> New
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-4">
        {(["summary", "requirements", "scope"] as ReportTab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
              activeTab === tab ? "bg-white text-[#2D1252] shadow-sm" : "text-gray-500 hover:text-gray-700")}>
            {tab === "scope" ? "Scope Map" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "summary" && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-[#2D1252] mb-3">Client Profile</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  ["Client", report?.client_name],
                  ["Country", report?.country],
                  ["Sector", report?.sector],
                  ["Tender ID", report?.tender_id],
                  ["Deadline", report?.submission_deadline],
                  ["Budget", report?.budget_indication ? `${report.budget_indication} ${report.currency || ""}`.trim() : null],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={String(k)}>
                    <dt className="text-xs text-gray-400">{k}</dt>
                    <dd className="font-medium text-gray-800">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "In Scope", count: inScope.length, color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                { label: "Conditional", count: conditional.length, color: "text-amber-700 bg-amber-50 border-amber-100" },
                { label: "Out of Scope", count: outScope.length, color: "text-red-700 bg-red-50 border-red-100" },
              ].map(({ label, count, color }) => (
                <div key={label} className={cn("rounded-xl border p-4 text-center", color)}>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs font-medium mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "requirements" && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_100px_90px_80px] gap-3 px-4 py-2.5 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              <span>Req ID</span><span>Requirement</span><span>Category</span><span>Priority</span><span>Page</span>
            </div>
            {requirements.map(req => (
              <div key={req.req_id} className="grid grid-cols-[80px_1fr_100px_90px_80px] gap-3 px-4 py-3 border-b border-gray-50 text-sm items-start hover:bg-gray-50/50">
                <span className="font-mono text-xs text-[#2D1252] font-semibold">{req.req_id}</span>
                <span className="text-gray-700 leading-relaxed">{req.text}</span>
                <span className="text-xs text-gray-500">{req.category || "—"}</span>
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit",
                  req.priority === "mandatory" ? "bg-red-50 text-red-600" :
                  req.priority === "preferred" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500")}>
                  {req.priority || "—"}
                </span>
                <span className="text-xs text-gray-400">{req.source_page ?? "—"}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "scope" && (
          <div className="grid grid-cols-3 gap-4 h-full">
            {(["in", "conditional", "out"] as const).map(scopeKey => {
              const items = requirements.filter(r =>
                (r.classification?.user_override || r.classification?.scope) === scopeKey
              );
              return (
                <div key={scopeKey}>
                  <div className={cn("text-xs font-semibold px-3 py-1.5 rounded-lg mb-2 w-fit",
                    scopeKey === "in" ? "bg-emerald-100 text-emerald-700" :
                    scopeKey === "conditional" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                    {SCOPE_LABELS[scopeKey]} ({items.length})
                  </div>
                  <div className="space-y-2">
                    {items.map(req => (
                      <ScopeCard key={req.req_id} req={req} analysisId={analysisId!} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ScopeCard({ req, analysisId }: { req: RequirementOut; analysisId: string }) {
  const [open, setOpen] = useState(false);
  const override = useOverrideScope();
  const c = req.classification;
  const effectiveScope = (c?.user_override || c?.scope || "out") as "in" | "conditional" | "out";

  return (
    <div className={cn("rounded-xl border p-3 text-xs relative", SCOPE_COLORS[effectiveScope])}>
      <p className="font-mono font-semibold mb-1">{req.req_id}</p>
      <p className="text-[11px] leading-relaxed mb-1.5">{req.text.slice(0, 120)}{req.text.length > 120 ? "…" : ""}</p>
      {c?.justification && <p className="text-[10px] opacity-70 leading-snug mb-2">{c.justification}</p>}
      {c?.confidence != null && (
        <p className="text-[10px] opacity-60">{Math.round(c.confidence * 100)}% confidence</p>
      )}
      {/* Override dropdown */}
      <div className="relative mt-2">
        <button onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-[10px] font-medium opacity-70 hover:opacity-100 transition-opacity">
          Reclassify <ChevronDown className="w-3 h-3" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-5 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36">
              {(["in", "conditional", "out"] as const).filter(s => s !== effectiveScope).map(s => (
                <button key={s} onClick={() => {
                  override.mutate({ analysisId, reqId: req.req_id, scope: s });
                  setOpen(false);
                }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-700">
                  → {SCOPE_LABELS[s]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {c?.user_override && <p className="text-[10px] mt-1 font-semibold opacity-60">Override applied</p>}
    </div>
  );
}
