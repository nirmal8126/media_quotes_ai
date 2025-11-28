import Link from 'next/link';

const featureHighlights = [
  {
    title: 'AI scripts on demand',
    description: 'Generate briefing-ready scripts, thumbnails, and captions tailored to each platform in seconds.',
  },
  {
    title: 'Calendar that delivers',
    description: 'Publish-ready schedules auto-sync with creator preferences so teams know exactly when to post.',
  },
  {
    title: 'Automation workspace',
    description: 'Reminders, approvals, and reporting run together so you can scale without adding extra ops hours.',
  },
];

const infoSections = [
  {
    title: 'Reels intelligence',
    body:
      'We analyze prior uploads, brand tone, and trending prompts, then codify those learnings into reusable themes for every new batch of AI-created content.',
  },
  {
    title: 'Payments + plans',
    body:
      'Monetize creators with transparent plan tiers, Razorpay + Stripe checkouts, and realtime dashboards that keep finance teams on the same page.',
  },
  {
    title: 'Control everything',
    body:
      'Role-based access, activity logs, and Supabase service-role APIs keep the launchpad secure while your operations team moves fast.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3 text-lg font-semibold tracking-tight text-orange-300">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400" />
            MediaQuotes AI
          </div>
          <nav className="hidden items-center gap-6 text-sm uppercase tracking-[0.25em] text-slate-600 sm:flex">
            <a className="hover:text-slate-900" href="#product">
              Product
            </a>
            <a className="hover:text-slate-900" href="#showcase">
              Showcase
            </a>
            <a className="hover:text-slate-900" href="#pricing">
              Pricing
            </a>
            <a className="hover:text-slate-900" href="#contact">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link
              className="rounded-full border border-slate-300 px-4 py-2 text-slate-900 hover:border-orange-400"
              href="/auth"
            >
              Sign in
            </Link>
            <Link
              className="rounded-full bg-orange-400 px-4 py-2 font-semibold text-slate-950"
              href="/auth"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-20 px-6 py-16">
        <section className="grid gap-10 md:grid-cols-[1.1fr,0.9fr] md:items-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.5em] text-orange-400">Creator operating system</p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Build consistent, high-performing short-form content without the agency backlog.
            </h1>
            <p className="max-w-2xl text-lg text-slate-600">
              MediaQuotes AI orchestrates every step of the creator workflow—planning, generation, payment, and reporting—so
              teams can execute ambitious social strategies with a single dashboard.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white">Request demo</button>
              <button className="rounded-full border border-slate-300 px-6 py-3 text-sm text-slate-600">View case studies</button>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_25px_50px_-30px_rgba(15,23,42,0.25)]">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Live metrics</p>
            <div className="mt-6 space-y-4 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Active creators</span>
                <span className="text-xl font-semibold text-slate-900">4,120</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Reels/month</span>
                <span className="text-xl font-semibold text-slate-900">32k</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Avg. approval time</span>
                <span className="text-xl font-semibold text-slate-900">2h 12m</span>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="space-y-6">
          <h2 className="text-3xl font-semibold text-slate-900">What MediaQuotes AI manages for you</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {featureHighlights.map((feature) => (
              <article
                key={feature.title}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_15px_30px_-10px_rgba(2,6,23,0.12)]"
              >
                <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-3 text-sm text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="showcase" className="grid gap-10 md:grid-cols-2">
          {infoSections.map((section) => (
            <article key={section.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_15px_30px_-10px_rgba(2,6,23,0.12)]">
              <h3 className="text-xl font-semibold text-slate-900">{section.title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">{section.body}</p>
              <p className="mt-6 text-xs uppercase tracking-[0.4em] text-orange-400">Live today with creators</p>
            </article>
          ))}
        </section>

        <section id="pricing" className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-[0_20px_60px_-30px_rgba(15,23,42,0.15)]">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Plans</p>
          <h3 className="mt-4 text-2xl font-semibold text-slate-900">Start with a free trial, scale to enterprise</h3>
          <p className="mt-3 text-sm text-slate-600">
            Transparent pricing, Razorpay + Stripe checkouts, and support bundle add-ons keep every team aligned.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <button className="rounded-full bg-orange-400 px-5 py-3 font-semibold text-slate-950">See pricing</button>
            <button className="rounded-full border border-slate-300 px-5 py-3 text-sm text-slate-600">Talk to sales</button>
          </div>
        </section>

        <section id="contact" className="space-y-6 border-t border-slate-200 pt-10 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Questions?</p>
          <h3 className="text-2xl font-semibold text-slate-900">Let’s talk creatives, automations, and payments</h3>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button className="rounded-full border border-slate-300 px-5 py-3 text-sm text-slate-700">Schedule a call</button>
            <button className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Email hello@mediaquotes.ai</button>
          </div>
        </section>
      </main>
    </div>
  );
}
