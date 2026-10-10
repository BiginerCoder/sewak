"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  CURRENT_RESIDENT,
  CATEGORIES,
  REOPEN_THRESHOLD,
  VERIFY_THRESHOLD,
  categoryOf,
  stageOf,
} from "./constants";
import { INITIAL_DEMO_DATA, type DemoData } from "./queries";

const STORAGE_KEY = "sewak-demo-data-v1";
const MAX_IMAGE_CHARS = 1_600_000;

export type ActionResult = { ok: true; id?: number } | { ok: false; error: string; fields?: Record<string, string> };

type DemoContextValue = {
  data: DemoData;
  isReady: boolean;
  storageError: string;
  clearSavedData: () => void;
  createIssue: (input: {
    kind: string;
    title: string;
    category: string;
    description: string;
    location: string;
    simulated?: boolean;
    photo?: string | null;
  }) => ActionResult;
  confirmAffected: (issueId: number) => ActionResult;
  addComment: (issueId: number, body: string) => ActionResult;
  addEvidence: (input: { issueId: number; phase: string; caption: string; photo?: string | null }) => ActionResult;
  logAuthorityUpdate: (input: { issueId: number; stage: number; ref: string; note: string }) => ActionResult;
  submitVerification: (input: { issueId: number; verdict: string; note: string }) => ActionResult;
};

const DemoContext = createContext<DemoContextValue | null>(null);

function restoreDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(restoreDates);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    typeof item === "string" && key.endsWith("At") ? new Date(item) : restoreDates(item),
  ]));
}

function isDemoData(value: unknown): value is DemoData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DemoData>;
  return ["issues", "comments", "evidence", "timeline", "verifications", "confirmations"]
    .every((key) => Array.isArray(candidate[key as keyof DemoData]));
}

