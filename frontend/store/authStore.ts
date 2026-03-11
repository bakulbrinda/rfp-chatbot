"use client";
import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clear: () => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
  isAdmin: () => get().user?.role === "admin",
}));
