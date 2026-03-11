"use client";
import { create } from "zustand";
import type { Citation } from "@/types";

interface UIState {
  sidebarCollapsed: boolean;
  rfpMode: "responder" | "generator";
  citationSheetOpen: boolean;
  activeCitation: Citation | null;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setRFPMode: (mode: "responder" | "generator") => void;
  openCitation: (citation: Citation) => void;
  closeCitation: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  rfpMode: "responder",
  citationSheetOpen: false,
  activeCitation: null,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setRFPMode: (mode) => set({ rfpMode: mode }),
  openCitation: (citation) => set({ citationSheetOpen: true, activeCitation: citation }),
  closeCitation: () => set({ citationSheetOpen: false, activeCitation: null }),
}));
