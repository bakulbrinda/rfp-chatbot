import { MessageSquare, Zap, Shield, FileText } from "lucide-react";

const SUGGESTIONS = [
  "What are iMocha's key differentiators over HackerRank?",
  "Summarize our enterprise security certifications.",
  "What integrations does iMocha support?",
  "How does iMocha's AI proctoring work?",
];

interface EmptyChatStateProps {
  onSuggestion: (text: string) => void;
}

export function EmptyChatState({ onSuggestion }: EmptyChatStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12 text-center">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-[#F05A28] flex items-center justify-center mb-5 shadow-lg">
        <span className="text-white font-black text-2xl">i</span>
      </div>

      <h2 className="text-xl font-bold text-[#2D1252] mb-1">iMocha Intelligence Hub</h2>
      <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-8">
        Ask me anything about iMocha's products, capabilities, and knowledge base. All answers are grounded in your documents.
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {[
          { icon: Zap, label: "Instant answers" },
          { icon: Shield, label: "Source citations" },
          { icon: FileText, label: "No hallucinations" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-600 shadow-sm">
            <Icon className="w-3.5 h-3.5 text-[#F05A28]" />
            {label}
          </div>
        ))}
      </div>

      {/* Suggested prompts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs text-gray-700 hover:border-[#F05A28]/40 hover:bg-[#F05A28]/5 hover:text-[#2D1252] transition-all shadow-sm font-medium leading-snug"
          >
            <MessageSquare className="w-3 h-3 inline mr-1.5 text-[#F05A28] flex-shrink-0" />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
