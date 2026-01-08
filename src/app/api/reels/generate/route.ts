import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { startReelGeneration } from "@/lib/reel-service";

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;

  try {
    const body = await request.json().catch(() => ({}));
    const idea = typeof body.idea === "string" ? body.idea.trim() : "";
    const scriptText = typeof body.scriptText === "string" ? body.scriptText.trim() : "";
    const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";

    if (!idea && !scriptText) {
      const response = NextResponse.json(
        { error: "Provide an idea or a script." },
        { status: 422 },
      );
      applyCookies(response);
      return response;
    }

    const payload = {
      idea,
      scriptText,
      channelId: channelId || undefined,
      platform: typeof body.platform === "string" ? body.platform.trim() : undefined,
      language: typeof body.language === "string" ? body.language.trim() : undefined,
      template: typeof body.template === "string" ? body.template.trim() : undefined,
      tone: typeof body.tone === "string" ? body.tone.trim() : undefined,
      style: typeof body.style === "string" ? body.style.trim() : undefined,
      personaId: typeof body.personaId === "string" ? body.personaId.trim() : undefined,
      durationSec: Number.isFinite(Number(body.durationSec)) ? Number(body.durationSec) : undefined,
      withVoiceover: body.withVoiceover !== false,
      audio:
        body.audio && typeof body.audio === "object"
          ? {
              aiVoiceId:
                typeof body.audio.aiVoiceId === "string" ? body.audio.aiVoiceId.trim() : undefined,
            }
          : undefined,
    };

    const result = await startReelGeneration(user, payload);

    if (result.reel.status === "FAILED") {
      const response = NextResponse.json(
        {
          reelId: result.reel.id,
          scriptId: result.script.id,
          status: result.reel.status,
          videoUrl: result.reel.videoUrl,
          thumbnailUrl: result.reel.thumbnailUrl,
          errorMessage: result.reel.errorMessage || "Renderer failed.",
          error: result.reel.errorMessage || "Renderer failed.",
        },
        { status: 500 },
      );
      applyCookies(response);
      return response;
    }

    const response = NextResponse.json({
      reelId: result.reel.id,
      scriptId: result.script.id,
      status: result.reel.status,
      videoUrl: result.reel.videoUrl,
      thumbnailUrl: result.reel.thumbnailUrl,
      errorMessage: result.reel.errorMessage || null,
    });
    applyCookies(response);
    return response;
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message = (error as Error)?.message || "Unable to start reel generation.";
    console.error("reels/generate failed", error);
    const response = NextResponse.json({ error: message }, { status });
    applyCookies(response);
    return response;
  }
}
