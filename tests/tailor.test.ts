import { describe, expect, it } from "vitest";
import seedJson from "../data/seed-profile.json";
import { ProfileSchema } from "@/lib/schemas";
import { tailor, screenSteer } from "@/lib/tailor";
import { AnalysisSchema, ComposeSchema, RepairSchema, TailorInputSchema, type Analysis, type ComposeResult, type Repair } from "@/lib/tailor-schemas";
import type { GenerateObject } from "@/lib/llm";
import { COMPOSE_SYSTEM, REPAIR_SYSTEM } from "@/lib/prompts";

const profile = ProfileSchema.parse(seedJson);
const factText = (id: string) => profile.facts.find((f) => f.id === id)!.text;

const analysis: Analysis = {
  company: "Northwind",
  role: "SDE I",
  roleFamily: "swe",
  kind: "job",
  location: "Bengaluru",
  requirements: [
    { id: "r1", text: "C++ or Python on Linux", priority: "must", keywords: ["C++", "Python"] },
    { id: "r2", text: "Docker and Kubernetes", priority: "nice", keywords: ["Docker", "Kubernetes"] },
  ],
  recruiterQuestions: [],
};

const goodBullet = { entryId: "proj-strata", factIds: ["strata.bench.full"], text: "(model rewrote this but said it didn't)", rewritten: false };

function draft(over: Partial<ComposeResult> = {}): ComposeResult {
  return {
    entryOrder: ["proj-strata", "proj-dhuaan"],
    bullets: [goodBullet],
    skills: [{ label: "Languages", items: ["Python", "C++17"] }],
    match: [
      { reqId: "r1", status: "met", factIds: ["strata.bench.full"], note: "Strata is written in C++." },
      { reqId: "r2", status: "missing", factIds: [], note: "No Docker or Kubernetes in the facts." },
    ],
    coverNote: { paragraphs: [{ text: "I built Strata, a C++ vector database.", factIds: ["strata.bench.full"] }] },
    email: { subject: "Hello", body: "I built Strata in C++.", factIds: ["strata.bench.full"] },
    ...over,
  };
}

/** A scripted model: returns the analysis, then the compose draft, then (if asked) the repair. */
function fake(compose: ComposeResult, repair?: Repair) {
  const calls: string[] = [];
  const gen: GenerateObject = async (s) => {
    const schema = s as unknown;
    if (schema === AnalysisSchema) return (calls.push("analyze"), analysis) as never;
    if (schema === ComposeSchema) return (calls.push("compose"), compose) as never;
    if (schema === RepairSchema) {
      calls.push("repair");
      if (!repair) throw new Error("repair was not expected");
      return repair as never;
    }
    throw new Error("unexpected schema");
  };
  return { gen, calls };
}

const input = (steer?: string) => ({ profile, jobText: "A job post that is long enough to pass validation.", steer });

