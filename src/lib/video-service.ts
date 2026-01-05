import { supabaseAdmin } from "@/lib/supabase";

export type VideoType = "shorts" | "longform";
export type VideoStatus = "draft" | "generating_script" | "editing" | "rendering" | "ready" | "failed";
export type ContentFormat = "faceless" | "fake_text" | "split_screen" | string;
export type InputMode = "topic" | "prompt" | "script" | string;

export type VideoProjectRecord = {
  id: string;
  userId: string;
  title: string;
  videoType: VideoType;
  contentFormat?: ContentFormat | null;
  inputMode?: InputMode | null;
  topic?: string | null;
  prompt?: string | null;
  script?: string | null;
  language?: string | null;
  durationSeconds?: number | null;
  aspectRatio?: string | null;
  narratorVoiceId?: string | null;
  status: VideoStatus;
  settings?: Record<string, unknown> | null;
  error?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type VideoSceneRecord = {
  id: string;
  projectId: string;
  sceneIndex: number;
  label?: string | null;
  script?: string | null;
  prompt?: string | null;
  durationMs?: number | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SceneMediaRecord = {
  id: string;
  projectId: string;
  sceneId?: string | null;
  mediaType: "image" | "video" | "audio" | string;
  source?: string | null;
  url: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
};

export type VideoVoiceRecord = {
  id: string;
  name: string;
  language: string;
  gender?: string | null;
  tone?: string | null;
  provider?: string | null;
  providerVoiceId?: string | null;
  wordsPerMinute?: number | null;
  enabled: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type VideoRenderJobRecord = {
  id: string;
  projectId: string;
  status: "queued" | "processing" | "failed" | "completed";
  previewUrl?: string | null;
  outputUrl?: string | null;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function missingTableMessage(table: string) {
  return `Table "${table}" is missing. Run web/docs/sql/ai_videos_tables.sql in Supabase.`;
}

function isMissingTable(error: { message?: string | null }, table: string) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("relation") && message.includes(table);
}

function mapProject(row: Record<string, any>): VideoProjectRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    videoType: (row.video_type as VideoType) ?? "shorts",
    contentFormat: row.content_format ?? null,
    inputMode: row.input_mode ?? null,
    topic: row.topic ?? null,
    prompt: row.prompt ?? null,
    script: row.script ?? null,
    language: row.language ?? null,
    durationSeconds: row.duration_seconds ?? null,
    aspectRatio: row.aspect_ratio ?? null,
    narratorVoiceId: row.narrator_voice_id ?? null,
    status: (row.status as VideoStatus) ?? "draft",
    settings: row.settings ?? null,
    error: row.error ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function mapScene(row: Record<string, any>): VideoSceneRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    sceneIndex: row.scene_index,
    label: row.label ?? null,
    script: row.script ?? null,
    prompt: row.prompt ?? null,
    durationMs: row.duration_ms ?? null,
    imageUrl: row.image_url ?? null,
    videoUrl: row.video_url ?? null,
    status: row.status ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function mapVoice(row: Record<string, any>): VideoVoiceRecord {
  return {
    id: row.id,
    name: row.name,
    language: row.language ?? "en",
    gender: row.gender ?? null,
    tone: row.tone ?? null,
    provider: row.provider ?? null,
    providerVoiceId: row.provider_voice_id ?? null,
    wordsPerMinute: row.words_per_minute ?? null,
    enabled: row.enabled ?? true,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function mapRenderJob(row: Record<string, any>): VideoRenderJobRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status ?? "queued",
    previewUrl: row.preview_url ?? null,
    outputUrl: row.output_url ?? null,
    error: row.error ?? null,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function createVideoProject(userId: string, payload: {
  title: string;
  videoType?: VideoType;
  contentFormat?: ContentFormat | null;
  inputMode?: InputMode | null;
  topic?: string | null;
  prompt?: string | null;
  script?: string | null;
  language?: string | null;
  durationSeconds?: number | null;
  aspectRatio?: string | null;
  narratorVoiceId?: string | null;
  settings?: Record<string, unknown> | null;
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("video_projects")
    .insert({
      user_id: userId,
      title: payload.title.trim(),
      video_type: payload.videoType ?? "shorts",
      content_format: payload.contentFormat ?? null,
      input_mode: payload.inputMode ?? null,
      topic: payload.topic ?? null,
      prompt: payload.prompt ?? null,
      script: payload.script ?? null,
      language: payload.language ?? "en",
      duration_seconds: payload.durationSeconds ?? null,
      aspect_ratio: payload.aspectRatio ?? "9:16",
      narrator_voice_id: payload.narratorVoiceId ?? null,
      settings: payload.settings ?? null,
      status: "draft",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingTable(error, "video_projects")) {
      throw new Error(missingTableMessage("video_projects"));
    }
    throw error;
  }

  if (!data) throw new Error("No project returned after insert");
  return mapProject(data);
}

export async function listVideoProjects(userId: string, options?: { limit?: number }) {
  const { data, error } = await supabaseAdmin
    .from("video_projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (error) {
    if (isMissingTable(error, "video_projects")) {
      throw new Error(missingTableMessage("video_projects"));
    }
    throw error;
  }

  return (data ?? []).map(mapProject);
}

export async function getVideoProject(userId: string, projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("video_projects")
    .select("*")
    .eq("user_id", userId)
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error, "video_projects")) {
      throw new Error(missingTableMessage("video_projects"));
    }
    throw error;
  }

  return data ? mapProject(data) : null;
}

export async function updateVideoProject(userId: string, projectId: string, payload: Partial<{
  title: string;
  videoType: VideoType;
  contentFormat: ContentFormat | null;
  inputMode: InputMode | null;
  topic: string | null;
  prompt: string | null;
  script: string | null;
  language: string | null;
  durationSeconds: number | null;
  aspectRatio: string | null;
  narratorVoiceId: string | null;
  status: VideoStatus;
  settings: Record<string, unknown> | null;
  error: string | null;
}>) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.title !== undefined) updates.title = payload.title.trim();
  if (payload.videoType !== undefined) updates.video_type = payload.videoType;
  if (payload.contentFormat !== undefined) updates.content_format = payload.contentFormat;
  if (payload.inputMode !== undefined) updates.input_mode = payload.inputMode;
  if (payload.topic !== undefined) updates.topic = payload.topic;
  if (payload.prompt !== undefined) updates.prompt = payload.prompt;
  if (payload.script !== undefined) updates.script = payload.script;
  if (payload.language !== undefined) updates.language = payload.language;
  if (payload.durationSeconds !== undefined) updates.duration_seconds = payload.durationSeconds;
  if (payload.aspectRatio !== undefined) updates.aspect_ratio = payload.aspectRatio;
  if (payload.narratorVoiceId !== undefined) updates.narrator_voice_id = payload.narratorVoiceId;
  if (payload.status !== undefined) updates.status = payload.status;
  if (payload.settings !== undefined) updates.settings = payload.settings;
  if (payload.error !== undefined) updates.error = payload.error;

  const { data, error } = await supabaseAdmin
    .from("video_projects")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", projectId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingTable(error, "video_projects")) {
      throw new Error(missingTableMessage("video_projects"));
    }
    throw error;
  }

  return data ? mapProject(data) : null;
}

