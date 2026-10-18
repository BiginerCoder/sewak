import { AreaLinks } from "@/components/AreaLinks";
import { PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Area service links" };

export default function ServicesPage() {
  return (
    <>
      <PageHead title="Government services for your area" eyebrow="Area service directory">
        Choose a supported ward or use your device location to see every available government service link for that area.
      </PageHead>
      <AreaLinks />
    </>
  );
}
