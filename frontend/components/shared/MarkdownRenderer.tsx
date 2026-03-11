"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose prose-sm max-w-none", className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-lg font-bold text-[#2D1252] mt-4 mb-2 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold text-[#2D1252] mt-3 mb-1.5 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-[#2D1252] mt-2 mb-1 first:mt-0">{children}</h3>,
        p: ({ children }) => <p className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="text-sm text-gray-700 leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-[#2D1252]">{children}</strong>,
        em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
        code: ({ children, className: cls }) => {
          const isBlock = cls?.includes("language-");
          if (isBlock) {
            return (
              <code className="block bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono text-gray-800 overflow-x-auto whitespace-pre">
                {children}
              </code>
            );
          }
          return (
            <code className="inline bg-gray-100 rounded px-1 py-0.5 text-xs font-mono text-[#F05A28]">{children}</code>
          );
        },
        pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#F05A28] pl-3 my-2 text-gray-600 italic">{children}</blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} className="text-[#F05A28] hover:underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        hr: () => <hr className="border-gray-200 my-3" />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-xs border-collapse border border-gray-200 rounded">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
        th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-gray-700 border border-gray-200">{children}</th>,
        td: ({ children }) => <td className="px-3 py-2 text-gray-600 border border-gray-200">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
