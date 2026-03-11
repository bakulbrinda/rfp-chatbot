"use client";
import { useState } from "react";
import { FileText, Sparkles, RotateCcw, MessageSquare, FilePlus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRFPRespond, useRFPGenerate } from "@/hooks/useRFP";
import { RFPAnswerCard } from "@/components/rfp/RFPAnswerCard";
import { RFPDocumentView } from "@/components/rfp/RFPDocumentView";
import type { RFPAnswer, RFPDocument } from "@/lib/api/analysis";

type Mode = "respond" | "generate";

const MODES: { id: Mode; label: string; icon: typeof MessageSquare; desc: string }[] = [
  {
    id: "respond",
    label: "RFP Responder",
    icon: MessageSquare,
    desc: "Paste an RFP and get structured answers grounded in your KB",
  },
  {
    id: "generate",
    label: "RFP Generator",
    icon: FilePlus,
    desc: "Describe a client brief and generate a full RFP response document",
  },
];

const CHAR_LIMIT = 10000;

export default function RFPPage() {
  const [mode, setMode] = useState<Mode>("respond");
  const [rfpText, setRfpText] = useState("");
  const [clientBrief, setClientBrief] = useState("");
  const [clientName, setClientName] = useState("");

  const [respondResult, setRespondResult] = useState<RFPAnswer[] | null>(null);
  const [generateResult, setGenerateResult] = useState<{ rfp: RFPDocument; client_name: string | null } | null>(null);

  const respondMutation = useRFPRespond();
  const generateMutation = useRFPGenerate();

  const isLoading = respondMutation.isPending || generateMutation.isPending;

  async function handleRun() {
    if (mode === "respond") {
      if (!rfpText.trim()) return;
      const data = await respondMutation.mutateAsync({ rfp_text: rfpText.trim() });
      setRespondResult(data.answers);
    } else {
      if (!clientBrief.trim()) return;
      const data = await generateMutation.mutateAsync({
        client_brief: clientBrief.trim(),
        client_name: clientName.trim() || undefined,
      });
      setGenerateResult(data);
    }
  }

  function handleReset() {
    setRespondResult(null);
    setGenerateResult(null);
    setRfpText("");
    setClientBrief("");
    setClientName("");
    respondMutation.reset();
    generateMutation.reset();
  }

  const hasResult = respondResult !== null || generateResult !== null;
  const inputText = mode === "respond" ? rfpText : clientBrief;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F05A28]/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#F05A28]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#2D1252]">RFP Module</h1>
              <p className="text-xs text-gray-500">Respond to RFPs or generate full proposal documents</p>
            </div>
          </div>
          {hasResult && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Start over
            </button>
          )}
        </div>

        {/* Mode tabs */}
        {!hasResult && (
          <div className="flex gap-2 mt-4">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    mode === m.id
                      ? "bg-[#F05A28] text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {m.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!hasResult ? (
          /* Input Form */
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Mode description */}
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
              {MODES.find((m) => m.id === mode)?.desc}
            </p>

            {/* Client name (generate mode only) */}
            {mode === "generate" && (
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
            )}

            {/* Text area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {mode === "respond" ? "RFP Document / Questions" : "Client Brief"}
              </label>
              <div className="relative">
                <textarea
                  value={mode === "respond" ? rfpText : clientBrief}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, CHAR_LIMIT);
                    mode === "respond" ? setRfpText(val) : setClientBrief(val);
                  }}
                  placeholder={
                    mode === "respond"
                      ? "Paste the RFP document or list of questions here..."
                      : "Describe the client's needs, context, and goals..."
                  }
                  rows={16}
                  className="w-full px-4 py-3.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28] transition-all resize-none placeholder:text-gray-400 font-mono leading-relaxed"
                />
                <div className={cn(
                  "absolute bottom-3 right-3 text-[10px] font-medium",
                  inputText.length > CHAR_LIMIT * 0.9 ? "text-amber-500" : "text-gray-400"
                )}>
                  {inputText.length.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Submit button */}
            <button
              onClick={handleRun}
              disabled={!inputText.trim() || isLoading}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all",
                inputText.trim() && !isLoading
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
                  {mode === "respond" ? "Generating answers..." : "Generating RFP document..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {mode === "respond" ? "Answer RFP Questions" : "Generate RFP Response"}
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-400">
              {mode === "respond"
                ? "Each question will be answered with grounded KB citations. Takes 15–30 seconds."
                : "A structured proposal document will be generated. Takes 20–40 seconds."}
            </p>
          </div>
        ) : (
          /* Results */
          <div className="space-y-4">
            {/* Result summary bar */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {respondResult
                  ? `${respondResult.length} questions answered`
                  : generateResult?.client_name
                  ? `RFP document generated for ${generateResult.client_name}`
                  : "RFP document generated"}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Complete
              </div>
            </div>

            {/* RFP Respond results */}
            {respondResult && (
              <div className="space-y-3">
                {respondResult.map((item, i) => (
                  <RFPAnswerCard key={i} item={item} index={i} />
                ))}
              </div>
            )}

            {/* RFP Generate results */}
            {generateResult && (
              <RFPDocumentView
                doc={generateResult.rfp}
                clientName={generateResult.client_name}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
