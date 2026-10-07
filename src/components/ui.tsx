import Link from "next/link";
import type { ReactNode } from "react";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm text-accent-foreground">D</span>
      Dropio
    </Link>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "success" | "error"; children: ReactNode }) {
  const styles = {
    info: "border-border bg-surface text-foreground",
    warning: "border-transparent bg-warning-bg text-warning-fg",
    success: "border-transparent bg-accent-soft text-accent",
    error: "border-transparent bg-negative/10 text-negative",
  }[tone];
  return <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Meter({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div className={`h-full rounded-full ${pct >= 100 ? "bg-negative" : "bg-accent"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-border/60 ${className}`} />;
}

export function ProductImage({ src, alt, size = 64 }: { src?: string | null; alt: string; size?: number }) {
  if (!src) {
    return (
      <div
        className="grid shrink-0 place-items-center rounded-lg bg-accent-soft text-lg font-semibold text-accent"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {alt.charAt(0).toUpperCase()}
      </div>
    );
  }
  // Supplier CDNs vary widely, so use a plain img rather than configuring next/image domains.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={size} height={size} className="shrink-0 rounded-lg border border-border object-cover" style={{ width: size, height: size }} />;
}

export const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

export const money = (n: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);

export const pct = (n: number) => `${n.toFixed(1)}%`;
