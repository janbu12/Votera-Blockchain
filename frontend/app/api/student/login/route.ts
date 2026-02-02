import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  const token = data.token as string | undefined;
  if (!token) {
    return NextResponse.json({ ok: false, reason: "Token missing" }, { status: 500 });
  }

  const response = NextResponse.json({
    ok: true,
    nim: body.nim,
    mustChangePassword: !!data.mustChangePassword,
  });
  response.cookies.set({
    name: "studentToken",
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
