import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { DesktopSidebar, MobileNav } from "@/components/dashboard-nav";
import { Skeleton } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const account = (
    <Suspense fallback={<Skeleton className="h-14" />}>
      <AccountBox />
    </Suspense>
  );
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <MobileNav account={account} />
      <DesktopSidebar account={account} />
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

async function AccountBox() {
  const [user, t] = await Promise.all([getCurrentUser(), getMessages()]);
  if (!user) return null;
  const plan = effectivePlan(user);
  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <div className="truncate font-medium" title={user.email}>
        {user.name ?? user.email}
      </div>
      <div className="mt-0.5 flex items-center justify-between text-xs text-muted">
        <span>{fmt(t.nav.planSuffix, { plan: t.plans[plan.id].name })}</span>
        <form action={logout}>
          <button type="submit" className="hover:text-foreground">
            {t.nav.logOut}
          </button>
        </form>
      </div>
    </div>
  );
}
