import { z } from "zod";
import type { Application, Entry, Fact, Prefs, Profile, SkillGroup } from "./types";

export const StatusSchema = z.enum(["verified", "needs_review"]);

export const EntrySchema = z.object({
  id: z.string().min(1),
  section: z.enum([
    "education",
    "research",
    "experience",
    "projects",
    "opensource",
    "achievements",
  ]),
  title: z.string().min(1),
  org: z.string().optional(),
  location: z.string().optional(),
  dates: z.string().optional(),
  subtitle: z.string().optional(),
  links: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
  headingLatex: z.string().optional(),
}) satisfies z.ZodType<Entry>;

export const FactSchema = z.object({
  id: z.string().min(1),
  entryId: z.string().min(1),
  text: z.string().min(1),
  latex: z.string().optional(),
  tags: z.array(z.string()),
  roles: z.array(z.string()).optional(),
  status: StatusSchema,
  source: z.string().min(1),
  alternatives: z
    .array(z.object({ value: z.string(), files: z.number().int().nonnegative() }))
    .optional(),
}) satisfies z.ZodType<Fact>;

export const SkillGroupSchema = z.object({
  label: z.string().min(1),
  items: z.array(z.string().min(1)),
}) satisfies z.ZodType<SkillGroup>;

export const PrefsSchema = z.object({
  location: z.string().optional(),
  expectedSalary: z.string().optional(),
  noticePeriod: z.string().optional(),
  availability: z.string().optional(),
}) satisfies z.ZodType<Prefs>;

export const ProfileSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1),
    email: z.string().optional(),
    phone: z.string().optional(),
    links: z.array(
      z.object({ label: z.string(), url: z.string(), icon: z.string().optional() }),
    ),
    entries: z.array(EntrySchema),
    facts: z.array(FactSchema),
    skills: z.array(SkillGroupSchema),
    prefs: PrefsSchema,
  })
  .superRefine((p, ctx) => {
    const entryIds = new Set(p.entries.map((e) => e.id));
    const seen = new Set<string>();
    p.facts.forEach((f, i) => {
      if (!entryIds.has(f.entryId)) {
        ctx.addIssue({
          code: "custom",
          path: ["facts", i, "entryId"],
          message: `unknown entry "${f.entryId}"`,
        });
      }
      if (seen.has(f.id)) {
        ctx.addIssue({ code: "custom", path: ["facts", i, "id"], message: `duplicate fact id "${f.id}"` });
      }
      seen.add(f.id);
    });
  }) satisfies z.ZodType<Profile>;

export const ApplicationSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  startedAt: z.string(),
  sentAt: z.string().optional(),
  minutes: z.number().optional(),
  guard: z.object({
    claims: z.number(),
    verified: z.number(),
    blocked: z.number(),
  }),
  jobExcerpt: z.string(),
}) satisfies z.ZodType<Application>;
