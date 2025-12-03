import { ForgotPasswordForm } from "@/components/Auth/ForgotPasswordForm";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f4f6ff] via-white to-[#e9ecff] px-4 py-10 text-dark">
      <div className="mx-auto flex max-w-6xl items-center justify-between pb-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Image src="/images/logo/logo-dark.svg" alt="MediaQuotes_AI" width={160} height={34} />
        </Link>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-6 rounded-[14px] bg-white/70 p-4 shadow-card-2 backdrop-blur lg:grid-cols-[1.05fr,0.95fr] lg:p-6">
        <div className="rounded-[12px] border border-gray-3 bg-white p-5 shadow-card-2 sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Authentication</p>
            <h1 className="text-2xl font-bold text-dark">Reset your password</h1>
            <p className="mt-1 text-sm text-gray-6">
              Enter the email linked to your account. We&apos;ll send a secure reset link.
            </p>
          </div>
          <ForgotPasswordForm />
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
              <p className="text-sm font-semibold text-primary">Reset securely</p>
              <h2 className="text-3xl font-bold leading-tight text-dark">We’ll help you get back in.</h2>
              <p className="max-w-md text-base text-gray-6">
                Supabase sends a single-use link to your inbox. Follow it to choose a new password and return to your
                dashboard.
              </p>
            </div>

            <div className="mt-auto flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-primary shadow-card-2 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Email-based recovery with secure tokens
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
