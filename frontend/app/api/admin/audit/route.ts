import { NextRequest } from "next/server";
import { forwardAdminRequest } from "../_utils";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");
  const query = new URLSearchParams();
  if (limit) query.set("limit", limit);
  if (offset) query.set("offset", offset);
  const qs = query.toString();
  return forwardAdminRequest(
    req,
    `/admin/audit${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
    }
  );
}
