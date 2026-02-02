import { NextRequest } from "next/server";
import { forwardAdminRequest } from "../../../_utils";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  return forwardAdminRequest(req, `/admin/verifications/${params.id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
