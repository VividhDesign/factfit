import { z } from "zod";
import { ProfileSchema, SkillGroupSchema } from "./schemas";

export const MAX_JOB_CHARS = 15_000;
export const MAX_STEER_CHARS = 2_000;
export const MAX_BULLETS = 12;

export const TailorInputSchema = z.object({
  profile: ProfileSchema,
  jobText: z.string().trim().min(20, "Paste a job post or a recruiter's email.").max(MAX_JOB_CHARS, `Job text is limited to ${MAX_JOB_CHARS} characters.`),
  steer: z.string().max(MAX_STEER_CHARS, `The steer is limited to ${MAX_STEER_CHARS} characters.`).optional(),
  kind: z.enum(["auto", "job", "recruiter_email"]).optional(),
});
export type TailorInput = z.infer<typeof TailorInputSchema>;

// ---------- step 1 ----------

export const AnalysisSchema = z.object({
  company: z.string(),
  role: z.string(),
  roleFamily: z.enum(["swe", "ml", "data", "quant", "research", "other"]),
  kind: z.enum(["job", "recruiter_email"]),
  /** Empty string when the post doesn't say. */
  location: z.string(),
  requirements: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      priority: z.enum(["must", "nice"]),
      /** Concrete technologies, tools, languages or services only. */
      keywords: z.array(z.string()),
    }),
  ),
  /** Questions a recruiter asked, in order. Empty for a job post. */
  recruiterQuestions: z.array(z.string()),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

// ---------- step 2 ----------

const FactRefs = z.array(z.string());

export const ComposeSchema = z.object({
  entryOrder: z.array(z.string()),
  bullets: z.array(z.object({ entryId: z.string(), factIds: FactRefs, text: z.string(), rewritten: z.boolean() })),
  skills: z.array(SkillGroupSchema),
  match: z.array(
    z.object({
      reqId: z.string(),
      status: z.enum(["met", "partial", "missing"]),
      factIds: FactRefs,
      note: z.string(),
    }),
  ),
  coverNote: z.object({ paragraphs: z.array(z.object({ text: z.string(), factIds: FactRefs })) }),
  email: z.object({ subject: z.string(), body: z.string(), factIds: FactRefs }),
});
export type ComposeResult = z.infer<typeof ComposeSchema>;

/** What the pipeline returns for the UI: the compose output after the guard has removed what failed. */
export interface TailorResult {
  entryOrder: string[];
  bullets: ComposeResult["bullets"];
  skills: ComposeResult["skills"];
  match: ComposeResult["match"];
  coverNote: ComposeResult["coverNote"];
  email: ComposeResult["email"] | null;
}

// ---------- step 4 ----------

export const RepairSchema = z.object({
  fixes: z.array(
    z.object({
      where: z.string(),
      /** True when the claim cannot be said truthfully with the cited facts. */
      drop: z.boolean(),
      text: z.string(),
      factIds: FactRefs,
    }),
  ),
});
export type Repair = z.infer<typeof RepairSchema>;

// ---------- response ----------

export interface BlockedItem {
  where: string;
  text: string;
  reasons: string[];
}
export interface RepairedItem {
  where: string;
  before: string;
  after: string;
  reasons: string[];
}

export interface TailorResponse {
  analysis: Analysis;
  result: TailorResult;
  guard: { claims: number; verified: number; blocked: BlockedItem[]; repaired: RepairedItem[] };
  warnings: string[];
  timingsMs: { analyze: number; compose: number; guard: number; repair: number; total: number };
}
