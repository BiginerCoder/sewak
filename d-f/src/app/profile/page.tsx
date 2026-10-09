import { Metric, PageHead } from "@/components/ui";
import { CURRENT_RESIDENT, WARD } from "@/lib/constants";
import { getContributions } from "@/lib/queries";
import { Award, CheckCircle2, FileText, Lock, MessageSquare, Search, ThumbsUp, Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const c = await getContributions();
  const resolvedByMe = c.reported.filter((i) => i.kind === "problem" && i.stage === 7).length;
  const verifs = c.verified.filter((v) => v.verdict === "fixed").length;

  const badges = [
    { icon: FileText, name: "First report", desc: "Reported a problem in the ward", got: c.reported.length > 0 },
    { icon: Users, name: "Neighbour confirmed", desc: "Confirmed another resident's case", got: c.confirmed.length > 0 },
    { icon: ThumbsUp, name: "Resolution checker", desc: "Verified whether a fix is real", got: c.verified.length > 0 },
    { icon: MessageSquare, name: "In the conversation", desc: "Commented on a case", got: c.commentCount > 0 },
    { icon: CheckCircle2, name: "Fixed together", desc: "A case you reported was community-verified", got: resolvedByMe > 0 },
  ];

  return (
    <>
      <PageHead title="Profile" eyebrow="Your civic contributions">
        A record of what you have reported, confirmed, and verified in Ward 24.
      </PageHead>

      <div className="workspace-grid has-rail">
        <div className="primary-content">
          <section className="card row" style={{ gap: 18 }}>
            <span className="avatar" style={{ width: 64, height: 64, fontSize: 22 }} aria-hidden>
              {CURRENT_RESIDENT.split(" ").map((p) => p[0]).join("")}
            </span>
            <div>
              <h2 className="section-title">{CURRENT_RESIDENT}</h2>
              <div className="small muted">
                Demo resident · {WARD.name}, {WARD.locality}, {WARD.city}
              </div>
            </div>
          </section>

          <section aria-label="Contribution summary" className="metrics" style={{ marginBottom: 0 }}>
            <Metric label="Reported issues" value={c.reported.length} icon={FileText} />
            <Metric label="Confirmed issues" value={c.confirmed.length} note="Other residents' cases" icon={Users} tone="blue" />
            <Metric label="Resolution checks" value={c.verified.length} note={`${verifs} said fixed`} icon={ThumbsUp} tone="green" />
            <Metric label="Comments" value={c.commentCount} icon={MessageSquare} />
          </section>

          <section className="card" aria-labelledby="bd">
            <div className="row between wrap" style={{ marginBottom: 14 }}>
              <h2 id="bd" className="section-title">Contribution badges</h2>
              <Link href="/contributions" className="link small">View all contributions →</Link>
            </div>
            <div className="badge-grid">
              {badges.map((b) => (
                <div key={b.name} className={`award${b.got ? "" : " locked"}`}>
                  <span className="ic" aria-hidden>{b.got ? <Award size={18} /> : <Lock size={16} />}</span>
                  <div>
                    <b>{b.name}</b>
                    <span>{b.desc}</span>
                    <span className="sr-only">{b.got ? " Earned" : " Not yet earned"}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="small muted" style={{ margin: "14px 0 0" }}>Badges are earned from real actions in this demo. There are no scores or rankings.</p>
          </section>
        </div>

        <aside className="contextual-panel" aria-label="Privacy">
          <section className="card widget">
            <h3>Privacy</h3>
            <ul className="bullets">
              <li>Your name appears on reports, confirmations and comments.</li>
              <li>Civic Network stores no phone number, email or exact address in this demo.</li>
              <li>Locations are simulated or typed by you. Your device location is never read.</li>
              <li>Photos you add are visible to everyone viewing the case.</li>
            </ul>
          </section>
          <section className="card widget">
            <h3>Next steps</h3>
            <div className="stack" style={{ gap: 8 }}>
              <Link href="/cases?status=awaiting" className="btn btn-secondary btn-sm">Verify a resolution</Link>
              <Link href="/cases?status=open" className="btn btn-secondary btn-sm">Confirm an open case</Link>
              <Link href="/ask" className="btn btn-secondary btn-sm"><Search size={14} aria-hidden /> Ask for help</Link>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
