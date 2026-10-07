"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/provider";

export const POLICY_LINKS = [
  { href: "/terms", key: "terms" },
  { href: "/privacy", key: "privacy" },
  { href: "/refunds", key: "refunds" },
  { href: "/contacts", key: "contacts" },
] as const;

export function PolicyLinks({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <nav aria-label="Policies" className={`flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted ${className}`}>
      {POLICY_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-foreground">
          {t.legal[l.key]}
        </Link>
      ))}
    </nav>
  );
}
