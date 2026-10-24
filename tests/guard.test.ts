import { describe, expect, it } from "vitest";
import seedJson from "../data/seed-profile.json";
import { ProfileSchema } from "@/lib/schemas";
import { guard, guardClaim, type GuardInput } from "@/lib/guard";
import { normalize, normalizeWords } from "@/lib/normalize";
import type { Profile } from "@/lib/types";

const profile: Profile = ProfileSchema.parse(seedJson);

/** Guards one claim against the real seed and returns the rules it broke. */
function rulesFor(text: string, factIds: string[], keywords: string[] = []) {
  const violations = guardClaim({ where: "claim", text, factIds }, profile, keywords);
  return { violations, rules: violations.map((v) => v.rule) };
}

describe("the five things the guard must catch", () => {
  it("1. blocks 'won the WeMakeDevs hackathon' when the fact says Runner-up (G3)", () => {
    const { violations, rules } = rulesFor("Won the WeMakeDevs × AWS hackathon with a smoke forecasting app.", ["dhuaan.award"]);
    expect(rules).toContain("G3");
    const v = violations.find((x) => x.token === "won")!;
    expect(v.message).toContain("Runner-up");
  });

  it("   also blocks 'winner', 'first place' and 'champion'", () => {
    for (const phrase of ["Winner of the WeMakeDevs hackathon", "Took first place at WeMakeDevs", "Hackathon champion"]) {
      expect(rulesFor(phrase, ["dhuaan.award"]).rules, phrase).toContain("G3");
    }
  });

  it("2. blocks Kubernetes when it is not in the facts or skills (G4)", () => {
    const { violations, rules } = rulesFor("Deployed the forecasting pipeline on Kubernetes.", ["dhuaan.pipeline"]);
    expect(rules).toContain("G4");
    expect(violations.find((v) => v.rule === "G4")!.token).toBe("kubernetes");
  });

  it("   blocks a job-post keyword that is not in the lexicon", () => {
    expect(rulesFor("Built dashboards in Zorblax.", ["dhuaan.pipeline"], ["Zorblax"]).rules).toContain("G4");
  });

  it("3. blocks the old CGPA 8.72 when the fact says 8.73 (G2)", () => {
    const { violations, rules } = rulesFor("B.Tech student with a CGPA of 8.72/10.", ["edu.cgpa"]);
    expect(rules).toContain("G2");
    expect(violations.find((v) => v.rule === "G2")!.token).toBe("8.72");
  });

  it("4. blocks an internship that says 'Present' when the fact says Jul 2026 (G5)", () => {
    const { violations, rules } = rulesFor("Undergraduate Research Intern, Jan 2026 – Present.", ["research.internship"]);
    expect(rules).toContain("G5");
    expect(violations.some((v) => v.token === "present")).toBe(true);
  });

  it("   blocks 'Present' written with LaTeX dashes too", () => {
    expect(rulesFor("Jan 2026 -- Present", ["research.internship"]).rules).toContain("G5");
  });

  it("   blocks the wrong graduation month (Jul 2027 instead of May 2027)", () => {
    expect(rulesFor("Graduating in Jul 2027.", ["edu.grad"]).rules).toContain("G5");
  });

  it("5. blocks '~2× faster than hnswlib' when the fact says 1.9× (G2)", () => {
    const { violations, rules } = rulesFor("An HNSW index ~2× faster than hnswlib at equal recall.", ["strata.bench.full"]);
    expect(rules).toContain("G2");
    expect(violations.find((v) => v.rule === "G2")!.token).toBe("2×");
  });

  it("   blocks the same ~2x in LaTeX", () => {
    expect(rulesFor(String.raw`$\sim$2$\times$ faster than hnswlib`, ["strata.bench.full"]).rules).toContain("G2");
  });
});

