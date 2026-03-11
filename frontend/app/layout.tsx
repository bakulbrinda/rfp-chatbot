import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/shell/Providers";

export const metadata: Metadata = {
  title: "iMocha Intelligence Hub",
  description: "Enterprise RAG-powered knowledge platform for iMocha",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
