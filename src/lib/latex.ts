/** Builds a compilable .tex: the template preamble verbatim, plus the tailored body. */
import { escapeLatex } from "./latex-escape";
import { PREAMBLE } from "./preamble";
import type { ModelBullet, ModelEntry, ModelSection, ResumeModel } from "./resume-model";

export { escapeLatex };

const itemList = (items: ModelBullet[], indent: string) =>
  `${indent}\\resumeItemListStart\n${items.map((b) => `${indent}  \\resumeItem{${b.latex}}`).join("\n")}\n${indent}\\resumeItemListEnd`;

/** The heading macro: verbatim from the resume when stored, otherwise built (OverlayAi has no stored heading). */
function heading(e: ModelEntry["entry"]): string {
  if (e.headingLatex) return e.headingLatex;
  const links = (e.links ?? []).map((l) => `\\href{${l.url}}{\\faGithub\\ ${escapeLatex(l.label)}}`).join(" $|$ ");
  const sub = e.subtitle ? ` $|$ \\emph{${escapeLatex(e.subtitle)}}` : "";
  return `\\resumeProjectHeading\n          {\\textbf{${escapeLatex(e.title)}}${sub}}{${links}}`;
}

function entriesSection(s: ModelSection): string {
  const isProjects = s.entries?.some((e) => e.entry.section !== "research" && e.entry.section !== "education");
  const body = (s.entries ?? [])
    .map((e) => {
      const head = `    ${heading(e.entry)}`;
      return e.bullets.length ? `${head}\n${itemList(e.bullets, isProjects ? "          " : "      ")}` : head;
    })
    .join("\n");
  return `\\section{${s.title}}\n  \\resumeSubHeadingListStart\n${body}\n  \\resumeSubHeadingListEnd\n`;
}

function skillsSection(s: ModelSection): string {
  const lines = (s.skills ?? []).map((g) => `     \\textbf{${escapeLatex(g.label)}}{: ${g.items.map(escapeLatex).join(", ")}}`);
  return `\\section{${s.title}}\n \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{\n${lines.join(" \\\\\n")}\n    }}\n \\end{itemize}\n`;
}

function listSection(s: ModelSection): string {
  const items = (s.items ?? []).map((b) => `    \\item ${b.latex}`).join("\n");
  return `\\section{${s.title}}\n \\begin{itemize}[leftmargin=0.15in, itemsep=-1pt]\n    \\small{\n${items}\n    }\n \\end{itemize}\n`;
}

function headingBlock(m: ResumeModel): string {
  const parts = [
    m.phone && `\\faPhone\\ ${escapeLatex(m.phone)}`,
    m.email && `\\href{mailto:${m.email}}{\\faEnvelope\\ ${escapeLatex(m.email)}}`,
    ...m.links.map((l) => `\\href{${l.url}}{\\${l.icon ?? "faLink"}\\ ${escapeLatex(l.label)}}`),
  ].filter(Boolean);
  return `\\begin{center}\n    \\textbf{\\Huge \\scshape ${escapeLatex(m.name)}} \\\\ \\vspace{3pt}\n    \\small ${parts.join(" $|$\n    ")}\n\\end{center}\n`;
}

export function buildTex(m: ResumeModel): string {
  const sections = m.sections.map((s) => (s.kind === "skills" ? skillsSection(s) : s.kind === "list" ? listSection(s) : entriesSection(s)));
  return `${PREAMBLE}\\begin{document}\n\n${headingBlock(m)}\n${sections.join("\n")}\n\\end{document}\n`;
}

/** Macros that could read or write files when compiled. The body is generated, but the profile is client-supplied. */
const FORBIDDEN = /\\(?:input|include|openin|openout|read|write|immediate|catcode|csname|special|usepackage|documentclass|newwrite|newread)\b/;

/** Throws if the generated body (everything after the preamble) contains a file-touching macro. */
export function assertSafeTex(tex: string): void {
  const body = tex.slice(tex.indexOf("\\begin{document}"));
  const hit = FORBIDDEN.exec(body);
  if (hit) throw new Error(`Refusing to compile: the resume contains ${hit[0]}.`);
}
