"use client";

import { categoryOf, classify } from "@/lib/constants";
import { ExternalLink } from "lucide-react";

export function GovlinksPanel({ query }: { query: string }) {
  const category = categoryOf(classify(query).id);
  const links = category.resources.filter((resource) => resource.url !== "#");

  return (
    <section className="card form-card govlinks-panel" aria-labelledby="govlinks-title">
      <div>
        <div className="eyebrow">Demo links</div>
        <h2 id="govlinks-title" className="section-title">Government service pages</h2>
        <p className="small muted" style={{ margin: "6px 0 0" }}>
          Suggested links for {category.label.toLowerCase()}. These curated links are shown locally; this demo does not contact a recommendation API.
        </p>
      </div>
      <div className="govlinks-results">
        {links.map((resource) => (
          <article className="card govlink-result" key={resource.url}>
            <div className="row between wrap">
              <div>
                <h3 className="card-title">{resource.label}</h3>
                <span className="small muted">{resource.quality === "official" ? "Official website" : "Demo link"}</span>
              </div>
              <a className="btn btn-primary btn-sm" href={resource.url} target="_blank" rel="noopener noreferrer">
                Open page <ExternalLink size={14} aria-hidden />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
