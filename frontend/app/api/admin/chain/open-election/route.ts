import { NextRequest } from "next/server";
import { forwardAdminRequest } from "../../_utils";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return forwardAdminRequest(req, "/admin/chain/open-election", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
