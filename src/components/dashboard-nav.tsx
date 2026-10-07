"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PolicyLinks } from "@/components/policy-links";
import { Logo } from "@/components/ui";
import { useI18n } from "@/i18n/provider";
import type { Messages } from "@/i18n/messages";

type NavKey = keyof Messages["nav"];

const MAIN_LINKS: { href: string; key: NavKey; also?: string[] }[] = [
  { href: "/dashboard", key: "overview" },
  { href: "/dashboard/research", key: "research", also: ["/dashboard/analyze"] },
  { href: "/dashboard/bulk", key: "bulk" },
  { href: "/dashboard/image", key: "image" },
  { href: "/dashboard/duty", key: "duty" },
  { href: "/dashboard/shipping", key: "shipping" },
  { href: "/dashboard/channels", key: "channels" },
  { href: "/dashboard/saved", key: "watchlist" },
  { href: "/dashboard/settings", key: "costSettings" },
];

function isActive(pathname: string, href: string, also: string[] = []): boolean {
  if (href === "/dashboard") return pathname === href;
  return [href, ...also].some((p) => pathname.startsWith(p));
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * Sidebar contents shared by desktop and the mobile drawer: main sections on top;
 * plan & billing and language at the bottom, above the account box and policies.
 */
function NavContents({ account }: { account: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <nav className="space-y-1" aria-label={t.nav.menu}>
        {MAIN_LINKS.map((l) => (
          <NavLink key={l.href} href={l.href} active={isActive(pathname, l.href, l.also)}>
            {t.nav[l.key]}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-3 pt-6">
        <NavLink href="/dashboard/billing" active={isActive(pathname, "/dashboard/billing")}>
          {t.nav.billing}
        </NavLink>
        <LanguageSwitcher className="px-3" />
        {account}
        <PolicyLinks className="px-1" />
      </div>
    </div>
  );
}

export function DesktopSidebar({ account }: { account: ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
      <div className="mb-8">
        <Logo href="/dashboard" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NavContents account={account} />
      </div>
    </aside>
  );
}

/** Top bar with a slide-in menu on phones. */
export function MobileNav({ account }: { account: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Close the drawer after navigating.
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Logo href="/dashboard" />
        <button
          type="button"
          onClick={() => {
            setOpenedAt(pathname);
            setOpen(true);
          }}
          aria-label={t.nav.openMenu}
          aria-expanded={open}
          className="rounded-lg border border-border px-3 py-1.5 text-sm"
        >
          ☰ {t.nav.menu}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={t.nav.menu}>
          <button type="button" aria-label={t.nav.closeMenu} className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col bg-background p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Logo href="/dashboard" />
              <button type="button" onClick={() => setOpen(false)} aria-label={t.nav.closeMenu} className="rounded-lg px-2 py-1 text-lg">
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NavContents account={account} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