export async function upsertScene(projectId: string, sceneIndex: number, payload: Partial<{
  label: string | null;
  script: string | null;
  prompt: string | null;
  durationMs: number | null;
  imageUrl: string | null;
  videoUrl: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
}>) {
  const { data, error } = await supabaseAdmin
    .from("video_scenes")
    .upsert(
      {
        project_id: projectId,
        scene_index: sceneIndex,
        label: payload.label ?? null,
        script: payload.script ?? null,
        prompt: payload.prompt ?? null,
        duration_ms: payload.durationMs ?? null,
        image_url: payload.imageUrl ?? null,
        video_url: payload.videoUrl ?? null,
        status: payload.status ?? null,
        metadata: payload.metadata ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,scene_index" }
    )
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingTable(error, "video_scenes")) {
      throw new Error(missingTableMessage("video_scenes"));
    }
    throw error;
  }

  return data ? mapScene(data) : null;
}

export async function listScenes(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("video_scenes")
    .select("*")
    .eq("project_id", projectId)
    .order("scene_index", { ascending: true });

  if (error) {
    if (isMissingTable(error, "video_scenes")) {
      throw new Error(missingTableMessage("video_scenes"));
    }
    throw error;
  }

  return (data ?? []).map(mapScene);
}

export async function listVoicesByLanguage(language: string) {
  const { data, error } = await supabaseAdmin
    .from("video_voices")
    .select("*")
    .eq("language", language)
    .eq("enabled", true)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTable(error, "video_voices")) {
      throw new Error(missingTableMessage("video_voices"));
    }
    throw error;
  }

  return (data ?? []).map(mapVoice);
}

