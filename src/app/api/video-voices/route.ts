import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { listVoicesByLanguage } from "@/lib/video-service";

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { applyCookies } = session;

  const { searchParams } = new URL(request.url);
  const language = (searchParams.get("language") ?? "en").trim().toLowerCase() || "en";

  try {
    const voices = await listVoicesByLanguage(language);
    const response = NextResponse.json({ voices });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to load voices" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}
