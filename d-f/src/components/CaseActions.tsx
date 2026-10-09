"use client";

import { addComment, addEvidence, confirmAffected, logAuthorityUpdate, submitVerification, type ActionResult } from "@/app/actions";
import { STAGES } from "@/lib/constants";
import { Check, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { PhotoPicker } from "./PhotoPicker";

function useRun() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<ActionResult>, okText: string, after?: () => void) => {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setMsg({ ok: true, text: okText });
        after?.();
      } else setMsg({ ok: false, text: r.error });
    });
  };
  const status = msg && (
    <div role={msg.ok ? "status" : "alert"} className={`status-msg ${msg.ok ? "ok" : "err"}`}>
      {msg.text}
    </div>
  );
  return { pending, run, status };
}

export function ConfirmAffected({ issueId, confirmed, count }: { issueId: number; confirmed: boolean; count: number }) {
  const { pending, run, status } = useRun();
  return (
    <div className="confirm-bar">
      <div className="row" style={{ gap: 14 }}>
        <span className="metric-icon blue" aria-hidden>
          <Users size={18} />
        </span>
        <div>
          <div className="big-num">{count}</div>
          <div className="small muted">residents confirmed they are affected</div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
        <button
          className={`btn ${confirmed ? "btn-secondary" : "btn-primary"}`}
          disabled={confirmed || pending}
          onClick={() => run(() => confirmAffected(issueId), "Thank you. Your confirmation was added.")}
        >
          {confirmed ? <Check size={16} aria-hidden /> : <Users size={16} aria-hidden />}
          {confirmed ? "You confirmed this" : pending ? "Saving…" : "I'm affected too"}
        </button>
        {status}
      </div>
    </div>
  );
}

export function CommentForm({ issueId }: { issueId: number }) {
  const [body, setBody] = useState("");
  const { pending, run, status } = useRun();
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addComment(issueId, body), "Comment posted.", () => setBody(""));
      }}
    >
      <div className="field">
        <label htmlFor="comment-body">Add to the discussion</label>
        <textarea
          id="comment-body"
          className="textarea"
          style={{ minHeight: 84 }}
          value={body}
          maxLength={1000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share an update, a detail, or what you have seen on site"
        />
      </div>
      <div className="row between wrap">
        <div>{status}</div>
        <button className="btn btn-primary" type="submit" disabled={pending || body.trim().length < 2}>
          {pending ? "Posting…" : "Post comment"}
        </button>
      </div>
    </form>
  );
}

export function EvidenceForm({ issueId, defaultPhase = "during" }: { issueId: number; defaultPhase?: string }) {
  const [phase, setPhase] = useState(defaultPhase);
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const { pending, run, status } = useRun();
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addEvidence({ issueId, phase, caption, photo }), "Evidence added.", () => {
          setCaption("");
          setPhoto(null);
        });
      }}
    >
      <div className="field">
        <label htmlFor="ev-phase">Stage of the evidence</label>
        <select id="ev-phase" className="select" value={phase} onChange={(e) => setPhase(e.target.value)}>
          <option value="before">Before: the problem</option>
          <option value="during">During: work in progress</option>
          <option value="after">After: the outcome</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="ev-cap">Caption</label>
        <input id="ev-cap" className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What does this show?" maxLength={140} />
      </div>
      <PhotoPicker value={photo} onChange={setPhoto} label="Photo" hint="Required for evidence." />
      {status}
      <button className="btn btn-primary" disabled={pending || !photo || caption.trim().length < 3}>
        {pending ? "Uploading…" : "Add evidence"}
      </button>
    </form>
  );
}

export function AuthorityForm({ issueId, stage }: { issueId: number; stage: number }) {
  const options = STAGES.filter((s) => s.n >= 3 && s.n <= 6 && s.n > stage);
  const [next, setNext] = useState(options[0]?.n ?? 0);
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const { pending, run, status } = useRun();
  if (!options.length) return <p className="small muted" style={{ margin: 0 }}>No further authority stages can be logged for this case.</p>;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => logAuthorityUpdate({ issueId, stage: next, ref, note }), "Update recorded and labelled as resident-reported.", () => {
          setRef("");
          setNote("");
        });
      }}
    >
      <div className="field">
        <label htmlFor="au-stage">What happened?</label>
        <select id="au-stage" className="select" value={next} onChange={(e) => setNext(Number(e.target.value))}>
          {options.map((o) => (
            <option key={o.n} value={o.n}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="au-ref">Complaint reference (optional)</label>
        <input id="au-ref" className="input" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={60} />
      </div>
      <div className="field">
        <label htmlFor="au-note">What did the authority say?</label>
        <textarea id="au-note" className="textarea" style={{ minHeight: 76 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />
        <span className="hint">Saved as resident-reported. Civic Network does not connect to government systems.</span>
      </div>
      {status}
      <button className="btn btn-secondary" disabled={pending}>
        {pending ? "Saving…" : "Record update"}
      </button>
    </form>
  );
}

export function VerifyPanel({ issueId, myVerdict }: { issueId: number; myVerdict: string | null }) {
  const { pending, run, status } = useRun();
  const [note, setNote] = useState("");
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="field">
        <label htmlFor="v-note">Optional note</label>
        <input id="v-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you see on site?" maxLength={200} />
      </div>
      <div className="row wrap">
        <button
          className="btn btn-primary btn-sm"
          disabled={pending}
          aria-pressed={myVerdict === "fixed"}
          onClick={() => run(() => submitVerification({ issueId, verdict: "fixed", note }), "Your confirmation was recorded.")}
        >
          <ThumbsUp size={15} aria-hidden /> It&apos;s fixed
        </button>
        <button
          className="btn btn-secondary btn-sm"
          disabled={pending}
          aria-pressed={myVerdict === "not_fixed"}
          onClick={() => run(() => submitVerification({ issueId, verdict: "not_fixed", note }), "Your report was recorded.")}
        >
          <ThumbsDown size={15} aria-hidden /> Not fixed
        </button>
      </div>
      {myVerdict && <div className="small muted">Your current answer: {myVerdict === "fixed" ? "fixed" : "not fixed"}. You can change it.</div>}
      {status}
    </div>
  );
}
