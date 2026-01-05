"use client";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ADMIN_NAV_DATA, NAV_DATA } from "./data";
import { ArrowLeftIcon, ChevronUp } from "./icons";
import { MenuItem } from "./menu-item";
import { useSidebarContext } from "./sidebar-context";

export function Sidebar() {
  const pathname = usePathname();
  const { setIsOpen, isOpen, isMobile, toggleSidebar, isCollapsed, toggleCollapse } = useSidebarContext();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminResolved, setAdminResolved] = useState(!pathname?.startsWith("/admin"));
  const isLoadingAdmin = !adminResolved;

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) => (prev.includes(title) ? [] : [title]));

    // Uncomment the following line to enable multiple expanded items
    // setExpandedItems((prev) =>
    //   prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    // );
  };

  useEffect(() => {
    // Keep collapsible open, when it's subpage is active
    NAV_DATA.some((section) => {
      return section.items.some((item) => {
        return item.items.some((subItem) => {
          if (subItem.url === pathname) {
            if (!expandedItems.includes(item.title)) {
              toggleExpanded(item.title);
            }

            // Break the loop
            return true;
          }
        });
      });
    });
  }, [pathname]);

  useEffect(() => {
    if (isCollapsed) {
      setExpandedItems([]);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/session", {
          credentials: "include",
          cache: "no-store",
        });
        const body = await res.json().catch(() => ({}));
        const user = body?.user;
        const role = user?.app_metadata?.role;
        const meta = user?.user_metadata || {};
        const flag = meta.is_admin === true || meta.admin === true;
        if (role === "superadmin" || flag) {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error("Failed to load session for admin link", error);
      } finally {
        setAdminResolved(true);
      }
    };
    loadSession();
  }, [pathname]);

  const adminLink = useMemo(() => {
    if (!adminResolved || !isAdmin) return null;
    if (pathname?.startsWith("/admin")) return null;
    return (
      <button
        onClick={() => (window.location.href = "/admin")}
        title="Admin Dashboard"
        className={cn(
          "mt-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-3 py-3 text-sm font-semibold text-primary transition hover:bg-primary/15",
          isCollapsed && "w-12 justify-center px-0 py-2 text-xs",
        )}
      >
        {isCollapsed ? <span aria-hidden>⚙️</span> : <span>Admin Dashboard</span>}
        {!isCollapsed && <span aria-hidden className="text-xs">→</span>}
      </button>
    );
  }, [isAdmin, pathname, isCollapsed, adminResolved]);

  const backToUserLink = useMemo(() => {
    if (!adminResolved || !isAdmin) return null;
    if (!pathname?.startsWith("/admin")) return null;
    return (
      <button
        onClick={() => (window.location.href = "/")}
        title="Back to User Dashboard"
        className={cn(
          "mt-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10",
          isCollapsed && "w-12 justify-center px-0 py-2 text-xs",
        )}
      >
        {isCollapsed ? <span aria-hidden>🏠</span> : <span>Back to User Dashboard</span>}
        {!isCollapsed && <span aria-hidden className="text-xs">→</span>}
      </button>
    );
  }, [isAdmin, pathname, isCollapsed, adminResolved]);

  const navSections = useMemo(() => {
    if (pathname?.startsWith("/admin")) {
      if (!adminResolved) return [];
      if (isAdmin) return ADMIN_NAV_DATA;
      return [];
    }
    return NAV_DATA;
  }, [isAdmin, pathname, adminResolved]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "relative overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-200 ease-linear dark:border-gray-800 dark:bg-gray-dark",
          isMobile ? "fixed bottom-0 top-0 z-50 max-w-[320px]" : "sticky top-0 h-screen",
          isMobile
            ? isOpen
              ? "w-full"
              : "w-0 opacity-0"
            : isCollapsed
              ? "w-[84px]"
              : "w-[290px]",
        )}
        aria-label="Main navigation"
        aria-hidden={isMobile && !isOpen}
        inert={isMobile && !isOpen ? true : undefined}
      >
        {!isMobile && (
          <button
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "absolute -right-4 top-16 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/5 transition hover:-translate-x-0.5 dark:bg-dark-2",
              "border border-gray-100 dark:border-white/10",
            )}
          >
            <span
              className={cn(
                "text-lg font-semibold text-gray-700 dark:text-gray-200 transition-transform",
                isCollapsed ? "rotate-180" : "",
              )}
            >
              ⏴
            </span>
          </button>
        )}

        <div
          className={cn(
            "flex h-full flex-col py-10 transition-all duration-200",
            isCollapsed ? "pl-3 pr-2" : "pl-[25px] pr-[7px]",
          )}
        >
          <div
            className={cn(
              "relative pr-4.5",
              isCollapsed && "flex flex-col items-center justify-center gap-2 pr-0",
            )}
          >
            <Link
              href={"/"}
              onClick={() => isMobile && toggleSidebar()}
              className={cn(
                "px-0 py-2.5 min-[850px]:py-0",
                isCollapsed && "flex items-center justify-center",
              )}
            >
              {isCollapsed ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary dark:bg-white/10 dark:text-white">
                  MQ
                </div>
              ) : (
                <Logo />
              )}
            </Link>

            {isMobile && (
              <button
                onClick={toggleSidebar}
                className="absolute left-3/4 right-4.5 top-1/2 -translate-y-1/2 text-right"
              >
                <span className="sr-only">Close Menu</span>

                <ArrowLeftIcon className="ml-auto size-7" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <div
            className={cn(
              "custom-scrollbar mt-6 flex-1 overflow-y-auto pr-3 transition-[padding] duration-200 min-[850px]:mt-10",
              isCollapsed && "pr-1",
            )}
          >
            {isLoadingAdmin ? (
              <div className="space-y-4">
                <div className="h-4 w-24 rounded bg-gray-2 dark:bg-dark-3" />
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="h-10 rounded-lg bg-gray-2 dark:bg-dark-3" />
                  ))}
                </div>
              </div>
              ) : (
                <>
                  {navSections.map((section) => (
                    <div key={section.label} className="mb-6">
                      {!isCollapsed && (
                        <h2 className="mb-5 text-sm font-medium text-dark-4 dark:text-dark-6">
                          {section.label}
                        </h2>
                      )}

                      <nav role="navigation" aria-label={section.label}>
                        <ul className="space-y-2">
                          {section.items.map((item) => (
                            <li key={item.title}>
                              {item.items.length ? (
                                <div>
                                  <MenuItem
                                    isActive={item.items.some(
                                      ({ url }) => url === pathname,
                                    )}
                                    iconOnly={isCollapsed}
                                    onClick={() => toggleExpanded(item.title)}
                                  >
                                    <item.icon
                                      className={cn(
                                        "size-6 shrink-0",
                                        isCollapsed && "mx-auto",
                                      )}
                                      aria-hidden="true"
                                    />

                                    {!isCollapsed && <span>{item.title}</span>}

                                    {!isCollapsed && (
                                      <ChevronUp
                                        className={cn(
                                          "ml-auto rotate-180 transition-transform duration-200",
                                          expandedItems.includes(item.title) &&
                                            "rotate-0",
                                        )}
                                        aria-hidden="true"
                                      />
                                    )}
                                  </MenuItem>

                                  {!isCollapsed && expandedItems.includes(item.title) && (
                                    <ul
                                      className="ml-9 mr-0 space-y-1.5 pb-[15px] pr-0 pt-2"
                                      role="menu"
                                    >
                                      {item.items.map((subItem) => (
                                      <li key={subItem.title} role="none">
                                        <MenuItem
                                          as="link"
                                          href={subItem.url}
                                          isActive={pathname === subItem.url}
                                        >
                                          <span>{subItem.title}</span>
                                        </MenuItem>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ) : (
                              (() => {
                                const href =
                                  "url" in item
                                    ? item.url + ""
                                    : "/" +
                                      item.title.toLowerCase().split(" ").join("-");

                                return (
                                  <MenuItem
                                    className="flex items-center gap-3 py-3"
                                    as="link"
                                    href={href}
                                    isActive={pathname === href}
                                    iconOnly={isCollapsed}
                                  >
                                    <item.icon
                                      className={cn(
                                        "size-6 shrink-0",
                                        isCollapsed && "mx-auto",
                                      )}
                                      aria-hidden="true"
                                    />

                                    {!isCollapsed && <span>{item.title}</span>}
                                  </MenuItem>
                                );
                              })()
                            )}
                          </li>
                        ))}
                      </ul>
                    </nav>
                  </div>
                ))}
                <div className={cn("space-y-2 pt-2", isCollapsed && "flex flex-col items-center space-y-3")}>
                  {adminLink}
                  {backToUserLink}
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