function nextId(items: { id: number }[]) {
  return Math.max(0, ...items.map((item) => item.id)) + 1;
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DemoData>(INITIAL_DEMO_DATA);
  const [isReady, setIsReady] = useState(false);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    const load = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setData(INITIAL_DEMO_DATA);
          setStorageError("");
          setIsReady(true);
          return;
        }
        const parsed = restoreDates(JSON.parse(stored));
        if (!isDemoData(parsed)) throw new Error("Saved demo data has an invalid format.");
        setData(parsed);
        setStorageError("");
      } catch (error) {
        setStorageError(error instanceof Error ? error.message : "Saved demo data could not be read.");
      } finally {
        setIsReady(true);
      }
    };
    load();
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) load();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const save = (next: DemoData): ActionResult => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setData(next);
      setStorageError("");
      return { ok: true };
    } catch {
      const error = "This browser could not save the demo data. Free up browser storage and try again.";
      setStorageError(error);
      return { ok: false, error };
    }
  };

  const actions: DemoContextValue = {
    data,
    isReady,
    storageError,
    clearSavedData() {
      try {
        localStorage.removeItem(STORAGE_KEY);
        setData(INITIAL_DEMO_DATA);
        setStorageError("");
        setIsReady(true);
      } catch {
        setStorageError("Saved demo data could not be cleared from this browser.");
      }
    },
    createIssue(input) {
      const fields: Record<string, string> = {};
      const title = input.title.trim();
      const description = input.description.trim();
      const location = input.location.trim();
      if (title.length < 8 || title.length > 120) fields.title = "Enter a title between 8 and 120 characters.";
      if (!CATEGORIES.some((category) => category.id === input.category)) fields.category = "Choose a category.";
      if (description.length < 20) fields.description = "Describe the problem in at least 20 characters.";
      if (location.length < 3) fields.location = "Add a location or use the demo location.";
      const photo = input.photo || null;
      if (photo && (!/^data:image\/(jpeg|png|webp);base64,/.test(photo) || photo.length > MAX_IMAGE_CHARS)) {
        fields.photo = "Photo must be a JPEG, PNG or WebP image under 1 MB after resizing.";
      }
      if (Object.keys(fields).length) return { ok: false, error: "Please fix the highlighted fields.", fields };

      const id = nextId(data.issues);
      const now = new Date();
      const kind = input.kind === "information" ? "information" : "problem";
      const category = categoryOf(input.category);
      const issue = {
        id,
        kind,
        title,
        description,
        category: category.id,
        stage: 1,
        author: CURRENT_RESIDENT,
        locationText: location,
        locationSimulated: input.simulated !== false,
        department: kind === "problem" ? category.department : null,
        complaintRef: null,
        authorityNote: null,
        affectedCount: kind === "problem" ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      };
      const next = { ...data, issues: [...data.issues, issue] };
      if (kind === "problem") {
        next.timeline = [...data.timeline, {
          id: nextId(data.timeline), issueId: id, stage: 1, label: "Reported",
          note: "Problem posted.", actor: CURRENT_RESIDENT, source: "resident", createdAt: now,
        }];
        next.confirmations = [...data.confirmations, {
          id: nextId(data.confirmations), issueId: id, resident: CURRENT_RESIDENT, createdAt: now,
        }];
      }
      if (photo) {
        next.evidence = [...data.evidence, {
          id: nextId(data.evidence), issueId: id, phase: "before", caption: "Photo added with the report",
          imageUrl: photo, addedBy: CURRENT_RESIDENT, createdAt: now,
        }];
      }
      const result = save(next);
      return result.ok ? { ok: true, id } : result;
    },
    confirmAffected(issueId) {
      const issue = data.issues.find((item) => item.id === issueId);
      if (!issue || issue.kind !== "problem") return { ok: false, error: "Case not found." };
      if (data.confirmations.some((item) => item.issueId === issueId && item.resident === CURRENT_RESIDENT)) {
        return { ok: false, error: "You have already confirmed this problem." };
      }
      const now = new Date();
      const affectedCount = issue.affectedCount + 1;
      const stage = issue.stage === 1 && affectedCount >= 3 ? 2 : issue.stage;
      const next = {
        ...data,
        issues: data.issues.map((item) => item.id === issueId ? { ...item, affectedCount, stage, updatedAt: now } : item),
        confirmations: [...data.confirmations, { id: nextId(data.confirmations), issueId, resident: CURRENT_RESIDENT, createdAt: now }],
      };
      if (stage === 2 && issue.stage === 1) {
        next.timeline = [...data.timeline, {
          id: nextId(data.timeline), issueId, stage, label: "Community confirmed",
          note: "Three or more residents confirmed they are affected.", actor: "Community", source: "community", createdAt: now,
        }];
      }
      return save(next);
    },
    addComment(issueId, body) {
      const text = body.trim();
      if (text.length < 2 || text.length > 1000) return { ok: false, error: "Comments must be between 2 and 1000 characters." };
      if (!data.issues.some((item) => item.id === issueId)) return { ok: false, error: "Case not found." };
      return save({ ...data, comments: [...data.comments, {
        id: nextId(data.comments), issueId, author: CURRENT_RESIDENT, body: text, createdAt: new Date(),
      }] });
    },
    addEvidence(input) {
      const phase = ["before", "during", "after"].includes(input.phase) ? input.phase : "";
      const caption = input.caption.trim();
      const photo = input.photo || null;
      if (!data.issues.some((item) => item.id === input.issueId)) return { ok: false, error: "Case not found." };
      if (!phase) return { ok: false, error: "Choose before, during or after." };
      if (caption.length < 3) return { ok: false, error: "Add a short caption describing the evidence." };
      if (!photo || !/^data:image\/(jpeg|png|webp);base64,/.test(photo) || photo.length > MAX_IMAGE_CHARS) {
        return { ok: false, error: "Attach a JPEG, PNG or WebP photo under 1 MB after resizing." };
      }
      return save({ ...data, evidence: [...data.evidence, {
        id: nextId(data.evidence), issueId: input.issueId, phase, caption, imageUrl: photo, addedBy: CURRENT_RESIDENT, createdAt: new Date(),
      }] });
    },
    logAuthorityUpdate(input) {
      const issue = data.issues.find((item) => item.id === input.issueId);
      if (!issue || issue.kind !== "problem") return { ok: false, error: "Case not found." };
      const stage = Number(input.stage);
      const ref = input.ref.trim();
      const note = input.note.trim();
      if (stage < 3 || stage > 6 || stage <= issue.stage) return { ok: false, error: "Choose a stage after the current one." };
      if (!ref && !note) return { ok: false, error: "Add a complaint reference or a note about what the authority said." };
      const now = new Date();
      return save({
        ...data,
        issues: data.issues.map((item) => item.id === issue.id
          ? { ...item, stage, complaintRef: ref || item.complaintRef, authorityNote: note || item.authorityNote, updatedAt: now }
          : item),
        timeline: [...data.timeline, {
          id: nextId(data.timeline), issueId: issue.id, stage, label: stageOf(stage).label,
          note: note || `Complaint reference ${ref} recorded.`,
          actor: `${CURRENT_RESIDENT} (reporting authority activity)`, source: "authority-reported", createdAt: now,
        }],
      });
    },
    submitVerification(input) {
      const issue = data.issues.find((item) => item.id === input.issueId);
      if (!issue || issue.kind !== "problem") return { ok: false, error: "Case not found." };
      if (issue.stage !== 6) return { ok: false, error: "Resolution can only be verified after the authority reports it resolved." };
      if (input.verdict !== "fixed" && input.verdict !== "not_fixed") return { ok: false, error: "Choose a verdict." };
      const now = new Date();
      const previous = data.verifications.find((item) => item.issueId === issue.id && item.resident === CURRENT_RESIDENT);
      const verification = {
        id: previous?.id ?? nextId(data.verifications), issueId: issue.id, resident: CURRENT_RESIDENT,
        verdict: input.verdict, note: input.note.trim() || null, createdAt: now,
      };
      const verifications = previous
        ? data.verifications.map((item) => item.id === previous.id ? verification : item)
        : [...data.verifications, verification];
      const fixed = verifications.filter((item) => item.issueId === issue.id && item.verdict === "fixed").length;
      const notFixed = verifications.filter((item) => item.issueId === issue.id && item.verdict === "not_fixed").length;
      let stage = issue.stage;
      let label = "";
      if (fixed >= VERIFY_THRESHOLD) {
        stage = 7;
        label = "Community verified resolved";
      } else if (notFixed >= REOPEN_THRESHOLD) {
        stage = 5;
        label = "Reopened by residents";
      }
      const next = {
        ...data,
        verifications: stage === 5 ? verifications.filter((item) => item.issueId !== issue.id) : verifications,
        issues: data.issues.map((item) => item.id === issue.id ? { ...item, stage, updatedAt: now } : item),
      };
      if (label) {
        next.timeline = [...data.timeline, {
          id: nextId(data.timeline), issueId: issue.id, stage, label,
          note: label === "Community verified resolved"
            ? `${fixed} residents confirmed the problem is actually fixed.`
            : `${notFixed} residents reported the problem is not fixed.`,
          actor: "Community", source: "community", createdAt: now,
        }];
      }
      return save(next);
    },
  };

  return (
    <DemoContext.Provider value={actions}>
      <div className="callout info" role="note" style={{ margin: 12 }}>
        <span>{isReady ? "Demo mode: changes are saved only in this browser and are not sent to a service." : "Loading this browser's saved demo…"}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (window.confirm("Reset all saved demo changes in this browser?")) actions.clearSavedData();
          }}
        >
          Reset demo
        </button>
      </div>
      {storageError && (
        <div className="callout" role="alert" style={{ margin: 12 }}>
          <span>{storageError}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={actions.clearSavedData}>Reset browser demo data</button>
        </div>
      )}
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoData() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemoData must be used inside DemoProvider.");
  return value;
}
