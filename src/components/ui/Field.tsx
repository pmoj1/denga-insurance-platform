const INPUT_CLASSES =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${INPUT_CLASSES} ${className ?? ""}`} {...rest} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${INPUT_CLASSES} cursor-pointer ${className ?? ""}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${INPUT_CLASSES} resize-y leading-relaxed ${className ?? ""}`} {...rest} />;
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | null;
  helper?: string;
  children: React.ReactNode;
}

/** Label + control + helper/error wrapper. Error renders with role="alert". */
export function Field({ label, htmlFor, error, helper, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      ) : (
        helper && <p className="mt-1.5 text-xs text-slate-400">{helper}</p>
      )}
    </div>
  );
}
