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
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-orange-400">Reel generation</p>
          <h1 className="text-3xl font-semibold">New batch</h1>
          <p className="text-slate-300">Choose tone, platform, and let MediaQuotes AI build a 45–60 second script.</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="text-sm text-slate-300">Creator: {userId ? 'Authenticated' : 'Not signed in'}</div>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            Brand tone
            <select value={tone} onChange={(event) => setTone(event.target.value)} className="rounded-2xl border border-slate-700 bg-slate-950/80 p-3 text-sm">
              <option value="funny">Funny</option>
              <option value="educational">Educational</option>
              <option value="emotional">Emotional</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            Platform
            <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="rounded-2xl border border-slate-700 bg-slate-950/80 p-3 text-sm">
              <option value="instagram">Instagram Reels</option>
              <option value="youtube">YouTube Shorts</option>
            </select>
          </label>
          <button
            type="submit"
            className="w-full rounded-full bg-orange-500 py-3 font-semibold text-slate-900 disabled:opacity-60"
            disabled={isLoading || !userId}
          >
            {isLoading ? 'Generating...' : userId ? 'Generate script' : 'Sign in to generate'}
          </button>
        </form>
        {error && <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
        {result && (
          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Quota</p>
              {result.quota && (
                <p className="text-sm text-orange-300">
                  {result.quota.used} / {result.quota.limit} used · {result.quota.remaining} remaining
                </p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Hook</p>
              <p className="text-xl font-semibold text-white">{result.hook}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Script</p>
              <p className="text-sm text-slate-200 whitespace-pre-line">{result.script}</p>
            </div>
            {result.shotBreakdown.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Shot breakdown</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                  {result.shotBreakdown.map((shot) => (
                    <li key={shot}>{shot}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