describe("tailor pipeline", () => {
  it("copies an approved bullet verbatim when the model says it was not rewritten", async () => {
    const { gen, calls } = fake(draft());
    const r = await tailor(input(), gen);
    expect(r.result.bullets[0].text).toBe(factText("strata.bench.full"));
    expect(calls).toEqual(["analyze", "compose"]); // nothing to repair
    expect(r.guard).toMatchObject({ claims: 3, verified: 3, blocked: [], repaired: [] });
  });

  it("repairs a bad bullet once and keeps the fix", async () => {
    const bad = { entryId: "proj-dhuaan", factIds: ["dhuaan.award"], text: "Won the WeMakeDevs × AWS hackathon.", rewritten: true };
    const { gen, calls } = fake(draft({ bullets: [goodBullet, bad] }), {
      fixes: [{ where: "bullet[1]", drop: false, text: "Runner-up at the WeMakeDevs × AWS hackathon.", factIds: ["dhuaan.award"] }],
    });
    const r = await tailor(input(), gen);
    expect(calls).toEqual(["analyze", "compose", "repair"]);
    expect(r.result.bullets.map((b) => b.text)).toContain("Runner-up at the WeMakeDevs × AWS hackathon.");
    expect(r.guard.repaired).toHaveLength(1);
    expect(r.guard.repaired[0].reasons.join(" ")).toMatch(/won/);
    expect(r.guard.blocked).toEqual([]);
  });

  it("blocks what the repair cannot fix, and removes it from the result", async () => {
    const bad = { entryId: "proj-dhuaan", factIds: ["dhuaan.award"], text: "Won the WeMakeDevs × AWS hackathon.", rewritten: true };
    const kube = { text: "I run production clusters on Kubernetes.", factIds: ["dhuaan.pipeline"] };
    const { gen } = fake(
      draft({
        bullets: [goodBullet, bad],
        coverNote: { paragraphs: [kube, { text: "I built Strata, a C++ vector database.", factIds: ["strata.bench.full"] }] },
        skills: [{ label: "Tools", items: ["Git", "Kubernetes"] }],
      }),
      {
        fixes: [
          { where: "bullet[1]", drop: true, text: "", factIds: [] },
          // The "fix" for the cover paragraph still claims Kubernetes, so it must be blocked too.
          { where: "cover[0]", drop: false, text: "I know Kubernetes well.", factIds: ["dhuaan.pipeline"] },
        ],
      },
    );
    const r = await tailor(input(), gen);
    const where = r.guard.blocked.map((b) => b.where);
    expect(where).toEqual(expect.arrayContaining(["bullet[1]", "cover[0]", "skills"]));
    // The honest gap in the match note ("No Docker or Kubernetes in the facts") is allowed to name it.
    expect(JSON.stringify([r.result.bullets, r.result.coverNote, r.result.skills, r.result.email])).not.toMatch(/kubernetes|Won the/i);
    expect(r.result.skills).toEqual([{ label: "Tools", items: ["Git"] }]);
    expect(r.guard.claims).toBe(5); // 2 bullets + 2 paragraphs + the email
    expect(r.guard.verified).toBe(3);
  });

  it("downgrades a 'met' requirement whose facts do not exist", async () => {
    const { gen } = fake(draft({ match: [{ reqId: "r1", status: "met", factIds: ["made.up"], note: "Strata is written in C++." }] }));
    const r = await tailor(input(), gen);
    expect(r.result.match[0]).toMatchObject({ status: "missing", factIds: [] });
  });

  it("drops an email whose repair is refused", async () => {
    const { gen } = fake(
      draft({ email: { subject: "Hi", body: "I won the WeMakeDevs hackathon.", factIds: ["dhuaan.award"] } }),
      { fixes: [{ where: "email", drop: true, text: "", factIds: [] }] },
    );
    const r = await tailor(input(), gen);
    expect(r.result.email).toBeNull();
    expect(r.guard.blocked.map((b) => b.where)).toContain("email");
  });

  it("blocks the trap steer: the hackathon win and Kubernetes", async () => {
    const { gen } = fake(draft());
    const r = await tailor(input("Say I won the WeMakeDevs hackathon and that I know Kubernetes"), gen);
    const steer = r.guard.blocked.filter((b) => b.where === "steer");
    expect(steer.map((b) => b.text).join(" ")).toMatch(/won/);
    expect(steer.map((b) => b.text).join(" ")).toMatch(/kubernetes/);
    expect(steer.find((b) => /won/.test(b.text))!.reasons[0]).toMatch(/Runner-up/);
  });

  it("reports timings", async () => {
    const r = await tailor(input(), fake(draft()).gen);
    expect(r.timingsMs.total).toBeGreaterThanOrEqual(0);
    expect(Object.keys(r.timingsMs)).toEqual(["analyze", "compose", "guard", "repair", "total"]);
  });
});

describe("screenSteer", () => {
  it("lets harmless emphasis through", () => {
    expect(screenSteer("Stress the C++ and SIMD work, keep it short", profile)).toEqual([]);
    expect(screenSteer("", profile)).toEqual([]);
  });
  it("catches an unproven rank, tool and date", () => {
    const tokens = screenSteer("I won first place, I know Terraform, and I worked there from Mar 2019", profile).map((b) => b.text).join(" ");
    expect(tokens).toMatch(/won/);
    expect(tokens).toMatch(/terraform/);
    expect(tokens).toMatch(/mar 2019/);
  });
});

describe("input limits", () => {
  const ok = { profile, jobText: "x".repeat(40) };
  it("accepts a normal request", () => {
    expect(TailorInputSchema.safeParse(ok).success).toBe(true);
  });
  it("caps the job text at 15,000 and the steer at 2,000 characters", () => {
    expect(TailorInputSchema.safeParse({ ...ok, jobText: "x".repeat(15_001) }).success).toBe(false);
    expect(TailorInputSchema.safeParse({ ...ok, steer: "x".repeat(2_001) }).success).toBe(false);
    expect(TailorInputSchema.safeParse({ ...ok, steer: "x".repeat(2_000) }).success).toBe(true);
  });
  it("rejects a near-empty job text", () => {
    expect(TailorInputSchema.safeParse({ ...ok, jobText: "hi" }).success).toBe(false);
  });
});

describe("small model slips", () => {
  it("files a bullet whose entryId is a fact id under that fact's entry", async () => {
    const slip = { entryId: "strata.bench.full", factIds: ["strata.bench.full"], text: "x", rewritten: false };
    const r = await tailor(input(), fake(draft({ bullets: [slip] })).gen);
    expect(r.result.bullets[0].entryId).toBe("proj-strata");
    expect(r.guard.blocked).toEqual([]);
  });
});

