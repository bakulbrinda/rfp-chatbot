"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";
import { useChatSessions } from "@/hooks/useChatSessions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SessionList() {
  const params = useParams();
  const router = useRouter();
  const activeId = params?.sessionId as string | undefined;
  const { data: sessions, isLoading, deleteSession } = useChatSessions();

  function handleNew() {
    router.push("/chat");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-[#2D1252]">Conversations</h2>
        <Button
          size="sm"
          onClick={handleNew}
          className="h-7 gap-1 text-xs bg-[#F05A28] hover:bg-[#d94e20] text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-2 py-2.5">
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        ) : (sessions ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <MessageSquare className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-xs text-gray-400">No conversations yet</p>
            <p className="text-xs text-gray-300 mt-0.5">Start a new chat above</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {(sessions ?? []).map((session: import("@/types").ChatSession) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "group flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                  activeId === session.id
                    ? "bg-[#F05A28]/10 text-[#2D1252]"
                    : "hover:bg-gray-50 text-gray-700"
                )}
              >
                <Link href={`/chat/${session.id}`} className="flex-1 min-w-0">
                  <p className={cn(
                    "text-xs font-medium truncate leading-snug",
                    activeId === session.id ? "text-[#2D1252]" : "text-gray-800"
                  )}>
                    {session.title || "New conversation"}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {formatRelativeTime(session.created_at)}
                  </p>
                </Link>

                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-300 hover:text-red-400 flex-shrink-0 mt-0.5"
                        aria-label="Delete conversation"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{truncate(session.title || "this conversation", 40)}" and all its messages.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          deleteSession.mutate(session.id);
                          if (activeId === session.id) router.push("/chat");
                        }}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
