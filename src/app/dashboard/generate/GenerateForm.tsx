"use client";

import { FormEvent, useState } from 'react';

type ScriptResponse = null | {
  script: string;
  shotBreakdown: string[];
  hook: string;
  quota?: { used: number; remaining: number; limit: number };
};

interface GenerateFormProps {
  userId: string | null;
}

export default function GenerateForm({ userId }: GenerateFormProps) {
  const [tone, setTone] = useState('funny');
  const [platform, setPlatform] = useState('instagram');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScriptResponse>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!userId) {
      setError('Sign in to generate reels');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/reels/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tone, platform }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Failed to generate script');
      }

      const payload = await response.json();
      setResult({
        script: payload.script,
        shotBreakdown: payload.shotBreakdown ?? [],
        hook: payload.hook ?? '',
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
      <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white/80 p-6 shadow ring-1 ring-slate-100">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Creator: {userId ? 'Authenticated' : 'Not signed in'}</span>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">Script wizard</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            Brand tone
            <select
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
            >
              <option value="funny">Funny</option>
              <option value="educational">Educational</option>
              <option value="emotional">Emotional</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            Platform
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
            >
              <option value="instagram">Instagram Reels</option>
              <option value="youtube">YouTube Shorts</option>
            </select>
          </label>
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
        <section className="space-y-4 rounded-3xl bg-white/80 p-6 shadow ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Quota</p>
            {result.quota && (
              <p className="text-sm font-semibold text-indigo-600">
                {result.quota.used} / {result.quota.limit} used · {result.quota.remaining} remaining
              </p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Hook</p>
            <p className="text-xl font-semibold text-slate-900">{result.hook}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Script</p>
            <p className="whitespace-pre-line text-sm text-slate-800">{result.script}</p>
          </div>
          {result.shotBreakdown.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Shot breakdown</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {result.shotBreakdown.map((shot) => (
                  <li key={shot}>{shot}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
