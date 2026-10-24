import fs from "node:fs";
import { describe, expect, it } from "vitest";
import seedJson from "../data/seed-profile.json";
import { ProfileSchema } from "@/lib/schemas";

const RESUME = "/Users/vividhyadav/Projects/resume";
const raw = JSON.stringify(seedJson);
const profile = ProfileSchema.parse(seedJson);
const fact = (id: string) => {
  const f = profile.facts.find((x) => x.id === id);
  if (!f) throw new Error(`no fact ${id}`);
  return f;
};

describe("seed profile", () => {
  it("validates against the Zod schema", () => {
    expect(ProfileSchema.safeParse(seedJson).success).toBe(true);
  });

  it("has no phone, no prefs and no secrets", () => {
    expect(profile.phone).toBeUndefined();
    expect(profile.prefs).toEqual({});
    expect(raw).not.toMatch(/\+?91[\s-]?\d{5}[\s-]?\d{5}/);
    expect(raw).not.toMatch(/\d{5}\s\d{5}/);
    expect(raw).not.toMatch(/\\faPhone|sk-ant|AIza|salary/i);
  });

  it("gives every fact a tag, a source and a known entry", () => {
    const entries = new Set(profile.entries.map((e) => e.id));
    for (const f of profile.facts) {
      expect(f.tags.length, f.id).toBeGreaterThan(0);
      expect(f.source, f.id).toBeTruthy();
      expect(entries.has(f.entryId), f.id).toBe(true);
    }
  });

  it("seeds the confirmed facts as verified, with the confirmed values", () => {
    expect(fact("edu.cgpa")).toMatchObject({ status: "verified" });
    expect(fact("edu.cgpa").text).toContain("8.73/10");
    expect(fact("edu.class12").text).toContain("91.25%");
    expect(fact("edu.class10").text).toContain("87.16%");
    expect(fact("research.internship").text).toContain("Jan 2026 – Jul 2026");
    expect(fact("edu.grad").text).toContain("Aug 2023 – May 2027");
    expect(fact("dhuaan.award").text).toMatch(/^Runner-up/);
    for (const id of ["edu.cgpa", "edu.class12", "edu.class10", "research.internship", "edu.grad", "dhuaan.award"]) {
      expect(fact(id).status).toBe("verified");
    }
  });

  it("never says Present, 8.72, Jul 2027, winner or won", () => {
    const all = profile.facts.map((f) => f.text + (f.latex ?? "")).join("\n") + JSON.stringify(profile.entries);
    expect(all).not.toMatch(/Present/);
    expect(all).not.toMatch(/8\.72/);
    expect(all).not.toMatch(/Jul 2027/);
    expect(all).not.toMatch(/\b(winner|won)\b/i);
  });

  it("flags the reranker latency conflict as needs_review with both values", () => {
    const flagged = profile.facts.filter((f) => /28--170|30--170/.test(f.latex ?? ""));
    expect(flagged.length).toBeGreaterThanOrEqual(3);
    for (const f of flagged) {
      expect(f.status, f.id).toBe("needs_review");
      expect(f.alternatives?.map((a) => a.value)).toEqual(["28–170×", "30–170×"]);
    }
  });

  it("never reuses the rounded ~2x for Strata vs hnswlib", () => {
    const all = profile.facts.map((f) => f.latex ?? "").join("\n");
    expect(all).not.toMatch(/\\sim\$2\$\\times\$/);
    expect(fact("strata.bench.full").text).toContain("1.9×");
  });

  it("lists needs_review facts only with alternatives", () => {
    for (const f of profile.facts.filter((x) => x.status === "needs_review")) {
      expect(f.alternatives?.length, f.id).toBeGreaterThan(1);
    }
  });

  it.skipIf(!fs.existsSync(`${RESUME}/make_variants.py`))("copies every LaTeX bullet byte-for-byte from the sources", () => {
    const general = fs.readFileSync(`${RESUME}/vividh_yadav_resume_general.tex`, "utf8");
    // make_variants.py itself strips "signed-off " from the one OverlayAi bullet.
    const variants = fs.readFileSync(`${RESUME}/make_variants.py`, "utf8").replace("signed-off ", "");
    for (const f of profile.facts.filter((x) => x.latex)) {
      expect(general.includes(f.latex!) || variants.includes(f.latex!), f.id).toBe(true);
    }
  });
});
