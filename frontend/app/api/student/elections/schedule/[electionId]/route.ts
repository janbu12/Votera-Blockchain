import { NextRequest } from "next/server";
import { forwardStudentRequest } from "../../../_utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ electionId: string }> }
) {
  const { electionId } = await params;
  return forwardStudentRequest(req, `/auth/elections/schedule/${electionId}`);
}
