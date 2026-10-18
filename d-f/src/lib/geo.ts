import { CIVIC_LOCATIONS, DEFAULT_LOCATION_ID } from "./constants";

export type LocationDetail = {
  id: string;
  label: string;
  formattedAddress: string;
  pincode?: string;
  road?: string;
  neighbourhood?: string;
  city?: string;
  state?: string;
  lat?: number;
  lon?: number;
  isGps?: boolean;
  savedTag?: string; // "Home", "Work", "Shop", etc.
  savedAt?: number;
};

const SAVED_STORAGE_KEY = "sewak_saved_locations";
const DEFAULT_STORAGE_KEY = "cn-default-location";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeSavedLocations(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAVED_STORAGE_KEY || e.key === DEFAULT_STORAGE_KEY) {
      listener();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

const EMPTY_SAVED_LIST: LocationDetail[] = [];
let cachedRaw: string | null = null;
let cachedParsed: LocationDetail[] = EMPTY_SAVED_LIST;

export function getSavedLocations(): LocationDetail[] {
  if (typeof window === "undefined") return EMPTY_SAVED_LIST;
  try {
    const raw = window.localStorage.getItem(SAVED_STORAGE_KEY);
    if (raw === cachedRaw) {
      return cachedParsed;
    }
    cachedRaw = raw;
    if (!raw) {
      cachedParsed = EMPTY_SAVED_LIST;
      return cachedParsed;
    }
    const parsed = JSON.parse(raw);
    cachedParsed = Array.isArray(parsed) ? parsed : EMPTY_SAVED_LIST;
    return cachedParsed;
  } catch {
    cachedParsed = EMPTY_SAVED_LIST;
    return cachedParsed;
  }
}

export function saveLocationToStorage(loc: LocationDetail, tag?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const current = getSavedLocations();
    const entry: LocationDetail = {
      ...loc,
      savedTag: tag || loc.savedTag || "Saved area",
      savedAt: Date.now(),
    };
    // remove existing entry with same id if any
    const filtered = current.filter((x) => x.id !== loc.id && x.formattedAddress !== loc.formattedAddress);
    const updated = [entry, ...filtered].slice(0, 10);
    window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(updated));
    notify();
    return true;
  } catch {
    return false;
  }
}

export function removeSavedLocation(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const current = getSavedLocations();
    const updated = current.filter((x) => x.id !== id);
    window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(updated));
    notify();
    return true;
  } catch {
    return false;
  }
}

export function saveAsDefaultLocation(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(DEFAULT_STORAGE_KEY, id);
    notify();
    return true;
  } catch {
    return false;
  }
}

/**
 * Request real GPS position from browser and reverse geocode it to exact address + pincode.
 */
export async function fetchLiveLocation(): Promise<LocationDetail> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation is not supported by your browser.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          // Call our server proxy endpoint
          const res = await fetch(`/api/geo/reverse?lat=${latitude}&lon=${longitude}`);
          if (!res.ok) {
            throw new Error(`Reverse geocode failed (${res.status})`);
          }
          const body = await res.json();
          if (!body.ok || !body.data) {
            throw new Error(body.error || "Could not resolve address from GPS coordinates.");
          }

          const d = body.data;
          const pincode = d.postcode || "";
          const neighbourhood = d.neighbourhood || d.road || "";
          const city = d.city || "Jaipur";
          const state = d.state || "Rajasthan";

          // Check if this matches one of our known civic ward locations
          const matchingPreset = CIVIC_LOCATIONS.find((loc) => {
            const locName = loc.locality.toLowerCase();
            return (
              neighbourhood.toLowerCase().includes(locName) ||
              locName.includes(neighbourhood.toLowerCase()) ||
              (loc.city.toLowerCase() === city.toLowerCase() && loc.ward.toLowerCase().includes(neighbourhood.toLowerCase()))
            );
          });

          const locationId = matchingPreset
            ? matchingPreset.id
            : pincode
            ? `pin-${pincode}`
            : `gps-${latitude.toFixed(4)}-${longitude.toFixed(4)}`;

          const label = matchingPreset
            ? `${matchingPreset.ward} · ${matchingPreset.locality}, ${matchingPreset.city}`
            : d.displayName || `${neighbourhood || city} (${pincode || "Live GPS"})`;

          resolve({
            id: locationId,
            label,
            formattedAddress: d.formattedAddress || `${neighbourhood}, ${city}, ${state} ${pincode}`.trim(),
            pincode,
            road: d.road,
            neighbourhood,
            city,
            state,
            lat: latitude,
            lon: longitude,
            isGps: true,
          });
        } catch (err) {
          // Fallback if reverse geocode service is unreachable
          const fallbackId = `gps-${latitude.toFixed(4)}-${longitude.toFixed(4)}`;
          resolve({
            id: fallbackId,
            label: `GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            formattedAddress: `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`,
            lat: latitude,
            lon: longitude,
            isGps: true,
          });
        }
      },
      (err) => {
        let msg = "Could not access your location.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Location access was denied. Please allow location permissions in your browser or type your address/pincode below.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "GPS location is currently unavailable. Please enter your address or 6-digit PIN code.";
        } else if (err.code === err.TIMEOUT) {
          msg = "GPS location request timed out. Please try again or type your address/pincode.";
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Search locations by address or 6-digit PIN code.
 */
export async function searchLocations(query: string): Promise<LocationDetail[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  // Match preset wards first if query is a keyword
  const presetMatches: LocationDetail[] = [];
  const qLower = clean.toLowerCase();
  for (const preset of CIVIC_LOCATIONS) {
    if (
      preset.locality.toLowerCase().includes(qLower) ||
      preset.ward.toLowerCase().includes(qLower) ||
      preset.city.toLowerCase().includes(qLower) ||
      (clean === "302016" && preset.id === "jaipur-24") // Known Jaipur Shastri Nagar pincode
    ) {
      presetMatches.push({
        id: preset.id,
        label: `${preset.ward} · ${preset.locality}, ${preset.city}`,
        formattedAddress: `${preset.ward}, ${preset.locality}, ${preset.city}, Rajasthan`,
        pincode: preset.id === "jaipur-24" ? "302016" : undefined,
        neighbourhood: preset.locality,
        city: preset.city,
        state: "Rajasthan",
      });
    }
  }

  try {
    const res = await fetch(`/api/geo/search?q=${encodeURIComponent(clean)}`);
    if (!res.ok) return presetMatches;
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.results)) return presetMatches;

    const external: LocationDetail[] = data.results.map((r: any) => ({
      id: r.id || (r.postcode ? `pin-${r.postcode}` : `geo-${Math.random().toString(36).substring(2, 8)}`),
      label: r.displayName || r.primaryText,
      formattedAddress: r.formattedAddress || `${r.primaryText}, ${r.secondaryText}`,
      pincode: r.postcode,
      road: r.road,
      neighbourhood: r.neighbourhood,
      city: r.city,
      state: r.state,
      lat: r.lat,
      lon: r.lon,
    }));

    // Merge without duplicates
    const combined = [...presetMatches];
    for (const item of external) {
      if (!combined.some((x) => x.id === item.id || (x.pincode && x.pincode === item.pincode && x.city === item.city))) {
        combined.push(item);
      }
    }
    return combined.slice(0, 8);
  } catch {
    return presetMatches;
  }
}
