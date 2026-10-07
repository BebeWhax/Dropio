import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { DashboardNav, NavLinks } from "@/components/dashboard-nav";
import { Logo, Skeleton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/plans";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-border px-4 py-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0 md:py-6">
        <div className="mb-4 flex items-center justify-between md:mb-8">
          <Logo href="/dashboard" />
        </div>
        <Suspense fallback={<NavLinks />}>
          <DashboardNav />
        </Suspense>
        <div className="mt-4 md:absolute md:bottom-6 md:left-4 md:right-4">
          <Suspense fallback={<Skeleton className="h-14" />}>
            <AccountBox />
          </Suspense>
        </div>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

async function AccountBox() {
  const user = await getCurrentUser();
  if (!user) return null;
  const plan = effectivePlan(user);
  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <div className="truncate font-medium" title={user.email}>
        {user.name ?? user.email}
      </div>
      <div className="mt-0.5 flex items-center justify-between text-xs text-muted">
        <span>{plan.name} plan</span>
        <form action={logout}>
          <button type="submit" className="hover:text-foreground">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
