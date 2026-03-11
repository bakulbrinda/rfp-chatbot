"use client";
import { useState } from "react";
import { BarChart3, Sparkles, RotateCcw, User, GitCompare } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { useAnalysis } from "@/hooks/useAnalysis";
import { ScopeColumn } from "@/components/analysis/ScopeColumn";
import type { AnalysisResult, ScopeItem } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "analyse" | "compare";

interface ScopeGroup {
  in_scope: ScopeItem[];
  out_of_scope: ScopeItem[];
  future_scope: ScopeItem[];
}

interface CompareResult {
  client_a: string | null;
  client_b: string | null;
  result_a: ScopeGroup;
  result_b: ScopeGroup;
  created_at: string;
}

const CHAR_LIMIT = 8000;

// ── Analyse tab ────────────────────────────────────────────────────────────────
function AnalyseTab() {
  const [requirements, setRequirements] = useState("");
  const [clientName, setClientName] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const mutation = useAnalysis();

  async function handleRun() {
    if (!requirements.trim()) return;
    const data = await mutation.mutateAsync({
      requirements: requirements.trim(),
      client_name: clientName.trim() || undefined,
    });
    setResult(data);
  }

  function handleReset() {
    setResult(null);
    setRequirements("");
    setClientName("");
    mutation.reset();
  }

  const isLoading = mutation.isPending;

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            {result.client_name && (
              <p className="text-xs text-gray-500 mb-0.5">
                Analysis for <span className="font-semibold text-[#2D1252]">{result.client_name}</span>
              </p>
            )}
            <p className="text-xs text-gray-400">
              {new Date(result.created_at).toLocaleString()} ·{" "}
              {result.in_scope.length + result.out_of_scope.length + result.future_scope.length} items categorized
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Analysis complete
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScopeColumn title="In Scope" items={result.in_scope} type="in" />
          <ScopeColumn title="Out of Scope" items={result.out_of_scope} type="out" />
          <ScopeColumn title="Future Scope" items={result.future_scope} type="future" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            Client Name <span className="text-gray-400 font-normal">(optional)</span>
          </div>
        </label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Client name"
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28] transition-all placeholder:text-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Requirements</label>
        <div className="relative">
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value.slice(0, CHAR_LIMIT))}
            placeholder="Paste the client's requirements, RFP text, or project brief here..."
            rows={14}
            className="w-full px-4 py-3.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28] transition-all resize-none placeholder:text-gray-400 font-mono leading-relaxed"
          />
          <div className={cn(
            "absolute bottom-3 right-3 text-[10px] font-medium",
            requirements.length > CHAR_LIMIT * 0.9 ? "text-amber-500" : "text-gray-400"
          )}>
            {requirements.length.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
          </div>
        </div>
      </div>
      <button
        onClick={handleRun}
        disabled={!requirements.trim() || isLoading}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all",
          requirements.trim() && !isLoading
            ? "bg-[#F05A28] hover:bg-[#d94e22] text-white shadow-sm shadow-orange-200"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        )}
      >
        {isLoading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing requirements...
          </>
        ) : (
          <><Sparkles className="w-4 h-4" />Run Analysis</>
        )}
      </button>
      <p className="text-center text-xs text-gray-400">Analysis is grounded in your knowledge base. Takes 10–20 seconds.</p>
    </div>
  );
}

