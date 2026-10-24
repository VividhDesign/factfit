/** One description of the tailored resume, shared by the HTML preview, the .tex builder and the plain-text export. */
import { latexToHtml } from "./tex";
import { escapeLatex } from "./latex-escape";
import type { TailorResult } from "./tailor-schemas";
import type { Entry, Profile, SkillGroup } from "./types";

export interface ModelBullet {
  text: string;
  html: string;
  latex: string;
  factIds: string[];
}
export interface ModelEntry {
  entry: Entry;
  bullets: ModelBullet[];
}
export interface ModelSection {
  title: string;
  /** "entries" have headings; "list" is a plain itemize (Achievements); "skills" is the skills block. */
  kind: "entries" | "list" | "skills";
  entries?: ModelEntry[];
  items?: ModelBullet[];
  skills?: SkillGroup[];
}
export interface ResumeModel {
  name: string;
  email?: string;
  phone?: string;
  links: Profile["links"];
  sections: ModelSection[];
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildResume(profile: Profile, result: TailorResult): ResumeModel {
  const facts = new Map(profile.facts.map((f) => [f.id, f]));
  const entries = new Map(profile.entries.map((e) => [e.id, e]));

  const toBullet = (b: TailorResult["bullets"][number]): ModelBullet => {
    const only = b.factIds.length === 1 ? facts.get(b.factIds[0]) : undefined;
    // An unchanged approved bullet keeps its stored LaTeX, byte-for-byte.
    if (!b.rewritten && only?.latex && only.text === b.text) {
      return { text: b.text, html: latexToHtml(only.latex), latex: only.latex, factIds: b.factIds };
    }
    return { text: b.text, html: escHtml(b.text), latex: escapeLatex(b.text), factIds: b.factIds };
  };

  const group = (section: Entry["section"]): ModelEntry[] =>
    result.entryOrder
      .map((id) => entries.get(id))
      .filter((e): e is Entry => !!e && e.section === section)
      .map((entry) => ({ entry, bullets: result.bullets.filter((b) => b.entryId === entry.id).map(toBullet) }))
      .filter((e) => e.bullets.length > 0);

  const sections: ModelSection[] = [
    { title: "Education", kind: "entries", entries: profile.entries.filter((e) => e.section === "education").map((entry) => ({ entry, bullets: [] })) },
  ];
  const add = (title: string, section: Entry["section"]) => {
    const list = group(section);
    if (list.length) sections.push({ title, kind: "entries", entries: list });
  };
  add("Research Experience", "research");
  add("Projects", "projects");
  add("Open Source", "opensource");
  sections.push({ title: "Technical Skills", kind: "skills", skills: result.skills.length ? result.skills : profile.skills });
  const ach = result.bullets.filter((b) => entries.get(b.entryId)?.section === "achievements").map(toBullet);
  if (ach.length) sections.push({ title: "Achievements", kind: "list", items: ach });

  return { name: profile.name, email: profile.email, phone: profile.phone, links: profile.links, sections };
}

/** Plain-text resume, for Copy. */
export function resumeToText(m: ResumeModel): string {
  const out = [m.name, [m.phone, m.email, ...m.links.map((l) => l.url)].filter(Boolean).join(" | "), ""];
  for (const s of m.sections) {
    out.push(s.title.toUpperCase());
    for (const e of s.entries ?? []) {
      out.push([e.entry.title, e.entry.dates?.replace(/--/g, "–")].filter(Boolean).join("  ·  "));
      if (e.entry.subtitle || e.entry.org) out.push([e.entry.org, e.entry.subtitle].filter(Boolean).join(" — "));
      for (const b of e.bullets) out.push(`- ${b.text}`);
    }
    for (const b of s.items ?? []) out.push(`- ${b.text}`);
    for (const g of s.skills ?? []) out.push(`${g.label}: ${g.items.join(", ")}`);
    out.push("");
  }
  return out.join("\n").trim() + "\n";
}
