import { CIVIC_LOCATIONS, DEFAULT_LOCATION_ID, type CivicLocationId } from "@/lib/constants";

const STORAGE_KEY = "cn-default-location";
const listeners = new Set<() => void>();

export function subscribeDefaultLocation(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function readDefaultLocation(): string {
  try {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    return saved || DEFAULT_LOCATION_ID;
  } catch {
    return DEFAULT_LOCATION_ID;
  }
}

export function saveDefaultLocation(locationId: string) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, locationId);
    }
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // ignore
      }
    });
    return true;
  } catch {
    return false;
  }
}
