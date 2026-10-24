/**
 * The tailor pipeline: analyze -> compose -> guard -> repair once -> block what still fails.
 * The LLM writes; deterministic code (lib/guard.ts) decides what stays.
 */
import { guard, guardClaim, type ClaimOptions, type Violation } from "./guard";
import { generateObject, type GenerateObject } from "./llm";
import { dropSentences } from "./sentences";
import { ANALYZE_SYSTEM, analyzeUser, COMPOSE_SYSTEM, composeUser, REPAIR_SYSTEM, repairUser } from "./prompts";
import {
  AnalysisSchema,
  ComposeSchema,
  MAX_BULLETS,
  RepairSchema,
  type BlockedItem,
  type ComposeResult,
  type Repair,
  type RepairedItem,
  type TailorInput,
  type TailorResponse,
  type TailorResult,
} from "./tailor-schemas";
import type { Profile } from "./types";

const MAX_BULLET_CHARS = 230;
const CLAIM_RULES = new Set(["G1", "G2", "G3", "G4", "G5"]);
const MISSING_NOTE = "Not claimed: it did not pass the fact check.";

const ms = (t0: number) => Math.round(performance.now() - t0);

/** Claims in the steer that the facts don't prove (rank, tool or date). Numbers are the user's own words, so G2 is skipped. */
export function screenSteer(steer: string, profile: Profile): BlockedItem[] {
  if (!steer.trim()) return [];
  const ids = profile.facts.filter((f) => f.status === "verified").map((f) => f.id);
  return guardClaim({ where: "steer", text: steer, factIds: ids }, profile, [], { gapsOk: true })
    .filter((v) => v.rule === "G3" || v.rule === "G4" || v.rule === "G5")
    .map((v) => ({ where: "steer", text: `Steer asks for “${v.token}”`, reasons: [v.message] }));
}

function prefsText(profile: Profile, recruiter: boolean): string | undefined {
  if (!recruiter) return undefined;
  const p = profile.prefs;
  return [p.location, p.expectedSalary, p.noticePeriod, p.availability].filter(Boolean).join(". ") || undefined;
}

/** Deterministic tidy-ups before the guard: approved bullets are copied verbatim, the page is capped. */
function sanitize(draft: ComposeResult, profile: Profile, warnings: string[]): ComposeResult {
  const byId = new Map(profile.facts.map((f) => [f.id, f]));
  const entryIds = new Set(profile.entries.map((e) => e.id));
  let bullets = draft.bullets.map((b) => {
    const only = b.factIds.length === 1 ? byId.get(b.factIds[0]) : undefined;
    // A bullet filed under a made-up entry goes back under its fact's entry.
    const entryId = !entryIds.has(b.entryId) && only ? only.entryId : b.entryId;
    return !b.rewritten && only?.status === "verified" ? { ...b, entryId, text: only.text } : { ...b, entryId };
  });
  if (bullets.length > MAX_BULLETS) {
    warnings.push(`Kept the first ${MAX_BULLETS} of ${bullets.length} bullets to fit one page.`);
    bullets = bullets.slice(0, MAX_BULLETS);
  }
  const long = bullets.filter((b) => b.text.length > MAX_BULLET_CHARS).length;
  if (long) warnings.push(`${long} bullet(s) are over ${MAX_BULLET_CHARS} characters; the page may overflow.`);

  const match = draft.match.map((m) => {
    const proven = m.factIds.filter((id) => byId.get(id)?.status === "verified");
    return m.status !== "missing" && proven.length === 0 ? { ...m, status: "missing" as const, factIds: [] } : { ...m, factIds: proven };
  });
  return { ...draft, bullets, match };
}

interface Checked {
  violations: Violation[];
  claims: number;
  verified: number;
}

interface Ctx {
  profile: Profile;
  keywords: string[];
  recruiter: boolean;
  /** The job post: its numbers may appear in match notes ("needs CGPA 8.5"). */
  jobText: string;
}

function check(result: ComposeResult, ctx: Ctx): Checked {
  const { profile, keywords, recruiter, jobText } = ctx;
  const g = guard(
    {
      entryOrder: result.entryOrder,
      bullets: result.bullets,
      paragraphs: result.coverNote.paragraphs,
      email: result.email.body.trim() ? { ...result.email, extraEvidence: prefsText(profile, recruiter) } : undefined,
      skills: result.skills,
      keywords,
    },
    profile,
  );
  // Match notes are prose the user reads, so they are checked too (but not counted as claims).
  const noteViolations = result.match.flatMap((m, i) =>
    m.status === "missing" || !m.note.trim()
      ? []
      : guardClaim({ where: `match[${i}]`, text: m.note, factIds: m.factIds }, profile, keywords, { gapsOk: true, allowNumbersFrom: jobText }),
  );
  return { violations: [...g.violations, ...noteViolations], claims: g.claims, verified: g.verified };
}

