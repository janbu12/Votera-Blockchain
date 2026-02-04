import { NextRequest } from "next/server";
import { forwardAdminRequest } from "../../_utils";

export async function GET(req: NextRequest) {
  return forwardAdminRequest(req, "/admin/audit/summary", { method: "GET" });
}
