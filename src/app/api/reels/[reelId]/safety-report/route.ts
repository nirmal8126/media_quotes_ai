import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { computeSafetyReport } from "@/lib/safety-scoring";

type Params = { reelId?: string };

export async function GET(_request: Request, context: { params: Params }) {
  const session = await requireUser(_request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;
  const reelId = (context.params.reelId ?? "").toString().trim();

  if (!reelId) {
    const response = NextResponse.json({ error: "reelId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const report = await computeSafetyReport(reelId, user.id);
    const response = NextResponse.json({ report });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to compute safety report." },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}

