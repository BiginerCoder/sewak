"use client";

import { CATEGORIES, buildDraft, categoryOf, classify, stageOf } from "@/lib/constants";
import { GovlinksPanel } from "@/components/GovlinksPanel";
import { AlertTriangle, ClipboardCopy, ExternalLink, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { SourceLabel } from "./ui";

export type LiteCase = { id: number; title: string; category: string; stage: number; affectedCount: number };

const EXAMPLES = [
  "There is a big pothole on the main road near the circle and bikes keep slipping",
  "Streetlights on our lane have not worked for a week",
  "Garbage has not been collected in our block for days",
  "Sewage is overflowing near the water tank",
];

export function AskAssistant({ cases }: { cases: LiteCase[] }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ category: string; matched: string[]; text: string } | null>(null);
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const resultRef = useRef<HTMLDivElement>(null);

  const cat = result ? categoryOf(result.category) : null;
  const similar = useMemo(
    () => (result ? cases.filter((c) => c.category === result.category && c.stage < 7).sort((a, b) => b.affectedCount - a.affectedCount) : []),
    [cases, result],
  );
  const draft = result ? buildDraft(result.category, result.text) : "";

  function find() {
    setCopied("");
    if (text.trim().length < 8) {
      setError("Describe the problem in a few words first, for example where it is and what is wrong.");
      setResult(null);
      return;
    }
    setError("");
    const c = classify(text);
    setResult({ category: c.id, matched: c.matched, text });
    setTimeout(() => resultRef.current?.focus(), 50);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  return (
    <div className="workspace-grid has-rail">
      <div className="primary-content">
        <section className="card form-card" aria-labelledby="ask-q">
          <div className="field">
            <label htmlFor="ask-text" id="ask-q" className="section-title" style={{ fontSize: 18 }}>
              What is the problem?
            </label>
            <textarea
              id="ask-text"
              className="textarea lg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe what is wrong and where, in your own words."
              aria-invalid={!!error}
              aria-describedby="ask-hint"
            />
            <span id="ask-hint" className="hint">
              We check for similar sample cases and suggest curated government service links locally in your browser.
            </span>
            {error && <div className="error" role="alert">{error}</div>}
          </div>

          <div>
            <div className="label small muted" style={{ marginBottom: 8 }}>Try an example</div>
            <div className="chips">
              {EXAMPLES.map((e) => (
                <button key={e} type="button" className="chip" onClick={() => { setText(e); setError(""); }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <button type="button" className="btn btn-primary btn-lg" onClick={find}>
              <Search size={17} aria-hidden /> Find help
            </button>
          </div>
        </section>

        {result && cat && (
          <>
          <section className="card form-card" ref={resultRef} tabIndex={-1} aria-labelledby="res-title" style={{ outline: "none" }}>
            <div>
              <div className="eyebrow">Result</div>
              <h2 id="res-title" className="section-title">
                Detected category: {cat.label}
              </h2>
              <p className="small muted" style={{ margin: "6px 0 0" }}>
                {result.matched.length
                  ? `Matched on: ${result.matched.map((m) => `“${m}”`).join(", ")}.`
                  : "No category keywords found, so this is marked as other. Choose the closest match below."}
              </p>
            </div>

            <div>
              <div className="label small" style={{ marginBottom: 8 }} id="cat-fix">Not right? Choose a different category</div>
              <div className="chips" role="group" aria-labelledby="cat-fix">
                {CATEGORIES.map((c) => (
                  <button key={c.id} type="button" className="chip" aria-pressed={c.id === result.category} onClick={() => setResult({ ...result, category: c.id })}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {similar[0] && (
              <div className="callout info" role="note">
                <AlertTriangle size={16} aria-hidden />
                <span>
                  <b>A similar case is already open:</b>{" "}
                  <Link href={`/cases/${similar[0].id}`} className="link" style={{ color: "inherit", textDecoration: "underline" }}>
                    {similar[0].title}
                  </Link>{" "}
                  ({similar[0].affectedCount} residents affected). Confirming it adds weight to the existing complaint instead of creating a duplicate.
                </span>
              </div>
            )}

            <div>
              <div className="row between wrap" style={{ marginBottom: 10 }}>
                <h3 className="card-title">Complaint draft</h3>
                <div className="row">
                  {copied === "ok" && <span role="status" className="status-msg ok">Copied</span>}
                  {copied === "fail" && <span role="alert" className="status-msg err">Copy failed. Select the text manually.</span>}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
                    <ClipboardCopy size={15} aria-hidden /> Copy draft
                  </button>
                </div>
              </div>
              <pre className="draft" tabIndex={0} aria-label="Complaint draft text">{draft}</pre>
              <p className="small muted" style={{ margin: "10px 0 0" }}>
                Edit the draft before sending. Add your address and attach photos.
              </p>
            </div>

            <div className="row wrap">
              <Link
                href={`/report?category=${result.category}&description=${encodeURIComponent(result.text.slice(0, 500))}`}
                className="btn btn-primary"
              >
                Report this to the ward
              </Link>
              <Link href="/cases?status=open" className="btn btn-secondary">
                Browse open cases
              </Link>
            </div>
          </section>
          <GovlinksPanel query={result.text} />
          </>
        )}
      </div>

      <aside className="contextual-panel" aria-label="Supporting information" aria-live="polite">
        {!result || !cat ? (
          <section className="card widget">
            <h3>
              <Sparkles size={16} aria-hidden /> What this assistant does
            </h3>
            <ol className="steps">
              <li><span>Reads your description and picks the most likely civic category.</span></li>
              <li><span>Checks whether a similar case is already open in Ward 24.</span></li>
              <li><span>Shows the usual responsible department and what evidence to prepare.</span></li>
              <li><span>Writes a complaint draft you can copy and edit.</span></li>
            </ol>
            <hr className="divider" />
            <p className="small muted" style={{ margin: 0 }}>
              Classification is simple keyword matching, not AI. Always check the result.
            </p>
          </section>
        ) : (
          <>
            <section className="card widget">
              <h3>Responsible department</h3>
              <div style={{ fontWeight: 650 }}>{cat.department}</div>
              <div className="small muted" style={{ marginTop: 4 }}>Typical department for this category. Confirm with your ward office.</div>
            </section>

            <section className="card widget">
              <h3>Similar existing cases</h3>
              {similar.length === 0 ? (
                <p className="small muted" style={{ margin: 0 }}>No open case in this category. You may be the first to report it.</p>
              ) : (
                <ul className="list-links">
                  {similar.slice(0, 3).map((c) => (
                    <li key={c.id}>
                      <Link href={`/cases/${c.id}`}>
                        <span className="t">{c.title}</span>
                        <span className="small muted">{stageOf(c.stage).label} · {c.affectedCount} affected</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card widget">
              <h3>Evidence to prepare</h3>
              <ul className="bullets">
                {cat.evidence.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </section>

            <section className="card widget">
              <h3>Resources</h3>
              <div className="stack" style={{ gap: 12 }}>
                {cat.resources.map((r) => (
                  <div key={r.label}>
                    {r.url === "#" ? (
                      <span className="small" style={{ fontWeight: 600 }}>{r.label}</span>
                    ) : (
                      <a className="link small" href={r.url} target="_blank" rel="noopener noreferrer">
                        {r.label} <ExternalLink size={12} aria-hidden style={{ verticalAlign: "-1px" }} />
                      </a>
                    )}
                    <div style={{ marginTop: 3 }}><SourceLabel q={r.quality} /></div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}
