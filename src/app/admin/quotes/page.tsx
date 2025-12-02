import { supabaseAdmin } from '@/lib/supabase';

type QuoteRow = {
  id: string;
  user_id: string | null;
  persona: string | null;
  tone: string | null;
  language: string | null;
  quotes: string[] | null;
  created_at: string | null;
};

export default async function AdminQuotesPage() {
  const { data } = await supabaseAdmin
    .from('quotes')
    .select('id, user_id, persona, tone, language, quotes, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const rows = (data ?? []) as QuoteRow[];

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/70">Quotes</p>
            <h1 className="text-2xl font-semibold leading-tight">Recent quote packs</h1>
            <p className="text-sm text-white/80">Monitor generated quote packs across users.</p>
          </div>
        </div>
        <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25)_0,_transparent_45%)]" />
      </section>

      <section className="space-y-3 rounded-3xl bg-white/80 p-5 shadow ring-1 ring-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Quote packs</p>
            <p className="text-lg font-semibold text-slate-900">Latest</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{rows.length} shown</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{row.language ?? 'en'}</span>
                <span>{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{row.persona || 'Generic persona'}</p>
              <p className="text-xs text-slate-500">Tone: {row.tone || 'default'}</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {(row.quotes ?? []).slice(0, 4).map((quote, idx) => (
                  <li key={idx}>• {quote}</li>
                ))}
              </ul>
            </article>
          ))}
          {rows.length === 0 && <p className="text-sm text-slate-500">No quotes generated yet.</p>}
        </div>
      </section>
    </div>
  );
}
