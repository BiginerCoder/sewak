import { PageHead } from "@/components/ui";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Demo service page" };

export default async function PlaceholderPage({
  searchParams,
}: {
  searchParams: Promise<{ host?: string; title?: string }>;
}) {
  const { host, title } = await searchParams;

  return (
    <>
      <PageHead title="Demo service page" eyebrow="Govlinks sample">
        This destination is a placeholder used by the Govlinks demo. It is not a live government service.
      </PageHead>
      <section className="card form-card" style={{ maxWidth: 720 }}>
        <div className="callout">
          <ExternalLink size={16} aria-hidden />
          <span>Demo destination: <b>{title || "Government service"}</b>{host ? ` (${host})` : ""}</span>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          The visit has been logged. Return to the help assistant to report whether this page was useful.
        </p>
        <Link href="/ask" className="btn btn-primary" style={{ width: "fit-content" }}>
          <ArrowLeft size={16} aria-hidden /> Return to help
        </Link>
      </section>
    </>
  );
}
