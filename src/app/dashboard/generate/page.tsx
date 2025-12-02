import { createServerClient } from '@supabase/ssr';
import GenerateForm from './GenerateForm';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function GeneratePage() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase URL or service role key in environment.');
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
      setAll: () => {},
    },
  });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Caption & Script</p>
            <h1 className="text-2xl font-semibold text-slate-900">Generate captions and scripts</h1>
            <p className="text-sm text-slate-500">Choose content type, platform, tone, and variations.</p>
          </div>
          <button className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">⚙️ Settings</button>
        </div>
      </div>
      <GenerateForm userId={session?.user?.id ?? null} />
    </div>
  );
}
