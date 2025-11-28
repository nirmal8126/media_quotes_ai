"use client";

import { useEffect, useState } from 'react';

type ReelRecord = {
  id: string;
  script?: string;
  caption?: string;
  tone?: string;
  platform?: string;
  thumbnail_prompt?: string;
  created_at?: string;
};

export default function DownloadsPage() {
  const [records, setRecords] = useState<ReelRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/reels/history', { signal: controller.signal })
      .then((res) => res.json())
      .then((payload) => {
        setRecords(payload?.reels ?? []);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError('Unable to load reel history');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-orange-400">Download hub</p>
          <h1 className="text-3xl font-semibold">Generated reels</h1>
        </header>
        {isLoading && <p className="text-sm text-slate-400">Loading reels...</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <div className="space-y-4">
          {records.map((reel) => (
            <article key={reel.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{reel.tone ? `${reel.tone} reel` : 'Reel'}</p>
                  <p className="text-sm text-slate-400">
                    Platform: {reel.platform ?? 'unknown'} · {reel.created_at?.slice(0, 10)}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200">Download script</button>
                  <button className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200">Download thumbnail</button>
                </div>
              </div>
              {reel.script && <p className="mt-3 text-sm text-slate-300">Script: {reel.script}</p>}
              {reel.caption && <p className="text-sm text-slate-300">Caption: {reel.caption}</p>}
              {reel.thumbnail_prompt && <p className="text-xs text-slate-500">Thumb prompt: {reel.thumbnail_prompt}</p>}
            </article>
          ))}
          {!isLoading && records.length === 0 && <p className="text-sm text-slate-500">No reels generated yet.</p>}
        </div>
      </div>
    </main>
  );
}
