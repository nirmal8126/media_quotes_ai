"use client";

import { useEffect, useState } from "react";

type Metadata = {
  tone?: string;
  phrases?: string;
  niches?: string;
  defaultLanguage?: string;
  defaultPlatform?: string;
  defaultFormat?: string;
  lengthLimit?: string;
  theme?: "light" | "dark";
};

export default function SettingsPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [metadata, setMetadata] = useState<Metadata>({
    tone: "",
    phrases: "",
    niches: "",
    defaultLanguage: "en",
    defaultPlatform: "instagram",
    defaultFormat: "quote",
    lengthLimit: "short",
    theme: "light",
  });
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaults, setDefaults] = useState<{
    platforms: string[];
    niches: string[];
    formats: string[];
    tones: string[];
  }>({ platforms: [], niches: [], formats: [], tones: [] });

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        const payload = await res.json().catch(() => ({}));
        if (res.ok && payload.user) {
          setFullName(payload.user.user_metadata?.full_name || payload.user.user_metadata?.fullName || "");
          setEmail(payload.user.email || "");
          const md = payload.user.user_metadata || {};
          setMetadata((prev) => ({
            ...prev,
            tone: md.tone ?? prev.tone,
            phrases: md.phrases ?? prev.phrases,
            niches: md.niches ?? prev.niches,
            defaultLanguage: md.defaultLanguage ?? prev.defaultLanguage,
            defaultPlatform: md.defaultPlatform ?? prev.defaultPlatform,
            defaultFormat: md.defaultFormat ?? prev.defaultFormat,
            lengthLimit: md.lengthLimit ?? prev.lengthLimit,
            theme: md.theme ?? prev.theme,
          }));
        }

        const metaRes = await fetch("/api/meta");
        const metaPayload = await metaRes.json().catch(() => ({}));
        if (metaRes.ok) {
          setDefaults({
            platforms: metaPayload.platforms ?? [],
            niches: metaPayload.niches ?? [],
            formats: metaPayload.formats ?? [],
            tones: metaPayload.tones ?? [],
          });
        }
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: fullName.trim(),
          metadata,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Unable to save settings");
      }
      setStatus("Settings saved");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const updateMeta = (key: keyof Metadata, value: string) => {
    setMetadata((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      <header className="rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
        <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Settings</p>
        <h1 className="text-2xl font-semibold text-slate-900">Profile & Persona</h1>
        <p className="text-sm text-slate-500">
          Configure your profile, AI persona, and default output preferences.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">Loading settings...</p>
      ) : (
        <div className="space-y-4">
          <section className="rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Name
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Email
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  value={email}
                  readOnly
                />
              </label>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Brand Voice (Persona)</h2>
            <p className="text-sm text-slate-500">
              Set the default persona the AI uses for quotes, captions, and scripts.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Tone
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  value={metadata.tone}
                  onChange={(e) => updateMeta("tone", e.target.value)}
                >
                  <option value="">Select a tone</option>
                  {(defaults.tones.length ? defaults.tones : ['motivational', 'professional', 'funny']).map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Signature phrases
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  value={metadata.phrases}
                  onChange={(e) => updateMeta("phrases", e.target.value)}
                  placeholder="Comma-separated phrases the AI should use"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Niches / topics
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  value={metadata.niches}
                  onChange={(e) => updateMeta("niches", e.target.value)}
                >
                  <option value="">Select a niche</option>
                  {(defaults.niches.length ? defaults.niches : ['fitness', 'business', 'travel']).map((niche) => (
                    <option key={niche} value={niche}>
                      {niche}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Default language
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  value={metadata.defaultLanguage}
                  onChange={(e) => updateMeta("defaultLanguage", e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="es">Spanish</option>
                  <option value="ar">Arabic</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Output preferences</h2>
            <p className="text-sm text-slate-500">Defaults applied when generating content.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Default platform
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  value={metadata.defaultPlatform}
                  onChange={(e) => updateMeta("defaultPlatform", e.target.value)}
                >
                  {(defaults.platforms.length ? defaults.platforms : ['instagram', 'tiktok', 'youtube']).map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Default format
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  value={metadata.defaultFormat}
                  onChange={(e) => updateMeta("defaultFormat", e.target.value)}
                >
                  {(defaults.formats.length ? defaults.formats : ['quote', 'caption', 'script', 'hook', 'post']).map((format) => (
                    <option key={format} value={format}>
                      {format}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Word length
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  value={metadata.lengthLimit}
                  onChange={(e) => updateMeta("lengthLimit", e.target.value)}
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Theme preference
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  value={metadata.theme}
                  onChange={(e) => updateMeta("theme", e.target.value)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Subscription & billing</h2>
            <p className="text-sm text-slate-500">View plan, renewal, and credits.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Plan</p>
                <p className="text-lg font-semibold text-slate-900">Standard</p>
                <p className="text-xs text-slate-500">30 reels/mo</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Credits</p>
                <p className="text-lg font-semibold text-slate-900">180</p>
                <p className="text-xs text-slate-500">Use for packs & graphics</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Renewal</p>
                <p className="text-lg font-semibold text-slate-900">Dec 31</p>
                <p className="text-xs text-slate-500">Manage in billing</p>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            {status && <p className="text-xs text-slate-500">{status}</p>}
            <button
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-60"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
