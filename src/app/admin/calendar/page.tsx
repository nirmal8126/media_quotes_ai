import AdminSidebar from '@/components/admin/AdminSidebar';
import { supabaseAdmin } from '@/lib/supabase';

export default async function AdminModuleCalendarPage() {
  const { data, error } = await supabaseAdmin
    .from('content_calendar')
    .select('id, user_id, reel_id, scheduled_date, best_time, status, platform')
    .order('scheduled_date', { ascending: true })
    .limit(30);

  const entries = (data ?? []).map((entry) => ({
    ...entry,
    scheduled_date: entry.scheduled_date ? new Date(entry.scheduled_date).toLocaleDateString() : '-',
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-[240px,1fr]">
        <AdminSidebar title="Content calendar" />
        <main className="px-8 py-10">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Publishing grid</p>
              <h2 className="text-3xl font-semibold">Scheduled posts</h2>
              <p className="text-sm text-slate-400">Live data pulled from the content calendar table.</p>
            </div>
            <span className="text-xs text-slate-400">{error ? 'Sync issue with Supabase' : `${entries.length} entries`}</span>
          </header>

          <section className="mt-8 space-y-3">
            {entries.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
                <table className="w-full text-sm text-slate-200">
                  <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-[0.3em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3">Platform</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Creator</th>
                      <th className="px-4 py-3">Reel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/40">
                    {entries.map((entry) => (
                      <tr key={entry.id} className="bg-slate-950/40">
                        <td className="px-4 py-3">{entry.scheduled_date}</td>
                        <td className="px-4 py-3 text-center text-slate-300">{entry.platform ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-slate-300">{entry.best_time ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-orange-300">{entry.status ?? 'pending'}</td>
                        <td className="px-4 py-3 text-slate-300 font-semibold">{entry.user_id}</td>
                        <td className="px-4 py-3 text-slate-300">{entry.reel_id ? entry.reel_id.slice(0, 8) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-sm text-slate-400">
                {error ? 'Could not load content calendar entries.' : 'No calendar entries present yet.'}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