const byWhere = (vs: Violation[]) => {
  const m = new Map<string, Violation[]>();
  for (const v of vs) m.set(v.where, [...(m.get(v.where) ?? []), v]);
  return m;
};

/** The text and citations currently at `where`. */
function read(r: ComposeResult, where: string): { text: string; factIds: string[] } | undefined {
  const [, kind, idx] = /^(\w+?)(?:\[(\d+)\])?$/.exec(where) ?? [];
  const i = Number(idx);
  if (kind === "bullet") return r.bullets[i] && { text: r.bullets[i].text, factIds: r.bullets[i].factIds };
  if (kind === "cover") return r.coverNote.paragraphs[i];
  if (kind === "match") return r.match[i] && { text: r.match[i].note, factIds: r.match[i].factIds };
  if (kind === "email") return { text: r.email.body, factIds: r.email.factIds };
  return undefined;
}

function applyFixes(r: ComposeResult, fixes: Repair["fixes"]): ComposeResult {
  const next: ComposeResult = structuredClone(r);
  for (const f of fixes) {
    if (f.drop || !f.text.trim()) continue; // left failing, so the final pass removes it
    const [, kind, idx] = /^(\w+?)(?:\[(\d+)\])?$/.exec(f.where) ?? [];
    const i = Number(idx);
    const ids = f.factIds.length ? f.factIds : undefined;
    if (kind === "bullet" && next.bullets[i]) next.bullets[i] = { ...next.bullets[i], text: f.text, rewritten: true, factIds: ids ?? next.bullets[i].factIds };
    else if (kind === "cover" && next.coverNote.paragraphs[i]) next.coverNote.paragraphs[i] = { text: f.text, factIds: ids ?? next.coverNote.paragraphs[i].factIds };
    else if (kind === "match" && next.match[i]) next.match[i] = { ...next.match[i], note: f.text, factIds: ids ?? next.match[i].factIds };
    else if (kind === "email") next.email = { ...next.email, body: f.text, factIds: ids ?? next.email.factIds };
  }
  return next;
}

/** Removes everything the violations point at. Returns what was removed. */
function removeFailing(r: ComposeResult, vs: Violation[], ctx: Ctx, wholeClaims = false): { result: TailorResult; blocked: BlockedItem[] } {
  const groups = byWhere(vs);
  const blocked: BlockedItem[] = [];
  const failed = (w: string) => groups.has(w);
  const block = (where: string, text: string) =>
    blocked.push({ where, text, reasons: (groups.get(where) ?? []).map((v) => v.message) });

  const bullets = r.bullets.filter((b, i) => {
    if (!failed(`bullet[${i}]`)) return true;
    block(`bullet[${i}]`, b.text);
    return false;
  });
  /**
   * A paragraph or the email that fails loses only its failing sentences. It goes whole only when every
   * sentence fails, when it cites no valid fact, or when asked to (the safety pass).
   */
  const trim = (where: string, text: string, factIds: string[], opts: ClaimOptions): string | null => {
    const vsHere = groups.get(where) ?? [];
    if (wholeClaims || vsHere.some((v) => v.rule === "G1")) {
      block(where, text);
      return null;
    }
    const reasonsOf = new Map<string, string[]>();
    const { kept, dropped } = dropSentences(text, (sentence) => {
      const found = guardClaim({ where, text: sentence, factIds }, ctx.profile, ctx.keywords, opts).filter((v) => CLAIM_RULES.has(v.rule));
      if (found.length) reasonsOf.set(sentence.trim(), found.map((v) => v.message));
      return found.length > 0;
    });
    if (dropped.length === 0) {
      block(where, text); // the violation is not in any one sentence: drop the whole claim
      return null;
    }
    for (const d of dropped) blocked.push({ where, text: d, reasons: reasonsOf.get(d) ?? [] });
    return kept || null;
  };

  const paragraphs = r.coverNote.paragraphs.flatMap((p, i) => {
    if (!failed(`cover[${i}]`)) return [p];
    const kept = trim(`cover[${i}]`, p.text, p.factIds, { gapsOk: true });
    return kept ? [{ ...p, text: kept }] : [];
  });
  let email: TailorResult["email"] = r.email;
  if (failed("email")) {
    const kept = trim("email", r.email.body, r.email.factIds, { gapsOk: true, extraEvidence: prefsText(ctx.profile, ctx.recruiter) });
    email = kept ? { ...r.email, body: kept } : null;
  }
  const match = r.match.map((m, i) => {
    if (!failed(`match[${i}]`)) return m;
    block(`match[${i}]`, m.note);
    return { ...m, status: "missing" as const, factIds: [], note: MISSING_NOTE };
  });

  const unknownSkills = new Set((groups.get("skills") ?? []).map((v) => v.token));
  for (const v of groups.get("skills") ?? []) blocked.push({ where: "skills", text: v.token, reasons: [v.message] });
  const skills = r.skills
    .map((g) => ({ ...g, items: g.items.filter((it) => !unknownSkills.has(it)) }))
    .filter((g) => g.items.length);

  const badEntries = new Set((groups.get("entryOrder") ?? []).map((v) => v.token));
  for (const v of groups.get("entryOrder") ?? []) blocked.push({ where: "entryOrder", text: v.token, reasons: [v.message] });
  const entryOrder = r.entryOrder.filter((id) => !badEntries.has(id));
  for (const b of bullets) if (!entryOrder.includes(b.entryId)) entryOrder.push(b.entryId);

  return { result: { entryOrder, bullets, skills, match, coverNote: { paragraphs }, email }, blocked };
}