describe("bullets copied from the resume always pass", () => {
  const approved = profile.facts.filter((f) => f.status === "verified" && f.latex);

  it("has approved bullets to test", () => {
    expect(approved.length).toBeGreaterThan(30);
  });

  it.each(approved.map((f) => [f.id, f] as const))("%s: stored LaTeX passes unchanged", (_id, f) => {
    expect(rulesFor(f.latex!, [f.id]).violations).toEqual([]);
  });

  it.each(approved.map((f) => [f.id, f] as const))("%s: plain text passes unchanged", (_id, f) => {
    expect(rulesFor(f.text, [f.id]).violations).toEqual([]);
  });

  it("every verified fact passes when it cites itself", () => {
    for (const f of profile.facts.filter((x) => x.status === "verified")) {
      expect(rulesFor(f.text, [f.id]).violations, f.id).toEqual([]);
    }
  });

  it("accepts LaTeX '11--15$\\times$' against a plain '11–15×' fact, and the reverse", () => {
    const base: Profile = {
      ...profile,
      facts: [
        { id: "plain", entryId: "proj-strata", text: "NEON/AVX2 kernels, 11–15× over scalar.", tags: ["SIMD"], status: "verified", source: "t" },
        { id: "tex", entryId: "proj-strata", text: "x", latex: String.raw`kernels \textbf{11--15$\times$} over scalar`, tags: ["SIMD"], status: "verified", source: "t" },
      ],
    };
    const a = guardClaim({ where: "a", text: String.raw`Wrote kernels 11--15$\times$ faster than scalar.`, factIds: ["plain"] }, base);
    const b = guardClaim({ where: "b", text: "Wrote kernels 11–15× faster than scalar.", factIds: ["tex"] }, base);
    expect(a).toEqual([]);
    expect(b).toEqual([]);
  });

  it("accepts a rewording that keeps every number", () => {
    const f = profile.facts.find((x) => x.id === "research.ensemble")!;
    const reworded = "Combined a 1D-CNN and a Conformer in a late-fusion ensemble: 97.03% balanced accuracy, 96.2% sensitivity and a 628 ms lead time on KFall.";
    expect(rulesFor(reworded, [f.id]).violations).toEqual([]);
  });

  it("accepts thousands separators written either way", () => {
    expect(rulesFor("Reached 6597 queries/s at 0.99 recall.", ["strata.bench.full"]).violations).toEqual([]);
    expect(rulesFor("Fixed 1975 of 2000 stale keys in USearch.", ["oss.usearch"]).violations).toEqual([]);
  });

  it("accepts skills as evidence for tools (G4 only)", () => {
    // The research fact never says Git or Linux, but the profile skills do.
    expect(rulesFor("Used Git and Linux throughout the research project.", ["research.ised.paper"]).rules).not.toContain("G4");
  });
});

describe("G1 citation", () => {
  it("fails with no citation", () => {
    expect(rulesFor("Built a vector database.", []).rules).toEqual(["G1"]);
  });
  it("fails on an unknown fact id", () => {
    expect(rulesFor("Built a vector database.", ["nope.nothing"]).rules).toContain("G1");
  });
  it("fails when citing a needs_review fact", () => {
    const f = profile.facts.find((x) => x.status === "needs_review")!;
    const { violations } = rulesFor(f.text, [f.id]);
    expect(violations.map((v) => v.rule)).toContain("G1");
    expect(violations[0].message).toMatch(/needs_review/);
  });
});

describe("G2 numbers", () => {
  it("needs a range to appear as the same range", () => {
    // Fact says nDCG@10 +8–74%; "74%" alone, or 8–70%, are not that range.
    expect(rulesFor("Improved nDCG@10 by 8–74% over BM25.", ["evident.hybrid.full"]).violations).toEqual([]);
    expect(rulesFor("Improved nDCG@10 by up to 74% over BM25.", ["evident.hybrid.full"]).rules).toContain("G2");
    expect(rulesFor("Improved nDCG@10 by 8–70% over BM25.", ["evident.hybrid.full"]).rules).toContain("G2");
  });
  it("rejects a number that is only a fragment of a bigger one", () => {
    expect(rulesFor("Hit 97.0% balanced accuracy.", ["research.ensemble"]).rules).toContain("G2");
    expect(rulesFor("Achieved a 62 ms lead time.", ["research.ensemble"]).rules).toContain("G2");
  });
  it("catches K and M suffixes", () => {
    expect(rulesFor("Sustained 76K req/s.", ["strata.durability.full"]).violations).toEqual([]);
    expect(rulesFor("Sustained 760K req/s.", ["strata.durability.full"]).rules).toContain("G2");
  });
  it("catches an invented percentage", () => {
    expect(rulesFor("Raised accuracy by 15%.", ["research.ensemble"]).rules).toContain("G2");
  });
});

describe("G3 ranks", () => {
  it("allows 'Runner-up' and 'Top 1%' when the facts say so", () => {
    expect(rulesFor("Runner-up at the WeMakeDevs × AWS hackathon.", ["dhuaan.award"]).violations).toEqual([]);
    expect(rulesFor("Top 1% nationally in the NatWest hackathon.", ["ach.natwest"]).violations).toEqual([]);
  });
  it("blocks a better rank than the fact", () => {
    expect(rulesFor("Top 5% nationally in the NatWest hackathon.", ["ach.natwest"]).rules).toContain("G3");
  });
  it("does not trip on words that merely contain 'win' or 'won'", () => {
    expect(rulesFor("Designed Adaptive Temporal Windowing for the 8:1 imbalance.", ["research.ised.paper"]).rules).not.toContain("G3");
  });
});

describe("G5 dates", () => {
  it("accepts the dates in the cited facts, in any spelling of the month", () => {
    expect(rulesFor("Research intern, January 2026 to July 2026.", ["research.internship"]).violations).toEqual([]);
    expect(rulesFor("Jan 2026 -- Jul 2026", ["research.internship"]).violations).toEqual([]);
  });
  it("blocks an invented year", () => {
    expect(rulesFor("Research intern since 2024.", ["research.internship"]).rules).toContain("G5");
  });
  it("accepts a paraphrase that uses the word 'present' as a verb", () => {
    expect(rulesFor("Will present the paper at IEEE ISED 2026.", ["research.ised.paper"]).rules).not.toContain("G5");
  });
});

