import { NextRequest } from "next/server";
import { forwardStudentRequest } from "../../_utils";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  return forwardStudentRequest(req, "/auth/verification/upload", {
    method: "POST",
    body: formData,
  });
}
