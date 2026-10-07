import { Notice } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";

/** Makes it obvious when numbers come from generated demo data rather than live APIs. */
export async function DemoBanner({ suppliers, markets }: { suppliers: boolean; markets: boolean }) {
  if (!suppliers && !markets) return null;
  const t = (await getMessages()).common;
  const parts = [suppliers && t.demoSuppliers, markets && t.demoMarkets].filter(Boolean).join(t.and);
  return (
    <Notice tone="warning">
      <strong>{t.demoData}</strong> {fmt(t.demoSimulated, { parts })}
    </Notice>
  );
}