export async function tailor(input: TailorInput, gen: GenerateObject = generateObject): Promise<TailorResponse> {
  const t0 = performance.now();
  const { profile } = input;
  const steer = input.steer?.trim() ?? "";
  const warnings: string[] = [];
  const timings = { analyze: 0, compose: 0, guard: 0, repair: 0, total: 0 };

  // 1. analyze
  let t = performance.now();
  const analysis = await gen(AnalysisSchema, { system: ANALYZE_SYSTEM, user: analyzeUser(input), model: "fast", effort: "low" });
  analysis.requirements = analysis.requirements.slice(0, 12).map((r, i) => ({ ...r, id: r.id || `r${i + 1}` }));
  if (input.kind && input.kind !== "auto") analysis.kind = input.kind;
  timings.analyze = ms(t);
  const keywords = [...new Set(analysis.requirements.flatMap((r) => r.keywords))];
  const recruiter = analysis.kind === "recruiter_email";
  const ctx: Ctx = { profile, keywords, recruiter, jobText: input.jobText };

  // 2. compose, from verified facts only
  const steerBlocked = screenSteer(steer, profile);
  t = performance.now();
  const composed = await gen(ComposeSchema, {
    system: COMPOSE_SYSTEM,
    user: composeUser({ profile, analysis, steer, unprovenSteer: steerBlocked.map((b) => b.reasons[0]) }),
    effort: "medium",
  });
  timings.compose = ms(t);
  const draft = sanitize(composed, profile, warnings);

  // 3. guard
  t = performance.now();
  const first = check(draft, ctx);
  timings.guard += ms(t);

  // 4. repair once
  let current = draft;
  let second = first;
  const repaired: RepairedItem[] = [];
  const claimGroups = byWhere(first.violations.filter((v) => CLAIM_RULES.has(v.rule)));
  if (claimGroups.size) {
    t = performance.now();
    const items = [...claimGroups].flatMap(([where, vs]) => {
      const cur = read(draft, where);
      return cur ? [{ where, text: cur.text, factIds: cur.factIds, problems: vs.map((v) => v.message) }] : [];
    });
    const fix = await gen(RepairSchema, { system: REPAIR_SYSTEM, user: repairUser({ profile, items }), effort: "low" });
    timings.repair = ms(t);

    current = applyFixes(draft, fix.fixes);
    t = performance.now();
    second = check(current, ctx);
    timings.guard += ms(t);
    for (const [where, vs] of claimGroups) {
      const before = read(draft, where)?.text ?? "";
      const after = read(current, where)?.text ?? "";
      if (!second.violations.some((v) => v.where === where) && after !== before) {
        repaired.push({ where, before, after, reasons: vs.map((v) => v.message) });
      }
    }
  }

  // 5. block what still fails
  t = performance.now();
  const asChecked = (r: TailorResult) => ({ ...r, email: r.email ?? { subject: "", body: "", factIds: [] } });
  let { result, blocked } = removeFailing(current, second.violations, ctx);
  let final = check(asChecked(result), ctx);
  if (final.violations.length) {
    // Safety pass: if trimming sentences left something the whole-claim check still rejects, drop those claims whole.
    const again = removeFailing(asChecked(result), final.violations, ctx, true);
    result = again.result;
    blocked = [...blocked, ...again.blocked];
    final = check(asChecked(result), ctx);
  }
  if (result.email && !result.email.body.trim()) result = { ...result, email: null };
  timings.guard += ms(t);
  if (final.violations.length) {
    throw new Error(`Internal error: the guard still rejects the final result (${final.violations[0].message}).`);
  }

  timings.total = ms(t0);
  return {
    analysis,
    result,
    guard: {
      claims: first.claims,
      verified: final.claims,
      blocked: [...steerBlocked, ...blocked],
      repaired,
    },
    warnings,
    timingsMs: timings,
  };
}
