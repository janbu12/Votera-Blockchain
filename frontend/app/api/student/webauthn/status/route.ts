import { NextRequest } from "next/server";
import { forwardStudentRequest } from "../../_utils";

export async function GET(req: NextRequest) {
  return forwardStudentRequest(req, "/auth/webauthn/status", {
    method: "GET",
  });
}