describe("G6 structure", () => {
  const ok: GuardInput = {
    entryOrder: ["research-bitm", "proj-strata"],
    bullets: [{ entryId: "proj-strata", text: profile.facts.find((f) => f.id === "strata.bench.full")!.text, factIds: ["strata.bench.full"] }],
    skills: [{ label: "Languages", items: ["Python", "C++17"] }],
  };

  it("passes a well-formed output and counts the claims", () => {
    const r = guard(ok, profile);
    expect(r).toMatchObject({ ok: true, claims: 1, verified: 1, violations: [] });
  });
  it("fails on an unknown entry", () => {
    const r = guard({ ...ok, bullets: [{ ...ok.bullets[0], entryId: "proj-made-up" }] }, profile);
    expect(r.violations.map((v) => v.rule)).toContain("G6");
    expect(r.ok).toBe(false);
  });
  it("fails on an unknown entry in entryOrder", () => {
    expect(guard({ ...ok, entryOrder: ["proj-made-up"] }, profile).violations.map((v) => v.rule)).toContain("G6");
  });
  it("fails on a skill that is not in the profile", () => {
    const r = guard({ ...ok, skills: [{ label: "Tools", items: ["Git", "Kubernetes"] }] }, profile);
    expect(r.violations.find((v) => v.rule === "G6")!.token).toBe("Kubernetes");
  });
  it("allows reordering and filtering skills", () => {
    const r = guard({ ...ok, skills: [{ label: "Anything", items: ["SQL", "Python"] }] }, profile);
    expect(r.violations).toEqual([]);
  });
});

describe("guard() over a whole output", () => {
  it("counts cover-note paragraphs and the email, and reports the verified total", () => {
    const f = profile.facts.find((x) => x.id === "dhuaan.award")!;
    const r = guard(
      {
        bullets: [],
        paragraphs: [
          { text: "I was Runner-up at the WeMakeDevs × AWS hackathon.", factIds: [f.id] },
          { text: "I won the WeMakeDevs × AWS hackathon.", factIds: [f.id] },
        ],
        email: { subject: "Hello", body: "I know Kubernetes well.", factIds: [f.id] },
      },
      profile,
    );
    expect(r.claims).toBe(3);
    expect(r.verified).toBe(1);
    expect(r.violations.map((v) => v.where)).toEqual(expect.arrayContaining(["cover[1]", "email"]));
    expect(r.violations.every((v) => v.message.length > 0)).toBe(true);
  });
});

describe("normalize", () => {
  it.each([
    [String.raw`11--15$\times$`, "11–15×"],
    [String.raw`\textbf{97.03\%} and \textbf{628\,ms}`, "97.03% and 628 ms"],
    ["6,597 queries", "6597 queries"],
    ["11x faster", "11× faster"],
    [String.raw`$\sim$2$\times$`, "~2×"],
    [String.raw`3.5K$\to$10.8K`, "3.5K→10.8K"],
    ["8 - 74%", "8–74%"],
    ["  lots   of \n space ", "lots of space"],
  ])("%s", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
  it("lowercases for word checks", () => {
    expect(normalizeWords(String.raw`\textbf{Runner-up}, WeMakeDevs $\times$ AWS`)).toBe("runner-up, wemakedevs × aws");
  });
});

describe("gaps and prefs in prose", () => {
  const cover = (text: string) =>
    guardClaim({ where: "email", text, factIds: ["dhuaan.pipeline"] }, profile, [], { gapsOk: true }).map((v) => v.rule);

  it("lets an honest gap name a tool you don't have", () => {
    expect(cover("No hands-on Azure experience yet, but my AWS Lambda work maps closely.")).toEqual([]);
    expect(cover("I haven't used Kubernetes in production.")).toEqual([]);
  });
  it("accepts a long gap sentence naming two tools", () => {
    expect(cover("No hands-on Azure Machine Learning or Power BI experience yet. I don't have Terraform exposure either.")).toEqual([]);
  });
  it("still blocks the same tool when it is claimed", () => {
    expect(cover("I deployed it on Azure and I know Kubernetes.")).toContain("G4");
  });
  it("never relaxes bullets", () => {
    expect(rulesFor("No hands-on Azure experience yet.", ["dhuaan.pipeline"]).rules).toContain("G4");
  });
  it("treats prefs as evidence for numbers in a recruiter reply", () => {
    const rules = (extra?: string) =>
      guardClaim({ where: "email", text: "My notice period is 30 days.", factIds: ["dhuaan.pipeline"] }, profile, [], { gapsOk: true, extraEvidence: extra }).map((v) => v.rule);
    expect(rules()).toContain("G2");
    expect(rules("Notice period: 30 days")).toEqual([]);
  });
});

describe("tool names with different spacing", () => {
  it("treats 'Hugging Face' and 'HuggingFace' as the same tool", () => {
    expect(profile.skills.some((g) => g.items.includes("HuggingFace"))).toBe(true); // the skill is spelled without a space
    expect(rulesFor("Used Hugging Face models.", ["research.ised.paper"]).violations).toEqual([]);
  });
});
