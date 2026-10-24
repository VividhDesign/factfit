import { latexToText } from "./tex";

/**
 * Brings LaTeX and plain text to one comparable form: LaTeX stripped, symbols unified
 * (× – → ~), thousands commas removed, "11x" read as "11×", whitespace collapsed.
 * Case is kept so K/M/B suffixes survive; use normalizeWords for word checks.
 */
export function normalize(s: string): string {
  let t = latexToText(s);
  t = t
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/−/g, "-")
    .replace(/ /g, " ");
  t = t.replace(/(\d)\s?x(?![A-Za-z0-9])/g, "$1×"); // "11x" -> "11×"
  t = t.replace(/(\d),(?=\d{3}(?!\d))/g, "$1"); // "6,597" -> "6597"
  t = t.replace(/(\d)\s*[-–—]\s*(?=\d)/g, "$1–"); // "8 - 74" -> "8–74"
  return t.replace(/\s+/g, " ").trim();
}

/** normalize() lowercased, for word checks. */
export function normalizeWords(s: string): string {
  return normalize(s).toLowerCase();
}

const NUM = String.raw`\d+(?:\.\d+)?(?:[KMB](?![A-Za-z]))?`;
const NUMBER_TOKEN = new RegExp(`${NUM}(?:–${NUM})?[%×]?`, "g");
const YEAR = /^(?:19|20)\d\d$/;

/** Numeric tokens of normalized text: 97.03%, 1.9×, 8–74%, 76K, 6597. Years are left to the date check. */
export function numberTokens(normalized: string): string[] {
  const out: string[] = [];
  for (const m of normalized.matchAll(NUMBER_TOKEN)) {
    const parts = m[0].replace(/[%×]$/, "").split("–");
    if (parts.every((p) => YEAR.test(p))) continue; // 2026, 2023–2027
    out.push(m[0]);
  }
  return out;
}

/**
 * True if `token` appears in `evidence` as a whole number or range: not inside a longer number,
 * and a bare "74%" does not match the tail of "8–74%".
 */
export function hasNumber(evidence: string, token: string): boolean {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\d.])(?<!\\d–)${esc}(?![\\d]|\\.\\d|–\\d)`).test(evidence);
}

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec";
const MONTH_YEAR = new RegExp(`\\b(${MONTHS})\\b\\.?\\s+((?:19|20)\\d\\d)\\b`, "g");

/** Month-year pairs as "jan 2026" (month cut to three letters). */
export function monthYears(normalizedLower: string): string[] {
  return [...normalizedLower.matchAll(MONTH_YEAR)].map((m) => `${m[1].slice(0, 3)} ${m[2]}`);
}

export function years(normalizedLower: string): string[] {
  return [...normalizedLower.matchAll(/(?<![\d.])(?:19|20)\d\d(?![\d])/g)].map((m) => m[0]);
}

/** "Present"-style end dates: "– Present", "to present", "until now". */
export function openEnded(normalizedLower: string): string[] {
  return [...normalizedLower.matchAll(/\d{4}\s*(?:–|-|\bto\b|\buntil\b|\bthrough\b)\s*(present|current|now|ongoing)\b/g)].map((m) => m[1]);
}
