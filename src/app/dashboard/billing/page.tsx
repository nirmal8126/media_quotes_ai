const plans = [
  {
    name: 'Basic',
    price: '$9/mo',
    features: ['Quotes + Captions', '15 quote packs/month', 'Email support'],
  },
  {
    name: 'Pro',
    price: '$29/mo',
    features: ['Scripts + Planner + Graphics', '30 packs/month', 'Priority support'],
  },
  {
    name: 'Agency',
    price: '$99/mo',
    features: ['Bulk 100 quote packs', 'Unlimited brands', 'Dedicated manager'],
  },
];

const tableRows = [
  { type: 'Quote Pack', credits: '-10', date: '2024-12-01', status: 'Used' },
  { type: 'Credit Top-up', credits: '+100', date: '2024-11-29', status: 'Purchased' },
  { type: 'Script Generation', credits: '-5', date: '2024-11-27', status: 'Used' },
];

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Subscription</p>
          <h1 className="text-2xl font-semibold text-slate-900">Plans & Credits</h1>
          <p className="text-sm text-slate-500">Pick a plan and top up credits as you grow.</p>
        </div>
        <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-indigo-600 ring-1 ring-slate-200">
          Secure checkout
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.name} className="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-100">
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-500">{plan.name}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{plan.price}</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {plan.features.map((feat) => (
                <li key={feat} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-400" /> {feat}
                </li>
              ))}
            </ul>
            <button className="mt-5 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-2 text-sm font-semibold text-white shadow hover:opacity-95">
              Subscribe
            </button>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr,0.9fr]">
        <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Credits</p>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Current credits</p>
              <p className="text-3xl font-semibold text-slate-900">180</p>
            </div>
            <button className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-400">
              Buy more credits
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Credits power quote packs, scripts, and graphic generations.</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Tips</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>• Agency plan unlocks bulk quote packs and unlimited brands.</li>
            <li>• Credits roll over month to month for active subscribers.</li>
            <li>• Need a custom plan? Contact support.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Usage</p>
            <p className="text-lg font-semibold text-slate-900">Credits activity</p>
          </div>
          <button className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            Export
          </button>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.25em] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Credits</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableRows.map((row, idx) => (
                <tr key={idx} className="bg-white">
                  <td className="px-4 py-3">{row.type}</td>
                  <td className="px-4 py-3 font-semibold text-indigo-600">{row.credits}</td>
                  <td className="px-4 py-3 text-slate-500">{row.date}</td>
                  <td className="px-4 py-3 text-slate-600">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
