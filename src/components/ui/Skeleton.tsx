/** Loading placeholder block. Size it with className (e.g. "h-4 w-32"). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-200/70 ${className ?? "h-4 w-full"}`} />;
}
