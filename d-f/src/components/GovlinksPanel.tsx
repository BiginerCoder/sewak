"use client";

import { AlertTriangle, ExternalLink, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  govlinks,
  type GovlinksCategory,
  type GovlinksFlagReason,
  type GovlinksOutcome,
  type GovlinksRecommendation,
  type GovlinksResult,
  type GovlinksWard,
} from "@/lib/govlinks";

type PendingVisit = {
  visit_id: number;
  link_id: number;
  title: string;
  domain: string;
  openedAt: number;
  asked?: boolean;
};

type FeedbackInput = { useful: boolean; rating?: number; comment?: string };

const PENDING_VISITS_KEY = "d-f.govlinksPendingVisits";
const USER_ID_KEY = "d-f.govlinksUserId";
const WARD_ID_KEY = "d-f.govlinksWardId";
const MAX_VISIT_AGE = 3 * 24 * 60 * 60 * 1000;
const FLAG_REASONS: GovlinksFlagReason[] = ["broken", "wrong_page", "outdated", "unsafe", "spam", "other"];

const OUTCOMES: { value: GovlinksOutcome; label: string; description: string }[] = [
  { value: "success", label: "It worked", description: "I completed the action" },
  { value: "failed", label: "Could not complete", description: "Right page, but it did not work" },
  { value: "broken", label: "Broken link", description: "Error, blank or not found" },
  { value: "wrong_page", label: "Wrong page", description: "Not where I could do this" },
];

function isPendingVisit(value: unknown): value is PendingVisit {
  if (!value || typeof value !== "object") return false;
  const visit = value as Partial<PendingVisit>;
  return Number.isInteger(visit.visit_id) && Number.isInteger(visit.link_id) &&
    typeof visit.title === "string" && typeof visit.domain === "string" &&
    typeof visit.openedAt === "number";
}

function readPendingVisits(): PendingVisit[] {
  const stored = localStorage.getItem(PENDING_VISITS_KEY);
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error("Saved visit data is invalid. Clear this browser's saved site data and try again.");
  return parsed.filter(isPendingVisit).filter((visit) => Date.now() - visit.openedAt < MAX_VISIT_AGE);
}

function savePendingVisits(visits: PendingVisit[]) {
  localStorage.setItem(PENDING_VISITS_KEY, JSON.stringify(visits));
}

function wardLabel(ward: GovlinksWard) {
  return `${ward.ward_name || `Ward ${ward.ward_number}`} (ward ${ward.ward_number}), ${ward.local_body}, ${ward.district}, ${ward.state}`;
}

function isFlagReason(value: string): value is GovlinksFlagReason {
  return FLAG_REASONS.some((reason) => reason === value);
}

async function loadGovlinksSetup() {
  const [health, wards, categories] = await Promise.all([
    govlinks.health(),
    govlinks.wards(),
    govlinks.categories(),
  ]);
  const savedWardId = Number(localStorage.getItem(WARD_ID_KEY));
  const savedWard = wards.find((ward) => ward.ward_id === savedWardId);
  const defaultWard = wards.find((ward) => ward.ward_number === "24" && /jaipur/i.test(`${ward.local_body} ${ward.district}`));
  const selectedWard = savedWard ?? defaultWard;
  if (selectedWard) localStorage.setItem(WARD_ID_KEY, String(selectedWard.ward_id));

  let userId: number | null = null;
  if (health.demo) {
    const storedUserId = Number(localStorage.getItem(USER_ID_KEY));
    userId = Number.isInteger(storedUserId) && storedUserId > 0
      ? storedUserId
      : (await govlinks.devUser(true)).user_id;
    localStorage.setItem(USER_ID_KEY, String(userId));
  }

  return { health, wards, categories, wardId: selectedWard ? String(selectedWard.ward_id) : "", userId };
}

