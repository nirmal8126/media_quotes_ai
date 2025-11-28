import AdminSidebar from '@/components/admin/AdminSidebar';
import { supabaseAdmin } from '@/lib/supabase';

export default async function AdminModuleAutomationsPage() {
  const { data, error } = await supabaseAdmin
    .from('activity_logs')
    .select('id, user_name, action_description, created_at, plan_tier, metadata')
    .ilike('action_description', '%automation%')
    .order('created_at', { ascending: false })
    .limit(30);

  const runs = data ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-[240px,1fr]">
        <AdminSidebar title="Automation agent" />
        <main className="px-8 py-10">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Agent logs</p>
              <h2 className="text-3xl font-semibold">Automation runs</h2>
              <p className="text-sm text-slate-400">This table only shows records that mention automation in their action descriptions.</p>
            </div>
            <div className="text-xs text-slate-400">
              {error ? 'Unable to read Supabase logs' : `${runs.length} runs synced`}
            </div>
          </header>

          <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-sm text-slate-200">
              <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-[0.3em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40">
                {runs.map((run) => (
                  <tr key={run.id} className="bg-slate-950/40">
                    <td className="px-4 py-3 font-semibold text-white">{run.user_name ?? 'Unknown'}</td>
                    <td className="px-4 py-3 text-center text-xs text-orange-300">{run.plan_tier ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{run.action_description}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {run.created_at ? new Date(run.created_at).toLocaleString() : 'Just now'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <pre className="whitespace-pre-wrap" aria-label="metadata">
                        {typeof run.metadata === 'object' && run.metadata ? JSON.stringify(run.metadata) : run.metadata ?? '—'}
                      </pre>
                    </td>
                  </tr>
                ))}
                {!runs.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-slate-500">
                      {error ? 'Failed to load automation logs.' : 'No automation runs captured yet.'}
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
