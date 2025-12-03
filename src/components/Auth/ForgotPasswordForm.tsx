/* eslint-disable jsx-a11y/no-autofocus */
"use client";

import { EmailIcon } from "@/assets/icons";
import InputGroup from "@/components/FormElements/InputGroup";
import { cn } from "@/lib/utils";
import { validateEmail } from "@/lib/validation";
import Link from "next/link";
import { useState } from "react";

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status.type === "loading") return;

    const emailResult = validateEmail(email);
    if (!emailResult.valid || !emailResult.value) {
      setStatus({ type: "error", message: emailResult.message || "Enter a valid email address." });
      return;
    }

    setStatus({ type: "loading", message: "Sending reset email..." });

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emailResult.value }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "Unable to send reset email right now.");
      }

      setStatus({
        type: "success",
        message: "Check your inbox for a reset link.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          (error as Error)?.message || "We couldn't send the reset email. Try again.",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <InputGroup
        type="email"
        label="Email"
        className="[&_input]:py-[15px]"
        placeholder="Enter your email"
        name="email"
        handleChange={(e) => setEmail(e.target.value)}
        value={email}
        icon={<EmailIcon />}
      />

      {status.type !== "idle" && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            status.type === "error"
              ? "border-red-200 bg-red-50 text-red-600"
              : status.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-stroke bg-gray-1 text-dark",
          )}
        >
          {status.message}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium text-gray-6">
        <Link href="/auth/sign-in" className="text-primary hover:text-primary/80">
          Back to Sign In
        </Link>
        <Link href="/auth/sign-up" className="text-primary hover:text-primary/80">
          Create account
        </Link>
      </div>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={status.type === "loading"}
      >
        Send reset link
        {status.type === "loading" && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
        )}
      </button>
    </form>
  );
}
