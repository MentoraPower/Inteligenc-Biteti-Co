import { Skeleton } from "@/components/ui/skeleton";

interface CRMColumnsSkeletonProps {
  /** Number of skeleton columns. Falls back to the last persisted count, then 4. */
  count?: number;
}

function resolveCount(count?: number): number {
  if (typeof count === "number" && count > 0) return count;
  try {
    const v = parseInt(localStorage.getItem("crm_cols_last") || "", 10);
    if (Number.isFinite(v) && v > 0) return v;
  } catch {
    /* ignore */
  }
  return 4;
}

/**
 * Loading skeleton that mirrors the real Kanban columns (same width, borders and
 * header layout) with the correct column count and NO pipeline names. Used both
 * as the CRM Suspense/auth fallback and inside the board while data loads, so the
 * loading visual is identical and shows up instantly.
 */
export function CRMColumnsSkeleton({ count }: CRMColumnsSkeletonProps) {
  const n = resolveCount(count);
  return (
    <div className="flex gap-4 overflow-x-auto overflow-y-hidden flex-1 pb-0 min-h-0 h-full board-scroll-x">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={`sk-${i}`}
          className="flex-shrink-0 w-[420px] flex flex-col min-h-0 relative"
        >
          <div className="flex-1 min-h-0 rounded-xl rounded-b-none border border-b-0 bg-card border-black/[0.04] dark:border-white/[0.06] flex flex-col overflow-hidden">
            {/* Header (matches VirtualizedKanbanColumn, no name) */}
            <div className="px-4 pt-4 pb-2 border-b border-black/5 dark:border-white/[0.06] bg-black/[0.03] dark:bg-white/[0.04]">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
              <Skeleton className="h-5 w-32" />
            </div>
            {/* Cards */}
            <div className="flex-1 overflow-hidden px-4 py-3 space-y-2.5">
              {Array.from({ length: 3 + (i % 3) }).map((_, c) => (
                <Skeleton key={c} className="h-[140px] w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
