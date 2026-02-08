import { NextRequest } from "next/server";
import { forwardStudentRequest } from "../../../_utils";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return forwardStudentRequest(req, "/auth/webauthn/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
