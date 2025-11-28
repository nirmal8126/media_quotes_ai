import AdminSidebar from '@/components/admin/AdminSidebar';
import { supabaseAdmin } from '@/lib/supabase';

type SupabaseUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  plan_tier: string | null;
  created_at: string | null;
  status: string | null;
};

const columns = ['User ID', 'Email', 'Name', 'Plan', 'Joined', 'Status'];

export default async function AdminModuleUsersPage() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, plan_tier, created_at, status')
    .order('created_at', { ascending: false })
    .limit(35);

  const users = (data ?? []) as SupabaseUser[];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-[240px,1fr]">
        <AdminSidebar title="Creator directory" />
        <main className="px-8 py-10">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Supabase users</p>
              <h2 className="text-3xl font-semibold">Active creators</h2>
              <p className="text-sm text-slate-400">Latest signup and plan information from the users table.</p>
            </div>
            <div className="text-right text-sm text-slate-300">
              <p>{error ? 'Unable to reach Supabase' : `${users.length} records`}</p>
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
                {users.map((user) => (
                  <tr key={user.id} className="bg-slate-950/40">
                    <td className="px-4 py-3 font-semibold text-white">{user.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-slate-300">{user.email ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{user.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{user.plan_tier ?? 'free'}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {user.created_at ? new Date(user.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
                      {user.status ?? 'unknown'}
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-sm text-slate-500">
                      {error ? 'Unable to load users. Check Supabase logs.' : 'No users yet.'}
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
