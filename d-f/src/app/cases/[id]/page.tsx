"use client";

import { AuthorityForm, CommentForm, ConfirmAffected, EvidenceForm, VerifyPanel } from "@/components/CaseActions";
import { Avatar, Lifecycle, SourceLabel, StatusBadge } from "@/components/ui";
import {
  EVIDENCE_PHASES, REOPEN_THRESHOLD, VERIFY_THRESHOLD, caseNumber, categoryOf, fmtDate, fmtDateTime, stageOf, timeAgo,
} from "@/lib/constants";
import { getIssueDetail } from "@/lib/queries";
import { Camera, ClipboardEdit, ExternalLink, Info, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useParams } from "next/navigation";
import { useDemoData } from "@/lib/demo-store";

export default function CaseDetail() {
  const { data, isReady } = useDemoData();
  const { id } = useParams<{ id: string }>();
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();
  const d = getIssueDetail(data, n);
  if (!d) {
    if (!isReady) return <div className="card empty" role="status">Loading saved demo case…</div>;
    notFound();
  }
  const { issue } = d;
  const cat = categoryOf(issue.category);
  const isCase = issue.kind === "problem";
  const fixed = d.verifications.filter((v) => v.verdict === "fixed");
  const notFixed = d.verifications.filter((v) => v.verdict === "not_fixed");
  const withNotes = d.verifications.filter((v) => v.note);

  return (
    <div className="workspace-grid has-rail">
      <div className="primary-content">
        {/* 1 + 2: Title & problem */}
        <section className="card" aria-labelledby="case-title">
          <div className="row wrap" style={{ gap: 10 }}>
            <span className="case-id">{isCase ? `Case #${caseNumber(issue.id)}` : "Community notice"}</span>
            <span className="tag">{cat.label}</span>
            <StatusBadge kind={issue.kind} stage={issue.stage} />
          </div>
          <h1 id="case-title" className="case-title">{issue.title}</h1>
          <p style={{ margin: "14px 0 0", maxWidth: "70ch", fontSize: 15.5 }}>{issue.description}</p>
          <hr className="divider" />
          <dl className="row wrap" style={{ gap: "10px 32px", margin: 0 }}>
            <div className="row" style={{ gap: 10 }}>
              <Avatar name={issue.author} small />
              <div>
                <dt className="small muted">Reported by</dt>
                <dd style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{issue.author}</dd>
              </div>
            </div>
            <div>
              <dt className="small muted">Submitted</dt>
              <dd style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{fmtDate(issue.createdAt)} · {timeAgo(issue.createdAt)}</dd>
            </div>
            <div>
              <dt className="small muted">Location</dt>
              <dd style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                <MapPin size={13} aria-hidden style={{ verticalAlign: "-1px" }} /> {issue.locationText}
                {issue.locationSimulated && <span className="small muted" style={{ fontWeight: 400 }}> (simulated demo location)</span>}
              </dd>
            </div>
          </dl>
        </section>

        {isCase && (
          <>
            {/* 3: Lifecycle */}
            <section className="card" aria-labelledby="lc-title">
              <div className="row between wrap" style={{ marginBottom: 18 }}>
                <h2 id="lc-title" className="section-title">Case lifecycle</h2>
                <span className="small muted">Stage {issue.stage} of 7 · {stageOf(issue.stage).label}</span>
              </div>
              <Lifecycle stage={issue.stage} />
              {issue.stage === 6 && (
                <div className="callout" style={{ marginTop: 16 }} role="note">
                  <Info size={16} aria-hidden />
                  <span><b>Authority-reported only.</b> This case is not counted as resolved until {VERIFY_THRESHOLD} residents confirm the problem is actually fixed.</span>
                </div>
              )}
              {issue.stage === 7 && (
                <div className="callout ok" style={{ marginTop: 16 }} role="note">
                  <Info size={16} aria-hidden />
                  <span><b>Community-verified.</b> Residents confirmed the problem is fixed.</span>
                </div>
              )}
            </section>

            {/* 4: Confirmation */}
            <section className="card" aria-label="Community confirmation">
              <ConfirmAffected issueId={issue.id} confirmed={d.confirmed} count={issue.affectedCount} />
            </section>
          </>
        )}

        {/* 5: Evidence */}
        <section className="card" aria-labelledby="ev-title">
          <div className="row between wrap" style={{ marginBottom: 16 }}>
            <h2 id="ev-title" className="section-title">Evidence</h2>
            <span className="small muted">{d.evidence.length} {d.evidence.length === 1 ? "item" : "items"}</span>
          </div>
          <div className="evidence-cols">
            {EVIDENCE_PHASES.map((p) => {
              const items = d.evidence.filter((e) => e.phase === p.id);
              return (
                <div className="ev-col" key={p.id}>
                  <h4>{p.label} <span>{items.length}</span></h4>
                  {items.length === 0 && (
                    <div className="ev-empty">
                      <span>
                        <Camera size={18} aria-hidden style={{ display: "block", margin: "0 auto 4px" }} />
                        No {p.label.toLowerCase()} evidence yet
                      </span>
                    </div>
                  )}
                  {items.map((e) => (
                    <figure className="ev-item" key={e.id}>
                      {e.hasImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.imageUrl ?? undefined} alt={e.caption} loading="lazy" />
                      ) : (
                        <div className="ev-empty">No photo provided</div>
                      )}
                      <figcaption>{e.caption} · {e.addedBy}, {fmtDate(e.createdAt)}</figcaption>
                    </figure>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        {/* 6: Timeline */}
        {isCase && (
          <section className="card" aria-labelledby="tl-title">
            <h2 id="tl-title" className="section-title" style={{ marginBottom: 18 }}>Case timeline</h2>
            <ol className="timeline">
              {[...d.timeline].reverse().map((t) => (
                <li key={t.id} className={`tl-item ${t.source}`}>
                  <span className="tl-dot" aria-hidden />
                  <div className="tl-title">
                    {t.label}
                    {t.source === "authority-reported" && <span className="source demo">Authority activity · as reported</span>}
                    {t.source === "community" && <span className="source community">Community</span>}
                  </div>
                  {t.note && <p className="tl-note">{t.note}</p>}
                  <div className="tl-when">{t.actor} · {fmtDateTime(t.createdAt)}</div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 7: Discussion */}
        <section className="card" aria-labelledby="dc-title">
          <h2 id="dc-title" className="section-title" style={{ marginBottom: 16 }}>Discussion <span className="muted" style={{ fontWeight: 500, fontSize: 16 }}>({d.comments.length})</span></h2>
          <div className="stack" style={{ gap: 18 }}>
            {d.comments.length === 0 && <p className="muted" style={{ margin: 0 }}>No comments yet. Be the first to add context.</p>}
            {d.comments.map((c) => (
              <div className="comment" key={c.id}>
                <Avatar name={c.author} />
                <div>
                  <b>{c.author}</b> <span className="small muted">· {timeAgo(c.createdAt)}</span>
                  <p>{c.body}</p>
                </div>
              </div>
            ))}
          </div>
          <hr className="divider" />
          <CommentForm issueId={issue.id} />
        </section>
      </div>

      {/* Contextual rail */}
      <aside className="contextual-panel sticky-rail" aria-label="Authority and case information">
        {isCase ? (
          <>
            <section className="card widget">
              <h3>Authority information</h3>
              <dl className="def">
                <div>
                  <dt>Responsible department</dt>
                  <dd>{issue.department ?? "Not assigned"}</dd>
                </div>
                <div>
                  <dt>Complaint reference</dt>
                  <dd>{issue.complaintRef ?? "Not recorded yet"}</dd>
                </div>
                <div>
                  <dt>Authority status</dt>
                  <dd>
                    {issue.stage >= 4 ? stageOf(Math.min(issue.stage, 6)).label : issue.stage === 3 ? "Complaint sent, awaiting acknowledgement" : "Not yet sent to authority"}
                    {issue.authorityNote && <div className="small muted" style={{ marginTop: 4 }}>{issue.authorityNote}</div>}
                    {issue.stage >= 3 && <div style={{ marginTop: 6 }}><SourceLabel q="resident" /></div>}
                  </dd>
                </div>
              </dl>
              <hr className="divider" />
              <div className="stack" style={{ gap: 10 }}>
                <div className="label small">Official sources</div>
                {cat.resources.filter((r) => r.url !== "#").map((r) => (
                  <div key={r.url}>
                    <a className="link small" href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.label} <ExternalLink size={12} aria-hidden style={{ verticalAlign: "-1px" }} />
                    </a>
                    <div style={{ marginTop: 3 }}><SourceLabel q={r.quality} /></div>
                  </div>
                ))}
              </div>
            </section>

            {(issue.stage === 6 || issue.stage === 7 || d.verifications.length > 0) && (
              <section className="card widget" aria-labelledby="rf-title">
                <h3 id="rf-title">Resolution feedback</h3>
                <div className="row between small" style={{ marginBottom: 6 }}>
                  <span><b>{fixed.length}</b> say fixed</span>
                  <span><b>{notFixed.length}</b> say not fixed</span>
                </div>
                <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={VERIFY_THRESHOLD} aria-valuenow={Math.min(fixed.length, VERIFY_THRESHOLD)} aria-label="Resident verifications toward community-verified resolution">
                  <i style={{ width: `${Math.min(100, (fixed.length / VERIFY_THRESHOLD) * 100)}%` }} />
                </div>
                <p className="small muted" style={{ margin: "8px 0 0" }}>
                  {issue.stage === 7
                    ? "Community verified."
                    : `${VERIFY_THRESHOLD} “fixed” confirmations mark this resolved. ${REOPEN_THRESHOLD} “not fixed” reports reopen it.`}
                </p>
                {withNotes.length > 0 && (
                  <ul className="bullets" style={{ marginTop: 10 }}>
                    {withNotes.slice(-2).map((v) => (
                      <li key={v.id}>“{v.note}” <span className="muted">· {v.resident}</span></li>
                    ))}
                  </ul>
                )}
                {issue.stage === 6 && (
                  <>
                    <hr className="divider" />
                    <div className="label small" style={{ marginBottom: 8 }}>Is it actually fixed where you are?</div>
                    <VerifyPanel issueId={issue.id} myVerdict={d.myVerdict} />
                  </>
                )}
              </section>
            )}

            <section className="card widget">
              <h3>Contribute</h3>
              <div className="stack" style={{ gap: 10 }}>
                <details className="disclosure">
                  <summary><Camera size={15} aria-hidden /> Add evidence</summary>
                  <div className="body"><EvidenceForm issueId={issue.id} defaultPhase={issue.stage >= 6 ? "after" : issue.stage >= 4 ? "during" : "before"} /></div>
                </details>
                {issue.stage < 6 && (
                  <details className="disclosure">
                    <summary><ClipboardEdit size={15} aria-hidden /> Update authority information</summary>
                    <div className="body"><AuthorityForm issueId={issue.id} stage={issue.stage} /></div>
                  </details>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="card widget">
              <h3>About this notice</h3>
              <SourceLabel q="resident" />
              <p className="small muted" style={{ margin: "10px 0 0" }}>
                This is a resident-shared notice, not an official announcement. Confirm with the relevant department before acting on it.
              </p>
            </section>
            <section className="card widget">
              <h3>Check official sources</h3>
              <div className="stack" style={{ gap: 10 }}>
                {cat.resources.filter((r) => r.url !== "#").map((r) => (
                  <div key={r.url}>
                    <a className="link small" href={r.url} target="_blank" rel="noopener noreferrer">{r.label}</a>
                    <div style={{ marginTop: 3 }}><SourceLabel q={r.quality} /></div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        <Link href="/cases" className="btn btn-ghost" style={{ justifySelf: "start" }}>← Back to all cases</Link>
      </aside>
    </div>
  );
}
