import { NextResponse } from "next/server";
import { requireUser, isSuperAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

const defaultVoices = [
  { name: "Matt", language: "en", gender: "male", tone: "deep", provider: "stub", provider_voice_id: "matt_en", words_per_minute: 150 },
  { name: "Kayla", language: "en", gender: "female", tone: "casual", provider: "stub", provider_voice_id: "kayla_en", words_per_minute: 145 },
  { name: "Adam Stone", language: "en", gender: "male", tone: "radio", provider: "stub", provider_voice_id: "adam_en", words_per_minute: 155 },
  { name: "Aman", language: "hi", gender: "male", tone: "warm", provider: "stub", provider_voice_id: "aman_hi", words_per_minute: 145 },
  { name: "Riya", language: "hi", gender: "female", tone: "bright", provider: "stub", provider_voice_id: "riya_hi", words_per_minute: 140 },
  { name: "Carlos", language: "es", gender: "male", tone: "neutral", provider: "stub", provider_voice_id: "carlos_es", words_per_minute: 145 },
  { name: "Sofia", language: "es", gender: "female", tone: "expressive", provider: "stub", provider_voice_id: "sofia_es", words_per_minute: 140 },
];

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;

  if (!isSuperAdmin(user)) {
    const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    applyCookies(response);
    return response;
  }

  try {
    const { data: existing, error } = await supabaseAdmin.from("video_voices").select("name, language");
    if (error) throw error;

    const existingKeys = new Set((existing ?? []).map((v) => `${v.name?.toLowerCase()}|${v.language?.toLowerCase()}`));
    const toInsert = defaultVoices.filter(
      (v) => !existingKeys.has(`${v.name.toLowerCase()}|${v.language.toLowerCase()}`),
    );

    let inserted = [];
    if (toInsert.length) {
      const { data: ins, error: insErr } = await supabaseAdmin.from("video_voices").insert(toInsert).select("*");
      if (insErr) throw insErr;
      inserted = ins ?? [];
    }

    const response = NextResponse.json({ inserted: inserted.length, skipped: defaultVoices.length - inserted.length });
    applyCookies(response);
    return response;
  } catch (err) {
    const response = NextResponse.json(
      { error: (err as Error).message || "Unable to seed voices" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}
