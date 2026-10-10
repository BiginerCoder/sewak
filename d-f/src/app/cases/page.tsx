"use client";

import { MiniProgress, PageHead, StatusBadge } from "@/components/ui";
import { CASE_FILTERS, STAGES, categoryOf, matchCaseFilter, timeAgo } from "@/lib/constants";
import { getIssues } from "@/lib/queries";
import { ArrowRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useDemoData } from "@/lib/demo-store";
import { useBrowserSearchParams } from "@/lib/use-browser-search";

export default function CasesPage() {
  const { data } = useDemoData();
  const params = useBrowserSearchParams();
  const s = params.get("status");
  const rawQ = params.get("q");
  const status = CASE_FILTERS.some((x) => x.id === s) ? (s as string) : "all";
  const q = (rawQ ?? "").trim().toLowerCase();

  const all = getIssues(data).filter((i) => i.kind === "problem");
  const matchesQ = (i: (typeof all)[number]) =>
    !q ||
    [i.title, i.description, i.department ?? "", i.locationText, categoryOf(i.category).label, String(12300 + i.id), `#${12300 + i.id}`]
      .join(" ")
      .toLowerCase()
      .includes(q.replace(/^case\s*/, ""));
  const searched = all.filter(matchesQ);
  const rows = searched.filter((i) => matchCaseFilter(i, status));

  const href = (id: string) => {
    const p = new URLSearchParams();
    if (id !== "all") p.set("status", id);
    if (q) p.set("q", rawQ!.trim());
    const qs = p.toString();
    return qs ? `/cases?${qs}` : "/cases";
  };

  return (
    <>
      <PageHead
        title="Cases"
        actions={
          <Link href="/report" className="btn btn-primary">
            <Plus size={16} aria-hidden /> Report a problem
          </Link>
        }
      >
        Every reported problem follows a seven-stage lifecycle, from the first report to resolution confirmed by residents, not just by the authority.
      </PageHead>

      <div className="workspace-grid has-rail">
        <section className="primary-content" aria-label="Case list">
          <div className="stack">
            <form action="/cases" role="search" className="row" style={{ gap: 10 }}>
              {status !== "all" && <input type="hidden" name="status" value={status} />}
              <div className="search" style={{ width: "100%", maxWidth: 480 }}>
                <Search size={16} aria-hidden />
                <label htmlFor="case-q" className="sr-only">
                  Search cases
                </label>
                <input id="case-q" name="q" type="search" defaultValue={rawQ ?? ""} placeholder="Search by title, location, department or case number" />
              </div>
              <button className="btn btn-secondary" type="submit">
                Search
              </button>
              {q && (
                <Link href={status === "all" ? "/cases" : `/cases?status=${status}`} className="btn btn-ghost">
                  Clear
                </Link>
              )}
            </form>

            <nav className="tabs" aria-label="Filter cases by status">
              {CASE_FILTERS.map((x) => (
                <Link key={x.id} href={href(x.id)} className="tab" aria-current={status === x.id ? "true" : undefined}>
                  {x.label}
                  <span className="count">{searched.filter((i) => matchCaseFilter(i, x.id)).length}</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="case-list" aria-live="polite">
            <div className="small muted" role="status">
              Showing {rows.length} of {all.length} cases{q ? ` matching “${rawQ}”` : ""}
            </div>
            {rows.length === 0 && (
              <div className="card empty">
                <b>No cases match</b>
                Adjust the filter or search, or report a new problem.
              </div>
            )}
            {rows.map((i) => (
              <article key={i.id} className="card case-row">
                <div style={{ minWidth: 0 }}>
                  <div className="row wrap" style={{ gap: 10 }}>
                    <span className="case-id">#{12300 + i.id}</span>
                    <span className="tag">{categoryOf(i.category).label}</span>
                  </div>
                  <h3>
                    <Link href={`/cases/${i.id}`} className="stretched">
                      {i.title}
                    </Link>
                  </h3>
                  <div className="case-facts">
                    <span>
                      <b>{i.affectedCount}</b> residents affected
                    </span>
                    <span>
                      Department: <b>{i.department ?? "Not assigned"}</b>
                    </span>
                    <span>
                      Last update: <b>{i.lastEventAt ? timeAgo(i.lastEventAt) : "None recorded"}</b>
                    </span>
                  </div>
                </div>
                <div className="case-side">
                  <StatusBadge kind={i.kind} stage={i.stage} />
                  <MiniProgress stage={i.stage} />
                  <span className="small link" aria-hidden>
                    Open case <ArrowRight size={13} style={{ verticalAlign: "-2px" }} />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="contextual-panel" aria-label="About the case lifecycle">
          <section className="card widget">
            <h3>Case lifecycle</h3>
            <ol className="steps">
              {STAGES.map((st) => (
                <li key={st.n}>
                  <span>
                    <b style={{ fontWeight: 650 }}>{st.label}</b>
                    <span className="small muted" style={{ display: "block" }}>
                      {st.desc}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section className="callout info" role="note">
            <span>
              <b>Filters:</b> “Open” is everything before stage 7. “In progress” covers stages 3–5. “Awaiting verification” is stage 6: the authority says it is fixed and residents have not yet confirmed.
            </span>
          </section>
        </aside>
      </div>
    </>
  );
}
