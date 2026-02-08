import { NextRequest } from "next/server";
import { forwardStudentRequest } from "../../../_utils";

export async function POST(req: NextRequest) {
  return forwardStudentRequest(req, "/auth/webauthn/assert/options", {
    method: "POST",
  });
}
