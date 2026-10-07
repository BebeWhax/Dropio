import { LanguageSwitcher } from "@/components/language-switcher";
import { PolicyLinks } from "@/components/policy-links";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <LanguageSwitcher />
        </div>
        <div className="card p-6">{children}</div>
        <PolicyLinks className="mt-6 justify-center" />
      </div>
    </main>
  );
}
