"use client";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/authStore";
import { useAuth } from "@/hooks/useAuth";
import { getInitials } from "@/lib/utils";

const PATH_LABELS: Record<string, string> = {
  "/chat": "Chat",
  "/knowledge-base": "Knowledge Base",
  "/analysis": "Analysis Engine",
  "/rfp": "RFP Module",
  "/analytics": "Analytics",
};

export function TopHeader() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { logout } = useAuth();

  const segment = "/" + (pathname.split("/")[1] || "");
  const pageLabel = PATH_LABELS[segment] || "Dashboard";

  return (
    <header className="h-16 bg-white border-b border-[#2D1252]/10 flex items-center justify-between px-6 sticky top-0 z-40 flex-shrink-0">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <span className="text-gray-400">iMocha</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
        <span className="font-semibold text-[#2D1252]">{pageLabel}</span>
      </nav>

      {/* User menu */}
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className="flex items-center gap-2.5 rounded-full pr-1 pl-1 py-1 hover:bg-gray-50 transition-colors"
                aria-label="User menu"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: "#F05A28" }}>
                  {getInitials(user.name)}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-[#2D1252] leading-none">{user.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{user.role}</p>
                </div>
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-gray-500 font-normal">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
