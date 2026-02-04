import { NextRequest } from "next/server";
import { forwardStudentRequest } from "../../../_utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ electionId: string; candidateId: string }> }
) {
  const { electionId, candidateId } = await params;
  return forwardStudentRequest(
    req,
    `/auth/candidates/${electionId}/${candidateId}`
  );
}
