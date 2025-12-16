import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

type ScriptPayload = {
  id?: string;
  text?: string;
  idea?: string;
  platform?: string;
  tone?: string;
  style?: string;
  personaId?: string | null;
  durationSec?: number | null;
};

type ScriptRow = {
  id: string;
  user_id: string;
  persona_id?: string | null;
  platform?: string | null;
  tone?: string | null;
  style?: string | null;
  duration_sec?: number | null;
  input_prompt?: string | null;
  text: string;
  created_at?: string | null;
  updated_at?: string | null;
};

function mapRow(row: ScriptRow) {
  return {
    id: row.id,
    userId: row.user_id,
    personaId: row.persona_id ?? null,
    platform: row.platform ?? null,
    tone: row.tone ?? null,
    style: row.style ?? null,
    durationSec: row.duration_sec ?? null,
    inputPrompt: row.input_prompt ?? null,
    text: row.text,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function isMissingTable(message?: string) {
  const text = (message || "").toLowerCase();
  return text.includes("relation") && text.includes("does not exist");
}

function clampDuration(value?: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(5, Math.min(Math.round(num), 600));
}

/* List scripts */
export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const limit = Math.max(1, Math.min(Number(searchParams.get("limit")) || 20, 100));
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabaseAdmin
    .from("scripts")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) {
    query = query.or(`text.ilike.%${q}%,input_prompt.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    const status = isMissingTable(error.message) ? 500 : 500;
    const response = NextResponse.json(
      {
        error: isMissingTable(error.message)
          ? 'Table "scripts" is missing. Run web/docs/sql/ai_reels_tables.sql in Supabase.'
          : "Unable to load scripts.",
      },
      { status },
    );
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({
    items: (data ?? []).map(mapRow),
    pagination: { page, limit, total: count ?? 0 },
  });
  applyCookies(response);
  return response;
}

/* Create script */
export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;

  const body = (await request.json().catch(() => ({}))) as ScriptPayload;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const inputPrompt = typeof body.idea === "string" ? body.idea.trim() : "";
  const platform = typeof body.platform === "string" ? body.platform.trim() : null;
  const tone = typeof body.tone === "string" ? body.tone.trim() : null;
  const style = typeof body.style === "string" ? body.style.trim() : null;
  const personaId = typeof body.personaId === "string" && body.personaId.trim() ? body.personaId.trim() : null;
  const durationSec = clampDuration(body.durationSec);

  if (!text) {
    const response = NextResponse.json({ error: "Script text is required." }, { status: 422 });
    applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin
    .from("scripts")
    .insert({
      user_id: user.id,
      persona_id: personaId,
      platform,
      tone,
      style,
      duration_sec: durationSec,
      input_prompt: inputPrompt || null,
      text,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    const response = NextResponse.json(
      {
        error: isMissingTable(error?.message)
          ? 'Table "scripts" is missing. Run web/docs/sql/ai_reels_tables.sql in Supabase.'
          : error?.message || "Unable to create script.",
      },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ script: mapRow(data) });
  applyCookies(response);
  return response;
}

/* Update script */
export async function PATCH(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;

  const body = (await request.json().catch(() => ({}))) as ScriptPayload;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    const response = NextResponse.json({ error: "Script id is required." }, { status: 422 });
    applyCookies(response);
    return response;
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.text === "string") {
    const text = body.text.trim();
    if (!text) {
      const response = NextResponse.json({ error: "Script text cannot be empty." }, { status: 422 });
      applyCookies(response);
      return response;
    }
    updates.text = text;
  }
  if (typeof body.idea === "string") updates.input_prompt = body.idea.trim();
  if (typeof body.platform === "string") updates.platform = body.platform.trim();
  if (typeof body.tone === "string") updates.tone = body.tone.trim();
  if (typeof body.style === "string") updates.style = body.style.trim();
  if (body.personaId !== undefined) {
    updates.persona_id =
      typeof body.personaId === "string" && body.personaId.trim() ? body.personaId.trim() : null;
  }
  if (body.durationSec !== undefined) {
    updates.duration_sec = clampDuration(body.durationSec);
  }
  updates.updated_at = new Date().toISOString();

  if (!Object.keys(updates).length) {
    const response = NextResponse.json({ error: "No fields to update." }, { status: 422 });
    applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin
    .from("scripts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    const response = NextResponse.json({ error: error?.message || "Unable to update script." }, { status: error?.code ? 400 : 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ script: mapRow(data) });
  applyCookies(response);
  return response;
}

/* Delete script */
export async function DELETE(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;

  const body = (await request.json().catch(() => ({}))) as ScriptPayload;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    const response = NextResponse.json({ error: "Script id is required." }, { status: 422 });
    applyCookies(response);
    return response;
  }

  const { error } = await supabaseAdmin.from("scripts").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    const response = NextResponse.json({ error: error.message || "Unable to delete script." }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true });
  applyCookies(response);
  return response;
}
