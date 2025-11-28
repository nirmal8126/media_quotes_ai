import Link from 'next/link';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { getAdminDashboardData } from '@/lib/admin-data';

const analyticsData = [
  { label: 'Avg. generation time', value: '22s', helper: 'Across all creators' },
  { label: 'Plan conversion', value: '18%', helper: 'Upgrade rate from free → standard' },
  { label: 'Email open rate', value: '52%', helper: 'Automation plan digests' },
];

const moduleLinks = [
  { label: 'Plans', href: '/admin/plans' },
  { label: 'Generated reels', href: '/admin/reels' },
  { label: 'Content calendar', href: '/admin/calendar' },
  { label: 'Automation runs', href: '/admin/automations' },
  { label: 'Payments', href: '/admin/payments' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Reel categories', href: '/admin/reel-categories' },
  { label: 'Reel platforms', href: '/admin/reel-platforms' },
  { label: 'Users', href: '/admin/users' },
];

export default async function AdminPage() {
  const { metrics, logs, paymentSummary, plans } = await getAdminDashboardData();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-[240px,1fr]">
        <aside className="flex flex-col border-r border-slate-800 bg-slate-900/70 p-6">
          <AdminSidebar
            title="Superadmin"
            moduleLinks={moduleLinks}
            extraLinks={[
              { label: 'Activity Logs', href: '#logs' },
              { label: 'Payments', href: '#payments' },
              { label: 'Membership Plans', href: '#plans' },
            ]}
          />
        </aside>
        <main className="px-8 py-10">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Superadmin console</p>
              <h2 className="text-3xl font-semibold">Global health</h2>
            </div>
            <div className="text-right text-sm text-slate-300">
              <p>Today · {new Date().toLocaleDateString()}</p>
              <p>Active sessions: 312</p>
            </div>
          </header>

          <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <article key={metric.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-sm text-slate-400">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold">{metric.value}</p>
                <p className="text-xs text-slate-500">{metric.change}</p>
              </article>
            ))}
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Analytics</p>
                <span className="text-xs text-slate-400">Realtime insights</span>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {analyticsData.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
                    <p className="text-sm text-slate-400">{item.label}</p>
                    <p className="text-2xl font-semibold">{item.value}</p>
                    <p className="text-xs text-slate-500">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Payments</p>
                <span className="text-xs text-slate-400">Overview</span>
              </div>
              <div className="mt-4 space-y-3">
                {paymentSummary.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-3">
                    <p className="text-sm text-slate-400">{item.label}</p>
                    <p className="text-xl font-semibold">{item.amount}</p>
                    <p className="text-xs text-slate-500">{item.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="modules" className="mt-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Module shortcuts</p>
                <h3 className="text-2xl font-semibold">Jump into any control surface</h3>
              </div>
              <p className="text-sm text-slate-400">Direct links to each admin page</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {moduleLinks.map((module) => (
                <Link
                  key={module.label}
                  href={module.href}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm font-semibold text-white hover:border-orange-400"
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{module.label}</p>
                  <p className="mt-3 text-lg font-semibold text-white">Open {module.label}</p>
                </Link>
              ))}
            </div>
          </section>

          <section id="logs" className="mt-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Activity logs</p>
                <h3 className="text-2xl font-semibold">Recent actions</h3>
              </div>
              <button className="rounded-full border border-orange-500/60 px-4 py-2 text-xs font-semibold text-orange-300">
                Export logs
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-sm text-slate-200">
                <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-[0.3em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Activity</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/40">
                  {logs.map((log) => (
                    <tr key={log.id} className="bg-slate-950/50">
                      <td className="px-4 py-3 font-semibold text-white">{log.user}</td>
                      <td className="px-4 py-3 text-slate-300">{log.action}</td>
                      <td className="px-4 py-3 text-center text-sm text-orange-300">{log.plan}</td>
                      <td className="px-4 py-3 text-slate-400">{log.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="plans" className="mt-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Membership plans</p>
                <h3 className="text-2xl font-semibold">Tier management</h3>
              </div>
              <Link
                href="/admin/plans"
                className="rounded-full border border-orange-500/60 px-4 py-2 text-xs font-semibold text-orange-300"
              >
                Manage plans
              </Link>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {plans.map((plan) => (
                <article key={plan.name} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">{plan.name}</p>
                    <span className="text-xs text-slate-400">{plan.price}</span>
                  </div>
                  <p className="mt-4 text-lg font-semibold">{plan.reels}</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex items-center gap-2">
                        <span className="text-xs text-orange-400">•</span>
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                  <button className="mt-5 w-full rounded-full border border-orange-500/40 px-4 py-2 text-xs font-semibold text-orange-300">
                    Manage
                  </button>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
