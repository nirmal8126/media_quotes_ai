"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';

type ScriptResponse = null | {
  items: string[];
  quota?: { used: number; remaining: number; limit: number };
};

interface GenerateFormProps {
  userId: string | null;
}

type MetaDefaults = {
  platforms: string[];
  tones: string[];
  formats: string[];
  niches: string[];
};

export default function GenerateForm({ userId }: GenerateFormProps) {
  const [tone, setTone] = useState('');
  const [platform, setPlatform] = useState('');
  const [contentType, setContentType] = useState<'caption' | 'short' | 'long'>('caption');
  const [idea, setIdea] = useState('');
  const [variations, setVariations] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScriptResponse>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<MetaDefaults>({ platforms: [], tones: [], formats: [], niches: [] });
  const [metaStatus, setMetaStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    const loadMeta = async () => {
      setMetaStatus('loading');
    try {
      const res = await fetch('/api/meta');
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        const next = {
            platforms: payload.platforms ?? [],
            tones: payload.tones ?? [],
            formats: payload.formats ?? [],
            niches: payload.niches ?? [],
          };
          setMeta(next);
          setMetaStatus('ready');
        } else {
          setMetaStatus('error');
        }
      } catch (error) {
        setMetaStatus('error');
      }
    };
    loadMeta();
  }, []);

  const toneOptions = useMemo(() => (meta.tones.length ? meta.tones : ['funny', 'educational', 'emotional']), [meta.tones]);
  const platformOptions = useMemo(
    () => (meta.platforms.length ? meta.platforms : ['instagram', 'youtube', 'tiktok', 'twitter']),
    [meta.platforms],
  );

  useEffect(() => {
    if (!tone && toneOptions[0]) setTone(toneOptions[0]);
  }, [tone, toneOptions]);

  useEffect(() => {
    if (!platform && platformOptions[0]) setPlatform(platformOptions[0]);
  }, [platform, platformOptions]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!userId) {
      setError('Sign in to generate reels');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const endpoint = contentType === 'caption' ? '/api/reels/caption' : '/api/reels/script';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tone, platform }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to generate');
      }

      const items: string[] = [];
      if (contentType === 'caption') {
        if (payload.caption) items.push(payload.caption.caption ?? payload.caption);
      } else {
        if (payload.hook) items.push(`Hook: ${payload.hook}`);
        if (payload.script) items.push(payload.script);
        if (Array.isArray(payload.shotBreakdown)) {
          items.push(...payload.shotBreakdown);
        }
      }

      setResult({
        items: items.slice(0, variations),
        quota: payload.quota,
      });
    } catch (err) {
      setError((err as Error).message || 'Something went wrong');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white p-6 shadow ring-1 ring-slate-100">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Creator: {userId ? 'Authenticated' : 'Not signed in'}</span>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
            {contentType === 'caption' ? 'Caption wizard' : 'Script wizard'}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            Content type
            <select
              value={contentType}
              onChange={(event) => setContentType(event.target.value as 'caption' | 'short' | 'long')}
              className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
            >
              <option value="caption">Caption</option>
              <option value="short">Short Script</option>
              <option value="long">Long Script</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            Brand tone
            <select
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
            >
              {toneOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            Platform
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
            >
              {platformOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-2 text-sm text-slate-600">
          Idea / description
          <textarea
            className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
            rows={4}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Describe your idea or hook..."
          />
        </label>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">
            # of variations: {variations}
            {metaStatus === 'loading' && ' · loading defaults...'}
          </span>
          <input
            type="range"
            min={1}
            max={5}
            value={variations}
            onChange={(e) => setVariations(Number(e.target.value))}
            className="h-2 w-64 rounded-full bg-slate-200 accent-indigo-500"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
          disabled={isLoading || !userId}
        >
          {isLoading ? 'Generating...' : userId ? 'Generate script' : 'Sign in to generate'}
        </button>
      </form>
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</p>}
      {result && (
        <section className="space-y-4 rounded-3xl bg-white p-6 shadow ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Results</p>
            {result.quota && (
              <p className="text-sm font-semibold text-indigo-600">
                {result.quota.used} / {result.quota.limit} used · {result.quota.remaining} remaining
              </p>
            )}
          </div>
          <div className="grid gap-3">
            {result.items.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-sm text-slate-800">{item}</p>
                <div className="ml-3 flex flex-col gap-2 text-xs">
                  <button className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-600 ring-1 ring-indigo-100">Copy</button>
                  <button className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">Save</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
