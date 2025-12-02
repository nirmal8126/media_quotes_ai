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
      <div className="rounded-3xl bg-white/80 p-5 shadow ring-1 ring-slate-100">
        <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Generate</p>
        <h1 className="text-2xl font-semibold text-slate-900">Build a new reel script</h1>
        <p className="text-sm text-slate-500">Pick tone + platform and trigger the AI pipeline.</p>
      </div>
      <GenerateForm userId={session?.user?.id ?? null} />
    </div>
  );
}
