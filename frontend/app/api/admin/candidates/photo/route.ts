import { NextRequest } from "next/server";
import { forwardAdminRequest } from "../../_utils";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  return forwardAdminRequest(req, "/admin/candidates/photo", {
    method: "POST",
    body: formData,
  });
}
