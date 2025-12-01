import { createServerClient } from '@supabase/auth-helpers-nextjs';
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
      setAll: async () => {},
    },
  });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return <GenerateForm userId={session?.user?.id ?? null} />;
}
