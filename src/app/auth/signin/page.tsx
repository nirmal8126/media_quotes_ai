import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import AuthForm from '../AuthForm';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function SignInPage() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const cookieStore = await cookies();
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
        setAll: () => {},
      },
    });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      redirect('/dashboard');
    }
  }

  return <AuthForm mode="signin" />;
}