// ── Compare tab ────────────────────────────────────────────────────────────────
function CompareTab() {
  const [criteriaA, setCriteriaA] = useState("");
  const [clientA, setClientA] = useState("");
  const [criteriaB, setCriteriaB] = useState("");
  const [clientB, setClientB] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);

  const mutation = useMutation({
    mutationFn: (data: { criteria_a: string; client_a?: string; criteria_b: string; client_b?: string }) =>
      api.post<CompareResult>("/api/analysis/compare", data).then((r) => r.data),
    onError: () => toast.error("Comparison failed. Please try again."),
  });

  async function handleCompare() {
    if (!criteriaA.trim() || !criteriaB.trim()) return;
    const data = await mutation.mutateAsync({
      criteria_a: criteriaA.trim(),
      client_a: clientA.trim() || undefined,
      criteria_b: criteriaB.trim(),
      client_b: clientB.trim() || undefined,
    });
    setResult(data);
  }

  function handleReset() {
    setResult(null);
    setCriteriaA(""); setClientA("");
    setCriteriaB(""); setClientB("");
    mutation.reset();
  }

  const isLoading = mutation.isPending;
  const canRun = criteriaA.trim() && criteriaB.trim() && !isLoading;

  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Compared {new Date(result.created_at).toLocaleString()}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Comparison complete
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New
            </button>
          </div>
        </div>

        {/* Client A */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 rounded-full bg-[#2D1252]" />
            <h2 className="text-sm font-bold text-[#2D1252]">
              {result.client_a ?? "Client A"}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ScopeColumn title="In Scope" items={result.result_a.in_scope ?? []} type="in" />
            <ScopeColumn title="Out of Scope" items={result.result_a.out_of_scope ?? []} type="out" />
            <ScopeColumn title="Future Scope" items={result.result_a.future_scope ?? []} type="future" />
          </div>
        </motion.div>

        <div className="border-t border-gray-100" />

        {/* Client B */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 rounded-full bg-[#F05A28]" />
            <h2 className="text-sm font-bold text-[#2D1252]">
              {result.client_b ?? "Client B"}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ScopeColumn title="In Scope" items={result.result_b.in_scope ?? []} type="in" />
            <ScopeColumn title="Out of Scope" items={result.result_b.out_of_scope ?? []} type="out" />
            <ScopeColumn title="Future Scope" items={result.result_b.future_scope ?? []} type="future" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
        Paste requirements for two clients side-by-side. Both will be analysed in parallel against the same KB.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Client A */}
        <div className="space-y-3 border border-[#2D1252]/20 rounded-xl p-4 bg-[#2D1252]/[0.02]">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-[#2D1252]" />
            <span className="text-sm font-semibold text-[#2D1252]">Client A</span>
          </div>
          <input
            type="text"
            value={clientA}
            onChange={(e) => setClientA(e.target.value)}
            placeholder="Client name (optional)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2D1252]/20 focus:border-[#2D1252]/40 transition-all placeholder:text-gray-400"
          />
          <textarea
            value={criteriaA}
            onChange={(e) => setCriteriaA(e.target.value.slice(0, CHAR_LIMIT))}
            placeholder="Paste Client A's requirements here..."
            rows={10}
            className="w-full px-3 py-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2D1252]/20 focus:border-[#2D1252]/40 transition-all resize-none placeholder:text-gray-400 font-mono leading-relaxed"
          />
        </div>

        {/* Client B */}
        <div className="space-y-3 border border-[#F05A28]/20 rounded-xl p-4 bg-[#F05A28]/[0.02]">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-[#F05A28]" />
            <span className="text-sm font-semibold text-[#2D1252]">Client B</span>
          </div>
          <input
            type="text"
            value={clientB}
            onChange={(e) => setClientB(e.target.value)}
            placeholder="Client name (optional)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28] transition-all placeholder:text-gray-400"
          />
          <textarea
            value={criteriaB}
            onChange={(e) => setCriteriaB(e.target.value.slice(0, CHAR_LIMIT))}
            placeholder="Paste Client B's requirements here..."
            rows={10}
            className="w-full px-3 py-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28] transition-all resize-none placeholder:text-gray-400 font-mono leading-relaxed"
          />
        </div>
      </div>

      <button
        onClick={handleCompare}
        disabled={!canRun}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all",
          canRun
            ? "bg-[#2D1252] hover:bg-[#3d1a73] text-white shadow-sm"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        )}
      >
        {isLoading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Comparing in parallel...
          </>
        ) : (
          <><GitCompare className="w-4 h-4" />Compare Clients</>
        )}
      </button>
      <p className="text-center text-xs text-gray-400">Both analyses run in parallel. Takes 15–30 seconds.</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const [tab, setTab] = useState<Tab>("analyse");

  const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "analyse", label: "Analyse", icon: BarChart3 },
    { id: "compare", label: "Compare", icon: GitCompare },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F05A28]/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[#F05A28]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#2D1252]">Analysis Engine</h1>
              <p className="text-xs text-gray-500">Categorize requirements against iMocha's capabilities</p>
            </div>
          </div>
          {/* Tab switcher */}
          <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  tab === id
                    ? "bg-white text-[#2D1252] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "analyse" ? <AnalyseTab /> : <CompareTab />}
      </div>
    </div>
  );
}
