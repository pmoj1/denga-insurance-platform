export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className ?? ""}`}>
      {children}
    </section>
  );
}

interface CardHeaderProps {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  /** Text color class for the count, e.g. "text-red-600". */
  accent?: string;
  actions?: React.ReactNode;
}

export function CardHeader({ title, icon, count, accent, actions }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        {count !== undefined && (
          <span className={`text-xl font-semibold tabular-nums ${accent ?? "text-slate-900"}`}>
            {count}
          </span>
        )}
      </div>
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className ?? "px-3 py-2.5"}>{children}</div>;
}
