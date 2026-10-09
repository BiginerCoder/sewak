import { ReportForm } from "@/components/ReportForm";
import { PageHead } from "@/components/ui";
import { STAGES } from "@/lib/constants";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Report a problem" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ category?: string; description?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <PageHead title="Report a problem" eyebrow="New case">
        Tell your neighbours and the ward what needs fixing. A clear, specific report is the fastest way to get a case confirmed.
      </PageHead>

      <div className="workspace-grid has-rail">
        <div className="primary-content" style={{ maxWidth: 760 }}>
          <ReportForm initialCategory={sp.category} initialDescription={sp.description?.slice(0, 500)} />
        </div>

        <aside className="contextual-panel" aria-label="Reporting guidance">
          <section className="card widget">
            <h3>A useful report</h3>
            <ul className="bullets">
              <li>Says exactly where, with a landmark or block.</li>
              <li>Describes size, duration, and who is at risk.</li>
              <li>Includes one clear photo in daylight if possible.</li>
              <li>Checks <Link className="link" href="/cases?status=open">open cases</Link> first, so you can confirm instead of duplicating.</li>
            </ul>
          </section>
          <section className="card widget">
            <h3>What happens next</h3>
            <ol className="steps">
              {STAGES.map((s) => (
                <li key={s.n}><span><b style={{ fontWeight: 650 }}>{s.label}</b></span></li>
              ))}
            </ol>
          </section>
          <p className="small muted" style={{ margin: 0 }}>
            Demo app: reports are stored in this demo only and are not sent to any government body.
          </p>
        </aside>
      </div>
    </>
  );
}
