"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CameraIcon } from "./_components/icons";
import { SocialAccounts } from "./_components/social-accounts";

type Profile = {
  fullName: string;
  email: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  socialLinks?: Record<string, string>;
};

const FALLBACK_PROFILE: Profile = {
  fullName: "User",
  email: "user@example.com",
  bio: "Add your bio in settings.",
  avatarUrl: "/images/user/user-03.png",
  coverUrl: "/images/cover/cover-01.png",
};

export default function Page() {
  const [profile, setProfile] = useState<Profile>(FALLBACK_PROFILE);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");

  useEffect(() => {
    const load = async () => {
      setStatus("loading");
      try {
        const res = await fetch("/api/auth/profile", { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || "Unable to load profile");
        }
        const p = body.profile || {};
        setProfile({
          fullName: p.fullName || FALLBACK_PROFILE.fullName,
          email: p.email || FALLBACK_PROFILE.email,
          bio: p.bio || FALLBACK_PROFILE.bio,
          avatarUrl: p.avatarUrl || FALLBACK_PROFILE.avatarUrl,
          coverUrl: p.coverUrl || FALLBACK_PROFILE.coverUrl,
          socialLinks: p.socialLinks || {},
        });
        setStatus("idle");
      } catch (err) {
        setProfile(FALLBACK_PROFILE);
        setStatus("error");
      }
    };
    void load();
  }, []);

  const aboutText = useMemo(() => profile.bio || FALLBACK_PROFILE.bio, [profile.bio]);

  return (
    <div className="mx-auto w-full max-w-[970px]">
      <Breadcrumb pageName="Profile" />

      <div className="overflow-hidden rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="relative z-20 h-35 md:h-65">
          <Image
            src={profile.coverUrl || FALLBACK_PROFILE.coverUrl}
            alt="profile cover"
            className="h-full w-full rounded-tl-[10px] rounded-tr-[10px] object-cover object-center"
            width={970}
            height={260}
            style={{
              width: "auto",
              height: "auto",
            }}
          />
          <div className="pointer-events-none absolute bottom-1 right-1 z-10 rounded-lg bg-black/20 px-3 py-1 text-xs font-semibold text-white xsm:bottom-4 xsm:right-4">
            Profile preview
          </div>
        </div>
        <div className="px-4 pb-6 text-center lg:pb-8 xl:pb-11.5">
          <div className="relative z-30 mx-auto -mt-22 h-30 w-full max-w-30 rounded-full bg-white/20 p-1 backdrop-blur sm:h-44 sm:max-w-[176px] sm:p-3">
            <div className="relative drop-shadow-2">
              <Image
                src={profile.avatarUrl || FALLBACK_PROFILE.avatarUrl}
                width={160}
                height={160}
                className="overflow-hidden rounded-full object-cover"
                alt="profile"
              />
              <div className="absolute bottom-0 right-0 flex size-8.5 items-center justify-center rounded-full bg-primary text-white sm:bottom-2 sm:right-2">
                <CameraIcon />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="mb-1 text-heading-6 font-bold text-dark dark:text-white">
              {profile.fullName}
            </h3>
            <p className="font-medium text-gray-600 dark:text-gray-300">{profile.email}</p>
            <div className="mx-auto mb-5.5 mt-5 grid max-w-[370px] grid-cols-3 rounded-[5px] border border-stroke py-[9px] shadow-1 dark:border-dark-3 dark:bg-dark-2 dark:shadow-card">
              <div className="flex flex-col items-center justify-center gap-1 border-r border-stroke px-4 dark:border-dark-3 xsm:flex-row">
                <span className="font-medium text-dark dark:text-white">—</span>
                <span className="text-body-sm">Posts</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 border-r border-stroke px-4 dark:border-dark-3 xsm:flex-row">
                <span className="font-medium text-dark dark:text-white">—</span>
                <span className="text-body-sm">Followers</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 px-4 xsm:flex-row">
                <span className="font-medium text-dark dark:text-white">—</span>
                <span className="text-body-sm-sm">Following</span>
              </div>
            </div>

            <div className="mx-auto max-w-[720px]">
              <h4 className="font-medium text-dark dark:text-white">
                About Me
              </h4>
              <p className="mt-4">
                {aboutText}
              </p>
            </div>

            <SocialAccounts links={profile.socialLinks} />

            {status === "error" && (
              <p className="mt-4 text-sm text-red">Unable to load latest profile; showing defaults.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
