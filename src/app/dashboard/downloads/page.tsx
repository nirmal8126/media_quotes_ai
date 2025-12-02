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
      <header className="rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
        <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Gallery</p>
        <h1 className="text-2xl font-semibold text-slate-900">Assets library</h1>
        <p className="text-sm text-slate-500">Browse and download generated scripts, captions, and prompts.</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none">
            <option>Type</option>
            <option>Script</option>
            <option>Caption</option>
            <option>Thumbnail prompt</option>
          </select>
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none">
            <option>Niche</option>
            <option>Fitness</option>
            <option>Business</option>
            <option>Travel</option>
          </select>
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none">
            <option>Date</option>
            <option>Latest</option>
            <option>Oldest</option>
          </select>
        </div>
      </header>
      {isLoading && <p className="text-sm text-slate-500">Loading assets...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {records.map((reel) => (
          <article key={reel.id} className="rounded-2xl bg-white p-4 shadow ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{reel.tone ? `${reel.tone} asset` : 'Asset'}</p>
                <p className="text-xs text-slate-500">
                  {reel.platform ?? 'unknown'} · {reel.created_at?.slice(0, 10)}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-100">
                  Edit
                </button>
                <button className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  Download
                </button>
              </div>
            </div>
            {reel.script && <p className="mt-3 text-sm text-slate-800 line-clamp-3">{reel.script}</p>}
            {reel.caption && <p className="text-sm text-slate-800 line-clamp-3">{reel.caption}</p>}
            {reel.thumbnail_prompt && <p className="text-xs text-slate-500">Thumb prompt: {reel.thumbnail_prompt}</p>}
          </article>
        ))}
        {!isLoading && records.length === 0 && <p className="text-sm text-slate-500">No assets yet.</p>}
      </div>
    </div>
  );
}
