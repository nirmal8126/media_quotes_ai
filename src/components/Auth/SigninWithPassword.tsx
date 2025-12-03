"use client";
import { EmailIcon, PasswordIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";
import { validateEmail, validateName, validatePasswordBasic, validatePasswordStrong } from "@/lib/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import InputGroup from "../FormElements/InputGroup";
import { Checkbox } from "../FormElements/checkbox";

type Mode = "signin" | "signup";

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

type Props = {
  mode?: Mode;
};

export default function SigninWithPassword({ mode = "signin" }: Props) {
  const router = useRouter();
  const [data, setData] = useState({
    name: "",
    email: process.env.NEXT_PUBLIC_DEMO_USER_MAIL || "",
    password: process.env.NEXT_PUBLIC_DEMO_USER_PASS || "",
    remember: false,
  });

  const [status, setStatus] = useState<Status>({ type: "idle" });
  const isSignup = mode === "signup";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({
      ...data,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (status.type === "loading") return;

    const emailResult = validateEmail(data.email);
    const passwordResult = isSignup
      ? validatePasswordStrong(data.password)
      : validatePasswordBasic(data.password);
    const nameResult = isSignup ? validateName(data.name) : { valid: true, value: "" };

    const clientError =
      (!emailResult.valid && emailResult.message) ||
      (!passwordResult.valid && passwordResult.message) ||
      (!nameResult.valid && nameResult.message);

    if (clientError) {
      setStatus({ type: "error", message: clientError });
      return;
    }

    setStatus({ type: "loading", message: "Checking credentials..." });

    try {
      const endpoint =
        mode === "signup" ? "/api/auth/signup" : "/api/auth/signin";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: emailResult.value,
          password: passwordResult.value,
          ...(isSignup ? { name: nameResult.value } : {}),
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body?.error || "Unable to sign in right now.");
      }

      const successMessage =
        mode === "signup"
          ? body?.session
            ? "Account created — redirecting..."
            : "Check your email to confirm your account."
          : "Signed in — redirecting...";

      setStatus({ type: "success", message: successMessage });

      // If Supabase returned a session, go straight to the app. Otherwise, for sign-up without a session, stay put.
      if (mode === "signin" || body?.session) {
        router.replace("/");
        router.refresh();
      }
    } catch (error) {
      setStatus({
        type: "error",
        message:
          (error as Error)?.message ||
          "We couldn’t complete the request. Try again.",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {isSignup && (
        <InputGroup
          type="text"
          label="Full name"
          className="mb-4 [&_input]:py-[15px]"
          placeholder="Enter your name"
          name="name"
          handleChange={handleChange}
          value={data.name}
          required
        />
      )}

      <InputGroup
        type="email"
        label="Email"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="Enter your email"
        name="email"
        handleChange={handleChange}
        value={data.email}
        icon={<EmailIcon />}
      />

      <InputGroup
        type="password"
        label="Password"
        className="mb-5 [&_input]:py-[15px]"
          placeholder="Enter your password"
          name="password"
          handleChange={handleChange}
          value={data.password}
          icon={<PasswordIcon />}
        />

      <div className="mb-6 flex items-center justify-between gap-2 py-2 font-medium">
        <Checkbox
          label="Remember me"
          name="remember"
          withIcon="check"
          minimal
          radius="md"
          onChange={(e) =>
            setData({
              ...data,
              remember: e.target.checked,
            })
          }
        />

        <Link
          href="/auth/forgot-password"
          className="hover:text-primary dark:text-white dark:hover:text-primary"
        >
          Forgot Password?
        </Link>
      </div>

      {status.type !== "idle" && (
        <div
          className={cn(
            "mb-4 rounded-lg border px-4 py-3 text-sm",
            status.type === "error"
              ? "border-red-200 bg-red-50 text-red-600"
              : status.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-stroke bg-gray-1 text-dark",
          )}
          role="status"
        >
          {status.message}
        </div>
      )}

      <div className="mb-4.5">
        <button
          type="submit"
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={status.type === "loading"}
        >
          {isSignup ? "Create account" : "Sign In"}
          {status.type === "loading" && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
          )}
        </button>
      </div>
    </form>
  );
}
