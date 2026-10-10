"use client";

import { Metric, IssueCard, PageHead, PriorityIssues, SourceLabel, WardSnapshot } from "@/components/ui";
import { FEED_FILTERS, matchFeedFilter, isUnresolved, timeAgo } from "@/lib/constants";
import { getIssues, getRecentUpdates, getStats } from "@/lib/queries";
import { AlertCircle, CheckCircle2, FileText, Landmark, Newspaper, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useDemoData } from "@/lib/demo-store";
import { useBrowserSearchParams } from "@/lib/use-browser-search";

export default function HomePage() {
  const { data } = useDemoData();
  const f = useBrowserSearchParams().get("filter");
  const filter = FEED_FILTERS.some((x) => x.id === f) ? (f as string) : "all";
  const issues = getIssues(data);
  const stats = getStats(data);
  const updates = getRecentUpdates(data, 4);

  const feed = issues.filter((i) => matchFeedFilter(i, filter));
  const priority = issues.filter(isUnresolved).sort((a, b) => b.affectedCount - a.affectedCount).slice(0, 3);
  const label = FEED_FILTERS.find((x) => x.id === filter)!.label;

  return (
    <>
      <PageHead
        title="Your neighbourhood, better together."
        actions={
          <>
            <Link href="/ask" className="btn btn-secondary">
              <Search size={16} aria-hidden /> Find help
            </Link>
            <Link href="/report" className="btn btn-primary">
              <Plus size={16} aria-hidden /> Report a problem
            </Link>
          </>
        }
      >
        Report local problems, support existing cases, and follow progress in Ward 24.
      </PageHead>

      <section className="metrics" aria-label="Ward statistics">
        <Metric label="Unresolved issues" value={stats.unresolved} note={`${stats.awaiting} awaiting verification`} icon={AlertCircle} tone="amber" />
        <Metric label="Resolved issues" value={stats.resolved} note="Verified by residents" icon={CheckCircle2} tone="green" />
        <Metric label="Total civic posts" value={stats.total} note="Problems and notices" icon={FileText} />
        <Metric label="Community confirmations" value={stats.confirmations} note="Residents affected, across cases" icon={Users} tone="blue" />
      </section>

      <div className="workspace-grid has-rail">
        <section className="primary-content" aria-labelledby="feed-title">
          <div className="toolbar">
            <h2 id="feed-title" className="section-title">
              Community issues
            </h2>
            <nav className="tabs" aria-label="Filter community issues">
              {FEED_FILTERS.map((x) => (
                <Link key={x.id} href={x.id === "all" ? "/" : `/?filter=${x.id}`} className="tab" aria-current={filter === x.id ? "true" : undefined}>
                  {x.label}
                  <span className="count">{issues.filter((i) => matchFeedFilter(i, x.id)).length}</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="feed" aria-live="polite">
            {feed.length === 0 ? (
              <div className="card empty">
                <b>Nothing under “{label}” yet</b>
                Try another filter or report a new problem.
              </div>
            ) : (
              feed.map((i) => <IssueCard key={i.id} issue={i} />)
            )}
          </div>
        </section>

        <aside className="contextual-panel" aria-label="Ward context">
          <WardSnapshot unresolved={stats.unresolved} resolved={stats.resolved} />
          <PriorityIssues issues={priority} />

          <section className="card widget" aria-labelledby="w-gov">
            <h3 id="w-gov">
              <Landmark size={16} aria-hidden /> Government contacts
            </h3>
            <div className="stack" style={{ gap: 12 }}>
              <div>
                <a className="link" href="https://jaipurmc.org" target="_blank" rel="noopener noreferrer">
                  Jaipur Municipal Corporation
                </a>
                <div style={{ marginTop: 4 }}>
                  <SourceLabel q="official" />
                </div>
              </div>
              <div>
                <a className="link" href="https://sampark.rajasthan.gov.in" target="_blank" rel="noopener noreferrer">
                  Rajasthan Sampark portal
                </a>
                <div style={{ marginTop: 4 }}>
                  <SourceLabel q="official" />
                </div>
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                Phone numbers are not listed: this demo has no verified contact data. <Link href="/place" className="link">Ward information</Link>
              </p>
            </div>
          </section>

          <section className="card widget" aria-labelledby="w-upd">
            <h3 id="w-upd">
              <Newspaper size={16} aria-hidden /> Community updates
            </h3>
            <ul className="list-links">
              {updates.map((u) => (
                <li key={u.id}>
                  <Link href={`/cases/${u.issueId}`}>
                    <span className="t">{u.label}</span>
                    <span className="small muted">
                      {u.title} · {timeAgo(u.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
