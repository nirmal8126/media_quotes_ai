import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET =
  process.env.MEDIA_BUCKET ||
  process.env.RENDERER_MEDIA_BUCKET ||
  process.env.NEXT_PUBLIC_MEDIA_BUCKET ||
  "media";

function buildPath(filename: string, projectId?: string) {
  const safeName = filename.replace(/[^\w.\-]/g, "_");
  const prefix = projectId ? `${projectId}/` : "";
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
}

async function ensureBucketExists() {
  const { data, error } = await supabaseAdmin.storage.getBucket(BUCKET);
  if (data) return true;
  if (error && error.message && error.message.toLowerCase().includes("not found")) {
    const { error: createErr } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: "20MB",
    });
    if (createErr) throw createErr;
    return true;
  }
  if (error) throw error;
  return true;
}

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { applyCookies } = session;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const response = NextResponse.json(
      { error: "Supabase credentials missing for uploads" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const filename = (body.filename ?? "upload.bin").toString();
  const projectId = (body.projectId ?? "").toString().trim() || undefined;
  const path = buildPath(filename, projectId);

  try {
    await ensureBucketExists();
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data?.signedUrl || !data?.path) {
      throw new Error(error?.message || "Unable to create signed upload url");
    }

    const { data: publicInfo } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path);

    const response = NextResponse.json({
      bucket: BUCKET,
      path: data.path,
      uploadUrl: data.signedUrl,
      headers: { "Content-Type": "application/octet-stream" },
      publicUrl: publicInfo?.publicUrl || null,
    });
    applyCookies(response);
    return response;
  } catch (err) {
    const response = NextResponse.json(
      { error: (err as Error).message || "Unable to create upload URL" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}
