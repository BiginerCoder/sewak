"use client";
import { Building2, ExternalLink, LocateFixed, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { govlinks, type GovlinksAreaLink, type GovlinksWard } from "@/lib/govlinks";
import { AddPartnerLinkModal } from "./AddPartnerLinkModal";

type AreaSelection = {
  id: number;
  kind: "ward_id" | "local_body_id" | "district_id";
  label: string;
  scope: string;
};

type ReverseGeocode = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

const USER_ID_KEY = "d-f.govlinksUserId";

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function wardLabel(ward: GovlinksWard) {
  const name = ward.ward_name || `Ward ${ward.ward_number}`;
  return `${name} · Ward ${ward.ward_number}, ${ward.local_body.replace(/\s*\(demo\)$/i, "")}, ${ward.district}, ${ward.state}`;
}

function wardSearchText(ward: GovlinksWard) {
  return normalize(`${ward.ward_name ?? ""} Ward ${ward.ward_number} ${ward.local_body} ${ward.district} ${ward.state}`);
}

function locationSelection(ward: GovlinksWard): AreaSelection {
  return { id: ward.ward_id, kind: "ward_id", label: wardLabel(ward), scope: "ward" };
}

function resolveDeviceArea(address: Record<string, string | undefined>, wards: GovlinksWard[]): AreaSelection | null {
  const neighborhoodNames = [
    address.neighbourhood,
    address.suburb,
    address.quarter,
    address.residential,
    address.city_district,
  ].filter((value): value is string => Boolean(value)).map(normalize);
  const exactWard = wards.find((ward) => {
    const name = normalize(ward.ward_name || "");
    return name && neighborhoodNames.some((candidate) => candidate === name || candidate.includes(name));
  });
  if (exactWard) return locationSelection(exactWard);

  const cityName = [address.city, address.town, address.village, address.municipality]
    .find((value) => Boolean(value));
  if (cityName) {
    const city = normalize(cityName);
    const localBody = wards.find((ward) => {
      const name = normalize(ward.local_body.replace(/\s*\(demo\)$/i, ""));
      return name === city || name.startsWith(`${city} `);
    });
    if (localBody) {
      return {
        id: localBody.local_body_id,
        kind: "local_body_id",
        label: `${cityName}, ${localBody.district}, ${localBody.state}`,
        scope: "local body",
      };
    }
  }

  const districtName = [address.state_district, address.district, address.county]
    .find((value) => Boolean(value));
  if (districtName) {
    const district = normalize(districtName);
    const match = wards.find((ward) => normalize(ward.district) === district);
    if (match) {
      return {
        id: match.district_id,
        kind: "district_id",
        label: `${match.district}, ${match.state}`,
        scope: "district",
      };
    }
  }
  return null;
}

function displayUrl(item: GovlinksAreaLink) {
  if (item.is_demo && item.domain.endsWith(".example")) {
    return `/placeholder?host=${encodeURIComponent(item.domain)}&title=${encodeURIComponent(item.title)}&from=services`;
  }
  return item.url;
}

function PartnerHighlightedCard({
  item,
  opening,
  disabled,
  onOpen,
}: {
  item: GovlinksAreaLink;
  opening: boolean;
  disabled: boolean;
  onOpen: (item: GovlinksAreaLink) => void;
}) {
  return (
    <article
      className="partner-highlighted-tab"
      style={{
        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.06) 100%)",
        border: "2px solid #10b981",
        borderRadius: "14px",
        padding: "20px",
        boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.15), 0 8px 10px -6px rgba(16, 185, 129, 0.1)",
        position: "relative",
        overflow: "hidden",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          color: "#ffffff",
          fontSize: "11px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          padding: "4px 14px",
          borderBottomLeftRadius: "10px",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <Sparkles size={12} />
        <span>Verified Partner Tab · No Voting Required</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginTop: "4px" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "10px",
            background: "rgba(16, 185, 129, 0.18)",
            color: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <ShieldCheck size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
            <span
              style={{
                background: "#10b981",
                color: "#ffffff",
                padding: "2px 8px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Direct Genuine Link
            </span>
            <span style={{ fontSize: "12px", color: "var(--fg-muted, #6b7280)", fontWeight: 500 }}>
              {item.website_name} · {item.domain}
            </span>
            <span style={{ fontSize: "11px", background: "rgba(0,0,0,0.06)", padding: "1px 6px", borderRadius: "4px" }}>
              {item.location_scope} coverage
            </span>
          </div>

          <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: 700, color: "var(--fg, #111827)" }}>
            {item.title}
          </h3>

          {item.partner_note && (
            <div
              style={{
                background: "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(4px)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                borderRadius: "8px",
                padding: "8px 12px",
                margin: "8px 0",
                fontSize: "12.5px",
                color: "#065f46",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <ShieldCheck size={16} style={{ color: "#10b981", flexShrink: 0 }} />
              <span><b>Partner Endorsement:</b> {item.partner_note}</span>
            </div>
          )}

          {item.steps && (
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--fg-muted, #4b5563)", lineHeight: "1.4" }}>
              <b>Steps:</b> {item.steps}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <span className="tag" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#065f46", fontWeight: 600 }}>
                {item.category_name}
              </span>
              <span className="tag">{item.action.replaceAll("_", " ")}</span>
            </div>

            {item.openable && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={disabled}
                onClick={() => onOpen(item)}
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "13px",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)",
                }}
              >
                {opening ? "Opening…" : item.is_demo ? "Open Verified Demo Link" : "Open Official Government Portal"}{" "}
                <ExternalLink size={15} style={{ marginLeft: "4px" }} />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function AreaLinkCard({
  item,
  opening,
  disabled,
  onOpen,
}: {
  item: GovlinksAreaLink;
  opening: boolean;
  disabled: boolean;
  onOpen: (item: GovlinksAreaLink) => void;
}) {
  return (
    <article className="card area-link-card">
      <div className="row between wrap" style={{ gap: 12 }}>
        <div>
          <div className="row wrap" style={{ gap: 7, marginBottom: 8 }}>
            <span className={`badge ${item.state === "verified" ? "green" : item.state === "stale" ? "red" : "amber"}`}>
              {item.state === "verified" ? "Verified" : item.state === "stale" ? "Reported stale" : "Candidate"}
            </span>
            {item.official_status && <span className="badge blue plain">Official organization</span>}
            {item.is_demo && <span className="badge amber plain">Demo data</span>}
          </div>
          <h3 className="card-title" style={{ margin: 0 }}>{item.title}</h3>
          <p className="small muted" style={{ margin: "4px 0 0" }}>{item.website_name} · {item.domain}</p>
        </div>
        <span className="badge plain">{item.location_scope} coverage</span>
      </div>
      <div className="row wrap" style={{ gap: 7 }}>
        <span className="tag">{item.category_name}</span>
        <span className="tag">{item.action.replaceAll("_", " ")}</span>
        {item.login_required && <span className="tag">Login may be required</span>}
      </div>
      {item.steps && <p className="small" style={{ margin: 0 }}>{item.steps}</p>}
      <div>
        {item.openable ? (
          <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() => onOpen(item)}>
            {opening ? "Opening…" : item.is_demo ? "Open demo page" : "Open government page"} <ExternalLink size={14} aria-hidden />
          </button>
        ) : (
          <span className="small muted">This link is not currently available to open safely.</span>
        )}
      </div>
    </article>
  );
}

export function AreaLinks() {
  const [wards, setWards] = useState<GovlinksWard[]>([]);
  const [area, setArea] = useState<AreaSelection | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [links, setLinks] = useState<GovlinksAreaLink[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [openingLinkId, setOpeningLinkId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const partnerLinks = useMemo(() => links.filter((l) => Boolean(l.is_partner_promoted)), [links]);
  const regularLinks = useMemo(() => links.filter((l) => !l.is_partner_promoted), [links]);

  const suggestions = useMemo(() => {
    const query = normalize(locationQuery);
    if (!query || area?.label === locationQuery) return [];
    return wards.filter((ward) => wardSearchText(ward).includes(query)).slice(0, 8);
  }, [area, locationQuery, wards]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [health, availableWards] = await Promise.all([govlinks.health(), govlinks.wards()]);
        let demoUserId: number | null = null;
        if (health.demo) {
          const saved = Number(localStorage.getItem(USER_ID_KEY));
          demoUserId = Number.isInteger(saved) && saved > 0
            ? saved
            : (await govlinks.devUser(true)).user_id;
          localStorage.setItem(USER_ID_KEY, String(demoUserId));
        }
        if (!active) return;
        setWards(availableWards);
        setUserId(demoUserId);
        const defaultWard = availableWards.find((ward) => ward.ward_number === "24" && /jaipur/i.test(`${ward.local_body} ${ward.district}`))
          ?? availableWards[0];
        if (defaultWard) {
          const selection = locationSelection(defaultWard);
          setArea(selection);
          setLocationQuery(selection.label);
        } else {
          setError("No supported areas are configured in the Govlinks directory yet.");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load area and service data.");
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!area || initializing) return;
    let active = true;
    setLoading(true);
    setError("");
    setNotice("");
    void govlinks.areaLinks({ [area.kind]: area.id })
      .then((response) => {
        if (active) setLinks(response.links);
      })
      .catch((cause: unknown) => {
        if (active) {
          setLinks([]);
          setError(cause instanceof Error ? cause.message : "Could not load links for this area.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [area, initializing, refreshKey]);

  function chooseWard(ward: GovlinksWard) {
    const selection = locationSelection(ward);
    setArea(selection);
    setLocationQuery(selection.label);
    setError("");
  }

  function useMyLocation() {
    setError("");
    setNotice("");
    if (!navigator.geolocation) {
      setError("This browser does not support location sharing. Search for your ward instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("lat", String(coords.latitude));
        url.searchParams.set("lon", String(coords.longitude));
        const response = await fetch(url, { headers: { "Accept-Language": "en" } });
        if (!response.ok) throw new Error(`OpenStreetMap location lookup failed (${response.status}).`);
        const result = await response.json() as ReverseGeocode;
        const matched = result.address ? resolveDeviceArea(result.address, wards) : null;
        if (!matched) {
          throw new Error("Your detected area is not in the prototype's service directory yet. Search for a supported ward or district.");
        }
        setArea(matched);
        setLocationQuery(matched.label);
        setNotice(`Location matched to ${matched.scope} coverage. Ward boundaries are not available for GPS lookup in this prototype.`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not resolve your current location.");
      } finally {
        setLocating(false);
      }
    }, (cause) => {
      setLocating(false);
      setError(cause.code === cause.PERMISSION_DENIED
        ? "Location permission was denied. You can still type and choose an area."
        : "Could not read your location. You can still type and choose an area.");
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  }

  async function openLink(item: GovlinksAreaLink) {
    if (!userId) {
      setError("Opening links requires the local Govlinks demo API with demo mode enabled.");
      return;
    }
    setError("");
    setNotice("");
    setOpeningLinkId(item.link_id);
    const tab = window.open("about:blank", "_blank");
    try {
      const visit = await govlinks.visit(userId, item.link_id);
      const destination = new URL(visit.url);
      if (destination.protocol !== "http:" && destination.protocol !== "https:") {
        throw new Error("The service returned an invalid page address.");
      }
      const target = item.is_demo && destination.hostname.endsWith(".example")
        ? displayUrl(item)
        : visit.url;
      if (tab) tab.location.href = target;
      else window.location.assign(target);
      setNotice(tab ? "Opened in a new tab." : "Your browser blocked a new tab, so the page opened here.");
    } catch (cause) {
      tab?.close();
      setError(cause instanceof Error ? cause.message : "Could not open this service page.");
    } finally {
      setOpeningLinkId(null);
    }
  }

  return (
    <section className="area-links" aria-label="Government service links by area">
      <div className="card area-location">
        <div>
          <h2 className="section-title"><MapPin size={18} aria-hidden /> Choose your area</h2>
          <p className="small muted" style={{ margin: "6px 0 0" }}>
            Search the prototype&apos;s supported wards, or use your device location to match a supported city or district.
          </p>
        </div>
        <div className="area-location-controls">
          <div className="field area-location-search">
            <label htmlFor="area-search">Type a locality, ward, city, or district</label>
            <input
              id="area-search"
              className="input"
              value={locationQuery}
              onChange={(event) => {
                setLocationQuery(event.target.value);
                setArea(null);
                setLinks([]);
                setNotice("");
              }}
              placeholder="e.g. Shastri Nagar or Pune"
              autoComplete="off"
            />
          </div>
          <button type="button" className="btn btn-secondary" onClick={useMyLocation} disabled={locating || initializing}>
            <LocateFixed size={16} aria-hidden /> {locating ? "Finding area…" : "Use my location"}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="area-suggestions" role="listbox" aria-label="Matching supported wards">
            {suggestions.map((ward) => (
              <button key={ward.ward_id} type="button" role="option" aria-selected={area?.id === ward.ward_id} onClick={() => chooseWard(ward)}>
                <MapPin size={15} aria-hidden />
                <span>{wardLabel(ward)}</span>
              </button>
            ))}
          </div>
        )}
        {locationQuery.trim() && !area && suggestions.length === 0 && !initializing && (
          <p className="small muted" style={{ margin: 0 }}>No supported ward matches yet. Try another locality, city, or district.</p>
        )}
        <p className="small muted area-privacy" style={{ margin: 0 }}>
          Device coordinates are sent to OpenStreetMap once to resolve the area and are not stored by Sewak. The prototype has no ward-boundary map, so GPS may only resolve a city or district.
        </p>
      </div>

      {error && <p className="callout error" role="alert">{error}</p>}
      {notice && <p className="callout" role="status">{notice}</p>}

      <section aria-labelledby="area-links-heading">
        <div className="row between wrap" style={{ marginBottom: 16 }}>
          <div>
            <h2 id="area-links-heading" className="section-title"><Building2 size={18} aria-hidden /> Available service links</h2>
            {area && <p className="small muted" style={{ margin: "5px 0 0" }}>Showing links for {area.label}</p>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AddPartnerLinkModal
              wards={wards}
              currentWardId={area?.kind === "ward_id" ? area.id : undefined}
              onLinkAdded={() => setRefreshKey((k) => k + 1)}
            />
            <span className="badge plain">{loading ? "Loading…" : `${links.length} ${links.length === 1 ? "link" : "links"}`}</span>
          </div>
        </div>

        {initializing || loading ? (
          <div className="card empty" role="status">Loading available services for this area…</div>
        ) : !area ? (
          <div className="card empty">Choose a supported area to see its government service links.</div>
        ) : links.length === 0 && !error ? (
          <div className="card empty">No service links are listed for this area yet.</div>
        ) : (
          <>
            {partnerLinks.length > 0 && (
              <div style={{ marginBottom: "28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <Sparkles size={18} style={{ color: "#10b981" }} />
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--fg, #111827)" }}>
                    Verified Partner Services (Priority Direct Access)
                  </h3>
                  <span style={{ fontSize: "11px", background: "rgba(16, 185, 129, 0.15)", color: "#065f46", padding: "2px 8px", borderRadius: "12px", fontWeight: 600 }}>
                    {partnerLinks.length} Highlighted {partnerLinks.length === 1 ? "Tab" : "Tabs"}
                  </span>
                </div>
                <div className="partner-highlighted-list">
                  {partnerLinks.map((item) => (
                    <PartnerHighlightedCard
                      key={item.link_id}
                      item={item}
                      opening={openingLinkId === item.link_id}
                      disabled={openingLinkId !== null || !userId}
                      onOpen={openLink}
                    />
                  ))}
                </div>
              </div>
            )}

            {regularLinks.length > 0 && (
              <div>
                {partnerLinks.length > 0 && (
                  <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--fg-muted, #4b5563)", marginBottom: "12px" }}>
                    Community & General Government Links
                  </h3>
                )}
                <div className="area-link-list">
                  {regularLinks.map((item) => (
                    <AreaLinkCard
                      key={item.link_id}
                      item={item}
                      opening={openingLinkId === item.link_id}
                      disabled={openingLinkId !== null || !userId}
                      onOpen={openLink}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
      <p className="small muted area-attribution">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
        {" · "}Demo service data can be incomplete or unverified. Confirm a destination before sharing personal information.
      </p>
    </section>
  );
}
