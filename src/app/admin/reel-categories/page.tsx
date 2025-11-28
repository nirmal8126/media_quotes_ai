import AdminSidebar from '@/components/admin/AdminSidebar';
import { supabaseAdmin } from '@/lib/supabase';

const fallbackCategories = [
  {
    id: 'default',
    name: 'Brand Stories',
    description: 'Narratives that highlight company heritage.',
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'engagement',
    name: 'Engagement Hooks',
    description: 'Short reels built for shares and saves.',
    created_at: '2025-01-02T00:00:00Z',
  },
  {
    id: 'education',
    name: 'Educational',
    description: 'Tutorial-style scripts and explainers.',
    created_at: '2025-01-03T00:00:00Z',
  },
];

const columns = ['Category', 'Description', 'Created'];

type CategoryRow = {
  id: string;
  name: string;
  description: string;
  createdAt: string | null;
};

export default async function AdminModuleReelCategoriesPage() {
  const { data, error } = await supabaseAdmin
    .from('reel_categories')
    .select('id, name, description, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const categories: CategoryRow[] = (data ?? fallbackCategories).map((category) => ({
    id: category.id,
    name: category.name ?? 'Unnamed category',
    description: category.description ?? 'No description',
    createdAt: category.created_at ?? null,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-[240px,1fr]">
        <AdminSidebar title="Reel categories" />
        <main className="px-8 py-10">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Taxonomy</p>
              <h2 className="text-3xl font-semibold">Reel category tags</h2>
              <p className="text-sm text-slate-400">These categories drive prompt defaults and dashboard filters.</p>
            </div>
            <span className="text-xs text-slate-400">{error ? 'Supabase table missing' : `${categories.length} entries`}</span>
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
                {categories.map((category) => (
                  <tr key={category.id} className="bg-slate-950/40">
                    <td className="px-4 py-3 font-semibold text-white">{category.name}</td>
                    <td className="px-4 py-3 text-slate-300">{category.description}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {category.createdAt ? new Date(category.createdAt).toLocaleDateString() : 'Legacy'}
                    </td>
                  </tr>
                ))}
                {!categories.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-sm text-slate-500">
                      No categories available.
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
