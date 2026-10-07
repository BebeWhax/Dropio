import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PlanCards } from "@/components/plan-cards";
import { PolicyLinks } from "@/components/policy-links";
import { Logo } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { COUNTRY_CODES, MARKETS } from "@/lib/markets";

export default async function Home() {
  const t = await getMessages();
  const l = t.landing;
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:flex" />
          <Link href="/login" className="btn-secondary">
            {l.login}
          </Link>
          <Link href="/signup" className="btn-primary">
            {l.startFree}
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="py-16 text-center md:py-24">
          <p className="mb-4 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">{l.badge}</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">{l.title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">{l.subtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              {l.ctaPrimary}
            </Link>
            <a href="#pricing" className="btn-secondary px-6 py-3 text-base">
              {l.ctaPricing}
            </a>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-2 text-sm text-muted">
            {COUNTRY_CODES.map((c) => (
              <span key={c} className="rounded-full border border-border bg-surface px-3 py-1">
                {MARKETS[c].flag} {t.countries[c]}
              </span>
            ))}
          </div>
        </section>

        <section className="grid gap-4 pb-16 md:grid-cols-3">
          {l.steps.map((step, i) => (
            <div key={step.title} className="card p-6">
              <div className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                {i + 1}
              </div>
              <h2 className="font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm text-muted">{step.body}</p>
            </div>
          ))}
        </section>

        <section id="pricing" className="pb-24">
          <h2 className="mb-2 text-center text-3xl font-semibold tracking-tight">{l.pricingTitle}</h2>
          <p className="mb-10 text-center text-muted">{l.pricingSubtitle}</p>
          <PlanCards
            currency="both"
            action={(plan) => (
              <Link href="/signup" className={plan.id === "starter" ? "btn-primary w-full" : "btn-secondary w-full"}>
                {plan.priceUsd === 0 ? l.startFree : fmt(l.choosePlan, { plan: t.plans[plan.id].name })}
              </Link>
            )}
          />
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4">
          <LanguageSwitcher className="sm:hidden" />
          <PolicyLinks className="justify-center" />
          <p>{t.common.footerDisclaimer}</p>
        </div>
      </footer>
    </div>
  );
}
