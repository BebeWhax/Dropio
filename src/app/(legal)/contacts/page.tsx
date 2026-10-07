import { LegalPageView, legalMetadata } from "@/components/legal-page";

export const generateMetadata = () => legalMetadata("contacts");

export default function Page() {
  return <LegalPageView page="contacts" />;
}
