import { describe, expect, it } from "vitest";
import seedJson from "../data/seed-profile.json";
import { ProfileSchema } from "@/lib/schemas";
import { assertSafeTex, buildTex, escapeLatex } from "@/lib/latex";
import { buildResume, resumeToText } from "@/lib/resume-model";
import { compileTex, tectonicPath } from "@/lib/pdf";
import { latexToHtml } from "@/lib/tex";
import type { TailorResult } from "@/lib/tailor-schemas";

const profile = ProfileSchema.parse(seedJson);
const fact = (id: string) => profile.facts.find((f) => f.id === id)!;
const bullet = (id: string) => ({ entryId: fact(id).entryId, factIds: [id], text: fact(id).text, rewritten: false });

/** The default selection: one or two approved bullets per entry. */
const result: TailorResult = {
  entryOrder: ["research-bitm", "proj-strata", "proj-evident", "proj-dhuaan", "proj-overlay", "oss", "achievements"],
  bullets: [
    bullet("research.ised.paper"),
    bullet("research.ensemble"),
    bullet("strata.bench.full"),
    bullet("strata.simd.full"),
    bullet("evident.bm25"),
    { entryId: "proj-dhuaan", factIds: ["dhuaan.pipeline"], text: "Built a serverless pipeline & ran it every 3 h (100% on AWS_Lambda).", rewritten: true },
    bullet("overlay.short"),
    bullet("oss.usearch"),
    bullet("ach.runnerup"),
    bullet("ach.natwest"),
  ],
  skills: [{ label: "Languages & CS", items: ["Python", "C++17"] }],
  match: [],
  coverNote: { paragraphs: [] },
  email: null,
};

describe("escapeLatex", () => {
  it("escapes every LaTeX special character", () => {
    expect(escapeLatex("a & b % c $ d # e _ f { g } h ~ i ^ j \\ k")).toBe(
      "a \\& b \\% c \\$ d \\# e \\_ f \\{ g \\} h \\textasciitilde{} i \\textasciicircum{} j \\textbackslash{} k",
    );
  });
  it("maps the symbols the guard understands", () => {
    expect(escapeLatex("11–15× and 3.5K→10.8K, a — b")).toBe("11--15$\\times$ and 3.5K$\\rightarrow$10.8K, a --- b");
  });
});

describe("buildTex", () => {
  const model = buildResume(profile, result);
  const tex = buildTex(model);

  it("starts with the template attribution and keeps the preamble verbatim", () => {
    expect(tex).toContain("built on Jake Gutierrez's resume template (MIT)");
    expect(tex).toContain("\\newcommand{\\resumeItem}[1]{\\item\\small{{#1 \\vspace{-2pt}}}}");
    expect(tex).toContain("\\begin{document}");
    expect(tex.trim().endsWith("\\end{document}")).toBe(true);
  });

  it("uses an unchanged approved bullet's stored LaTeX byte-for-byte", () => {
    expect(tex).toContain(`\\resumeItem{${fact("strata.bench.full").latex}}`);
    expect(tex).toContain(`\\item ${fact("ach.runnerup").latex}`);
  });

  it("escapes a rewritten bullet", () => {
    expect(tex).toContain("Built a serverless pipeline \\& ran it every 3 h (100\\% on AWS\\_Lambda).");
  });

  it("keeps the confirmed dates and never prints Present", () => {
    expect(tex).toContain("Jan 2026 -- Jul 2026");
    expect(tex).toContain("Aug 2023 -- May 2027");
    expect(tex).not.toMatch(/Present|8\.72|Jul 2027/);
  });

  it("includes the phone only when the user has set one locally", () => {
    expect(tex).not.toContain("faPhone");
    const withPhone = buildTex(buildResume({ ...profile, phone: "+00 11111 22222" }, result));
    expect(withPhone).toContain("\\faPhone\\ +00 11111 22222");
  });

  it("is safe to compile", () => {
    expect(() => assertSafeTex(tex)).not.toThrow();
    expect(() => assertSafeTex(`${tex}\n\\input{/etc/passwd}`)).toThrow(/input/);
  });

  it.skipIf(!tectonicPath())("compiles with tectonic into a one-page PDF", async () => {
    const { pdf, pages } = await compileTex(tex);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pages).toBe(1);
  }, 180_000);
});

describe("resume model", () => {
  const model = buildResume(profile, result);
  it("orders sections like the template and drops empty ones", () => {
    expect(model.sections.map((s) => s.title)).toEqual(["Education", "Research Experience", "Projects", "Open Source", "Technical Skills", "Achievements"]);
  });
  it("renders bold and italics for the preview and plain text for Copy", () => {
    const b = model.sections[2].entries![0].bullets[0];
    expect(b.html).toContain("<strong>HNSW</strong>");
    expect(resumeToText(model)).toContain("- " + fact("strata.bench.full").text);
  });
});

describe("latexToHtml", () => {
  it("keeps spaces around tags and escapes HTML", () => {
    expect(latexToHtml(String.raw`Built \textbf{HNSW} with \texttt{a<b} and 50\% faster ($\sim$2$\times$).`)).toBe(
      "Built <strong>HNSW</strong> with <code>a&lt;b</code> and 50% faster (~2×).",
    );
  });
  it("nests styles", () => {
    expect(latexToHtml(String.raw`\textbf{a \emph{b} c}`)).toBe("<strong>a <em>b</em> c</strong>");
  });
});
