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
    <div className="space-y-4">
      <header className="rounded-3xl bg-white/80 p-5 shadow ring-1 ring-slate-100">
        <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Download hub</p>
        <h1 className="text-2xl font-semibold text-slate-900">Generated reels</h1>
        <p className="text-sm text-slate-500">Export scripts, captions, prompts, and hashtag packs.</p>
      </header>
      {isLoading && <p className="text-sm text-slate-500">Loading reels...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-4">
        {records.map((reel) => (
          <article key={reel.id} className="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">{reel.tone ? `${reel.tone} reel` : 'Reel'}</p>
                <p className="text-sm text-slate-500">
                  Platform: {reel.platform ?? 'unknown'} · {reel.created_at?.slice(0, 10)}
                </p>
              </div>
              <div className="flex gap-3">
                <button className="rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-100">
                  Download script
                </button>
                <button className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  Download thumbnail
                </button>
              </div>
            </div>
            {reel.script && <p className="mt-3 text-sm text-slate-800">Script: {reel.script}</p>}
            {reel.caption && <p className="text-sm text-slate-800">Caption: {reel.caption}</p>}
            {reel.thumbnail_prompt && <p className="text-xs text-slate-500">Thumb prompt: {reel.thumbnail_prompt}</p>}
          </article>
        ))}
        {!isLoading && records.length === 0 && <p className="text-sm text-slate-500">No reels generated yet.</p>}
      </div>
    </div>
  );
}
