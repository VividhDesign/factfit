/**
 * The fact guard. Deterministic: no LLM. Every claim (a bullet, a cover-note paragraph, the email
 * body) is checked against the facts it cites. Anything the facts don't prove is a violation.
 *
 *  G1 citation   at least one fact, every id exists and is verified
 *  G2 numbers    every number and range appears in the evidence
 *  G3 ranks      winner/won/first place/top N%/... must appear in the evidence
 *  G4 tools      lexicon + job keywords named in the claim must be in the evidence or the skills
 *  G5 dates      month-year pairs, years and "Present" must appear in the evidence
 *  G6 structure  entry ids exist; skills are a subset of the profile skills
 */
import { LEXICON, termRegex } from "./lexicon";
import { hasNumber, monthYears, normalize, normalizeWords, numberTokens, openEnded, years } from "./normalize";
import type { Fact, Profile, SkillGroup } from "./types";

export type Rule = "G1" | "G2" | "G3" | "G4" | "G5" | "G6";

export interface Violation {
  where: string;
  rule: Rule;
  token: string;
  /** For humans: "'won': your facts say Runner-up." */
  message: string;
}

export interface Claim {
  where: string;
  text: string;
  factIds: string[];
}

export interface ClaimOptions {
  /** Extra text that counts as evidence, e.g. the user's own prefs for a recruiter reply. */
  extraEvidence?: string;
  /** Prose (cover note, email, match notes): a sentence that admits a gap ("no hands-on Azure experience") may name a tool. */
  gapsOk?: boolean;
  /** Tools named in the profile's skills count as evidence. Off for bullets: a bullet may only name tools its own facts name. */
  skillsCount?: boolean;
  /** Text whose numbers may appear in the claim without being facts, e.g. the job post for a match note ("needs CGPA 8.5"). Numbers only: it never proves a tool, rank or date. */
  allowNumbersFrom?: string;
}

export interface GuardInput {
  entryOrder?: string[];
  bullets: { entryId: string; text: string; factIds: string[] }[];
  paragraphs?: { text: string; factIds: string[] }[];
  email?: { subject?: string; body: string; factIds: string[]; extraEvidence?: string };
  skills?: SkillGroup[];
  /** Requirement keywords from the job post; named in a claim, they must be proven (G4). */
  keywords?: string[];
}

export interface GuardResult {
  ok: boolean;
  claims: number;
  verified: number;
  violations: Violation[];
}

// ---------- G3 ----------

/** Rank and award words. Matched on lowercased normalized text. */
const RANK_WORDS: RegExp[] = [
  /\bwinners?\b/,
  /\bwon\b/,
  /\bwins?\b/,
  /\bwinning\b/,
  /\b(?:first|1st|second|2nd|third|3rd)[- ]place\b/,
  /\b1st\b|\b2nd\b|\b3rd\b/,
  /\bchampions?\b|\bchampionships?\b/,
  /\bgold\b|\bsilver\b|\bbronze\b/,
  /\btop[- ]\d+(?:\.\d+)?%?/,
  /\bfinalists?\b|\bsemi-?finalists?\b|\bshortlisted\b/,
  /\brunners?[- ]up\b/,
  /\branked\b/,
  /\bawards?\b|\bawarded\b|\bprizes?\b|\bmedal(?:ist)?s?\b|\bpodium\b/,
];

// ---------- evidence ----------

interface Evidence {
  text: string;
  lower: string;
  facts: Fact[];
}

