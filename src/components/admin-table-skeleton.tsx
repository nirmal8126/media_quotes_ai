"use client";

type Props = {
  rows?: number;
  columns?: number;
};

export function AdminTableSkeleton({ rows = 5, columns = 4 }: Props) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-5 w-40 rounded bg-gray-2 dark:bg-dark-3" />
      <div className="space-y-2 rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 rounded-lg border border-gray-2 bg-gray-1 px-3 py-3 dark:border-stroke-dark dark:bg-dark-3"
          >
            {Array.from({ length: columns }).map((__, cidx) => (
              <div
                key={`${idx}-${cidx}`}
                className="h-4 flex-1 rounded bg-gray-3 dark:bg-dark-4"
                style={{ maxWidth: `${120 + cidx * 40}px` }}
              />
            ))}
            <div className="h-8 w-24 rounded bg-gray-3 dark:bg-dark-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
