import AdminSidebar from '@/components/admin/AdminSidebar';
import { supabaseAdmin } from '@/lib/supabase';

const columns = ['Order ID', 'Creator', 'Platform', 'Tone', 'Reels', 'Created'];

export default async function AdminModuleOrdersPage() {
  const { data, error } = await supabaseAdmin
    .from('generated_reels')
    .select('id, user_id, platform, tone, created_at, script')
    .order('created_at', { ascending: false })
    .limit(25);

  const orders = data ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-[240px,1fr]">
        <AdminSidebar title="Reel orders" />
        <main className="px-8 py-10">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">AI orders</p>
              <h2 className="text-3xl font-semibold">Latest generated reels</h2>
              <p className="text-sm text-slate-400">Treat each reel batch as a creator order for auditing.</p>
            </div>
            <span className="text-xs text-slate-400">{error ? 'Failed to read reels' : `${orders.length} orders`}</span>
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
                {orders.map((order) => (
                  <tr key={order.id} className="bg-slate-950/40">
                    <td className="px-4 py-3 font-semibold text-white">{order.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-slate-300">{order.user_id}</td>
                    <td className="px-4 py-3 text-slate-300">{order.platform ?? 'mixed'}</td>
                    <td className="px-4 py-3 text-slate-300">{order.tone ?? 'balanced'}</td>
                    <td className="px-4 py-3 text-slate-300">{order.script ? 'Script ready' : 'Draft'}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {order.created_at ? new Date(order.created_at).toLocaleString() : 'Pending'}
                    </td>
                  </tr>
                ))}
                {!orders.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-sm text-slate-500">
                      {error ? 'Unable to list reels.' : 'No orders yet.'}
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