/** A sentence that admits a gap rather than claiming a skill. */
const GAP_SENTENCE =
  /\b(?:no|little|limited|zero|without)\s+(?:[\w-]+\s+){0,8}?(?:experience|exposure)\b|\b(?:do not|don'?t) have\b|\bnot yet\b|\bhaven'?t\b|\bhave not\b|\byet to\b|\bnew to\b|\b(?:keen|eager|excited|happy|ready) to learn\b/;

function buildEvidence(facts: Fact[], profile: Profile, extra = ""): Evidence {
  const parts: string[] = extra ? [normalize(extra)] : [];
  for (const f of facts) {
    parts.push(normalize(f.text));
    if (f.latex) parts.push(normalize(f.latex));
    const e = profile.entries.find((x) => x.id === f.entryId);
    if (e) parts.push(normalize([e.title, e.org, e.dates].filter(Boolean).join(" ")));
  }
  const text = parts.join(" ");
  return { text, lower: text.toLowerCase(), facts };
}

function skillsText(profile: Profile): string {
  return normalizeWords(profile.skills.flatMap((g) => g.items).join(" , "));
}

const uniq = <T>(xs: T[]) => [...new Set(xs)];

// ---------- one claim ----------

/** Checks G1 to G5 for one claim. G6 is structural and lives in guard(). */
export function guardClaim(claim: Claim, profile: Profile, keywords: string[] = [], opts: ClaimOptions = {}): Violation[] {
  const { where } = claim;
  const out: Violation[] = [];
  const v = (rule: Rule, token: string, message: string) => out.push({ where, rule, token, message });

  // G1
  if (claim.factIds.length === 0) {
    v("G1", "", "cites no fact.");
    return out;
  }
  const facts: Fact[] = [];
  for (const id of claim.factIds) {
    const f = profile.facts.find((x) => x.id === id);
    if (!f) v("G1", id, `unknown fact "${id}".`);
    else if (f.status !== "verified") v("G1", id, `fact "${id}" is needs_review: confirm it on the Facts page first.`);
    else facts.push(f);
  }
  if (out.length) return out;

  const ev = buildEvidence(facts, profile, opts.extraEvidence);
  // "1. ", "2) " at the start of a line number a list; they are not claims.
  const text = normalize(claim.text.replace(/(^|\n)[ \t]*\d{1,2}[.)][ \t]+/g, "$1"));
  const lower = text.toLowerCase();

  // G2
  const allowed = opts.allowNumbersFrom ? normalize(opts.allowNumbersFrom) : "";
  for (const t of uniq(numberTokens(text))) {
    if (hasNumber(ev.text, t) || (allowed && hasNumber(allowed, t))) continue;
    const unit = /[%×]$/.exec(t)?.[0];
    const near = uniq(numberTokens(ev.text).filter((e) => (unit ? e.endsWith(unit) : e.split(".")[0] === t.split(".")[0])));
    v("G2", t, near.length ? `'${t}': your facts say ${near.slice(0, 3).join(", ")}.` : `'${t}': not in your cited facts.`);
  }

  // G3: each rank word the claim uses must itself appear in the evidence ("top 5%" is not "top 1%").
  const rankHits = uniq(RANK_WORDS.flatMap((re) => [...lower.matchAll(new RegExp(re.source, "g"))].map((m) => m[0])));
  const have = uniq(RANK_WORDS.flatMap((re) => [...ev.lower.matchAll(new RegExp(re.source, "g"))].map((m) => m[0])));
  for (const w of rankHits) {
    if (have.includes(w)) continue;
    v("G3", w, have.length ? `'${w}': your facts say ${have.map(cap).join(", ")}.` : `'${w}': not in your cited facts.`);
  }

  // G4
  const terms = uniq([...LEXICON, ...keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)]);
  // Tags record what a fact proves (e.g. NEON/AVX2 -> SIMD), so they count for tool names only.
  const tags = facts.flatMap((f) => f.tags).join(" , ").toLowerCase();
  const supported = `${ev.lower} ${opts.skillsCount === false ? "" : skillsText(profile)} ${tags}`;
  const asserted = opts.gapsOk ? lower.split(/(?<=[.!?])\s+/).filter((sent) => !GAP_SENTENCE.test(sent)).join(" ") : lower;
  const missing = terms.filter((t) => termRegex(t).test(asserted) && !termRegex(t).test(supported));
  for (const t of missing.filter((t) => !missing.some((o) => o !== t && o.includes(t)))) {
    v("G4", t, `'${t}': not in your cited facts or skills.`);
  }

  // G5
  const evPairs = new Set(monthYears(ev.lower));
  const evYears = new Set(years(ev.lower));
  const badPairYears = new Set<string>();
  for (const p of uniq(monthYears(lower))) {
    if (evPairs.has(p)) continue;
    badPairYears.add(p.split(" ")[1]);
    v("G5", p, evPairs.size ? `'${p}': your facts say ${[...evPairs].slice(0, 3).join(", ")}.` : `'${p}': not in your cited facts.`);
  }
  for (const y of uniq(years(lower))) {
    if (!evYears.has(y) && !badPairYears.has(y)) v("G5", y, `'${y}': not in your cited facts.`);
  }
  for (const w of uniq(openEnded(lower))) {
    if (!new RegExp(`\\b${w}\\b`).test(ev.lower)) {
      const ends = [...evPairs].slice(-2).join(" to ");
      v("G5", w, ends ? `'${w}': your facts end on ${evPairs.size ? [...evPairs].pop() : ends}.` : `'${w}': not in your cited facts.`);
    }
  }

  return out;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- whole output ----------

export function guard(input: GuardInput, profile: Profile): GuardResult {
  const keywords = input.keywords ?? [];
  const claims: Claim[] = [
    ...input.bullets.map((b, i) => ({ where: `bullet[${i}]`, text: b.text, factIds: b.factIds })),
    ...(input.paragraphs ?? []).map((p, i) => ({ where: `cover[${i}]`, text: p.text, factIds: p.factIds })),
    ...(input.email ? [{ where: "email", text: input.email.body, factIds: input.email.factIds }] : []),
  ];

  const violations: Violation[] = claims.flatMap((c) =>
    guardClaim(c, profile, keywords, c.where.startsWith("bullet") ? { skillsCount: false } : { gapsOk: true, extraEvidence: c.where === "email" ? input.email?.extraEvidence : undefined }),
  );

  // G6
  const entryIds = new Set(profile.entries.map((e) => e.id));
  input.bullets.forEach((b, i) => {
    if (!entryIds.has(b.entryId)) {
      violations.push({ where: `bullet[${i}]`, rule: "G6", token: b.entryId, message: `unknown entry "${b.entryId}".` });
    }
  });
  for (const id of input.entryOrder ?? []) {
    if (!entryIds.has(id)) violations.push({ where: "entryOrder", rule: "G6", token: id, message: `unknown entry "${id}".` });
  }
  const known = new Set(profile.skills.flatMap((g) => g.items).map(normalizeWords));
  for (const item of (input.skills ?? []).flatMap((g) => g.items)) {
    if (!known.has(normalizeWords(item))) {
      violations.push({ where: "skills", rule: "G6", token: item, message: `'${item}' is not in your profile skills.` });
    }
  }

  const bad = new Set(violations.map((x) => x.where));
  return {
    ok: violations.length === 0,
    claims: claims.length,
    verified: claims.filter((c) => !bad.has(c.where)).length,
    violations,
  };
}
