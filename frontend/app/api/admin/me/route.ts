import { NextRequest, NextResponse } from "next/server";
import { forwardAdminRequest, getAdminToken } from "../_utils";

export async function GET(req: NextRequest) {
  const token = getAdminToken(req);
  if (!token) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return forwardAdminRequest(req, "/admin/me");
}
