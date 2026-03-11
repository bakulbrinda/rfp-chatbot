export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <div className="w-7 h-7 rounded-full bg-[#F05A28] flex items-center justify-center flex-shrink-0">
        <span className="text-white font-black text-xs">i</span>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-white rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
