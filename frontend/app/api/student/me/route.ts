import { NextRequest, NextResponse } from "next/server";
import { forwardStudentRequest, getStudentToken } from "../_utils";

export async function GET(req: NextRequest) {
  const token = getStudentToken(req);
  if (!token) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return forwardStudentRequest(req, "/auth/me");
}
