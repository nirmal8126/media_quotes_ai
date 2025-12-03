"use client";

import { GoogleIcon } from "@/assets/icons";
import { createClient } from "@supabase/supabase-js";
import { useState } from "react";

type Props = {
  text: string;
};

export default function GoogleSigninButton({ text }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleAuth = async () => {
    if (loading) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      setError("Supabase keys are missing. Add NEXT_PUBLIC_SUPABASE_URL + KEY.");
      return;
    }

    setError(null);
    setLoading(true);

    const supabase = createClient(url, anonKey);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
    // Supabase handles the redirect flow.
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleGoogleAuth}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3.5 rounded-lg border border-stroke bg-gray-2 p-[15px] font-medium transition hover:bg-opacity-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-dark-3 dark:bg-dark-2 dark:hover:bg-opacity-50"
      >
        <GoogleIcon />
        {text} with Google
        {loading && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-dark-4 border-t-transparent dark:border-white dark:border-t-transparent" />
        )}
      </button>

      {error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
