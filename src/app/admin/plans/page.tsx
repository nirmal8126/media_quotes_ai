import AdminSidebar from '@/components/admin/AdminSidebar';
import { supabaseAdmin } from '@/lib/supabase';
import PlansCrudPanel from './PlansCrudPanel';

type SupabasePlan = {
  id: string;
  name: string | null;
  reels_per_month: number | null;
  price: number | null;
  perks: string[] | null;
};

export default async function AdminModulePlansPage() {
  const { data: plansData } = await supabaseAdmin
    .from('plans')
    .select('id, name, reels_per_month, price, perks')
    .order('price', { ascending: true });

  const plans = (plansData ?? []) as SupabasePlan[];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-[240px,1fr]">
        <AdminSidebar title="Plan CRUD" />
        <main className="px-8 py-10">
          <header className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Superadmin plan control</p>
            <h2 className="text-3xl font-semibold">Membership tiers</h2>
            <p className="max-w-2xl text-sm text-slate-400">
              Use this UI to add or update the offers that appear throughout the dashboard. Changes sync directly with Supabase.
            </p>
          </header>
          <section className="mt-8">
            <PlansCrudPanel plans={plans} />
          </section>
        </main>
      </div>
    </div>
  );
}
