import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";

const PROTECTED_PATHS = ["/chat", "/knowledge-base", "/analysis", "/rfp", "/analytics"];
const ADMIN_PATHS = ["/analytics"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAdminPath = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const accessToken = req.cookies.get("im_access")?.value;

  if (isProtected) {
    if (!accessToken) {
      const url = new URL("/login", req.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    try {
      const payload = decodeJwt(accessToken);
      if (!payload.exp || payload.exp * 1000 < Date.now()) {
        const url = new URL("/login", req.url);
        url.searchParams.set("refresh", "1");
        url.searchParams.set("redirect", pathname);
        const res = NextResponse.redirect(url);
        res.cookies.delete("im_access");
        return res;
      }
      if (isAdminPath && payload.role !== "admin") {
        return NextResponse.redirect(new URL("/chat", req.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // Redirect authenticated users away from login
  if (pathname === "/login" && accessToken) {
    try {
      const payload = decodeJwt(accessToken);
      if (payload.exp && payload.exp * 1000 > Date.now()) {
        return NextResponse.redirect(new URL("/chat", req.url));
      }
    } catch {}
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