function ResultCard({
  item,
  rank,
  recommendation,
  userId,
  disabled,
  busy,
  voted,
  feedbackSent,
  flagSent,
  onOpen,
  onVote,
  onFeedback,
  onFlag,
}: {
  item: GovlinksResult;
  rank: number;
  recommendation: GovlinksRecommendation;
  userId: number | null;
  disabled: boolean;
  busy: boolean;
  voted: 1 | -1 | undefined;
  feedbackSent: boolean;
  flagSent: boolean;
  onOpen: (item: GovlinksResult) => Promise<void>;
  onVote: (item: GovlinksResult, vote: 1 | -1) => Promise<void>;
  onFeedback: (item: GovlinksResult, feedback: FeedbackInput) => Promise<void>;
  onFlag: (item: GovlinksResult, reason: GovlinksFlagReason) => Promise<void>;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [useful, setUseful] = useState<boolean | null>(null);
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [flagReason, setFlagReason] = useState<GovlinksFlagReason>("broken");
  const [flagOpen, setFlagOpen] = useState(false);
  const state = item.state ?? "candidate";

  function submitFeedback() {
    if (useful === null) return;
    void onFeedback(item, {
      useful,
      ...(rating ? { rating: Number(rating) } : {}),
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
  }

  return (
    <article className="card govlink-result">
      <div className="row between wrap" style={{ gap: 12 }}>
        <div>
          <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
            {rank === 1 && <span className="badge green">Best match</span>}
            <span className={`badge ${state === "verified" ? "green" : "amber"}`}>
              {state === "verified" ? "Community verified" : state}
            </span>
            {item.official_status && <span className="badge blue plain">Official site</span>}
          </div>
          <h3 className="card-title" style={{ margin: 0 }}>{item.title}</h3>
          <p className="small muted" style={{ margin: "4px 0 0" }}>{item.website_name || item.domain}</p>
        </div>
        <div className="govlink-score" aria-label={`Ranking score ${item.score.toFixed(0)} out of 100`}>
          <b>{item.score.toFixed(0)}</b><span>/100</span>
        </div>
      </div>

      <p className="small" style={{ margin: 0 }}>{item.reason}</p>
      {recommendation.used_fallback && rank === 1 && (
        <p className="small muted" style={{ margin: 0 }}>No specific service matched, so these are general grievance portals.</p>
      )}

      <div className="row wrap" style={{ gap: 8 }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={disabled || busy} onClick={() => void onOpen(item)}>
          {busy ? "Opening…" : "Open government page"} <ExternalLink size={14} aria-hidden />
        </button>
        <button type="button" className={`btn btn-secondary btn-sm${voted === 1 ? " selected" : ""}`} aria-pressed={voted === 1} disabled={disabled} onClick={() => void onVote(item, 1)}>
          <ThumbsUp size={14} aria-hidden /> {voted === 1 ? "Voted: worked" : "Worked"}
        </button>
        <button type="button" className={`btn btn-secondary btn-sm${voted === -1 ? " selected" : ""}`} aria-pressed={voted === -1} disabled={disabled} onClick={() => void onVote(item, -1)}>
          <ThumbsDown size={14} aria-hidden /> {voted === -1 ? "Voted: didn’t help" : "Didn’t help"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={disabled || flagSent} onClick={() => setFlagOpen((open) => !open)}>
          {flagSent ? "Problem reported" : "Report a problem"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>
          {detailsOpen ? "Hide ranking" : "Why this rank?"}
        </button>
      </div>

      {flagOpen && (
        <div className="row wrap" style={{ gap: 8 }}>
          <label className="field small">
            Report reason
            <select className="select" value={flagReason} onChange={(event) => {
              if (isFlagReason(event.target.value)) setFlagReason(event.target.value);
            }}>
              <option value="broken">Broken link</option>
              <option value="wrong_page">Wrong page</option>
              <option value="outdated">Outdated information</option>
              <option value="unsafe">Unsafe</option>
              <option value="spam">Spam</option>
              <option value="other">Other</option>
            </select>
          </label>
          <button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => void onFlag(item, flagReason)}>
            Send report
          </button>
        </div>
      )}

      <div className="govlink-feedback">
        <div className="small" style={{ fontWeight: 650 }}>Was this page useful?</div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className={`btn btn-secondary btn-sm${useful === true ? " selected" : ""}`} onClick={() => setUseful(true)} aria-pressed={useful === true}>
            Yes
          </button>
          <button type="button" className={`btn btn-secondary btn-sm${useful === false ? " selected" : ""}`} onClick={() => setUseful(false)} aria-pressed={useful === false}>
            No
          </button>
          <label className="small">
            Rating
            <select className="select govlink-rating" value={rating} onChange={(event) => setRating(event.target.value)}>
              <option value="">Optional</option>
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={disabled || useful === null || (!rating && !comment.trim()) || feedbackSent}
            onClick={submitFeedback}
          >
            {feedbackSent ? "Feedback sent" : "Send feedback"}
          </button>
        </div>
        <label className="sr-only" htmlFor={`govlinks-comment-${item.link_id}`}>Optional feedback comment</label>
        <input
          id={`govlinks-comment-${item.link_id}`}
          className="input"
          value={comment}
          maxLength={500}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Optional comment (no personal details)"
        />
      </div>

      {detailsOpen && (
        <dl className="govlink-ranking">
          {([
            ["Community feedback", item.c_feedback],
            ["Real outcomes", item.c_usage],
            ["Problem match", item.c_relevance],
            ["Location match", item.c_location],
            ["Trust", item.c_trust],
          ] as const).map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{Math.round(value * 100)}%</dd></div>
          ))}
          {item.multiplier < 1 && <p className="small muted">Score adjusted because this page is not fully verified.</p>}
        </dl>
      )}
    </article>
  );
}

export function GovlinksPanel({ query }: { query: string }) {
  const [wards, setWards] = useState<GovlinksWard[]>([]);
  const [categories, setCategories] = useState<GovlinksCategory[]>([]);
  const [wardId, setWardId] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [recommendation, setRecommendation] = useState<GovlinksRecommendation | null>(null);
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyLinkId, setBusyLinkId] = useState<number | null>(null);
  const [votes, setVotes] = useState<Record<number, 1 | -1>>({});
  const [feedbackSent, setFeedbackSent] = useState<Record<number, boolean>>({});
  const [flagSent, setFlagSent] = useState<Record<number, boolean>>({});
  const [pendingVisit, setPendingVisit] = useState<PendingVisit | null>(null);
  const [outcome, setOutcome] = useState<GovlinksOutcome | null>(null);
  const [finalUrl, setFinalUrl] = useState("");
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const setup = await loadGovlinksSetup();
        if (!active) return;
        setWards(setup.wards);
        setCategories(setup.categories);
        setDemoMode(setup.health.demo);
        setWardId(setup.wardId);
        setUserId(setup.userId);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not initialize Govlinks.");
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function retryInitialization() {
    setInitializing(true);
    setError("");
    try {
      const setup = await loadGovlinksSetup();
      setWards(setup.wards);
      setCategories(setup.categories);
      setDemoMode(setup.health.demo);
      setWardId(setup.wardId);
      setUserId(setup.userId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not initialize Govlinks.");
    } finally {
      setInitializing(false);
    }
  }

  useEffect(() => {
    if (pendingVisit) return;
    const checkForReturn = () => {
      if (document.visibilityState !== "visible") return;
      try {
        const visit = readPendingVisits().find((item) => !item.asked && Date.now() - item.openedAt >= 5000);
        if (visit) {
          setPendingVisit(visit);
          setOutcome(null);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not read saved visit data.");
      }
    };
    const interval = window.setInterval(checkForReturn, 1500);
    window.addEventListener("focus", checkForReturn);
    document.addEventListener("visibilitychange", checkForReturn);
    checkForReturn();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkForReturn);
      document.removeEventListener("visibilitychange", checkForReturn);
    };
  }, [pendingVisit]);

  async function search(nextCategory = category) {
    if (!wardId) {
      setError("Choose your ward so the service links match your area.");
      return;
    }
    setError("");
    setNotice("");
    setBusy(true);
    setCategory(nextCategory);
    try {
      const result = await govlinks.recommend({
        query,
        ward_id: Number(wardId),
        ...(userId ? { user_id: userId } : {}),
        ...(nextCategory ? { category: nextCategory } : {}),
      });
      setRecommendation(result);
      setVotes({});
      setFeedbackSent({});
      setFlagSent({});
    } catch (cause) {
      setRecommendation(null);
      setError(cause instanceof Error ? cause.message : "Could not get service recommendations.");
    } finally {
      setBusy(false);
    }
  }

  async function openPage(item: GovlinksResult) {
    if (!userId || !recommendation) return;
    setBusyLinkId(item.link_id);
    setError("");
    const tab = window.open("about:blank", "_blank");
    try {
      const visit = await govlinks.visit(userId, item.link_id, recommendation.query_id);
      const destination = new URL(visit.url);
      if (destination.protocol !== "http:" && destination.protocol !== "https:") {
        throw new Error("The service returned an invalid page address.");
      }
      const pending: PendingVisit = {
        visit_id: visit.visit_id,
        link_id: item.link_id,
        title: item.title,
        domain: destination.hostname,
        openedAt: Date.now(),
      };
      savePendingVisits([...readPendingVisits().filter((saved) => saved.visit_id !== visit.visit_id), pending]);
      const target = destination.hostname.endsWith(".example")
        ? `/placeholder?host=${encodeURIComponent(destination.hostname)}&title=${encodeURIComponent(item.title)}`
        : visit.url;
      if (tab) tab.location.href = target;
      else window.location.assign(target);
      setNotice(tab
        ? "Opened in a new tab. Come back here when you are done to report the outcome."
        : "The browser blocked a new tab, so the page opened here. Use Back when you are done to report the outcome.");
    } catch (cause) {
      tab?.close();
      setError(cause instanceof Error ? cause.message : "Could not open this service page.");
    } finally {
      setBusyLinkId(null);
    }
  }

  async function sendVote(item: GovlinksResult, vote: 1 | -1) {
    if (!userId || !recommendation) return;
    setError("");
    try {
      await govlinks.vote(userId, item.link_id, vote, recommendation.query_id);
      setVotes((current) => ({ ...current, [item.link_id]: vote }));
      setNotice("Thanks. Your vote helps improve recommendations.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your vote.");
    }
  }

  async function sendFeedback(item: GovlinksResult, feedback: FeedbackInput) {
    if (!userId || !recommendation) return;
    setError("");
    try {
      await govlinks.feedback({
        user_id: userId,
        link_id: item.link_id,
        query_id: recommendation.query_id,
        ...feedback,
      });
      setFeedbackSent((current) => ({ ...current, [item.link_id]: true }));
      setNotice("Thanks. Your feedback has been recorded.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your feedback.");
    }
  }

  async function sendFlag(item: GovlinksResult, reason: GovlinksFlagReason) {
    if (!userId) return;
    setError("");
    try {
      await govlinks.flag(userId, item.link_id, reason);
      setFlagSent((current) => ({ ...current, [item.link_id]: true }));
      setNotice("Thanks. The link has been reported for review.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not report this link.");
    }
  }

  function dismissOutcome() {
    if (!pendingVisit) return;
    try {
      savePendingVisits(readPendingVisits().map((visit) =>
        visit.visit_id === pendingVisit.visit_id ? { ...visit, asked: true } : visit,
      ));
      setPendingVisit(null);
      setOutcome(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your visit status.");
    }
  }

  async function submitOutcome() {
    if (!pendingVisit || !outcome) return;
    setError("");
    try {
      await govlinks.outcome(
        pendingVisit.visit_id,
        outcome,
        outcome === "success" && finalUrl.trim() ? finalUrl.trim() : undefined,
      );
      savePendingVisits(readPendingVisits().filter((visit) => visit.visit_id !== pendingVisit.visit_id));
      setNotice(outcome === "success"
        ? "Thanks. Your outcome helps your neighbours find working services."
        : "Thanks. Your report will help improve the recommendations.");
      setPendingVisit(null);
      setOutcome(null);
      setFinalUrl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record the visit outcome.");
    }
  }

  return (
    <section className="card form-card govlinks-panel" aria-labelledby="govlinks-title">
      <div>
        <div className="eyebrow">Government services · Govlinks</div>
        <h2 id="govlinks-title" className="section-title">Find the right government page</h2>
        <p className="small muted" style={{ margin: "6px 0 0" }}>
          Govlinks ranks government service pages for your problem and ward. Your description is sent to the Govlinks API when you search.
        </p>
      </div>

      <div className="row wrap" style={{ alignItems: "end", gap: 12 }}>
        <label className="field govlinks-ward">
          Your ward
          <select
            className="select"
            value={wardId}
            onChange={(event) => {
              setWardId(event.target.value);
              localStorage.setItem(WARD_ID_KEY, event.target.value);
            }}
            disabled={initializing || !wards.length}
          >
            <option value="">Choose a ward…</option>
            {wards.map((ward) => <option key={ward.ward_id} value={ward.ward_id}>{wardLabel(ward)}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-primary" disabled={initializing || busy || !query.trim()} onClick={() => void search()}>
          {initializing ? "Connecting…" : busy ? "Searching…" : "Find government help"}
        </button>
      </div>

      {demoMode && <p className="small muted" style={{ margin: 0 }}>Demo mode: service links and user activity may include simulated data.</p>}
      {!initializing && !demoMode && (
        <div className="callout info" role="note">
          <AlertTriangle size={16} aria-hidden />
          <span>Recommendations are available. Visit tracking, votes and feedback require an authenticated Govlinks user; this backend currently exposes demo accounts only.</span>
        </div>
      )}
      {error && (
        <div className="callout" role="alert">
          <span>{error}</span>
      {!initializing && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setInitializing(true);
            setError("");
            void retryInitialization();
          }}
        >
          Retry
        </button>
      )}
        </div>
      )}
      {notice && <div className="callout ok" role="status">{notice}</div>}

      {pendingVisit && (
        <section className="card widget" aria-labelledby="visit-outcome-title">
          <h3 id="visit-outcome-title">How did it go?</h3>
          <p className="small muted">You opened <b>{pendingVisit.title}</b> ({pendingVisit.domain}).</p>
          <div className="chips" role="group" aria-label="Visit outcome">
            {OUTCOMES.map((option) => (
              <button
                key={option.value}
                type="button"
                className="chip"
                aria-pressed={outcome === option.value}
                onClick={() => setOutcome(option.value)}
              >
                <b>{option.label}</b><span className="small muted" style={{ display: "block" }}>{option.description}</span>
              </button>
            ))}
          </div>
          {outcome === "success" && (
            <label className="field small">
              Optional final page address (do not include personal details)
              <input className="input" type="url" value={finalUrl} onChange={(event) => setFinalUrl(event.target.value)} placeholder="https://…" />
            </label>
          )}
          <div className="row wrap">
            <button type="button" className="btn btn-ghost" onClick={dismissOutcome}>Ask me later</button>
            <button type="button" className="btn btn-primary" disabled={!outcome} onClick={() => void submitOutcome()}>Send outcome</button>
          </div>
        </section>
      )}

      {recommendation && (
        <div className="stack">
          <div className="row between wrap">
            <div>
              <div className="eyebrow">Recommended service</div>
              <h3 className="card-title" style={{ margin: 0 }}>
                {recommendation.used_fallback ? "General complaint portals" : recommendation.problem_category || "Government services"}
              </h3>
            </div>
            <label className="field small">
              Wrong topic?
              <select
                className="select"
                value={category}
                onChange={(event) => void search(event.target.value)}
                disabled={busy}
              >
                <option value="">Detect automatically</option>
                {categories.filter((item) => !item.is_fallback).map((item) => (
                  <option key={item.category_id} value={item.category_name}>
                    {item.parent ? `${item.parent} › ` : ""}{item.category_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {recommendation.category_source === "user"
              ? "Topic selected by you."
              : `Topic ${recommendation.category_source === "fallback" ? "could not be identified confidently" : "detected from your description"}.`}
          </p>
          {recommendation.results.length === 0 ? (
            <div className="card empty">
              <b>No service pages found for this ward and topic.</b>
              Try another category or check back later.
            </div>
          ) : (
            <div className="govlinks-results">
              {recommendation.results.map((item, index) => (
                <ResultCard
                  key={`${recommendation.query_id}-${item.link_id}`}
                  item={item}
                  rank={index + 1}
                  recommendation={recommendation}
                  userId={userId}
                  disabled={!userId}
                  busy={busyLinkId === item.link_id}
                  voted={votes[item.link_id]}
                  feedbackSent={!!feedbackSent[item.link_id]}
                  flagSent={!!flagSent[item.link_id]}
                  onOpen={openPage}
                  onVote={sendVote}
                  onFeedback={sendFeedback}
                  onFlag={sendFlag}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
