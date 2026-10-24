export type Status = "verified" | "needs_review";

export type Section =
  | "education"
  | "research"
  | "experience"
  | "projects"
  | "opensource"
  | "achievements";

/** One heading on the resume. */
export interface Entry {
  id: string;
  section: Section;
  title: string;
  org?: string;
  location?: string;
  /** Exactly as printed, e.g. "Jan 2026 -- Jul 2026". */
  dates?: string;
  subtitle?: string;
  links?: { label: string; url: string }[];
  /** Exact heading command and arguments from general.tex, when available. */
  headingLatex?: string;
}

export interface Fact {
  id: string;
  entryId: string;
  /** Plain text, numbers verbatim. */
  text: string;
  /** Approved LaTeX bullet, byte-for-byte from the source. */
  latex?: string;
  /** What it proves: ["C++17", "SIMD", "HNSW"]. */
  tags: string[];
  /** Variant pool it came from: ["swe", "hft", "ml", "quant-research"]. */
  roles?: string[];
  status: Status;
  source: string;
  /** Only for needs_review conflicts. */
  alternatives?: { value: string; files: number }[];
}

export interface SkillGroup {
  label: string;
  items: string[];
}

/** Local only, never seeded. */
export interface Prefs {
  location?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  availability?: string;
}

export interface Profile {
  version: 1;
  name: string;
  email?: string;
  /** Local only, never seeded. */
  phone?: string;
  links: { label: string; url: string; icon?: string }[];
  entries: Entry[];
  facts: Fact[];
  skills: SkillGroup[];
  prefs: Prefs;
}

export interface Application {
  id: string;
  company: string;
  role: string;
  startedAt: string;
  sentAt?: string;
  minutes?: number;
  guard: { claims: number; verified: number; blocked: number };
  /** First 300 chars of the job text. */
  jobExcerpt: string;
}
