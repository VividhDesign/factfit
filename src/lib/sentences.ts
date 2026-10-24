/**
 * Keeps the good sentences of a paragraph or an email and reports the bad ones.
 * Works line by line so a numbered reply ("1. ... 2. ...") keeps its numbers and order.
 */
export function dropSentences(text: string, isBad: (sentence: string) => boolean): { kept: string; dropped: string[] } {
  const dropped: string[] = [];
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    const m = /^(\s*\d{1,2}[.)]\s+)?(.*)$/.exec(line)!;
    const sentences = m[2].split(/(?<=[.!?])\s+(?=[A-Z"'[(])/).filter((s) => s.trim());
    if (sentences.length === 0) {
      lines.push(line); // a blank line stays, so paragraphs stay apart
      continue;
    }
    const good = sentences.filter((s) => {
      const bad = isBad(s);
      if (bad) dropped.push(s.trim());
      return !bad;
    });
    if (good.length) lines.push((m[1] ?? "") + good.join(" "));
  }
  return { kept: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), dropped };
}
