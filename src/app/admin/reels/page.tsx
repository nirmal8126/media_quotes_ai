import AdminSidebar from '@/components/admin/AdminSidebar';
import { supabaseAdmin } from '@/lib/supabase';

const columns = ['Reel ID', 'Creator', 'Platform', 'Tone', 'Generated', 'Status'];

export default async function AdminModuleReelsPage() {
  const { data, error } = await supabaseAdmin
    .from('generated_reels')
    .select('id, user_id, platform, tone, created_at, script')
    .order('created_at', { ascending: false })
    .limit(25);

  const reels = data ?? [];
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-[240px,1fr]">
        <AdminSidebar title="Generated reels" />
        <main className="px-8 py-10">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">AI outputs</p>
              <h2 className="text-3xl font-semibold">Recently created reels</h2>
              <p className="text-sm text-slate-400">Showing the last 25 generated reel drafts.</p>
            </div>
            <div className="text-right text-sm text-slate-300">
              <p>{error ? 'Unable to reach Supabase' : `${reels.length} records`}</p>
            </div>
          </header>

          <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-sm text-slate-200">
              <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-[0.3em] text-slate-500">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="px-4 py-3">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40">
                {reels.map((reel) => (
                  <tr key={reel.id} className="bg-slate-950/40">
                    <td className="px-4 py-3 font-semibold text-white">{reel.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-slate-300">{reel.user_id}</td>
                    <td className="px-4 py-3 text-slate-300">{reel.platform ?? 'unknown'}</td>
                    <td className="px-4 py-3 text-slate-300">{reel.tone ?? 'balanced'}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {reel.created_at ? new Date(reel.created_at).toLocaleString() : 'Just now'}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
                      {reel.script ? 'Has script' : 'Draft only'}
                    </td>
                  </tr>
                ))}
                {!reels.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-sm text-slate-500">
                      {error ? 'Unable to load reels. Check Supabase logs.' : 'No reels yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </div>
  );
}
