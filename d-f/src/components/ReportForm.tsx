"use client";

import { createIssue } from "@/app/actions";
import { CATEGORIES } from "@/lib/constants";
import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PhotoPicker } from "./PhotoPicker";

const DEMO_LOCATION = "Near Shastri Nagar Circle, Ward 24";

export function ReportForm({ initialCategory, initialDescription }: { initialCategory?: string; initialDescription?: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"problem" | "information">("problem");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES.some((c) => c.id === initialCategory) ? initialCategory! : "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [location, setLocation] = useState("");
  const [simulated, setSimulated] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, start] = useTransition();

  function validate() {
    const e: Record<string, string> = {};
    if (title.trim().length < 8) e.title = "Enter a short title of at least 8 characters.";
    if (!category) e.category = "Choose a category.";
    if (description.trim().length < 20) e.description = "Describe the problem in at least 20 characters.";
    if (location.trim().length < 3) e.location = "Add a location or use the demo location.";
    return e;
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError("Please fix the highlighted fields.");
      const first = ["title", "category", "description", "location"].find((k) => e[k]);
      if (first) document.getElementById(`f-${first}`)?.focus();
      return;
    }
    start(async () => {
      const r = await createIssue({ kind, title, category, description, location, simulated, photo });
      if (r.ok) router.push(`/cases/${r.id}`);
      else {
        setErrors(r.fields ?? {});
        setFormError(r.error);
      }
    });
  }

  const f = (k: string) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `e-${k}` : undefined });

  return (
    <form className="card form-card" onSubmit={submit} noValidate aria-label="Report a problem">
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>What are you posting?</legend>
        <div className="radio-cards">
          <button type="button" className="chip" aria-pressed={kind === "problem"} onClick={() => setKind("problem")}>
            <b style={{ display: "block" }}>A problem to fix</b>
            <span className="small muted">Starts a tracked case</span>
          </button>
          <button type="button" className="chip" aria-pressed={kind === "information"} onClick={() => setKind("information")}>
            <b style={{ display: "block" }}>Information for neighbours</b>
            <span className="small muted">A notice with no case lifecycle</span>
          </button>
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="f-title">Title</label>
        <input id="f-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Streetlights out on Lane 4" {...f("title")} />
        {errors.title && <div id="e-title" className="error">{errors.title}</div>}
      </div>

      <div className="field">
        <label htmlFor="f-category">Category</label>
        <select id="f-category" className="select" value={category} onChange={(e) => setCategory(e.target.value)} {...f("category")}>
          <option value="">Select a category</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        {errors.category && <div id="e-category" className="error">{errors.category}</div>}
      </div>

      <div className="field">
        <label htmlFor="f-description">Description</label>
        <textarea id="f-description" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is wrong, how long has it been happening, who is affected?" {...f("description")} />
        <span className="hint">{description.trim().length} characters · at least 20</span>
        {errors.description && <div id="e-description" className="error">{errors.description}</div>}
      </div>

      <div className="field">
        <label htmlFor="f-location">Location</label>
        <div className="row" style={{ gap: 10, alignItems: "stretch" }}>
          <input id="f-location" className="input" value={location} onChange={(e) => { setLocation(e.target.value); setSimulated(false); }} placeholder="Street, landmark or block" {...f("location")} />
          <button type="button" className="btn btn-secondary" onClick={() => { setLocation(DEMO_LOCATION); setSimulated(true); }}>
            <MapPin size={16} aria-hidden /> Use demo location
          </button>
        </div>
        <span className="hint">
          {simulated
            ? "Simulated location: this demo does not read your real GPS position."
            : "Typed by you. Demo location fills in a simulated spot in Ward 24."}
        </span>
        {errors.location && <div id="e-location" className="error">{errors.location}</div>}
      </div>

      <PhotoPicker value={photo} onChange={setPhoto} error={errors.photo} label="Photo (optional)" hint="A clear photo with a landmark makes the case stronger. Resized in your browser." />

      {formError && <div className="callout" style={{ background: "var(--red-bg)", color: "var(--red-fg)" }} role="alert">{formError}</div>}

      <div className="row between wrap">
        <span className="small muted">Posting as Demo resident · Ward 24</span>
        <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>
          {pending ? "Submitting…" : kind === "problem" ? "Submit report" : "Post notice"}
        </button>
      </div>
    </form>
  );
}
