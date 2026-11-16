export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  brand: "bg-sky-50 text-sky-700 border-sky-200",
};

interface BadgeProps {
  tone?: BadgeTone;
  /** Escape hatch for existing mappings (e.g. STATUS_STYLES) — overrides tone. */
  className?: string;
  children: React.ReactNode;
}

export function Badge({ tone = "neutral", className, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${className ?? TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
