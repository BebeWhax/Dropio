import { LegalPageView, legalMetadata } from "@/components/legal-page";

export const generateMetadata = () => legalMetadata("terms");

export default function Page() {
  return <LegalPageView page="terms" />;
}
