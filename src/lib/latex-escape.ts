const SPECIAL: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

/** Escapes plain text for LaTeX and maps the typographic symbols the guard understands. */
export function escapeLatex(text: string): string {
  return text
    .replace(/[\\&%$#_{}~^]/g, (c) => SPECIAL[c])
    .replace(/×/g, "$\\times$")
    .replace(/→/g, "$\\rightarrow$")
    .replace(/≈/g, "$\\approx$")
    .replace(/±/g, "$\\pm$")
    .replace(/—/g, "---")
    .replace(/–/g, "--")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u201C/g, "``")
    .replace(/\u201D/g, "''")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x00-\x7F]/g, "?");
}
