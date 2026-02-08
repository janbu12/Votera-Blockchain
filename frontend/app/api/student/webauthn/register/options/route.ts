import { NextRequest } from "next/server";
import { forwardStudentRequest } from "../../../_utils";

export async function POST(req: NextRequest) {
  return forwardStudentRequest(req, "/auth/webauthn/register/options", {
    method: "POST",
  });
}
