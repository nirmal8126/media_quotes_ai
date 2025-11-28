import AdminSidebar from '@/components/admin/AdminSidebar';
import { planCatalog } from '@/lib/payments';
import { PlanTier } from '@/lib/plan';
import { supabaseAdmin } from '@/lib/supabase';

const formatRupees = (value: number) => `₹${(value / 100).toLocaleString('en-IN')}`;

type SubscriptionRow = {
  id: string;
  userId: string;
  provider: string;
  planTier: PlanTier | string;
  status: string;
  amount: number;
  createdAt: string | null;
};

const columns = ['Creator', 'Provider', 'Plan', 'Status', 'Amount', 'When'];

export default async function AdminModulePaymentsPage() {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id, user_id, provider, plan_tier, status, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  const rows: SubscriptionRow[] = (data ?? []).map((subscription) => {
    const tier = (subscription.plan_tier ?? 'standard') as PlanTier;
    const metadataAmount = Number(subscription.metadata?.amount ?? NaN);
    const amount = Number.isFinite(metadataAmount)
      ? metadataAmount
      : planCatalog[tier]?.amount ?? 0;

    return {
      id: subscription.id,
      userId: subscription.user_id ?? 'Unknown',
      provider: subscription.provider ?? 'stripe',
      planTier: tier,
      status: subscription.status ?? 'pending',
      amount,
      createdAt: subscription.created_at ?? null,
    };
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-[240px,1fr]">
        <AdminSidebar title="Payments" />
        <main className="px-8 py-10">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Billing audit</p>
              <h2 className="text-3xl font-semibold">Subscription ledger</h2>
              <p className="text-sm text-slate-400">The most recent 30 subscription records from Stripe & Razorpay.</p>
            </div>
            <span className="text-xs text-slate-400">{error ? 'Supabase offline' : `${rows.length} records`}</span>
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
                {rows.map((row) => (
                  <tr key={row.id} className="bg-slate-950/40">
                    <td className="px-4 py-3 font-semibold text-white">{row.userId}</td>
                    <td className="px-4 py-3 text-slate-300 capitalize">{row.provider}</td>
                    <td className="px-4 py-3 text-slate-300 uppercase tracking-[0.2em] text-xs">{row.planTier}</td>
                    <td className="px-4 py-3 text-slate-300">{row.status}</td>
                    <td className="px-4 py-3 text-slate-300">{formatRupees(row.amount)}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : 'Pending'}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-sm text-slate-500">
                      {error ? 'Unable to read subscription table.' : 'No subscriptions yet.'}
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
