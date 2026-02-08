import { NextRequest } from "next/server";
import { forwardAdminRequest } from "../_utils";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  const includeCampus = req.nextUrl.searchParams.get("includeCampus") ?? "1";
  return forwardAdminRequest(
    req,
    `/admin/verifications?status=${status}&includeCampus=${includeCampus}`
  );
}
