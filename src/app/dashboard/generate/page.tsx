import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import GenerateForm from './GenerateForm';

export default async function GeneratePage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return <GenerateForm userId={session?.user?.id ?? null} />;
}
