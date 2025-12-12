"use client";

import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-3 bg-white p-6 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-dark dark:text-dark-8">Dashboard</h1>
        <p className="text-sm text-gray-6 dark:text-dark-6">
          Overview for superadmin. Add analytics, graphs, and system health here.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-3 bg-white p-10 text-center text-sm text-gray-6 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2 dark:text-dark-6">
        Analytics / graphs placeholder. Hook up metrics (usage, reels generated, top channels, revenue) here.
      </div>
    </div>
  );
}
