"use client";

import { ChevronUpIcon } from "@/assets/icons";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LogOutIcon, SettingsIcon, UserIcon } from "./icons";

export function UserInfo() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<{
    name: string;
    email: string;
    img: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Try profile endpoint first to pick up latest metadata
        const res = await fetch("/api/auth/profile", {
          credentials: "include",
          cache: "no-store",
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body?.profile) {
          setUser({
            name: body.profile.fullName || body.profile.email || "User",
            email: body.profile.email || "Account",
            img: body.profile.avatarUrl || "/images/user/user-03.png",
          });
          return;
        }

        // Fallback to session
        const sessionRes = await fetch("/api/auth/session", {
          credentials: "include",
          cache: "no-store",
        });
        const sessionBody = await sessionRes.json().catch(() => ({}));
        const supabaseUser = sessionBody?.user;
        if (supabaseUser) {
          const fullName =
            supabaseUser.user_metadata?.full_name ||
            supabaseUser.user_metadata?.name ||
            supabaseUser.email ||
            "User";
          const avatar =
            supabaseUser.user_metadata?.avatar_url ||
            "/images/user/user-03.png";
          setUser({
            name: fullName,
            email: supabaseUser.email ?? "Account",
            img: avatar,
          });
        }
      } catch (error) {
        console.error("Unable to load user info", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const displayUser = useMemo(
    () =>
      user ?? {
        name: loading ? "Loading..." : "Guest",
        email: loading ? "" : "Not signed in",
        img: "/images/user/user-03.png",
      },
    [loading, user],
  );

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Failed to log out", error);
    } finally {
      router.replace("/auth/sign-in");
      router.refresh();
    }
  };

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="rounded align-middle outline-none ring-primary ring-offset-2 focus-visible:ring-1 dark:ring-offset-gray-dark">
        <span className="sr-only">My Account</span>

        <figure className="flex items-center gap-3">
          <Image
            src={displayUser.img}
            className="size-12"
            alt={`Avatar of ${displayUser.name}`}
            role="presentation"
            width={200}
            height={200}
          />
          <figcaption className="flex items-center gap-1 font-medium text-dark dark:text-dark-6 max-[1024px]:sr-only">
            <span>{displayUser.name}</span>

            <ChevronUpIcon
              aria-hidden
              className={cn(
                "rotate-180 transition-transform",
                isOpen && "rotate-0",
              )}
              strokeWidth={1.5}
            />
          </figcaption>
        </figure>
      </DropdownTrigger>

      <DropdownContent
        className="border border-stroke bg-white shadow-md dark:border-dark-3 dark:bg-gray-dark min-[230px]:min-w-[17.5rem]"
        align="end"
      >
        <h2 className="sr-only">User information</h2>

        <figure className="flex items-center gap-2.5 px-5 py-3.5">
          <Image
            src={displayUser.img}
            className="size-12"
            alt={`Avatar for ${displayUser.name}`}
            role="presentation"
            width={200}
            height={200}
          />

          <figcaption className="space-y-1 text-base font-medium">
            <div className="mb-2 leading-none text-dark dark:text-white">
              {displayUser.name}
            </div>

            <div className="leading-none text-gray-6">{displayUser.email}</div>
          </figcaption>
        </figure>

        <hr className="border-[#E8E8E8] dark:border-dark-3" />

        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6 [&>*]:cursor-pointer">
          <Link
            href={"/profile"}
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
          >
            <UserIcon />

            <span className="mr-auto text-base font-medium">View profile</span>
          </Link>

          <Link
            href={"/settings"}
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
          >
            <SettingsIcon />

            <span className="mr-auto text-base font-medium">
              Account Settings
            </span>
          </Link>
        </div>

        <hr className="border-[#E8E8E8] dark:border-dark-3" />

        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6">
          <button
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
            onClick={handleLogout}
          >
            <LogOutIcon />

            <span className="text-base font-medium">Log out</span>
          </button>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}
