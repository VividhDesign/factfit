/** Browser-only storage: the profile (with the phone and prefs) and the application log never leave localStorage. */
import seed from "../../data/seed-profile.json";
import { ApplicationSchema, ProfileSchema } from "./schemas";
import type { Application, Profile } from "./types";

const PROFILE_KEY = "factfit.profile";
const APPS_KEY = "factfit.applications";
const START_KEY = "factfit.startedAt";

export const seedProfile = (): Profile => ProfileSchema.parse(seed);

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full: the app still works, it just won't remember */
  }
}

export function loadProfile(): Profile {
  const stored = ProfileSchema.safeParse(read(PROFILE_KEY));
  return stored.success ? stored.data : seedProfile();
}

export function saveProfile(profile: Profile) {
  write(PROFILE_KEY, profile);
}

export function loadApplications(): Application[] {
  const list = read(APPS_KEY);
  return Array.isArray(list) ? list.flatMap((a) => (ApplicationSchema.safeParse(a).success ? [a as Application] : [])) : [];
}

export function saveApplication(app: Application) {
  write(APPS_KEY, [...loadApplications(), app]);
}

/** The clock starts at the first paste and stops at "Mark as sent". */
export function startClock(): string {
  const existing = read(START_KEY);
  if (typeof existing === "string") return existing;
  const now = new Date().toISOString();
  write(START_KEY, now);
  return now;
}
export function clearClock() {
  try {
    window.localStorage.removeItem(START_KEY);
  } catch {
    /* ignore */
  }
}