export async function listMedia(projectId: string, options?: { sceneId?: string; mediaType?: string }) {
  let query = supabaseAdmin.from("scene_media").select("*").eq("project_id", projectId);
  if (options?.sceneId) {
    query = query.eq("scene_id", options.sceneId);
  }
  if (options?.mediaType) {
    query = query.eq("media_type", options.mediaType);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error, "scene_media")) {
      throw new Error(missingTableMessage("scene_media"));
    }
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    sceneId: row.scene_id,
    mediaType: row.media_type,
    source: row.source,
    url: row.url,
    metadata: row.metadata ?? null,
    createdAt: row.created_at ?? null,
  })) as SceneMediaRecord[];
}

export async function upsertMedia(record: {
  projectId: string;
  sceneId?: string | null;
  mediaType: SceneMediaRecord["mediaType"];
  source?: string | null;
  url: string;
  metadata?: Record<string, unknown> | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("scene_media")
    .insert({
      project_id: record.projectId,
      scene_id: record.sceneId ?? null,
      media_type: record.mediaType,
      source: record.source ?? null,
      url: record.url,
      metadata: record.metadata ?? null,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingTable(error, "scene_media")) {
      throw new Error(missingTableMessage("scene_media"));
    }
    throw error;
  }

  if (!data) throw new Error("No media returned after upsert");
  return {
    id: data.id,
    projectId: data.project_id,
    sceneId: data.scene_id ?? null,
    mediaType: data.media_type,
    source: data.source ?? null,
    url: data.url,
    metadata: data.metadata ?? null,
    createdAt: data.created_at ?? null,
  } as SceneMediaRecord;
}

export async function createRenderJob(projectId: string, status: VideoRenderJobRecord["status"] = "queued") {
  const { data, error } = await supabaseAdmin
    .from("video_render_jobs")
    .insert({
      project_id: projectId,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingTable(error, "video_render_jobs")) {
      throw new Error(missingTableMessage("video_render_jobs"));
    }
    throw error;
  }

  return data ? mapRenderJob(data) : null;
}

export async function listRenderJobs(projectId: string, options?: { limit?: number }) {
  const { data, error } = await supabaseAdmin
    .from("video_render_jobs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 10);

  if (error) {
    if (isMissingTable(error, "video_render_jobs")) {
      throw new Error(missingTableMessage("video_render_jobs"));
    }
    throw error;
  }

  return (data ?? []).map(mapRenderJob);
}

export async function updateRenderJob(jobId: string, payload: Partial<{
  status: VideoRenderJobRecord["status"];
  previewUrl: string | null;
  outputUrl: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}>) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.status !== undefined) updates.status = payload.status;
  if (payload.previewUrl !== undefined) updates.preview_url = payload.previewUrl;
  if (payload.outputUrl !== undefined) updates.output_url = payload.outputUrl;
  if (payload.error !== undefined) updates.error = payload.error;
  if (payload.startedAt !== undefined) updates.started_at = payload.startedAt;
  if (payload.completedAt !== undefined) updates.completed_at = payload.completedAt;

  const { data, error } = await supabaseAdmin
    .from("video_render_jobs")
    .update(updates)
    .eq("id", jobId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingTable(error, "video_render_jobs")) {
      throw new Error(missingTableMessage("video_render_jobs"));
    }
    throw error;
  }

  return data ? mapRenderJob(data) : null;
}
