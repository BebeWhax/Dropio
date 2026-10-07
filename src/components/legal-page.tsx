import type { Metadata } from "next";
import { LEGAL_UPDATED, legalDocs, type LegalPage } from "@/content/legal";
import { Notice } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { env } from "@/lib/env";

const vars = () => ({ company: env.legalCompany, email: env.legalEmail, address: env.legalAddress, taxId: env.legalTaxId });

export async function legalMetadata(page: LegalPage): Promise<Metadata> {
  return { title: legalDocs[await getLocale()][page].title };
}

export async function LegalPageView({ page }: { page: LegalPage }) {
  const [locale, t] = await Promise.all([getLocale(), getMessages()]);
  const doc = legalDocs[locale][page];
  return (
    <article>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mb-6 text-sm text-muted">{fmt(t.legal.updated, { date: LEGAL_UPDATED })}</p>
      <Notice tone="warning">{t.legal.draft}</Notice>
      <div className="space-y-6">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="mb-2 font-semibold">{s.heading}</h2>
            {s.body.map((p) => (
              <p key={p} className="mb-2 text-sm leading-6 text-muted">
                {fmt(p, vars())}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
