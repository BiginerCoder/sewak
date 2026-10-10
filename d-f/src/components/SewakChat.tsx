"use client";

import { AlertTriangle, LoaderCircle, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { classify, stageOf } from "@/lib/constants";

type ChatMessage = { role: "user" | "assistant"; content: string };
type AssistantReply = {
  answer: string;
  cases: { id: number; caseNumber: number; title: string; stage: string; location: string; affectedCount: number; score: number }[];
  webSources: { title: string; url: string }[];
  webSearchAttempted: boolean;
  matchingMethod: string;
};

const AREA_DEFAULT = "Ward 24, Shastri Nagar, Jaipur";

export function SewakChat({ cases }: { cases: { id: number; title: string; category: string; stage: number; affectedCount: number; locationText: string }[] }) {
  const [area, setArea] = useState(AREA_DEFAULT);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latestReply, setLatestReply] = useState<AssistantReply | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (message.length < 3 || loading) return;

    setError("");
    setLoading(true);
    const category = classify(message).id;
    const matches = cases.filter((item) => item.category === category)
      .sort((a, b) => b.affectedCount - a.affectedCount)
      .slice(0, 3);
    const reply: AssistantReply = {
      answer: matches.length
        ? `I found ${matches.length} related ${matches.length === 1 ? "case" : "cases"} for ${area}. Review the case details and confirm important information with the relevant department.`
        : `I couldn't find a matching case for ${area}. You can prepare a report with the help form below.`,
      cases: matches.map((item) => ({
        id: item.id, caseNumber: 12300 + item.id, title: item.title,
        stage: stageOf(item.stage).label, location: item.locationText,
        affectedCount: item.affectedCount, score: 90,
      })),
      webSources: [],
      webSearchAttempted: false,
      matchingMethod: "local keyword matching",
    };
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: message },
      { role: "assistant", content: reply.answer },
    ];
    setMessages(nextMessages.slice(-8));
    setLatestReply(reply);
    setInput("");
    setLoading(false);
  }

  function clearChat() {
    setMessages([]);
    setLatestReply(null);
    setError("");
  }

  return (
    <section className="card sewak-chat" aria-labelledby="sewak-chat-title">
      <div className="row between wrap">
        <div>
          <div className="eyebrow"><Sparkles size={14} aria-hidden /> Sewak assistant</div>
          <h2 id="sewak-chat-title" className="section-title">Ask a question about your area</h2>
        </div>
        {messages.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={clearChat}>Clear chat</button>}
      </div>
      <label className="field sewak-chat-area">
        <span className="label small">Area context</span>
        <input className="input" value={area} onChange={(event) => setArea(event.target.value)} maxLength={120} />
      </label>

      <div className="sewak-chat-messages" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 ? (
          <p className="small muted">Ask about a local problem, find a related Sewak case, or get help with next steps.</p>
        ) : messages.map((item, index) => (
          <div className={`sewak-chat-message ${item.role}`} key={`${index}-${item.role}`}>
            <b>{item.role === "user" ? "You" : "Sewak"}</b>
            <p>{item.content}</p>
          </div>
        ))}
        {loading && <div className="sewak-chat-loading" role="status"><LoaderCircle size={16} className="spin" aria-hidden /> Finding relevant cases and preparing an answer…</div>}
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      <form className="sewak-chat-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="sewak-chat-input">Your question</label>
        <textarea
          id="sewak-chat-input"
          className="textarea"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={1200}
          rows={3}
          placeholder="For example: Is anyone else reporting the dark lane near the park?"
          disabled={loading}
        />
        <div className="row between wrap">
          <span className="small muted">Avoid sharing personal or sensitive information.</span>
          <button type="submit" className="btn btn-primary" disabled={loading || input.trim().length < 3}>
            <Send size={15} aria-hidden /> Ask Sewak
          </button>
        </div>
      </form>

      {latestReply && (
        <div className="sewak-chat-sources">
          {latestReply.cases.length > 0 && (
            <div>
              <h3 className="card-title">Related Sewak cases</h3>
              <ul className="list-links">
                {latestReply.cases.map((issue) => (
                  <li key={issue.id}>
                    <Link href={`/cases/${issue.id}`}>
                      <span className="t">Case #{issue.caseNumber}: {issue.title}</span>
                      <span className="small muted">{issue.stage} · {issue.location} · {issue.affectedCount} affected · {issue.score}% match</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {latestReply.webSources.length > 0 && (
            <div>
              <h3 className="card-title">Official web sources</h3>
              <ul className="list-links">
                {latestReply.webSources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">
                      <span className="t">{source.title}</span>
                      <span className="small muted">{new URL(source.url).hostname}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {latestReply.webSearchAttempted && latestReply.webSources.length === 0 && (
            <div className="callout info" role="note"><AlertTriangle size={16} aria-hidden /> No allowlisted official web pages were found. Check the listed case links or try a different question.</div>
          )}
          <p className="small muted">Case matches use {latestReply.matchingMethod}. The assistant can make mistakes; verify important information with the linked source.</p>
        </div>
      )}
      <p className="small muted sewak-chat-notice">
        This demo matches your question against sample cases in your browser. It does not call an AI provider or send your message to a server.
      </p>
    </section>
  );
}
