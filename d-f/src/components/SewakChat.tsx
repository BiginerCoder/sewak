"use client";

import { ArrowUp, Bot, LoaderCircle, RotateCcw, UserRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useRef, useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };
type AssistantReply = {
  answer: string;
  mode: "llm" | "local";
  objective: string;
  relatedCases: { id: number; title: string; locationText: string; stage: number; affectedCount: number; areaMatch: boolean }[];
  resources: { label: string; url: string }[];
};

const WELCOME: ChatMessage = {
  role: "assistant",
  content: "Hi! Tell me what civic issue you’re facing and where. I’ll look for related Sewak cases and suggest next steps.",
};

const SUGGESTIONS = [
  "Why is the water supply unreliable?",
  "Are there open road problems near me?",
];

function renderMessage(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\/cases\/\d+)/g);
  return parts.map((part, index) => {
    const caseLink = part.match(/^\/cases\/(\d+)$/);
    if (caseLink) return <Link key={index} className="link" href={part}>case #{caseLink[1]}</Link>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

function isAssistantReply(value: unknown): value is AssistantReply {
  if (!value || typeof value !== "object" || !("answer" in value) || typeof value.answer !== "string" ||
      !("mode" in value) || (value.mode !== "llm" && value.mode !== "local") ||
      !("objective" in value) || typeof value.objective !== "string" ||
      !("relatedCases" in value) || !Array.isArray(value.relatedCases) ||
      !("resources" in value) || !Array.isArray(value.resources)) return false;
  return value.relatedCases.every((item) =>
    !!item && typeof item === "object" && "id" in item && typeof item.id === "number" &&
    "title" in item && typeof item.title === "string" && "locationText" in item &&
    typeof item.locationText === "string" && "stage" in item && typeof item.stage === "number" &&
    "affectedCount" in item && typeof item.affectedCount === "number" &&
    "areaMatch" in item && typeof item.areaMatch === "boolean")
    && value.resources.every((item) =>
      !!item && typeof item === "object" && "label" in item && typeof item.label === "string" &&
      "url" in item && typeof item.url === "string" && item.url.startsWith("https://"));
}

export function SewakChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function sendMessage(content: string) {
    const question = content.trim();
    if (!question || loading) return;
    const history = [...messages, { role: "user" as const, content: question }].slice(-12);
    setMessages(history);
    setDraft("");
    setError("");
    setReply(null);
    setLoading(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "The assistant request failed. Please try again.";
        throw new Error(message);
      }
      if (!isAssistantReply(payload)) {
        throw new Error("The assistant returned an invalid response.");
      }
      const result = payload;
      setReply(result);
      setMessages((current) => [...current, { role: "assistant" as const, content: result.answer }].slice(-12));
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "The assistant request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  }

  function resetChat() {
    setMessages([WELCOME]);
    setReply(null);
    setDraft("");
    setError("");
  }

  return (
    <section className="card widget sewak-chat" aria-labelledby="sewak-chat-title">
      <header className="sewak-chat-header">
        <div className="sewak-chat-avatar"><Bot size={18} aria-hidden /></div>
        <div className="sewak-chat-heading">
          <h3 id="sewak-chat-title">Sewak assistant</h3>
          <span>Grounded in Ward 24 community cases</span>
        </div>
        <button type="button" className="sewak-chat-reset" onClick={resetChat} aria-label="Start a new chat" title="Start a new chat">
          <RotateCcw size={15} aria-hidden />
        </button>
      </header>

      <div className="sewak-chat-messages" ref={scrollRef} aria-live="polite" aria-label="Conversation">
        {messages.map((message, index) => (
          <div key={`${index}-${message.role}`} className={`sewak-chat-message ${message.role}`}>
            <span className="sewak-chat-message-icon" aria-hidden>
              {message.role === "assistant" ? <Bot size={14} /> : <UserRound size={14} />}
            </span>
            <div className="sewak-chat-bubble">{renderMessage(message.content)}</div>
          </div>
        ))}
        {loading && (
          <div className="sewak-chat-message assistant" role="status">
            <span className="sewak-chat-message-icon" aria-hidden><Bot size={14} /></span>
            <div className="sewak-chat-bubble sewak-chat-loading"><LoaderCircle size={15} aria-hidden /> Checking relevant cases…</div>
          </div>
        )}
      </div>

      {reply && (
        <div className="sewak-chat-context">
          <div className="sewak-chat-meta">
            <span>Objective: <strong>{reply.objective}</strong></span>
            <span>{reply.mode === "llm" ? "AI answer · Sewak context" : "Local match · LLM not configured"}</span>
          </div>
          {reply.relatedCases.length > 0 && (
            <div>
              <div className="sewak-chat-context-label">Related cases</div>
              <ul className="sewak-chat-links">
                {reply.relatedCases.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Link href={`/cases/${item.id}`}>{item.title}</Link>
                    <span>{item.locationText} · {item.affectedCount} affected</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {reply.resources.length > 0 && (
            <div className="sewak-chat-sources">
              {reply.resources.map((resource) => (
                <a key={resource.url} href={resource.url} target="_blank" rel="noopener noreferrer">{resource.label}</a>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="sewak-chat-error" role="alert">{error}</p>}
      {messages.length === 1 && (
        <div className="sewak-chat-suggestions" aria-label="Suggested questions">
          {SUGGESTIONS.map((suggestion) => (
            <button type="button" className="chip" key={suggestion} disabled={loading} onClick={() => void sendMessage(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form className="sewak-chat-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="sewak-chat-input">Ask Sewak a question</label>
        <textarea
          id="sewak-chat-input"
          rows={2}
          maxLength={1500}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about a civic issue…"
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !draft.trim()} aria-label="Send message">
          <ArrowUp size={17} aria-hidden /> <span>Send</span>
        </button>
      </form>
      <p className="sewak-chat-note">Answers use Sewak case data and may be AI-generated. Verify advice with official sources.</p>
    </section>
  );
}
