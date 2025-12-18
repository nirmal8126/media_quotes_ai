"use client";

import { UploadIcon } from "@/assets/icons";
import InputGroup from "@/components/FormElements/InputGroup";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const PLACEHOLDER_AVATAR = "/images/user/user-03.png";
const PLACEHOLDER_COVER = "/images/cover/cover-01.png";

export function UploadPhotoForm() {
  const [avatarUrl, setAvatarUrl] = useState(PLACEHOLDER_AVATAR);
  const [coverUrl, setCoverUrl] = useState(PLACEHOLDER_COVER);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const isDisabled = status.type === "loading";

  useEffect(() => {
    const load = async () => {
      setStatus({ type: "loading", message: "Loading media..." });
    try {
      const res = await fetch("/api/auth/profile", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to load profile.");
      }
      const profile = body.profile || {};
      setAvatarUrl(profile.avatarUrl || PLACEHOLDER_AVATAR);
      setCoverUrl(profile.coverUrl || PLACEHOLDER_COVER);
      setStatus({ type: "idle" });
      } catch (err) {
        setStatus({ type: "error", message: (err as Error).message });
      }
    };
    void load();
  }, []);

  const helperText = useMemo(() => {
    if (status.type === "error") return status.message;
    if (status.type === "success") return status.message;
    return status.message;
  }, [status]);

  const isUrl = (value?: string) => {
    try {
      if (!value) return false;
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const uploadToStorage = async (file: File, folder: "avatar" | "cover") => {
    const signedRes = await fetch("/api/video-media/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: `${folder}-${file.name}`,
        projectId: folder,
      }),
    });
    const signedBody = await signedRes.json().catch(() => ({}));
    if (!signedRes.ok || !signedBody?.uploadUrl) {
      throw new Error(signedBody?.error || "Unable to get upload URL");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const putRes = await fetch(signedBody.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
        signal: controller.signal,
      });
      if (!putRes.ok) {
        const errText = await putRes.text().catch(() => putRes.statusText);
        throw new Error(`Upload failed (${putRes.status}): ${errText}`);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new Error("Upload timed out. Please try again on a stable connection.");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
    return signedBody.publicUrl || signedBody.path || "";
  };

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>, target: "avatar" | "cover") => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(target);
    setStatus({ type: "loading", message: `Uploading ${target}...` });
    try {
      const publicUrl = await uploadToStorage(file, target);
      if (target === "avatar") {
        setAvatarUrl(publicUrl);
      } else {
        setCoverUrl(publicUrl);
      }
      setStatus({ type: "success", message: "Image uploaded" });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (avatarUrl && !isUrl(avatarUrl)) {
      setStatus({ type: "error", message: "Avatar must be a valid URL." });
      return;
    }
    if (coverUrl && !isUrl(coverUrl)) {
      setStatus({ type: "error", message: "Cover must be a valid URL." });
      return;
    }
    setStatus({ type: "loading", message: "Saving media..." });
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl, coverUrl }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to save media.");
      }
      setStatus({ type: "success", message: "Photos updated" });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    }
  };

  return (
    <ShowcaseSection title="Your Photo" className="!p-7">
      <form onSubmit={handleSubmit} className="space-y-4">
        {helperText && (
          <div
            className={
              status.type === "error"
                ? "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300"
                : status.type === "success"
                  ? "rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-300"
                  : "rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
            }
          >
            {helperText}
          </div>
        )}

        <div className="mb-2 flex items-center gap-3">
          <Image
            src={avatarUrl || PLACEHOLDER_AVATAR}
            width={55}
            height={55}
            alt="User"
            className="size-14 rounded-full object-cover"
            quality={90}
          />

          <div>
            <span className="mb-1.5 font-medium text-dark dark:text-white">
              Avatar URL
            </span>
            <span className="flex gap-3 text-body-sm text-gray-600 dark:text-gray-300">
              Paste an image URL or upload a file.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-4 bg-gray-2 px-3 py-2 text-sm font-semibold text-dark hover:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white">
            <UploadIcon />
            <span>{uploading === "avatar" ? "Uploading..." : "Upload avatar"}</span>
            <input
              type="file"
              name="avatarFile"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void handleFileInput(e, "avatar")}
              disabled={uploading !== null}
            />
          </label>
        </div>

        <InputGroup
          type="url"
          name="avatarUrl"
          label="Avatar URL"
          placeholder="https://cdn.site/avatar.jpg"
          value={avatarUrl}
          handleChange={(e) => setAvatarUrl(e.target.value)}
          height="sm"
          active={!!avatarUrl}
          disabled={isDisabled}
        />

        <div className="mb-2">
          <div className="mb-2 text-body-sm font-medium text-dark dark:text-white">
            Cover URL
          </div>
          <Image
            src={coverUrl || PLACEHOLDER_COVER}
            width={970}
            height={260}
            alt="Cover"
            className="h-32 w-full rounded-lg object-cover"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-4 bg-gray-2 px-3 py-2 text-sm font-semibold text-dark hover:border-primary dark:border-white/20 dark:bg-white/5 dark:text-white">
            <UploadIcon />
            <span>{uploading === "cover" ? "Uploading..." : "Upload cover"}</span>
            <input
              type="file"
              name="coverFile"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void handleFileInput(e, "cover")}
              disabled={uploading !== null}
            />
          </label>
        </div>

        <InputGroup
          type="url"
          name="coverUrl"
          label="Cover URL"
          placeholder="https://cdn.site/cover.jpg"
          value={coverUrl}
          handleChange={(e) => setCoverUrl(e.target.value)}
          height="sm"
          active={!!coverUrl}
          disabled={isDisabled}
        />

        <div className="flex justify-end gap-3 pt-2">
          <button
            className="flex justify-center rounded-lg border border-stroke px-6 py-[7px] font-medium text-dark hover:shadow-1 dark:border-dark-3 dark:text-white"
            type="button"
            onClick={() => {
              setAvatarUrl(PLACEHOLDER_AVATAR);
              setCoverUrl(PLACEHOLDER_COVER);
            }}
            disabled={isDisabled}
          >
            Reset
          </button>
          <button
            className="flex items-center justify-center rounded-lg bg-primary px-6 py-[7px] font-medium text-gray-2 hover:bg-opacity-90 disabled:opacity-60"
            type="submit"
            disabled={isDisabled}
          >
            Save
          </button>
        </div>
      </form>
    </ShowcaseSection>
  );
}
