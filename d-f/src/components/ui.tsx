import { CATEGORIES, STAGES, categoryOf, fmtDate, initials, stageOf, timeAgo } from "@/lib/constants";
import type { IssueRow } from "@/lib/queries";
import { ArrowRight, Check, MessageSquare, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function StatusBadge({ kind, stage }: { kind: string; stage: number }) {
  if (kind === "information") return <span className="badge blue plain">Information</span>;
  const s = stageOf(stage);
  return <span className={`badge ${s.tone}`}>{s.n === 6 ? "Authority says resolved · unverified" : s.label}</span>;
}

export function Avatar({ name, small }: { name: string; small?: boolean }) {
  return (
    <span className={`avatar${small ? " avatar-sm" : ""}`} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function IssueCard({ issue }: { issue: IssueRow }) {
  const cat = categoryOf(issue.category);
  const isProblem = issue.kind === "problem";
  return (
    <article className="card issue-card">
      <div className="issue-top">
        <div className="row wrap" style={{ gap: 10 }}>
          <StatusBadge kind={issue.kind} stage={issue.stage} />
          <span className="tag">{cat.label}</span>
        </div>
        {isProblem && <span className="case-id">Case #{12300 + issue.id}</span>}
      </div>
      <div style={{ minWidth: 0 }}>
        <h3 className="issue-title">
          <Link href={`/cases/${issue.id}`} className="stretched">
            {issue.title}
          </Link>
        </h3>
        <p className="issue-desc">{issue.description}</p>
      </div>
      {issue.thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="issue-thumb" src={issue.thumbUrl} alt={`Evidence photo for ${issue.title}`} loading="lazy" />
      )}
      <div className="issue-meta">
        <span>
          <Avatar name={issue.author} small /> {issue.author} · {timeAgo(issue.createdAt)}
        </span>
        {isProblem && (
          <span title="Residents who confirmed they are affected">
            <Users size={15} aria-hidden /> {issue.affectedCount} affected
          </span>
        )}
        <span>
          <MessageSquare size={15} aria-hidden /> {issue.commentCount} {issue.commentCount === 1 ? "comment" : "comments"}
        </span>
        <span className="open-hint" aria-hidden>
          {isProblem ? "Open case" : "Read notice"} <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />
        </span>
      </div>
    </article>
  );
}

export function Metric({
  label, value, note, icon: Icon, tone,
}: { label: string; value: number | string; note?: string; icon: LucideIcon; tone?: "amber" | "green" | "blue" }) {
  return (
    <div className="card metric">
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        {note && <div className="metric-note">{note}</div>}
      </div>
      <span className={`metric-icon ${tone ?? ""}`} aria-hidden>
        <Icon size={18} />
      </span>
    </div>
  );
}

const STAGE_SRC = ["Resident", "Community", "Resident", "Authority (reported)", "Authority (reported)", "Authority (reported)", "Community"];

export function Lifecycle({ stage }: { stage: number }) {
  return (
    <div className="lifecycle-wrap">
      <ol className="lifecycle" aria-label="Case lifecycle, seven stages">
        {STAGES.map((s) => {
          const done = s.n < stage || (s.n === 7 && stage === 7);
          const current = s.n === stage && !done;
          const state = done ? "done" : current ? "current" : "future";
          return (
            <li key={s.n} className={`lc-step s${s.n} ${state}`} aria-current={current || (s.n === 7 && stage === 7) ? "step" : undefined} title={s.desc}>
              <span className="lc-dot">{done ? <Check size={16} aria-hidden /> : s.n}</span>
              <span>
                <span className="lc-name">{s.label}</span>
                <span className="lc-src" style={{ display: "block" }}>{STAGE_SRC[s.n - 1]}</span>
                <span className="sr-only">{done ? " (completed)" : current ? " (current stage)" : " (upcoming)"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="legend" aria-label="Legend">
        <span><i style={{ background: "var(--primary)" }} /> Resident or community step</span>
        <span><i style={{ background: "#d49a1a" }} /> Authority-reported (not independently checked)</span>
        <span><i style={{ background: "#2f9e55" }} /> Community-verified resolution</span>
      </div>
    </div>
  );
}

export function MiniProgress({ stage }: { stage: number }) {
  return (
    <div className="mini-progress" role="img" aria-label={`Stage ${stage} of 7: ${stageOf(stage).label}`}>
      {STAGES.map((s) => (
        <i key={s.n} className={s.n <= stage ? (s.n === 7 ? "ok" : s.n >= 4 && s.n <= 6 ? "auth" : "on") : ""} />
      ))}
    </div>
  );
}

export function PageHead({ title, children, actions, eyebrow }: { title: string; children?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function SourceLabel({ q }: { q: "official" | "demo" | "resident" | "community" }) {
  const text = {
    official: "Official portal · confirm before use",
    demo: "Demo placeholder · not verified",
    resident: "Resident-submitted · unverified",
    community: "Community-verified",
  }[q];
  return <span className={`source ${q}`}>{text}</span>;
}

export function WardSnapshot({ unresolved, resolved }: { unresolved: number; resolved: number }) {
  return (
    <section className="card widget" aria-labelledby="w-snap">
      <h3 id="w-snap">Ward snapshot</h3>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontFamily: "var(--font-head)", fontSize: 17 }}>Ward 24</div>
        <div className="small muted">Shastri Nagar, Jaipur</div>
      </div>
      <div className="kv">
        <div><b>{unresolved}</b><span>Unresolved</span></div>
        <div><b>{resolved}</b><span>Community-verified resolved</span></div>
      </div>
    </section>
  );
}

export function PriorityIssues({ issues }: { issues: IssueRow[] }) {
  return (
    <section className="card widget" aria-labelledby="w-pri">
      <h3 id="w-pri">Priority issues</h3>
      {issues.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>No unresolved cases right now.</p>
      ) : (
        <ul className="list-links">
          {issues.map((i) => (
            <li key={i.id}>
              <Link href={`/cases/${i.id}`}>
                <span className="t">{i.title}</span>
                <span className="row wrap" style={{ gap: 8 }}>
                  <StatusBadge kind={i.kind} stage={i.stage} />
                  <span className="small muted">{i.affectedCount} affected</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function categoryLabel(id: string) {
  return (CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]).label;
}

export { fmtDate };
