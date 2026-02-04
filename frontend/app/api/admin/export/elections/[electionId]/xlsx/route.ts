import { getAdminToken } from "@/app/api/admin/_utils";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ electionId: string }> }
) {
  const { electionId } = await params;
  const token = getAdminToken(req);
  if (!token) {
    return NextResponse.json({ ok: false, reason: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${BACKEND_URL}/admin/export/elections/${electionId}/xlsx`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: res.status,
    headers: {
      "Content-Type":
        res.headers.get("Content-Type") ??
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        res.headers.get("Content-Disposition") ??
        `attachment; filename=\"election-${electionId}-results.xlsx\"`,
    },
  });
}
