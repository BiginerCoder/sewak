"use client";

import { createIssue } from "@/app/actions";
import {
  CATEGORIES,
  CIVIC_LOCATIONS,
  civicLocation,
  civicLocationLabel,
  type CivicLocationId,
} from "@/lib/constants";
import {
  LocationDetail,
  fetchLiveLocation,
  getSavedLocations,
  saveAsDefaultLocation,
  saveLocationToStorage,
  searchLocations,
  subscribeSavedLocations,
} from "@/lib/geo";
import { saveDefaultLocation } from "@/lib/location-preference";
import { useAuth } from "@/lib/auth-context";
import {
  Check,
  Compass,
  Loader2,
  MapPin,
  Search,
  Star,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { PhotoPicker } from "./PhotoPicker";

const EMPTY_SAVED: LocationDetail[] = [];
const getServerSaved = () => EMPTY_SAVED;

export function ReportForm({
  initialCategory,
  initialDescription,
  initialLocationId,
}: {
  initialCategory?: string;
  initialDescription?: string;
  initialLocationId: CivicLocationId;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const [kind, setKind] = useState<"problem" | "information">("problem");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(
    CATEGORIES.some((c) => c.id === initialCategory) ? initialCategory! : ""
  );
  const [description, setDescription] = useState(initialDescription ?? "");
  const [locationId, setLocationId] = useState<CivicLocationId>(initialLocationId);
  const [location, setLocation] = useState("");
  const [pincode, setPincode] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [saveForFuture, setSaveForFuture] = useState(false);
  const [savedLabel, setSavedLabel] = useState("");
  const [simulated, setSimulated] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, start] = useTransition();

  // Location search & GPS state
  const [locating, setLocating] = useState(false);
  const [locNotice, setLocNotice] = useState<string | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationDetail[]>([]);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const savedLocations = useSyncExternalStore(
    subscribeSavedLocations,
    getSavedLocations,
    getServerSaved
  );

  // Address & Pincode Search Debounce
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(searchQuery);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  async function handleLiveGps() {
    setLocating(true);
    setLocError(null);
    setLocNotice(null);
    try {
      const detail = await fetchLiveLocation();
      setLocationId(detail.id);
      setLocation(detail.formattedAddress);
      if (detail.pincode) setPincode(detail.pincode);
      setSimulated(false);
      setLocNotice(`Live GPS: ${detail.label}`);
    } catch (err) {
      setLocError(err instanceof Error ? err.message : "Could not fetch GPS location.");
    } finally {
      setLocating(false);
    }
  }

  function pickSuggestion(item: LocationDetail) {
    setLocationId(item.id);
    setLocation(item.formattedAddress);
    if (item.pincode) setPincode(item.pincode);
    setSimulated(false);
    setSuggestions([]);
    setSearchQuery("");
    setLocNotice(`Location set to: ${item.label}`);
  }

  function pickSaved(saved: LocationDetail) {
    setLocationId(saved.id);
    setLocation(saved.formattedAddress);
    if (saved.pincode) setPincode(saved.pincode);
    setSimulated(false);
    setLocNotice(`Loaded from saved: ${saved.savedTag || saved.label}`);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (title.trim().length < 8) e.title = "Enter a short title of at least 8 characters.";
    if (!category) e.category = "Choose a category.";
    if (description.trim().length < 20) e.description = "Describe the problem in at least 20 characters.";
    if (location.trim().length < 3) e.location = "Add an address or use GPS / search.";
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

    if (saveAsDefault && !saveDefaultLocation(locationId)) {
      setFormError("Could not save your default location in this browser.");
      return;
    }

    // If requested, save location for future use
    if (saveForFuture && location.trim()) {
      saveLocationToStorage(
        {
          id: locationId,
          label: location.split(",")[0] + (pincode ? ` (${pincode})` : ""),
          formattedAddress: location,
          pincode,
          savedTag: savedLabel.trim() || "Saved location",
        },
        savedLabel.trim() || "Saved location"
      );
    }

    start(async () => {
      const r = await createIssue({
        kind,
        title,
        category,
        description,
        locationId,
        location,
        simulated,
        photo,
      });
      if (r.ok) router.push(`/cases/${r.id}?location=${locationId}`);
      else {
        setErrors(r.fields ?? {});
        setFormError(r.error);
      }
    });
  }

  const f = (k: string) => ({
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `e-${k}` : undefined,
  });

  const activeWard = civicLocation(locationId);

  return (
    <form className="card form-card" onSubmit={submit} noValidate aria-label="Report a problem">
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          What are you posting?
        </legend>
        <div className="radio-cards">
          <button
            type="button"
            className="chip"
            aria-pressed={kind === "problem"}
            onClick={() => setKind("problem")}
          >
            <b style={{ display: "block" }}>A problem to fix</b>
            <span className="small muted">Starts a tracked case</span>
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={kind === "information"}
            onClick={() => setKind("information")}
          >
            <b style={{ display: "block" }}>Information for neighbours</b>
            <span className="small muted">A notice with no case lifecycle</span>
          </button>
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="f-title">Title</label>
        <input
          id="f-title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. Broken water pipe leaking near Lane 4"
          {...f("title")}
        />
        {errors.title && <div id="e-title" className="error">{errors.title}</div>}
      </div>

      <div className="field">
        <label htmlFor="f-category">Category</label>
        <select
          id="f-category"
          className="select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          {...f("category")}
        >
          <option value="">Select a category</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        {errors.category && <div id="e-category" className="error">{errors.category}</div>}
      </div>

      <div className="field">
        <label htmlFor="f-description">Description</label>
        <textarea
          id="f-description"
          className="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is wrong, how long has it been happening, who is affected?"
          {...f("description")}
        />
        <span className="hint">{description.trim().length} characters · at least 20</span>
        {errors.description && <div id="e-description" className="error">{errors.description}</div>}
      </div>

      {/* Enhanced Location Section */}
      <div className="field" style={{ background: "var(--surface-sunken)", padding: "16px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
        <div className="row between wrap" style={{ alignItems: "center", marginBottom: 8 }}>
          <label htmlFor="f-location" style={{ margin: 0, fontWeight: 700 }}>
            Exact Incident Location
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleLiveGps}
            disabled={locating}
            title="Detect your device GPS position"
          >
            {locating ? <Loader2 size={14} className="spin" /> : <Compass size={14} />}
            {locating ? "Reading GPS…" : "Fetch Live Location (GPS)"}
          </button>
        </div>

        {/* Saved locations quick-select */}
        {savedLocations.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <span className="small muted" style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Quick pick from saved locations:
            </span>
            <div className="saved-locations-chips">
              {savedLocations.map((s) => (
                <button
                  key={s.id + (s.savedTag || "")}
                  type="button"
                  className="saved-location-chip"
                  onClick={() => pickSaved(s)}
                  title={`Use ${s.label}`}
                >
                  <Star size={11} className="star-icon" />
                  <span className="saved-tag">{s.savedTag || "Saved"}:</span>
                  <span className="saved-name">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Address / PIN code search autocomplete */}
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="report-loc-search" className="small muted" style={{ fontWeight: 600 }}>
            Or type address or 6-digit PIN code to search:
          </label>
          <div className="search" style={{ marginTop: 4 }}>
            <Search size={15} aria-hidden />
            <input
              id="report-loc-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. 302016, Mansarovar, Shastri Nagar..."
            />
            {searching && <Loader2 size={15} className="spin muted" />}
          </div>

          {suggestions.length > 0 && (
            <div className="location-suggestions-list" style={{ marginTop: 6 }}>
              {suggestions.map((item) => (
                <button
                  key={item.id + item.formattedAddress}
                  type="button"
                  className="location-suggestion-item"
                  onClick={() => pickSuggestion(item)}
                >
                  <MapPin size={15} className="muted" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div className="location-sugg-title">
                      <b>{item.label}</b>
                      {item.pincode && <span className="pincode-pill">PIN: {item.pincode}</span>}
                    </div>
                    <div className="small muted location-sugg-addr">{item.formattedAddress}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Address Input Field */}
        <div className="row" style={{ gap: 10, alignItems: "stretch" }}>
          <input
            id="f-location"
            className="input"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setSimulated(false);
            }}
            placeholder="Street address, landmark, colony or block"
            {...f("location")}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const selected = CIVIC_LOCATIONS.find((item) => item.id === locationId) ?? CIVIC_LOCATIONS[0];
              setLocation(`Near ${selected.locality}, ${selected.ward}`);
              setSimulated(true);
              setLocNotice(`Filled demo spot in ${selected.ward}`);
            }}
            title="Use demo location"
          >
            <MapPin size={15} aria-hidden /> Demo
          </button>
        </div>

        {locNotice && (
          <div className="small" style={{ color: "var(--green-fg)", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <Check size={14} /> {locNotice}
          </div>
        )}
        {locError && (
          <div className="small" style={{ color: "var(--red-fg)", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <X size={14} /> {locError}
          </div>
        )}

        <div className="row wrap" style={{ gap: 16, marginTop: 10 }}>
          <label className="location-save-default" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={saveForFuture}
              onChange={(e) => setSaveForFuture(e.target.checked)}
            />
            <b>Save this location for future complaints</b>
          </label>

          <label className="location-save-default" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={saveAsDefault}
              onChange={(e) => setSaveAsDefault(e.target.checked)}
            />
            Make my default browsing area
          </label>
        </div>

        {saveForFuture && (
          <div style={{ marginTop: 8 }}>
            <input
              type="text"
              className="input input-sm"
              placeholder="Tag this location (e.g. Home, Office, Lane 4)"
              value={savedLabel}
              onChange={(e) => setSavedLabel(e.target.value)}
              style={{ maxWidth: 300 }}
            />
          </div>
        )}

        {errors.location && <div id="e-location" className="error" style={{ marginTop: 6 }}>{errors.location}</div>}
      </div>

      <PhotoPicker
        value={photo}
        onChange={setPhoto}
        error={errors.photo}
        label="Photo (optional)"
        hint="A clear photo with a landmark makes the case stronger. Resized in your browser."
      />

      {formError && (
        <div className="callout" style={{ background: "var(--red-bg)", color: "var(--red-fg)" }} role="alert">
          {formError}
        </div>
      )}

      <div className="row between wrap" style={{ alignItems: "center" }}>
        <span className="small muted">
          Posting as <b>{user?.name || "Civic resident"}</b> · {activeWard.ward}
        </span>
        <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>
          {pending ? "Submitting…" : kind === "problem" ? "Submit report" : "Post notice"}
        </button>
      </div>
    </form>
  );
}
