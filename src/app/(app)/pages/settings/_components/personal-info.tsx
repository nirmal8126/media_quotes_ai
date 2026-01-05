"use client";

import {
  CallIcon,
  EmailIcon,
  PencilSquareIcon,
  UserIcon,
} from "@/assets/icons";
import InputGroup from "@/components/FormElements/InputGroup";
import { TextAreaGroup } from "@/components/FormElements/InputGroup/text-area";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

type FormState = {
  fullName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  username: string;
  bio: string;
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    github?: string;
  };
};

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const initialState: FormState = {
  fullName: "",
  email: "",
  countryCode: "+91",
  phoneNumber: "",
  username: "",
  bio: "",
  socialLinks: {
    linkedin: "",
    twitter: "",
    facebook: "",
    github: "",
  },
};

export function PersonalInfoForm() {
  const [form, setForm] = useState<FormState>({ ...initialState });
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isDisabled = status.type === "loading";

  useEffect(() => {
    const load = async () => {
      setStatus({ type: "loading", message: "Loading profile..." });
      try {
        const res = await fetch("/api/auth/profile", { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || "Unable to load profile.");
        }
        const profile = body.profile || {};
        const phoneRaw = profile.phone || "";
        const phoneMatch = /^\+[\d]{1,4}/.exec(phoneRaw || "");
        const nextCode = phoneMatch ? phoneMatch[0] : "+91";
        const nextNumber = phoneRaw.replace(nextCode, "").replace(/[^\d]/g, "");

        setForm({
          fullName: profile.fullName || "",
          email: profile.email || "",
          countryCode: nextCode || "+91",
          phoneNumber: nextNumber || "",
          username: profile.username || "",
          bio: profile.bio || "",
          socialLinks: {
            linkedin: profile.socialLinks?.linkedin || "",
            twitter: profile.socialLinks?.x || profile.socialLinks?.twitter || "",
            facebook: profile.socialLinks?.facebook || "",
            github: profile.socialLinks?.github || "",
          },
        });
        setStatus({ type: "idle" });
      } catch (err) {
        setStatus({ type: "error", message: (err as Error).message });
      }
    };
    void load();
  }, []);

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSocialChange =
    (field: keyof FormState["socialLinks"]) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({
        ...prev,
        socialLinks: { ...prev.socialLinks, [field]: e.target.value },
      }));
    };

  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, bio: e.target.value }));
  };

  const clientValidate = (next: FormState) => {
    const nextErrors: Record<string, string> = {};
    if (!next.fullName.trim() || next.fullName.trim().length < 2) {
      nextErrors.fullName = "Full name must be at least 2 characters.";
    }
    if (next.bio.length > 500) {
      nextErrors.bio = "Bio must be 500 characters or fewer.";
    }
    if (next.username && !/^[a-zA-Z0-9_.-]{3,30}$/.test(next.username)) {
      nextErrors.username = "Username must be 3-30 characters (letters, numbers, underscore, dot, dash).";
    }
    const phone = `${next.countryCode}${next.phoneNumber}`.replace(/[^\d+]/g, "");
    if (next.phoneNumber && (phone.length < 7 || phone.length > 18)) {
      nextErrors.phoneNumber = "Phone number looks invalid.";
    }
    const urlFields: Array<[keyof FormState["socialLinks"], string]> = [
      ["linkedin", "LinkedIn"],
      ["twitter", "X/Twitter"],
      ["facebook", "Facebook"],
      ["github", "GitHub"],
    ];
    urlFields.forEach(([key, label]) => {
      const value = next.socialLinks[key];
      if (value && !isUrl(value)) {
        nextErrors[key] = `${label} link must be a valid URL.`;
      }
    });
    return nextErrors;
  };

  const isUrl = (value?: string) => {
    try {
      if (!value) return true;
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = clientValidate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setStatus({ type: "loading", message: "Saving..." });
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          bio: form.bio,
          phone: `${form.countryCode} ${form.phoneNumber}`.trim(),
          username: form.username,
          socialLinks: {
            linkedin: form.socialLinks.linkedin,
            twitter: form.socialLinks.twitter,
            x: form.socialLinks.twitter,
            facebook: form.socialLinks.facebook,
            github: form.socialLinks.github,
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to save profile.");
      }
      setStatus({ type: "success", message: "Profile updated" });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    }
  };

  const helperText = useMemo(() => {
    if (status.type === "error") return status.message;
    if (status.type === "success") return status.message;
    return status.message;
  }, [status]);

  return (
    <ShowcaseSection title="Personal Information" className="!p-7">
      <form onSubmit={handleSubmit} className="space-y-4">
        {helperText && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              status.type === "error"
                ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
                : status.type === "success"
                  ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
            )}
          >
            {helperText}
          </div>
        )}

        <div className="mb-1 grid grid-cols-1 gap-5.5 sm:grid-cols-2">
          <InputGroup
            className="w-full"
            type="text"
            name="fullName"
            label="Full Name"
            placeholder="Your name"
            value={form.fullName}
            handleChange={handleChange("fullName")}
            icon={<UserIcon />}
            iconPosition="left"
            height="sm"
            required
            active={!!form.fullName}
            disabled={isDisabled}
          />
          <InputGroup
            className="w-full"
            type="email"
            name="email"
            label="Email Address"
            placeholder="user@email.com"
            value={form.email}
            icon={<EmailIcon />}
            iconPosition="left"
            height="sm"
            disabled
          />
        </div>
        {errors.fullName && <p className="text-xs font-medium text-red">{errors.fullName}</p>}
        {errors.phoneNumber && <p className="text-xs font-medium text-red">{errors.phoneNumber}</p>}

        <InputGroup
          className="mb-1"
          type="text"
          name="username"
          label="Username"
          placeholder="username"
          value={form.username}
          handleChange={handleChange("username")}
          icon={<UserIcon />}
          iconPosition="left"
          height="sm"
          active={!!form.username}
          disabled={isDisabled}
        />
        {errors.username && <p className="text-xs font-medium text-red">{errors.username}</p>}

        <div className="w-full">
          <label className="text-body-sm font-medium text-dark dark:text-white">
            Phone Number
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-[150px] items-center gap-2 rounded-lg border border-stroke bg-white px-3 py-2 text-sm font-medium text-dark outline-none transition focus-within:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white">
              <span className="text-lg">
                {(() => {
                  const map: Record<string, string> = {
                    "+1": "🇺🇸",
                    "+44": "🇬🇧",
                    "+61": "🇦🇺",
                    "+65": "🇸🇬",
                    "+91": "🇮🇳",
                    "+971": "🇦🇪",
                  };
                  return map[form.countryCode] || "🌐";
                })()}
              </span>
              <select
                className="w-full bg-transparent text-sm outline-none"
                value={form.countryCode}
                onChange={(e) => setForm((prev) => ({ ...prev, countryCode: e.target.value }))}
                disabled={isDisabled}
              >
                {["+1", "+44", "+61", "+65", "+91", "+971"].map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                  ))}
                </select>
              </div>
            <div className="relative w-full">
              <input
                type="text"
                name="phoneNumber"
                placeholder="555 123 4567"
                value={form.phoneNumber}
                onChange={handleChange("phoneNumber")}
                disabled={isDisabled}
                className="w-full rounded-lg border border-stroke bg-transparent px-10 py-2.5 text-dark outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:bg-gray-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
              />
              <CallIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dark-6" />
            </div>
          </div>
        </div>

        <TextAreaGroup
          className="mb-1"
          label="BIO"
          placeholder="Write your bio here"
          value={form.bio}
          onChange={handleBioChange}
        />
        {errors.bio && <p className="text-xs font-medium text-red">{errors.bio}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <InputGroup
            type="url"
            name="linkedin"
            label="LinkedIn"
            placeholder="https://linkedin.com/in/you"
            value={form.socialLinks.linkedin}
            handleChange={handleSocialChange("linkedin")}
            height="sm"
            disabled={isDisabled}
          />
          <InputGroup
            type="url"
            name="twitter"
            label="X / Twitter"
            placeholder="https://x.com/you"
            value={form.socialLinks.twitter}
            handleChange={handleSocialChange("twitter")}
            height="sm"
            disabled={isDisabled}
          />
          <InputGroup
            type="url"
            name="facebook"
            label="Facebook"
            placeholder="https://facebook.com/you"
            value={form.socialLinks.facebook}
            handleChange={handleSocialChange("facebook")}
            height="sm"
            disabled={isDisabled}
          />
          <InputGroup
            type="url"
            name="github"
            label="GitHub"
            placeholder="https://github.com/you"
            value={form.socialLinks.github}
            handleChange={handleSocialChange("github")}
            height="sm"
            disabled={isDisabled}
          />
        </div>
        {["linkedin", "twitter", "facebook", "github"].map(
          (field) =>
            errors[field] && (
              <p key={field} className="text-xs font-medium text-red">
                {errors[field]}
              </p>
            ),
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            className="rounded-lg border border-stroke px-6 py-[7px] font-medium text-dark hover:shadow-1 dark:border-dark-3 dark:text-white"
            type="button"
            onClick={() => setForm({ ...initialState, email: form.email })}
            disabled={isDisabled}
          >
            Reset
          </button>

          <button
            className="rounded-lg bg-primary px-6 py-[7px] font-medium text-gray-2 hover:bg-opacity-90 disabled:opacity-60"
            type="submit"
            disabled={isDisabled}
          >
            Save
          </button>
        </div>
      </form>
    </ShowcaseSection>
  );
}