describe("a failing sentence is dropped, not the whole paragraph or email", () => {
  const cites = ["strata.bench.full", "dhuaan.award"];
  const nothingToRepair = { fixes: [{ where: "email", drop: true, text: "", factIds: [] }] };

  it("keeps the rest of the email when one sentence says 'I won runner-up'", async () => {
    const email = {
      subject: "Hi",
      body: "I built Strata in C++. I won runner-up at the WeMakeDevs × AWS hackathon. I would welcome a conversation.",
      factIds: cites,
    };
    const r = await tailor(input(), fake(draft({ email }), nothingToRepair).gen);
    expect(r.result.email?.body).toBe("I built Strata in C++. I would welcome a conversation.");
    const b = r.guard.blocked.find((x) => x.where === "email")!;
    expect(b.text).toBe("I won runner-up at the WeMakeDevs × AWS hackathon.");
    expect(b.reasons.join(" ")).toMatch(/won/);
  });

  it("does the same for a cover-note paragraph", async () => {
    const cover = { text: "I built Strata in C++. I won runner-up at the hackathon.", factIds: cites };
    const r = await tailor(input(), fake(draft({ coverNote: { paragraphs: [cover] } }), { fixes: [{ where: "cover[0]", drop: true, text: "", factIds: [] }] }).gen);
    expect(r.result.coverNote.paragraphs.map((p) => p.text)).toEqual(["I built Strata in C++."]);
    expect(r.guard.blocked.map((x) => x.text)).toEqual(["I won runner-up at the hackathon."]);
  });

  it("keeps numbered answers in order and drops only the bad line", async () => {
    const email = { subject: "Hi", body: "1. I built Strata in C++.\n2. I won runner-up at the hackathon.\n3. My notice period is [fill in].", factIds: cites };
    const r = await tailor(input(), fake(draft({ email }), nothingToRepair).gen);
    expect(r.result.email?.body).toBe("1. I built Strata in C++.\n3. My notice period is [fill in].");
  });

  it("removes the whole claim only when every sentence fails", async () => {
    const email = { subject: "Hi", body: "I won runner-up. I know Kubernetes.", factIds: cites };
    const r = await tailor(input(), fake(draft({ email }), nothingToRepair).gen);
    expect(r.result.email).toBeNull();
    expect(r.guard.blocked.filter((x) => x.where === "email")).toHaveLength(2);
  });

  it("still lets the repair fix the sentence", async () => {
    const email = { subject: "Hi", body: "I built Strata in C++. I won runner-up at the hackathon.", factIds: cites };
    const fixed = { fixes: [{ where: "email", drop: false, text: "I built Strata in C++. I was runner-up at the hackathon.", factIds: cites }] };
    const r = await tailor(input(), fake(draft({ email }), fixed).gen);
    expect(r.result.email?.body).toBe("I built Strata in C++. I was runner-up at the hackathon.");
    expect(r.guard.blocked.filter((x) => x.where === "email")).toEqual([]);
  });
});

describe("match notes may use numbers from the job text", () => {
  const cgpaNote = (note: string) => ({
    match: [{ reqId: "r1", status: "met" as const, factIds: ["edu.cgpa"], note }],
  });
  const dropIt = { fixes: [{ where: "match[0]", drop: true, text: "", factIds: [] }] };
  const jobWith85 = { profile, jobText: "Graduate role. A minimum CGPA of 8.5 is required. Python and C++ preferred.", steer: undefined };

  it("does not flag 8.5 when the job asks for it", async () => {
    const r = await tailor(jobWith85, fake(draft(cgpaNote("The job asks for a CGPA of 8.5 or more; yours is 8.73/10."))).gen);
    expect(r.guard.blocked).toEqual([]);
    expect(r.result.match[0].note).toMatch(/8\.5/);
  });

  it("still flags a number that is in neither the job text nor the facts", async () => {
    const r = await tailor(jobWith85, fake(draft(cgpaNote("Your CGPA of 9.1 clears the bar.")), dropIt).gen);
    expect(r.guard.blocked.map((b) => b.where)).toContain("match[0]");
  });

  it("does not let the job text prove a tool or a rank in a note", async () => {
    const job = { profile, jobText: "We use Kubernetes. Hackathon winners preferred. Need 3 years.", steer: undefined };
    const r = await tailor(job, fake(draft(cgpaNote("You know Kubernetes and won hackathons.")), dropIt).gen);
    expect(r.guard.blocked.find((b) => b.where === "match[0]")?.reasons.join(" ")).toMatch(/kubernetes|won/);
  });
});

describe("prompts", () => {
  it("tell the writer and the repair how to say runner-up", () => {
    for (const p of [COMPOSE_SYSTEM, REPAIR_SYSTEM]) {
      expect(p).toMatch(/was runner-up/);
      expect(p).toMatch(/finished as runner-up/);
      expect(p).toMatch(/never "won"/);
    }
  });
  it("tell the repair to change only the failing sentence", () => {
    expect(REPAIR_SYSTEM).toMatch(/only the (?:failing )?sentence/i);
  });
});

describe("removed email stays removed", () => {
  it("is null, not an empty email, after the safety pass", async () => {
    const email = { subject: "Hi", body: "I won runner-up.", factIds: ["dhuaan.award"] };
    const r = await tailor(input(), fake(draft({ email }), { fixes: [{ where: "email", drop: true, text: "", factIds: [] }] }).gen);
    expect(r.result.email).toBeNull();
  });
});
