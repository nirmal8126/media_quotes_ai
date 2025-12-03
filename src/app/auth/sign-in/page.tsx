import Signin from "@/components/Auth/Signin";
import { createServerClient } from "@supabase/ssr";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignIn() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const getAllCookies = () => {
      try {
        const cookieStore = cookies() as unknown as { getAll?: () => Array<{ name: string; value?: string }> };
        if (typeof cookieStore.getAll === "function") {
          return cookieStore.getAll();
        }
      } catch {
        // ignore and return empty below
      }
      return [];
    };

    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll: getAllCookies,
        setAll: () => {},
      },
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      redirect("/");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f4f6ff] via-white to-[#e9ecff] px-4 py-10 text-dark">
      <div className="mx-auto flex max-w-6xl items-center justify-between pb-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Image src="/images/logo/logo-dark.svg" alt="MediaQuotes_AI" width={160} height={34} />
        </Link>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-6 rounded-[14px] bg-white/70 p-4 shadow-card-2 backdrop-blur lg:grid-cols-[1.05fr,0.95fr] lg:p-6">
        <div className="rounded-[12px] border border-gray-3 bg-white p-5 shadow-card-2 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Authentication</p>
              <h1 className="text-2xl font-bold text-dark">Sign In</h1>
            </div>
            <Link href="/auth/sign-up" className="text-sm font-semibold text-primary hover:text-primary/80">
              Sign Up
            </Link>
          </div>
          <Signin />
        </div>

        <div className="relative overflow-hidden rounded-[12px] bg-gradient-to-br from-[#eff2ff] via-white to-[#dfe6ff] p-8 shadow-card-2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(87,80,241,0.16),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(60,80,224,0.12),transparent_40%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-center gap-2 text-dark">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card">
                <Image src="/images/logo/logo-icon.svg" alt="MediaQuotes_AI" width={24} height={24} />
              </span>
              <div>
                <p className="text-sm font-semibold">MediaQuotes_AI</p>
                <p className="text-xs text-gray-6">MediaQuotes_AI Admin Dashboard Solution</p>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <p className="text-sm font-semibold text-primary">Sign in to your account</p>
              <h2 className="text-3xl font-bold leading-tight text-dark">Welcome Back!</h2>
              <p className="max-w-md text-base text-gray-6">
                Please sign in to your account by completing the necessary fields below. Secure authentication powered by
                Supabase.
              </p>
            </div>

            <div className="mt-auto flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-primary shadow-card-2 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Protected workspace access
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
