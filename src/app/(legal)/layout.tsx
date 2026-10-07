import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PolicyLinks } from "@/components/policy-links";
import { Logo } from "@/components/ui";
import { getMessages } from "@/i18n/server";

export default async function LegalLayout({ children }: LayoutProps<"/">) {
  const t = await getMessages();
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            {t.legal.home}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">{children}</main>
      <footer className="border-t border-border py-6">
        <PolicyLinks className="mx-auto max-w-3xl justify-center px-4" />
      </footer>
    </div>
  );
}
