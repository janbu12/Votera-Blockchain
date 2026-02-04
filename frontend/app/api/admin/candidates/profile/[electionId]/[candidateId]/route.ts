import { NextRequest } from "next/server";
import { forwardAdminRequest } from "../../../../_utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ electionId: string; candidateId: string }> }
) {
  const { electionId, candidateId } = await params;
  return forwardAdminRequest(req, `/admin/candidates/profile/${electionId}/${candidateId}`);
}
