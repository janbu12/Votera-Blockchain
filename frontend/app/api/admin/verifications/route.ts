import { NextRequest } from "next/server";
import { forwardAdminRequest } from "../_utils";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  return forwardAdminRequest(req, `/admin/verifications?status=${status}`);
}
