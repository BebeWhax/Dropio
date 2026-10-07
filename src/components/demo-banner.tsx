import { Notice } from "@/components/ui";

/** Makes it obvious when numbers come from generated demo data rather than live APIs. */
export function DemoBanner({ suppliers, markets }: { suppliers: boolean; markets: boolean }) {
  if (!suppliers && !markets) return null;
  const parts = [
    suppliers && "supplier products (set CJ_API_KEY)",
    markets && "marketplace prices (set EBAY_CLIENT_ID / EBAY_CLIENT_SECRET, and SERPAPI_KEY for Ukraine)",
  ]
    .filter(Boolean)
    .join(" and ");
  return (
    <Notice tone="warning">
      <strong>Demo data:</strong> {parts} are simulated. Add the API keys in <code>.env</code> for live results.
    </Notice>
  );
}
