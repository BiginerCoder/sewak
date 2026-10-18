"use client";

import {
  CIVIC_LOCATIONS,
  DEFAULT_LOCATION_ID,
  civicLocation,
  civicLocationLabel,
  type CivicLocationId,
} from "@/lib/constants";
import {
  LocationDetail,
  fetchLiveLocation,
  getSavedLocations,
  removeSavedLocation,
  saveAsDefaultLocation,
  saveLocationToStorage,
  searchLocations,
  subscribeSavedLocations,
} from "@/lib/geo";
import { readDefaultLocation, subscribeDefaultLocation } from "@/lib/location-preference";
import {
  Bookmark,
  Check,
  Compass,
  Loader2,
  MapPin,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const EMPTY_LOCATIONS: LocationDetail[] = [];
const getServerSavedLocations = () => EMPTY_LOCATIONS;
const getServerDefaultLocation = () => DEFAULT_LOCATION_ID;

export function LocationPicker({
  locationId,
  compact = false,
}: {
  locationId: CivicLocationId;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  const currentParam = searchParams.get("location");
  const currentId = currentParam || locationId || DEFAULT_LOCATION_ID;

  const defaultId = useSyncExternalStore(
    subscribeDefaultLocation,
    readDefaultLocation,
    getServerDefaultLocation
  );

  const savedLocations = useSyncExternalStore(
    subscribeSavedLocations,
    getSavedLocations,
    getServerSavedLocations
  );

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationDetail[]>([]);
  const [locating, setLocating] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [saveTagInput, setSaveTagInput] = useState("");
  const [showTagForm, setShowTagForm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const activeLocation = civicLocation(currentId);
  const isDefault = currentId === defaultId;

  // Sync to preferred default once on mount if not explicitly in URL
  useEffect(() => {
    if (compact || typeof window === "undefined") return;
    const preferred = readDefaultLocation();
    const currentLoc = new URLSearchParams(window.location.search).get("location");
    if (!currentLoc && preferred && preferred !== DEFAULT_LOCATION_ID) {
      const params = new URLSearchParams(window.location.search);
      params.set("location", preferred);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [compact, pathname, router]);

  // Handle location search debouncing
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  function applyLocation(id: string, detail?: LocationDetail) {
    if (detail) {
      // Also cache it in saved locations if not present
      saveLocationToStorage(detail);
    }
    const params = new URLSearchParams(query);
    params.set("location", id);
    router.push(`${pathname}?${params.toString()}`);
    setIsOpen(false);
    setSearchQuery("");
  }

  async function handleLiveGps() {
    setLocating(true);
    setGeoError(null);
    setGeoNotice(null);
    try {
      const detail = await fetchLiveLocation();
      setGeoNotice(`Detected: ${detail.label}`);
      applyLocation(detail.id, detail);
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Could not fetch GPS location.");
    } finally {
      setLocating(false);
    }
  }

  function handleSaveCurrent(tag: string) {
    const detail: LocationDetail = {
      id: currentId,
      label: civicLocationLabel(activeLocation),
      formattedAddress: `${activeLocation.ward}, ${activeLocation.locality}, ${activeLocation.city}`,
      savedTag: tag.trim() || "Saved area",
      savedAt: Date.now(),
    };
    saveLocationToStorage(detail, tag);
    setShowTagForm(false);
    setSaveTagInput("");
  }

  function handleSaveAsDefault() {
    saveAsDefaultLocation(currentId);
  }

  return (
    <>
      <div className={`location-picker${compact ? " compact" : ""}`}>
        <button
          type="button"
          className="location-picker-btn"
          onClick={() => setIsOpen(true)}
          title="Change location or find by PIN code / GPS"
          aria-label="Location selector"
        >
          <MapPin size={16} className="location-pin-icon" aria-hidden />
          <span className="location-picker-text">{civicLocationLabel(activeLocation)}</span>
          <span className="location-picker-change-tag">Change</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm location-gps-quick-btn"
          onClick={handleLiveGps}
          disabled={locating}
          title="Use live GPS location"
        >
          {locating ? <Loader2 size={13} className="spin" /> : <Compass size={13} />}
          <span>{locating ? "Locating…" : "GPS"}</span>
        </button>

        {!compact && !isDefault && (
          <button
            type="button"
            className="btn btn-ghost btn-sm location-default-button"
            onClick={handleSaveAsDefault}
            title="Save as your default location"
          >
            <Bookmark size={13} aria-hidden /> Save default
          </button>
        )}
        {!compact && isDefault && <span className="location-default-label">Default</span>}
      </div>

      {geoNotice && (
        <div className="location-toast notice" role="status">
          <Check size={14} /> {geoNotice}
          <button type="button" onClick={() => setGeoNotice(null)} className="toast-close">
            <X size={12} />
          </button>
        </div>
      )}

      {geoError && (
        <div className="location-toast error" role="alert">
          <X size={14} /> {geoError}
          <button type="button" onClick={() => setGeoError(null)} className="toast-close">
            <X size={12} />
          </button>
        </div>
      )}

      {isOpen && mounted && createPortal(
        <div className="location-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div
            className="location-modal card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="loc-modal-title"
          >
            <div className="location-modal-header">
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <MapPin size={20} className="primary-color" />
                <h3 id="loc-modal-title" style={{ margin: 0 }}>
                  Choose Your Civic Area
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="location-modal-body">
              {/* GPS Action */}
              <div className="location-gps-card">
                <div style={{ flex: 1 }}>
                  <b>Use Exact GPS Location</b>
                  <p className="small muted" style={{ margin: "2px 0 0" }}>
                    Detects your street, locality and PIN code directly from your device.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleLiveGps}
                  disabled={locating}
                >
                  {locating ? (
                    <>
                      <Loader2 size={15} className="spin" /> Detecting…
                    </>
                  ) : (
                    <>
                      <Compass size={15} /> Detect Live Location
                    </>
                  )}
                </button>
              </div>

              {/* Address / Pincode Search Input */}
              <div className="location-search-box">
                <label htmlFor="loc-search-input" className="small" style={{ fontWeight: 600 }}>
                  Type street address, locality or 6-digit PIN code:
                </label>
                <div className="search" style={{ marginTop: 6 }}>
                  <Search size={16} aria-hidden />
                  <input
                    id="loc-search-input"
                    type="search"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. 302016, Shastri Nagar, Mansarovar, Jaipur..."
                  />
                  {searching && <Loader2 size={16} className="spin muted" />}
                </div>
              </div>

              {/* Search Suggestions */}
              {searchResults.length > 0 && (
                <div className="location-suggestions-list" aria-label="Search suggestions">
                  <div className="small muted" style={{ marginBottom: 6 }}>
                    Matching locations ({searchResults.length}):
                  </div>
                  {searchResults.map((res) => (
                    <button
                      key={res.id + res.formattedAddress}
                      type="button"
                      className="location-suggestion-item"
                      onClick={() => applyLocation(res.id, res)}
                    >
                      <MapPin size={16} className="muted" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div className="location-sugg-title">
                          <b>{res.label}</b>
                          {res.pincode && <span className="pincode-pill">PIN: {res.pincode}</span>}
                        </div>
                        <div className="small muted location-sugg-addr">{res.formattedAddress}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.trim().length >= 2 && searchResults.length === 0 && !searching && (
                <div className="card empty" style={{ padding: "16px 20px" }}>
                  <p className="small" style={{ margin: 0 }}>
                    No exact match found for “{searchQuery}”. Try entering a 6-digit PIN code or landmark name.
                  </p>
                </div>
              )}

              {/* Saved Locations */}
              {savedLocations.length > 0 && (
                <div className="location-section">
                  <div className="row between" style={{ alignItems: "center", marginBottom: 8 }}>
                    <span className="small muted" style={{ fontWeight: 600 }}>
                      ⭐ Your Saved Locations ({savedLocations.length})
                    </span>
                  </div>
                  <div className="saved-locations-chips">
                    {savedLocations.map((loc) => (
                      <div
                        key={loc.id + (loc.savedTag || "")}
                        className={`saved-location-chip${loc.id === currentId ? " active" : ""}`}
                      >
                        <button
                          type="button"
                          className="saved-location-chip-click"
                          onClick={() => applyLocation(loc.id, loc)}
                        >
                          <Star size={12} className="star-icon" />
                          <span className="saved-tag">{loc.savedTag || "Area"}:</span>
                          <span className="saved-name">{loc.label}</span>
                        </button>
                        <button
                          type="button"
                          className="saved-location-chip-del"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSavedLocation(loc.id);
                          }}
                          title="Remove saved location"
                          aria-label="Remove saved location"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Current Location Form */}
              <div className="location-bookmark-section">
                {!showTagForm ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowTagForm(true)}
                  >
                    <Plus size={14} /> Bookmark current area ({civicLocationLabel(activeLocation)})
                  </button>
                ) : (
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <input
                      type="text"
                      className="input input-sm"
                      placeholder="Label (e.g. Home, Work, Shop)"
                      value={saveTagInput}
                      onChange={(e) => setSaveTagInput(e.target.value)}
                      style={{ maxWidth: 200 }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSaveCurrent(saveTagInput)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowTagForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Civic Wards (Presets) */}
              <div className="location-section">
                <span className="small muted" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Standard Prototype Wards:
                </span>
                <div className="preset-wards-grid">
                  {CIVIC_LOCATIONS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-ward-card${preset.id === currentId ? " active" : ""}`}
                      onClick={() => applyLocation(preset.id)}
                    >
                      <b>{preset.ward}</b>
                      <span className="small muted">{preset.locality}, {preset.city}</span>
                      {preset.id === currentId && <Check size={14} className="check-icon" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="location-modal-footer">
              <span className="small muted">
                Active: <b>{civicLocationLabel(activeLocation)}</b>
              </span>
              <div className="row" style={{ gap: 8 }}>
                {!isDefault && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleSaveAsDefault}
                  >
                    <Bookmark size={14} /> Make Default
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
