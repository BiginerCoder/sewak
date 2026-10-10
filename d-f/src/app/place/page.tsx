"use client";

import { Metric, PageHead, SourceLabel } from "@/components/ui";
import { CATEGORIES, isResolved, isUnresolved } from "@/lib/constants";
import { getIssues, getStats } from "@/lib/queries";
import { AlertCircle, CheckCircle2, ExternalLink, FileText, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useDemoData } from "@/lib/demo-store";

export default function PlacePage() {
  const { data } = useDemoData();
  const issues = getIssues(data);
  const stats = getStats(data);
  const problems = issues.filter((i) => i.kind === "problem");

  const byCat = CATEGORIES.map((c) => {
    const list = problems.filter((i) => i.category === c.id);
    return { c, total: list.length, open: list.filter(isUnresolved).length, done: list.filter(isResolved).length };
  }).filter((r) => r.total > 0);

  const places = Array.from(
    problems.reduce((m, i) => {
      const key = i.locationText;
      const cur = m.get(key) ?? { name: key, count: 0, id: i.id };
      cur.count += 1;
      m.set(key, cur);
      return m;
    }, new Map<string, { name: string; count: number; id: number }>()),
  ).map(([, v]) => v);

  const departments = Array.from(new Set(CATEGORIES.filter((c) => c.id !== "other").map((c) => c.department)));

  return (
    <>
      <PageHead title="Ward information" eyebrow="Ward 24 · Shastri Nagar, Jaipur">
        A reference for who looks after what in the ward, plus a summary of what residents have reported so far.
      </PageHead>

      <div className="workspace-grid has-rail">
        <div className="primary-content">
          <section className="card" aria-labelledby="ov">
            <h2 id="ov" className="section-title">Ward overview</h2>
            <p style={{ maxWidth: "68ch", margin: "10px 0 14px" }}>
              Ward 24 covers the Shastri Nagar neighbourhood in Jaipur. Civic Network helps residents here describe problems clearly, confirm each other&apos;s reports, and check whether fixes are real.
            </p>
            <div className="callout" role="note">
              <MapPin size={16} aria-hidden />
              <span>
                <b>No map is shown.</b> This demo has no verified geographic data, so it does not draw one. Locations in reports are simulated or typed by residents.
              </span>
            </div>
          </section>

          <section aria-labelledby="st">
            <h2 id="st" className="section-title" style={{ marginBottom: 14 }}>Issues and resolutions</h2>
            <div className="metrics" style={{ marginBottom: 16 }}>
              <Metric label="Unresolved" value={stats.unresolved} icon={AlertCircle} tone="amber" />
              <Metric label="Resolved" value={stats.resolved} icon={CheckCircle2} tone="green" />
              <Metric label="Civic posts" value={stats.total} icon={FileText} />
              <Metric label="Confirmations" value={stats.confirmations} icon={Users} tone="blue" />
            </div>
            <div className="card" style={{ padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <caption className="sr-only">Cases by category</caption>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-2)", fontSize: 12.5 }}>
                    <th scope="col" style={{ padding: "12px 20px" }}>Category</th>
                    <th scope="col" style={{ padding: 12, textAlign: "right" }}>Cases</th>
                    <th scope="col" style={{ padding: 12, textAlign: "right" }}>Open</th>
                    <th scope="col" style={{ padding: "12px 20px", textAlign: "right" }}>Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {byCat.map((r) => (
                    <tr key={r.c.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <th scope="row" style={{ padding: "12px 20px", textAlign: "left", fontWeight: 600 }}>{r.c.label}</th>
                      <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.total}</td>
                      <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.open}</td>
                      <td style={{ padding: "12px 20px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.done}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" aria-labelledby="fac">
            <div className="row between wrap">
              <h2 id="fac" className="section-title">Local places in reports</h2>
              <SourceLabel q="resident" />
            </div>
            <p className="small muted" style={{ margin: "6px 0 14px" }}>
              Places residents mentioned in cases. This is not an official facility directory.
            </p>
            <ul className="list-links">
              {places.map((p) => (
                <li key={p.name}>
                  <Link href={`/cases/${p.id}`}>
                    <span className="t"><MapPin size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> {p.name}</span>
                    <span className="small muted">{p.count} {p.count === 1 ? "case" : "cases"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="card" aria-labelledby="how">
            <h2 id="how" className="section-title">How civic complaints usually move</h2>
            <ol className="steps" style={{ marginTop: 14 }}>
              <li><span>Report with a photo and exact location, and ask neighbours to confirm.</span></li>
              <li><span>Lodge the complaint with the responsible department, and note the reference number on the case.</span></li>
              <li><span>Follow up using the reference number. Add progress photos when work starts.</span></li>
              <li><span>When the authority says it is fixed, residents check on site before the case is called resolved.</span></li>
            </ol>
          </section>
        </div>

        <aside className="contextual-panel" aria-label="Contacts and sources">
          <section className="card widget">
            <h3>Ward representative</h3>
            <div style={{ fontWeight: 650 }}>Not listed in demo data</div>
            <p className="small muted" style={{ margin: "6px 0 8px" }}>
              Ask your ward office or check the municipal corporation website for the current councillor.
            </p>
            <SourceLabel q="demo" />
          </section>

          <section className="card widget">
            <h3>Municipal office</h3>
            <a className="link" href="https://jaipurmc.org" target="_blank" rel="noopener noreferrer">
              Jaipur Municipal Corporation <ExternalLink size={12} aria-hidden style={{ verticalAlign: "-1px" }} />
            </a>
            <div style={{ margin: "6px 0 10px" }}><SourceLabel q="official" /></div>
            <a className="link" href="https://sampark.rajasthan.gov.in" target="_blank" rel="noopener noreferrer">
              Rajasthan Sampark grievance portal <ExternalLink size={12} aria-hidden style={{ verticalAlign: "-1px" }} />
            </a>
            <div style={{ marginTop: 6 }}><SourceLabel q="official" /></div>
            <p className="small muted" style={{ margin: "10px 0 0" }}>Links are not re-verified in this demo. Confirm before relying on them.</p>
          </section>

          <section className="card widget">
            <h3>Departments by issue type</h3>
            <ul className="bullets" style={{ paddingLeft: 16 }}>
              {departments.map((d) => <li key={d}>{d}</li>)}
            </ul>
            <p className="small muted" style={{ margin: "10px 0 0" }}>
              Typical responsibilities only. Phone numbers are not shown because this demo has no verified contact data.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
