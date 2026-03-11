"use client";
import { create } from "zustand";

interface ChatState {
  activeSessionId: string | null;
  isStreaming: boolean;
  pendingMessage: string;
  setActiveSession: (id: string | null) => void;
  setStreaming: (v: boolean) => void;
  setPendingMessage: (msg: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeSessionId: null,
  isStreaming: false,
  pendingMessage: "",
  setActiveSession: (id) => set({ activeSessionId: id }),
  setStreaming: (v) => set({ isStreaming: v }),
  setPendingMessage: (msg) => set({ pendingMessage: msg }),
}));
