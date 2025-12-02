const quickActions = [
  { label: 'Generate Quote', action: 'quotes' },
  { label: 'Create Script', action: 'script' },
  { label: 'New Caption', action: 'caption' },
  { label: 'Open Planner', action: 'planner' },
];

const recentItems = [
  { title: 'Motivation quote pack · fitness', type: 'Quotes', date: 'Dec 10' },
  { title: 'Product launch hook', type: 'Script', date: 'Dec 9' },
  { title: 'Short caption · reels', type: 'Caption', date: 'Dec 8' },
  { title: 'Wellness calendar export', type: 'Planner', date: 'Dec 7' },
  { title: 'Aesthetic quote pack · travel', type: 'Quotes', date: 'Dec 6' },
  { title: 'B2B carousel caption', type: 'Caption', date: 'Dec 5' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <header className="rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
        <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Welcome back</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Welcome back, Creator</h1>
            <p className="text-sm text-slate-500">Let&apos;s build quotes, captions, scripts, and your weekly plan.</p>
          </div>
          <div className="rounded-full bg-slate-50 px-4 py-2 text-xs font-semibold text-indigo-600 ring-1 ring-slate-200">
            Standard plan · 180 credits
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {quickActions.map((item) => (
          <button
            key={item.label}
            className="rounded-2xl bg-white p-4 text-left text-slate-800 shadow ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <p className="text-sm font-semibold text-indigo-600">{item.label}</p>
            <p className="text-xs text-slate-500">Jump to {item.action}</p>
          </button>
        ))}
      </section>

      <section className="space-y-3 rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Recent items</p>
            <p className="text-lg font-semibold text-slate-900">Your latest outputs</p>
          </div>
          <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">See all</button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {recentItems.map((item, idx) => (
            <article key={idx} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-500">
                {item.type} · {item.date}
              </p>
              <div className="mt-3 flex gap-2 text-xs">
                <button className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-600 ring-1 ring-indigo-100">Open</button>
                <button className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">Copy</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
