/**
 * Denga brand mark — the sky-blue rounded "D" square.
 * Pure presentational; shared by the login screen and staff chrome.
 */
export function DengaMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-lg bg-sky-500/90 font-semibold text-white ${className ?? "h-8 w-8 text-sm"}`}
    >
      D
    </span>
  );
}
