import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const adminMode = (process.env.NEXT_PUBLIC_ADMIN_MODE ?? "wallet").toLowerCase();
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/admin") && adminMode === "relayer") {
    const token = request.cookies.get("adminToken")?.value;
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/mahasiswa")) {
    const token = request.cookies.get("studentToken")?.value;
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/mahasiswa/:path*"],
};
