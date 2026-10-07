import { LegalPageView, legalMetadata } from "@/components/legal-page";

export const generateMetadata = () => legalMetadata("refunds");

export default function Page() {
  return <LegalPageView page="refunds" />;
}
