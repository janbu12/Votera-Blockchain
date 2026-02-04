import { NextRequest } from "next/server";
import { forwardAdminRequest } from "../../../_utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardAdminRequest(req, `/admin/users/${id}/toggle`, { method: "POST" });
}
