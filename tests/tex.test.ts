import { describe, expect, it } from "vitest";
import { extractItems, extractPlainItems, latexToText, parseResume, readGroup } from "@/lib/tex";

const SAMPLE = String.raw`\documentclass{article}
\newcommand{\resumeItem}[1]{\item #1}
\begin{document}
%\resumeItem{commented out}
\section{Projects}
  \resumeProjectHeading
      {\textbf{Strata} $|$ \emph{C++17}}{\href{https://github.com/x/strata}{\faGithub\ GitHub}}
      \resumeItemListStart
        \resumeItem{Built \textbf{HNSW} with \texttt{\{braces\}} and 50\% faster (11--15$\times$).}
        \resumeItem{Second {nested {deep}} item.}
      \resumeItemListEnd
\section{Research}
  \resumeSubheading
    {Intern}{Ranchi}
    {BIT Mesra}{Jan 2026 -- Jul 2026}
    \resumeItem{Paper accepted.}
\section{Achievements}
 \begin{itemize}
    \small{
    \item \textbf{Runner-up} --- Hacks.
    \item Top \textbf{1\%} nationally.
    }
 \end{itemize}
\end{document}
`;

describe("readGroup", () => {
  it("handles nesting and escaped braces", () => {
    const s = String.raw`{a \{ b {c} \} d} tail`;
    expect(readGroup(s, 0).content).toBe(String.raw`a \{ b {c} \} d`);
  });
  it("ignores braces inside % comments", () => {
    expect(readGroup("{a % }\n b}", 0).content).toBe("a % }\n b");
  });
  it("throws on unbalanced input", () => {
    expect(() => readGroup("{a {b}", 0)).toThrow();
  });
});

describe("parseResume", () => {
  const sections = parseResume(SAMPLE);
  it("finds sections in order and skips commented macros", () => {
    expect(sections.map((s) => s.title)).toEqual(["Projects", "Research", "Achievements"]);
    expect(extractItems(SAMPLE)).toHaveLength(3);
  });
  it("returns item bodies byte-for-byte", () => {
    expect(sections[0].entries[0].items[0]).toBe(
      String.raw`Built \textbf{HNSW} with \texttt{\{braces\}} and 50\% faster (11--15$\times$).`,
    );
    expect(sections[0].entries[0].items[1]).toBe("Second {nested {deep}} item.");
  });
  it("reads heading arguments and keeps the heading source", () => {
    const p = sections[0].entries[0];
    expect(p.kind).toBe("projectHeading");
    expect(p.args).toHaveLength(2);
    expect(p.headingLatex.startsWith(String.raw`\resumeProjectHeading`)).toBe(true);
    const s = sections[1].entries[0];
    expect(s.kind).toBe("subheading");
    expect(s.args).toEqual(["Intern", "Ranchi", "BIT Mesra", "Jan 2026 -- Jul 2026"]);
  });
});

describe("extractPlainItems", () => {
  it("returns the \\item lines of a section", () => {
    expect(extractPlainItems(SAMPLE, "Achievements")).toEqual([
      String.raw`\textbf{Runner-up} --- Hacks.`,
      String.raw`Top \textbf{1\%} nationally.`,
    ]);
  });
});

describe("latexToText", () => {
  it.each([
    [String.raw`11--15$\times$ faster`, "11–15× faster"],
    [String.raw`\textbf{97.03\%} and \textbf{628\,ms}`, "97.03% and 628 ms"],
    [String.raw`62$^6 \approx$ 56.8B`, "62^6 ≈ 56.8B"],
    [String.raw`\texttt{\$inc} counts`, "$inc counts"],
    [String.raw`3.5K$\to$10.8K`, "3.5K→10.8K"],
    [String.raw`\textbf{\faTrophy\ Runner-up}, WeMakeDevs $\times$ AWS`, "Runner-up, WeMakeDevs × AWS"],
    [String.raw`Class XII --- ISC $|$ Class X`, "Class XII — ISC | Class X"],
  ])("%s", (input, expected) => {
    expect(latexToText(input)).toBe(expected);
  });
});
