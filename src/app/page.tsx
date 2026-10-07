import Link from "next/link";
import { PlanCards } from "@/components/plan-cards";
import { Logo } from "@/components/ui";
import { COUNTRY_CODES, MARKETS } from "@/lib/markets";

const STEPS = [
  {
    title: "Find a supplier product",
    body: "Search the CJ Dropshipping catalog, or enter any product with your own cost from AliExpress or elsewhere.",
  },
  {
    title: "See what it sells for, per country",
    body: "We pull live eBay listings in up to 8 countries, match them to your product and drop outliers.",
  },
  {
    title: "Know your real margin",
    body: "Margin after shipping, import duty, VAT and marketplace fees, so you can pick the country worth selling in.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-secondary">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Start free
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="py-16 text-center md:py-24">
          <p className="mb-4 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            Supplier cost × marketplace price × landed cost
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            Find dropshipping products that are actually profitable — and where
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            A price gap means nothing until shipping, duty, VAT and fees are paid. Dropio shows your margin after
            all of them, country by country.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              Start researching free
            </Link>
            <a href="#pricing" className="btn-secondary px-6 py-3 text-base">
              See pricing
            </a>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-2 text-sm text-muted">
            {COUNTRY_CODES.map((c) => (
              <span key={c} className="rounded-full border border-border bg-surface px-3 py-1">
                {MARKETS[c].flag} {MARKETS[c].name}
              </span>
            ))}
          </div>
        </section>

        <section className="grid gap-4 pb-16 md:grid-cols-3">
          {STEPS.map((step, i) => (
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
          <h2 className="mb-2 text-center text-3xl font-semibold tracking-tight">Simple monthly plans</h2>
          <p className="mb-10 text-center text-muted">
            Start free. Upgrade when you need more countries and analyses. Pay by card, LiqPay or monobank.
          </p>
          <PlanCards
            currency="both"
            action={(plan) => (
              <Link href="/signup" className={plan.id === "starter" ? "btn-primary w-full" : "btn-secondary w-full"}>
                {plan.priceUsd === 0 ? "Start free" : `Choose ${plan.name}`}
              </Link>
            )}
          />
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        Prices come from public marketplace listings and are estimates, not financial advice.
      </footer>
    </div>
  );
}
