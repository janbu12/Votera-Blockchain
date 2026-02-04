import { NextRequest } from "next/server";
import { forwardAdminRequest } from "../../_utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ electionId: string }> }
) {
  const { electionId } = await params;
  return forwardAdminRequest(req, `/admin/results/${electionId}`, { method: "GET" });
}
