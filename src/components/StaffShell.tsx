import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { DengaMark } from "@/components/DengaMark";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/claims", label: "Claims" },
  { href: "/renewals", label: "Renewals" },
] as const;

/**
 * Shared staff chrome (header + nav + sign-out) used by every staff area.
 * Server component: enforces auth and renders the top bar once, DRY across
 * /dashboard, /claims and /renewals.
 */
export async function StaffShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
      <header className="no-print border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <Link
                href="/dashboard"
                className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <DengaMark className="h-7 w-7 text-xs" />
                <span className="text-base font-semibold tracking-tight text-white">
                  Denga
                </span>
              </Link>
              {/* Desktop nav — sits beside the wordmark */}
              <nav className="hidden items-center gap-1 text-sm sm:flex">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-3 py-1.5 font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-xs text-slate-500 md:block">
                {session.user.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
                  Sign out
                </button>
              </form>
            </div>
          </div>
          {/* Mobile nav — second row so nothing overflows on small screens */}
          <nav className="flex items-center gap-1 pb-2 text-sm sm:hidden">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-2.5 py-1 font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
