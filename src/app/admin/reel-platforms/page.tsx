import AdminSidebar from '@/components/admin/AdminSidebar';
import { supabaseAdmin } from '@/lib/supabase';

const fallbackPlatforms = [
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Reels with vertical framing and friendly hooks.',
    created_at: '2025-02-01T00:00:00Z',
  },
  {
    id: 'youtube',
    name: 'YouTube Shorts',
    description: 'Longer scripts and thumbnail prompts.',
    created_at: '2025-02-02T00:00:00Z',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Thought leadership reels + captions.',
    created_at: '2025-02-03T00:00:00Z',
  },
];

const columns = ['Platform', 'Description', 'Created'];

type PlatformRow = {
  id: string;
  name: string;
  description: string;
  createdAt: string | null;
};

export default async function AdminModuleReelPlatformsPage() {
  const { data, error } = await supabaseAdmin
    .from('reel_platforms')
    .select('id, name, description, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const platforms: PlatformRow[] = (data ?? fallbackPlatforms).map((platform) => ({
    id: platform.id,
    name: platform.name ?? 'Unnamed platform',
    description: platform.description ?? 'No description',
    createdAt: platform.created_at ?? null,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-[240px,1fr]">
        <AdminSidebar title="Reel platforms" />
        <main className="px-8 py-10">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Platforms</p>
              <h2 className="text-3xl font-semibold">Release destinations</h2>
              <p className="text-sm text-slate-400">Defines publishing defaults and thumbnail ratios.</p>
            </div>
            <span className="text-xs text-slate-400">{error ? 'Supabase table missing' : `${platforms.length} platforms`}</span>
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
                {platforms.map((platform) => (
                  <tr key={platform.id} className="bg-slate-950/40">
                    <td className="px-4 py-3 font-semibold text-white">{platform.name}</td>
                    <td className="px-4 py-3 text-slate-300">{platform.description}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {platform.createdAt ? new Date(platform.createdAt).toLocaleDateString() : 'Legacy'}
                    </td>
                  </tr>
                ))}
                {!platforms.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-sm text-slate-500">
                      No platforms defined.
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
