import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export function getStudentToken(req: NextRequest) {
  return req.cookies.get("studentToken")?.value ?? null;
}

export async function forwardStudentRequest(
  req: NextRequest,
  endpoint: string,
  init?: RequestInit
) {
  const token = getStudentToken(req);
  if (!token) {
    return NextResponse.json({ ok: false, reason: "Unauthorized" }, { status: 401 });
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
