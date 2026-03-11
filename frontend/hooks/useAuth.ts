"use client";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api/auth";

export function useAuth() {
  const { accessToken, user, setAuth, clear, isAdmin } = useAuthStore();
  const router = useRouter();

  async function login(email: string, password: string) {
    const data = await authApi.login({ email, password });
    setAuth(data.access_token, data.user);
    document.cookie = `im_access=${data.access_token}; path=/; max-age=900; SameSite=Strict`;
    router.push("/chat");
  }

  async function logout() {
    try { await authApi.logout(); } catch {}
    clear();
    document.cookie = "im_access=; max-age=0; path=/";
    router.push("/login");
  }

  return { user, accessToken, isAdmin, login, logout };
}
