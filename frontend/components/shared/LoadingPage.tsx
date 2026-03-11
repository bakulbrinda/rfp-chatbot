import { Loader2 } from "lucide-react";

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F05A28] flex items-center justify-center animate-pulse">
          <span className="text-white font-black text-lg">i</span>
        </div>
        <Loader2 className="w-5 h-5 text-[#F05A28] animate-spin" />
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    </div>
  );
}
