import Link from 'next/link';
import { getAdminDashboardData } from '@/lib/admin-data';

export default async function AdminPage() {
  const { metrics, logs, paymentSummary, plans } = await getAdminDashboardData();

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-700 to-purple-600 p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/70">Superadmin console</p>
            <h1 className="text-3xl font-semibold leading-tight">Global health & controls</h1>
            <p className="text-sm text-white/80">Monitor payments, quotas, and automation in one place.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/20">
              View logs
            </button>
            <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-md hover:bg-slate-50">
              Manage plans
            </button>
          </div>
        </div>
        <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2)_0,_transparent_45%)]" />
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl bg-white/80 p-4 shadow ring-1 ring-slate-100">
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{metric.value}</p>
            <p className="text-xs font-medium text-emerald-500">{metric.change}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4 rounded-3xl bg-white/80 p-5 shadow ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Activity logs</p>
              <p className="text-lg font-semibold text-slate-900">Recent actions</p>
            </div>
            <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">Export</button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
            <table className="w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.3em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Activity</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="bg-white">
                    <td className="px-4 py-3 font-semibold text-slate-900">{log.user}</td>
                    <td className="px-4 py-3 text-slate-700">{log.action}</td>
                    <td className="px-4 py-3 text-indigo-600">{log.plan}</td>
                    <td className="px-4 py-3 text-slate-500">{log.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 rounded-3xl bg-white/80 p-5 shadow ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Payments</p>
          <div className="space-y-2">
            {paymentSummary.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="text-xl font-semibold text-slate-900">{item.amount}</p>
                <p className="text-xs text-slate-500">{item.status}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 p-4 text-white shadow">
            <p className="text-sm font-semibold">Quota monitor</p>
            <p className="text-xs text-white/80">Track usage spikes and automation runs.</p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-3xl bg-white/80 p-5 shadow ring-1 ring-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Plans</p>
            <p className="text-lg font-semibold text-slate-900">Membership tiers</p>
          </div>
          <Link
            href="/admin/plans"
            className="rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-100"
          >
            Manage
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                <span className="text-xs text-slate-500">{plan.price}</span>
              </div>
              <p className="mt-2 text-lg font-semibold text-indigo-600">{plan.reels}</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {plan.perks.map((perk) => (
                  <li key={perk}>• {perk}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
