"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/research", label: "Product research" },
  { href: "/dashboard/duty", label: "Duty calculator" },
  { href: "/dashboard/saved", label: "Watchlist" },
  { href: "/dashboard/settings", label: "Cost settings" },
  { href: "/dashboard/billing", label: "Plan & billing" },
];

/** Highlights the current section. Reads the URL, so render it inside <Suspense>. */
export function DashboardNav() {
  return <NavLinks pathname={usePathname()} />;
}

/** Plain links without highlighting; also the Suspense fallback for DashboardNav. */
export function NavLinks({ pathname = "" }: { pathname?: string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {LINKS.map((link) => {
        const active =
          link.href === "/dashboard"
            ? pathname === link.href
            : pathname.startsWith(link.href) || (link.href === "/dashboard/research" && pathname.startsWith("/dashboard/analyze"));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
