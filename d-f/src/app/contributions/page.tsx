import { IssueCard, PageHead, StatusBadge } from "@/components/ui";
import { getContributions } from "@/lib/queries";
import { Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "My contributions" };

export default async function ContributionsPage() {
  const c = await getContributions();
  return (
    <>
      <PageHead
        title="My contributions"
        eyebrow="Your activity"
        actions={
          <Link href="/report" className="btn btn-primary">
            <Plus size={16} aria-hidden /> Report a problem
          </Link>
        }
      >
        Everything you have reported, confirmed, and verified.
      </PageHead>

      <div className="primary-content" style={{ maxWidth: 860 }}>
        <section aria-labelledby="c-rep" className="stack">
          <h2 id="c-rep" className="section-title">Reported by you <span className="muted" style={{ fontSize: 16, fontWeight: 500 }}>({c.reported.length})</span></h2>
          {c.reported.length === 0 ? (
            <div className="card empty"><b>Nothing reported yet</b>Your reports will appear here.</div>
          ) : (
            <div className="feed">{c.reported.map((i) => <IssueCard key={i.id} issue={i} />)}</div>
          )}
        </section>

        <section aria-labelledby="c-conf" className="stack">
          <h2 id="c-conf" className="section-title">Confirmed by you <span className="muted" style={{ fontSize: 16, fontWeight: 500 }}>({c.confirmed.length})</span></h2>
          {c.confirmed.length === 0 ? (
            <div className="card empty"><b>No confirmations yet</b>Open a case and choose “I&apos;m affected too”.</div>
          ) : (
            <div className="feed">{c.confirmed.map((i) => <IssueCard key={i.id} issue={i} />)}</div>
          )}
        </section>

        <section aria-labelledby="c-ver" className="stack">
          <h2 id="c-ver" className="section-title">Resolution checks <span className="muted" style={{ fontSize: 16, fontWeight: 500 }}>({c.verified.length})</span></h2>
          {c.verified.length === 0 ? (
            <div className="card empty"><b>No resolution checks yet</b>When an authority says a case is fixed, you can confirm on site.</div>
          ) : (
            <div className="card">
              <ul className="list-links">
                {c.verified.map((v) => (
                  <li key={v.issue.id}>
                    <Link href={`/cases/${v.issue.id}`}>
                      <span className="t">{v.issue.title}</span>
                      <span className="row wrap" style={{ gap: 8 }}>
                        <StatusBadge kind={v.issue.kind} stage={v.issue.stage} />
                        <span className="small muted">You said: {v.verdict === "fixed" ? "fixed" : "not fixed"}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
