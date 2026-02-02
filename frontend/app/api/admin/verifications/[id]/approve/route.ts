import { NextRequest } from "next/server";
import { forwardAdminRequest } from "../../../_utils";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return forwardAdminRequest(req, `/admin/verifications/${params.id}/approve`, {
    method: "POST",
  });
}
