"use client";

import { SearchIcon } from "@/assets/icons";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSidebarContext } from "../sidebar/sidebar-context";
import { MenuIcon } from "./icons";
import { Notification } from "./notification";
import { ThemeToggleSwitch } from "./theme-toggle";
import { UserInfo } from "./user-info";

type SearchResult = {
  id: string;
  type: "reel" | "quote" | "channel" | "video" | "script";
  title: string;
  subtitle?: string | null;
  href: string;
};

export function Header() {
  const { toggleSidebar, isMobile } = useSidebarContext();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!trimmedQuery) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (mountedRef.current) setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          cache: "no-store",
        });
        const body = await res.json().catch(() => ({}));
        if (mountedRef.current) {
          if (res.ok && Array.isArray(body.results)) {
            setResults(body.results);
            setOpen(true);
          } else {
            setResults([]);
            setOpen(true);
          }
        }
      } catch {
        if (mountedRef.current) {
          setResults([]);
          setOpen(true);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmedQuery]);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stroke bg-white px-4 py-5 shadow-1 dark:border-stroke-dark dark:bg-gray-dark md:px-5 2xl:px-10">
      <button
        onClick={toggleSidebar}
        className="rounded-lg border px-1.5 py-1 dark:border-stroke-dark dark:bg-[#020D1A] hover:dark:bg-[#FFFFFF1A] lg:hidden"
      >
        <MenuIcon />
        <span className="sr-only">Toggle Sidebar</span>
      </button>

      {isMobile && (
        <Link href={"/"} className="ml-2 max-[430px]:hidden min-[375px]:ml-4">
          <Image
            src={"/images/logo/logo-icon.svg"}
            width={32}
            height={32}
            alt=""
            role="presentation"
          />
        </Link>
      )}

      <div className="max-xl:hidden">
        <h1 className="mb-0.5 text-heading-5 font-bold text-dark dark:text-white">
          Dashboard
        </h1>
        <p className="font-medium">MediaQuotes_AI Dashboard</p>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 min-[375px]:gap-4">
        <div className="relative w-full max-w-[300px]">
          <input
            type="search"
            placeholder="Search"
            className="flex w-full items-center gap-3.5 rounded-full border bg-gray-2 py-3 pl-[53px] pr-5 outline-none transition-colors focus-visible:border-primary dark:border-dark-3 dark:bg-dark-2 dark:hover:border-dark-4 dark:hover:bg-dark-3 dark:hover:text-dark-6 dark:focus-visible:border-primary"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              if (results.length || trimmedQuery) setOpen(true);
            }}
            onBlur={() => {
              setTimeout(() => setOpen(false), 150);
            }}
          />

          <SearchIcon className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 max-[1015px]:size-5" />

          {open && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-gray-3 bg-white shadow-lg dark:border-stroke-dark dark:bg-dark-2">
              {loading ? (
                <div className="px-4 py-3 text-sm text-gray-6 dark:text-dark-6">Searching...</div>
              ) : results.length ? (
                <ul className="max-h-72 overflow-y-auto py-1">
                  {results.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 px-4 py-2 text-left text-sm text-dark transition hover:bg-gray-1 dark:text-dark-8 dark:hover:bg-dark-3"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setOpen(false);
                          setQuery("");
                          setResults([]);
                          router.push(item.href);
                        }}
                      >
                        <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full bg-primary/10 px-2 text-[11px] font-semibold uppercase text-primary">
                          {item.type}
                        </span>
                        <span className="flex flex-col">
                          <span className="font-semibold">{item.title}</span>
                          {item.subtitle ? (
                            <span className="text-xs text-gray-6 dark:text-dark-6">{item.subtitle}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-3 text-sm text-gray-6 dark:text-dark-6">No matches found.</div>
              )}
            </div>
          )}
        </div>

        <ThemeToggleSwitch />

        <Notification />

        <div className="shrink-0">
          <UserInfo />
        </div>
      </div>
    </header>
  );
}
