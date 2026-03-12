"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, Database, BarChart3, FileText, TrendingUp, ChevronLeft, ChevronRight, LogOut, Settings, ScanSearch } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getInitials } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/knowledge-base", label: "Knowledge Base", icon: Database },
  { href: "/analysis", label: "Analysis", icon: BarChart3 },
  { href: "/rfp-analyzer", label: "RFP Analyzer", icon: ScanSearch },
  { href: "/rfp", label: "RFP", icon: FileText },
];

const ADMIN_ITEMS = [
  { href: "/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavItem({
  href, label, icon: Icon, collapsed,
}: { href: string; label: string; icon: React.ElementType; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  const item = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 relative group",
        isActive
          ? "text-[#F05A28] bg-[#F05A28]/10"
          : "text-white/60 hover:text-white hover:bg-white/5"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#F05A28] rounded-r-full" />
      )}
      <Icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-[#F05A28]")} />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={item} />
        <TooltipContent side="right" className="font-medium">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return item;
}

export function AppSidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { user } = useAuthStore();
  const { logout } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <TooltipProvider delay={200}>
      <motion.aside
        animate={{ width: sidebarCollapsed ? 68 : 260 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex flex-col h-screen flex-shrink-0 overflow-hidden"
        style={{ backgroundColor: "#1C0A38" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-base flex-shrink-0"
            style={{ background: "#F05A28" }}>
            i
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="text-white font-bold text-sm leading-none">iMocha</p>
                <p className="text-[#F05A28] text-[10px] mt-0.5 font-medium">Intelligence Hub</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.href} {...item} collapsed={sidebarCollapsed} />
          ))}

          {isAdmin && (
            <>
              <div className={cn("my-3 border-t border-white/10", sidebarCollapsed ? "mx-2" : "mx-1")} />
              {!sidebarCollapsed && (
                <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">Admin</p>
              )}
              {ADMIN_ITEMS.map((item) => (
                <NavItem key={item.href} {...item} collapsed={sidebarCollapsed} />
              ))}
            </>
          )}
        </nav>

        {/* User + collapse */}
        <div className="border-t border-white/10 p-2 space-y-1">
          {/* User info */}
          {user && (
            <div className={cn("flex items-center gap-3 px-2 py-2", sidebarCollapsed && "justify-center")}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: "#F05A28" }}>
                {getInitials(user.name)}
              </div>
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="overflow-hidden flex-1 min-w-0"
                  >
                    <p className="text-white text-xs font-medium truncate">{user.name}</p>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 mt-0.5 border-[#F05A28]/50 text-[#F05A28]">
                      {user.role}
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Logout */}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors text-sm"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  <AnimatePresence>
                    {!sidebarCollapsed && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        Logout
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              }
            />
            {sidebarCollapsed && <TooltipContent side="right">Logout</TooltipContent>}
          </Tooltip>

          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center py-2 rounded-lg text-white/30 hover:text-white/60 transition-colors"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
