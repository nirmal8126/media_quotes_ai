import Link from 'next/link';

type SidebarLink = { label: string; href: string };

type AdminSidebarProps = {
  title: string;
  subtitle?: string;
  moduleLinks?: SidebarLink[];
  extraLinks?: SidebarLink[];
};

const baseLinks: SidebarLink[] = [{ label: 'Dashboard Home', href: '/admin' }];

export default function AdminSidebar({ title, subtitle, moduleLinks, extraLinks }: AdminSidebarProps) {
  return (
    <aside className="flex flex-col border-r border-slate-800 bg-slate-900/70 p-6">
      <div className="text-sm uppercase tracking-[0.3em] text-orange-400">MediaQuotes AI</div>
      <h1 className="mt-3 text-2xl font-semibold text-white">{title}</h1>
      {subtitle && <p className="mb-3 text-xs uppercase tracking-[0.4em] text-slate-500">{subtitle}</p>}
      <nav className="mt-8 space-y-3 text-sm">
        {[...baseLinks, ...(moduleLinks ?? []), ...(extraLinks ?? [])].map((link) => (
          <Link
            key={link.label}
            className="block rounded-xl border border-slate-800 px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-300 hover:border-orange-400"
            href={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
