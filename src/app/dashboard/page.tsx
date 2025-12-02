const statCards = [
  { title: 'Scripts generated', value: '1,232', delta: '+21%' },
  { title: 'Captions drafted', value: '874', delta: '+12%' },
  { title: 'Thumbnail prompts', value: '542', delta: '+9%' },
  { title: 'Calendar posts', value: '98', delta: '+18%' },
];

const projects = [
  { title: 'Wellness Reels Pack', tag: 'Instagram', progress: 92, status: 'Completed', due: 'Today' },
  { title: 'B2B Product Launch', tag: 'Shorts', progress: 68, status: 'In Progress', due: 'Tomorrow' },
  { title: 'Coaching Hooks', tag: 'Scripts', progress: 55, status: 'Review', due: 'Dec 15' },
];

const mentors = [
  { name: 'Script Assistant', role: 'Content expert' },
  { name: 'Visual Creator', role: 'Design expert' },
  { name: 'Voice Specialist', role: 'Audio expert' },
  { name: 'Social Specialist', role: 'Social strategist' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/80">Welcome back</p>
            <h1 className="text-3xl font-semibold leading-tight">Ready to create something amazing today?</h1>
            <p className="text-sm text-white/80">Your AI-powered content studio is ready. Let&apos;s turn your ideas into reality.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/20">
              View tutorials
            </button>
            <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-md hover:bg-slate-50">
              Start creating
            </button>
          </div>
        </div>
        <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25)_0,_transparent_45%)]" />
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.title} className="rounded-2xl bg-white/80 p-4 shadow ring-1 ring-slate-100">
            <p className="text-sm text-slate-500">{card.title}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
            <p className="text-xs font-medium text-emerald-500">{card.delta} vs last week</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-3 rounded-3xl bg-white/80 p-5 shadow ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Active projects</p>
              <p className="text-lg font-semibold text-slate-900">Your reel packages</p>
            </div>
            <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">See all</button>
          </div>
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project.title} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{project.title}</p>
                    <p className="text-xs text-slate-500">{project.tag}</p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">{project.status}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Due {project.due}</span>
                  <span>{project.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-3xl bg-white/80 p-5 shadow ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Your AI mentors</p>
          <div className="space-y-2">
            {mentors.map((mentor) => (
              <div key={mentor.name} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3">
                <div className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-center text-sm font-semibold text-white leading-10">
                    {mentor.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{mentor.name}</p>
                    <p className="text-xs text-slate-500">{mentor.role}</p>
                  </div>
                </div>
                <button className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Chat</button>
              </div>
            ))}
          </div>
          <button className="w-full rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            See all mentors
          </button>
        </div>
      </section>
    </div>
  );
}
