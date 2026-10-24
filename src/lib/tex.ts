/** Brace-aware extraction of the Jake-template resume macros. Pure string functions, no I/O. */

export interface ParsedEntry {
  kind: "subheading" | "projectHeading";
  /** Brace arguments of the heading macro, verbatim. */
  args: string[];
  /** The macro and its arguments, byte-for-byte from the source. */
  headingLatex: string;
  /** Bodies of the \resumeItem macros that follow, verbatim. */
  items: string[];
}

export interface ParsedSection {
  title: string;
  entries: ParsedEntry[];
}

/** Reads one `{...}` group starting at `start`. Honours `\{`, `\}` and `%` comments. */
export function readGroup(src: string, start: number): { content: string; end: number } {
  if (src[start] !== "{") throw new Error(`expected "{" at ${start}`);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      i++;
    } else if (c === "%") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) return { content: src.slice(start + 1, i), end: i + 1 };
    }
  }
  throw new Error(`unbalanced "{" at ${start}`);
}

function skipSpace(src: string, i: number): number {
  while (i < src.length && /\s/.test(src[i])) i++;
  return i;
}

function readArgs(src: string, from: number, count: number): { args: string[]; end: number } {
  const args: string[] = [];
  let pos = from;
  for (let n = 0; n < count; n++) {
    pos = skipSpace(src, pos);
    const g = readGroup(src, pos);
    args.push(g.content);
    pos = g.end;
  }
  return { args, end: pos };
}

const MACRO = /\\(section|resumeSubheading|resumeProjectHeading|resumeItem)(?![A-Za-z])/g;

/** Splits a resume into sections, each with its headings and their `\resumeItem` bodies. */
export function parseResume(tex: string): ParsedSection[] {
  const body = tex.includes("\\begin{document}") ? tex.slice(tex.indexOf("\\begin{document}")) : tex;
  const sections: ParsedSection[] = [];
  let section: ParsedSection | undefined;
  let entry: ParsedEntry | undefined;
  MACRO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MACRO.exec(body))) {
    // Skip macros that sit inside a % comment.
    const lineStart = body.lastIndexOf("\n", m.index) + 1;
    if (/(^|[^\\])%/.test(body.slice(lineStart, m.index))) continue;
    const after = m.index + m[0].length;
    if (m[1] === "section") {
      const { args, end } = readArgs(body, after, 1);
      section = { title: args[0], entries: [] };
      sections.push(section);
      entry = undefined;
      MACRO.lastIndex = end;
    } else if (m[1] === "resumeItem") {
      const { args, end } = readArgs(body, after, 1);
      if (!section) throw new Error("\\resumeItem before any \\section");
      if (!entry) {
        entry = { kind: "projectHeading", args: [], headingLatex: "", items: [] };
        section.entries.push(entry);
      }
      entry.items.push(args[0]);
      MACRO.lastIndex = end;
    } else {
      const count = m[1] === "resumeSubheading" ? 4 : 2;
      const { args, end } = readArgs(body, after, count);
      if (!section) throw new Error(`\\${m[1]} before any \\section`);
      entry = {
        kind: m[1] === "resumeSubheading" ? "subheading" : "projectHeading",
        args,
        headingLatex: body.slice(m.index, end),
        items: [],
      };
      section.entries.push(entry);
      MACRO.lastIndex = end;
    }
  }
  return sections;
}

/** Every `\resumeItem` body in the file, in order. */
export function extractItems(tex: string): string[] {
  return parseResume(tex).flatMap((s) => s.entries.flatMap((e) => e.items));
}

/** The `\item` lines of a plain itemize block (the Achievements section). */
export function extractPlainItems(tex: string, sectionTitle: string): string[] {
  const start = tex.indexOf(`\\section{${sectionTitle}}`);
  if (start < 0) return [];
  const rest = tex.slice(start + 1);
  const next = rest.search(/\\section\{|\\end\{document\}/);
  const block = rest.slice(0, next < 0 ? undefined : next);
  return [...block.matchAll(/^\s*\\item\s+(.+?)\s*$/gm)].map((x) => x[1]);
}

const MATH: Record<string, string> = {
  "\\times": "×",
  "\\sim": "~",
  "\\approx": "≈",
  "\\rightarrow": "→",
  "\\to": "→",
  "\\pm": "±",
  "|": "|",
};

/** Best-effort plain text of a LaTeX fragment. Numbers are kept verbatim. */
export function latexToText(latex: string): string {
  let s = latex.replace(/\\\$/g, "\u0000");
  s = s.replace(/\$([^$]*)\$/g, (_, inner: string) => {
    let t = inner.replace(/\\[A-Za-z]+|\|/g, (c) => MATH[c] ?? "");
    t = t.replace(/\^\{?([^}\s]+)\}?/g, "^$1");
    return t.replace(/\s+/g, " ").trim();
  });
  s = s.replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1");
  s = s.replace(/\\fa[A-Za-z]+\*?\\ ?/g, "");
  s = s.replace(/\\string&/g, "&");
  s = s.replace(/\\(?:textbf|emph|textit|texttt|small|scshape)\s*\{/g, "{");
  s = s.replace(/``|''/g, '"');
  s = s.replace(/\\,/g, " ").replace(/\\ /g, " ");
  s = s.replace(/\\([%&_#{}])/g, "$1");
  s = s.replace(/---/g, "—").replace(/--/g, "–");
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\u0000/g, "$");
  return s.replace(/\s+/g, " ").trim();
}
