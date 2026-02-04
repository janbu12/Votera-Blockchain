import { NextRequest } from "next/server";
import { forwardAdminRequest } from "../_utils";

export async function GET(req: NextRequest) {
  return forwardAdminRequest(req, "/admin/stats");
}
