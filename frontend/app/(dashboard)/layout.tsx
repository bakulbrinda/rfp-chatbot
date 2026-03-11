"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { TopHeader } from "@/components/shell/TopHeader";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, setAuth, clear } = useAuthStore();
  const router = useRouter();

  // Rehydrate auth on cold load (page refresh)
  useEffect(() => {
    if (!user) {
      authApi
        .refresh()
        .then((data) => {
          authApi.me().then((me) => {
            setAuth(data.access_token, me);
            document.cookie = `im_access=${data.access_token}; path=/; max-age=900; SameSite=Strict`;
          });
        })
        .catch(() => {
          clear();
          router.replace("/login");
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F7FC]">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
