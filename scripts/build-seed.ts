/**
 * Builds data/seed-profile.json from the user's real resume files (read-only).
 *   npx tsx scripts/build-seed.ts [resumeDir]
 * LaTeX bullets are copied byte-for-byte; only the plain `text` is derived.
 * No phone, no prefs, no email: those stay in the browser.
 */
import fs from "node:fs";
import path from "node:path";
import { extractPlainItems, latexToText, parseResume, readGroup, type ParsedSection } from "../src/lib/tex";
import { ProfileSchema } from "../src/lib/schemas";
import type { Entry, Fact, Profile, SkillGroup } from "../src/lib/types";

const RESUME_DIR = process.argv[2] ?? "/Users/vividhyadav/Projects/resume";
const GENERAL = "vividh_yadav_resume_general.tex";
const general = fs.readFileSync(path.join(RESUME_DIR, GENERAL), "utf8");
const variants = fs.readFileSync(path.join(RESUME_DIR, "make_variants.py"), "utf8");

// ---------- sources ----------

const sections = parseResume(general);
const sec = (title: string): ParsedSection => {
  const s = sections.find((x) => x.title.startsWith(title));
  if (!s) throw new Error(`section "${title}" not found in ${GENERAL}`);
  return s;
};
const generalItem = (title: string, entry: number, item: number): string => {
  const v = sec(title).entries[entry]?.items[item];
  if (v === undefined) throw new Error(`${title}[${entry}].items[${item}] missing`);
  return v;
};

/** String literals of a top-level `NAME = [ r"...", ... ]` list in make_variants.py. */
function pyList(name: string): string[] {
  const m = new RegExp(`^${name} = (?:[A-Z_]+ \\+ )?\\[`, "m").exec(variants);
  if (!m) throw new Error(`${name} not found in make_variants.py`);
  const out: string[] = [];
  let i = m.index + m[0].length;
  while (i < variants.length) {
    if (variants[i] === "]") break;
    const lit = /^r"([^"]*)"/.exec(variants.slice(i, i + 4000));
    if (lit) {
      out.push(lit[1]);
      i += lit[0].length;
    } else i++;
  }
  return out;
}
const pyOverlay1 = () => pyList("OVERLAY_1").map((s) => s.replace("signed-off ", "")); // mirrors the script's own .replace

// ---------- how many resume copies say what (for conflicts) ----------

function texFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? texFiles(p) : d.name.endsWith(".tex") ? [p] : [];
  });
}
const copies = texFiles(RESUME_DIR).map((f) => fs.readFileSync(f, "utf8"));
const filesMatching = (re: RegExp) => copies.filter((t) => re.test(t)).length;

// ---------- entries ----------

function hrefs(latex: string): { label: string; url: string }[] {
  return [...latex.matchAll(/\\href\{([^}]*)\}\{([^}]*)\}/g)].map((m) => ({
    label: latexToText(m[2]),
    url: m[1].replace(/\\string&/g, "&"),
  }));
}

function subheadingEntry(id: string, section: Entry["section"], sectionTitle: string, idx: number): Entry {
  const e = sec(sectionTitle).entries[idx];
  const [title, location, subtitle, dates] = e.args;
  const [org, ...rest] = latexToText(subtitle).split(" — ");
  const isEdu = section === "education";
  return {
    id,
    section,
    title: latexToText(title),
    ...(isEdu ? {} : { org }),
    location: latexToText(location),
    dates,
    subtitle: isEdu ? latexToText(subtitle) : rest.join(" — ") || undefined,
    headingLatex: e.headingLatex,
  };
}

function projectEntry(id: string, section: Entry["section"], sectionTitle: string, idx: number): Entry {
  const e = sec(sectionTitle).entries[idx];
  const [head, links] = e.args;
  // The open-source heading lists several repos separated by " | "; keep it whole.
  const [title, ...sub] = section === "opensource" ? [latexToText(head)] : latexToText(head).split(" | ");
  return {
    id,
    section,
    title,
    subtitle: sub.join(" | ") || undefined,
    links: hrefs(links),
    headingLatex: e.headingLatex,
  };
}

const entries: Entry[] = [
  subheadingEntry("edu-bitm", "education", "Education", 0),
  subheadingEntry("edu-school", "education", "Education", 1),
  subheadingEntry("research-bitm", "research", "Research Experience", 0),
  projectEntry("proj-dhuaan", "projects", "Projects", 0),
  projectEntry("proj-strata", "projects", "Projects", 1),
  projectEntry("proj-evident", "projects", "Projects", 2),
  projectEntry("proj-snaplink", "projects", "Projects", 3),
  projectEntry("oss", "opensource", "Open Source", 0),
  {
    id: "proj-overlay",
    section: "projects",
    title: "OverlayAi — Floating AI Assistant",
    subtitle: "Electron, Node.js, JavaScript, Ollama, Gemini, Groq",
    links: [{ label: "GitHub", url: "https://github.com/VividhDesign/OverlayAi" }],
  },
  { id: "achievements", section: "achievements", title: "Achievements" },
];

// ---------- facts ----------

type Spec = {
  id: string;
  entryId: string;
  latex: string;
  tags: string[];
  source: string;
  roles?: string[];
  review?: Fact["alternatives"];
};

const G = (title: string, e: number, i: number) => ({
  latex: generalItem(title, e, i),
  source: `resume/${GENERAL}:${title.toLowerCase().replace(/\s+/g, "-")}[${e}].item[${i}]`,
});
const P = (name: string, i: number, latex = pyList(name)[i]) => ({
  latex,
  source: `resume/make_variants.py:${name}[${i}]`,
});

const rerankAlternatives: Fact["alternatives"] = [
  { value: "28–170×", files: filesMatching(/28--170\$\\times\$/) },
  { value: "30–170×", files: filesMatching(/30--170\$\\times\$/) },
];
const leetcodeAlternatives: Fact["alternatives"] = [
  { value: "900+ problems solved", files: filesMatching(/\\textbf\{900\+\} problems solved/) },
  { value: "LeetCode 800+ solved", files: filesMatching(/LeetCode Knight\} \(800\+ solved\)/) },
  { value: "1100+ problems overall", files: filesMatching(/1100\+ problems overall/) },
  { value: "1500+ problems solved across LeetCode, Codeforces and GeeksForGeeks", files: filesMatching(/\\textbf\{1500\+\} problems solved across/) },
];

const specs: Spec[] = [
  // Research
  { id: "research.ised.paper", entryId: "research-bitm", ...G("Research Experience", 0, 0), tags: ["IEEE ISED 2026", "paper", "Transformers", "IMU", "time series", "class imbalance", "Adaptive Temporal Windowing", "deep learning", "KFall"] },
  { id: "research.ensemble", entryId: "research-bitm", ...G("Research Experience", 0, 1), tags: ["1D-CNN", "Conformer", "late fusion", "ensemble", "balanced accuracy", "KFall", "deep learning"] },
  { id: "research.ised.paper.full", entryId: "research-bitm", ...P("RES_FULL", 0), roles: ["ml"], tags: ["IEEE ISED 2026", "paper", "Transformers", "IMU", "time series", "class imbalance", "Adaptive Temporal Windowing", "deep learning", "KFall"] },
  { id: "research.ensemble.full", entryId: "research-bitm", ...P("RES_FULL", 1), roles: ["ml"], tags: ["1D-CNN", "Conformer", "late fusion", "ensemble", "attention", "balanced accuracy", "KFall", "deep learning"] },
  { id: "research.short", entryId: "research-bitm", ...P("RES_SHORT", 0), roles: ["swe", "hft"], tags: ["IEEE ISED 2026", "paper", "Transformers", "1D-CNN", "ensemble", "IMU", "time series", "class imbalance", "deep learning"] },
  { id: "research.quant.paper", entryId: "research-bitm", ...P("RES_QUANT", 0), roles: ["quant-research"], tags: ["IEEE ISED 2026", "paper", "time series", "class imbalance", "Adaptive Temporal Windowing", "1D-CNN", "Conformer", "ensemble", "statistics"] },
  { id: "research.quant.results", entryId: "research-bitm", ...P("RES_QUANT", 1), roles: ["quant-research"], tags: ["balanced accuracy", "sensitivity", "KFall", "time series", "evaluation", "class imbalance"] },

  // Dhuaan
  { id: "dhuaan.pipeline", entryId: "proj-dhuaan", ...G("Projects", 0, 0), tags: ["AWS", "EventBridge", "Step Functions", "Lambda", "S3", "DynamoDB", "SAM", "serverless", "NumPy", "Telegram", "SNS", "data pipelines"] },
  { id: "dhuaan.backtest", entryId: "proj-dhuaan", ...G("Projects", 0, 1), tags: ["backtesting", "forecasting", "trajectory model", "NASA", "CPCB", "data analysis"] },

  // Strata
  { id: "strata.durability", entryId: "proj-strata", ...G("Projects", 1, 1), tags: ["write-ahead log", "crash recovery", "snapshots", "metadata filtering", "inverted index", "HTTP server", "JSON", "Prometheus", "Python bindings", "CI", "Linux", "macOS", "C++"] },
  { id: "strata.bench.full", entryId: "proj-strata", ...P("STRATA", 0), roles: ["swe"], tags: ["C++", "HNSW", "vector database", "FAISS", "hnswlib", "benchmark", "SIFT", "performance"] },
  { id: "strata.simd.full", entryId: "proj-strata", ...P("STRATA", 1), roles: ["swe"], tags: ["SIMD", "NEON", "AVX2", "multithreading", "spinlock", "ThreadSanitizer", "performance", "C++"] },
  { id: "strata.durability.full", entryId: "proj-strata", ...P("STRATA", 2), roles: ["swe"], tags: ["write-ahead log", "crash recovery", "snapshots", "metadata filtering", "REST server", "pybind11", "Python bindings", "C++"] },
  { id: "strata.bench.hft", entryId: "proj-strata", ...P("STRATA_HFT", 0), roles: ["hft"], tags: ["C++17", "HNSW", "FAISS", "hnswlib", "benchmark", "SIFT", "latency", "performance", "single core"] },
  { id: "strata.cache.hft", entryId: "proj-strata", ...P("STRATA_HFT", 1), roles: ["hft"], tags: ["SIMD", "NEON", "AVX2", "FMA", "cache", "prefetch", "memory layout", "performance"] },
  { id: "strata.locks.hft", entryId: "proj-strata", ...P("STRATA_HFT", 2), roles: ["hft"], tags: ["atomics", "spinlock", "memory ordering", "multithreading", "ThreadSanitizer", "concurrency", "performance"] },
  { id: "strata.server.hft", entryId: "proj-strata", ...P("STRATA_HFT", 3), roles: ["hft"], tags: ["latency", "p99", "REST server", "thread pool", "throughput", "write-ahead log", "crash recovery", "performance"] },
  { id: "strata.bench.ml", entryId: "proj-strata", ...P("STRATA_ML", 0), roles: ["ml"], tags: ["vector database", "HNSW", "FAISS", "hnswlib", "retrieval", "SIFT", "Evident", "C++"] },
  { id: "strata.kernels.ml", entryId: "proj-strata", ...P("STRATA_ML", 1), roles: ["ml"], tags: ["SIMD", "NEON", "AVX2", "multithreading", "metadata filtering", "write-ahead log", "pybind11", "NumPy"] },
  { id: "strata.bench.qr", entryId: "proj-strata", ...P("STRATA_QR", 0), roles: ["quant-research"], tags: ["HNSW", "FAISS", "hnswlib", "benchmark", "recall", "ablation", "SIFT", "C++"] },
  { id: "strata.kernels.qr", entryId: "proj-strata", ...P("STRATA_QR", 1), roles: ["quant-research"], tags: ["SIMD", "NEON", "AVX2", "multithreading", "ThreadSanitizer", "write-ahead log"] },

  // Evident
  { id: "evident.bm25", entryId: "proj-evident", ...G("Projects", 2, 0), tags: ["BM25", "Pyserini", "sparse matrix", "hybrid retrieval", "fusion", "nDCG", "Strata", "benchmarks", "information retrieval"] },
  { id: "evident.ablation", entryId: "proj-evident", ...G("Projects", 2, 1), tags: ["ablation", "rerankers", "latency", "LLM-as-judge", "evaluation", "tests", "CI"], review: rerankAlternatives },
  { id: "evident.hybrid.full", entryId: "proj-evident", ...P("EVIDENT", 0), roles: ["ml"], tags: ["RAG", "BM25", "hybrid retrieval", "embeddings", "Strata", "nDCG", "BEIR", "Pyserini", "information retrieval"] },
  { id: "evident.ablation.full", entryId: "proj-evident", ...P("EVIDENT", 1), roles: ["ml"], tags: ["ablation", "rank fusion", "cross-encoder", "rerankers", "latency", "retrieval"], review: rerankAlternatives },
  { id: "evident.judge.full", entryId: "proj-evident", ...P("EVIDENT", 2), roles: ["ml"], tags: ["LLM-as-judge", "evaluation", "faithfulness", "citation precision", "bootstrap", "RAG"] },
  { id: "evident.demo.ml", entryId: "proj-evident", ...P("EVIDENT_ML", 3, pyList("EVIDENT_ML").at(-1)), roles: ["ml"], tags: ["Streamlit", "Groq", "Gemini", "Ollama", "SQLite", "caching", "deployment", "LLM client"] },
  { id: "evident.search.swe", entryId: "proj-evident", ...P("EVIDENT_SWE", 0), roles: ["swe"], tags: ["search", "BM25", "hybrid retrieval", "sparse matrix", "embeddings", "Strata", "nDCG", "BEIR", "latency"] },
  { id: "evident.measured.swe", entryId: "proj-evident", ...P("EVIDENT_SWE", 1), roles: ["swe"], tags: ["ablation", "rerankers", "latency", "Pyserini", "LLM-as-judge", "evaluation"], review: rerankAlternatives },
  { id: "evident.demo.swe", entryId: "proj-evident", ...P("EVIDENT_SWE", 2), roles: ["swe"], tags: ["Streamlit", "LLM client", "SQLite", "caching", "deployment", "indexing"] },
  { id: "evident.eval.q", entryId: "proj-evident", ...P("EVIDENT_Q", 0), roles: ["quant-research"], tags: ["BEIR", "hybrid retrieval", "nDCG", "dev split", "grid search", "evaluation", "statistics"] },
  { id: "evident.bootstrap.q", entryId: "proj-evident", ...P("EVIDENT_Q", 1), roles: ["quant-research"], tags: ["bootstrap", "confidence intervals", "paired bootstrap", "statistics", "evaluation", "RAG"] },

  // SnapLink
  { id: "snaplink.api", entryId: "proj-snaplink", ...G("Projects", 3, 0), tags: ["REST API", "Base62", "Redis", "cache-aside", "caching", "HTTP 302", "MongoDB", "URL deduplication"] },
  { id: "snaplink.analytics", entryId: "proj-snaplink", ...G("Projects", 3, 1), tags: ["MongoDB", "aggregation pipelines", "analytics", "rate limiting", "TTL indexes", "Vercel"] },

  // OverlayAi
  { id: "overlay.build", entryId: "proj-overlay", ...P("OVERLAY", 0), roles: ["ml", "swe"], tags: ["Electron", "macOS", "global hotkeys", "IPC", "screen capture", "Gemini", "Groq", "Ollama", "streaming", "LLM client"] },
  { id: "overlay.ship", entryId: "proj-overlay", ...P("OVERLAY", 1), roles: ["ml", "swe"], tags: ["Electron", "packaging", "GitHub Releases", "macOS", "Apple Silicon", "Intel"] },
  { id: "overlay.short", entryId: "proj-overlay", ...P("OVERLAY_1", 0, pyOverlay1()[0]), roles: ["ml", "swe"], tags: ["Electron", "macOS", "global hotkeys", "screen capture", "Gemini", "Groq", "Ollama", "streaming", "GitHub Releases"] },

  // Open source
  { id: "oss.usearch", entryId: "oss", ...G("Open Source", 0, 0), tags: ["USearch", "C++", "open source", "bug fix"] },
  { id: "oss.sktime", entryId: "oss", ...G("Open Source", 0, 1), tags: ["sktime", "skpro", "Python", "open source", "bug fix", "time series"] },

  // Achievements (plain \item lines)
  ...(() => {
    const items = extractPlainItems(general, "Achievements");
    if (items.length !== 3) throw new Error(`expected 3 achievements, got ${items.length}`);
    const src = (i: number) => `resume/${GENERAL}:achievements[${i}]`;
    return [
      { id: "ach.runnerup", entryId: "achievements", latex: items[0], source: src(0), tags: ["hackathon", "runner-up", "WeMakeDevs", "AWS", "leadership", "team lead"] },
      { id: "ach.leetcode", entryId: "achievements", latex: items[1], source: src(1), tags: ["LeetCode", "competitive programming", "DSA"], review: leetcodeAlternatives },
      { id: "ach.natwest", entryId: "achievements", latex: items[2], source: src(2), tags: ["hackathon", "NatWest", "Code for Purpose", "AI solution design"] },
    ] satisfies Spec[];
  })(),
];

const facts: Fact[] = [];
for (const s of specs) {
  const dup = facts.find((f) => f.latex === s.latex);
  if (dup) {
    dup.roles = [...new Set([...(dup.roles ?? []), ...(s.roles ?? [])])];
    continue;
  }
  facts.push({
    id: s.id,
    entryId: s.entryId,
    text: latexToText(s.latex),
    latex: s.latex,
    tags: s.tags,
    ...(s.roles ? { roles: s.roles } : {}),
    status: s.review ? "needs_review" : "verified",
    source: s.source,
    ...(s.review ? { alternatives: s.review } : {}),
  });
}

// Confirmed by the user (CLAUDE.md rule 3). No LaTeX: these come from the headings.
const confirmed = (id: string, entryId: string, text: string, tags: string[], where: string): Fact => ({
  id, entryId, text, tags, status: "verified", source: `resume/${GENERAL}:${where}; confirmed by user`,
});
facts.unshift(
  confirmed("edu.cgpa", "edu-bitm", "CGPA 8.73/10 in B.Tech in Artificial Intelligence & Machine Learning, Birla Institute of Technology, Mesra.", ["CGPA", "education", "B.Tech"], "education[0]"),
  confirmed("edu.grad", "edu-bitm", "B.Tech in Artificial Intelligence & Machine Learning, Birla Institute of Technology, Mesra, Aug 2023 – May 2027.", ["education", "B.Tech", "graduation"], "education[0]"),
  confirmed("edu.class12", "edu-school", "Class XII, ISC Board: 91.25% (2022), St. Joseph's College, Allahabad.", ["education", "school"], "education[1]"),
  confirmed("edu.class10", "edu-school", "Class X, ICSE Board: 87.16% (2020), St. Joseph's College, Allahabad.", ["education", "school"], "education[1]"),
  confirmed("research.internship", "research-bitm", "Undergraduate Research Intern, Deep Learning & Temporal Architectures, Birla Institute of Technology, Mesra, Jan 2026 – Jul 2026 (ended), supervised by Prof. Saikat Chakraborty.", ["research", "internship", "deep learning"], "research[0]"),
  confirmed("dhuaan.award", "proj-dhuaan", "Runner-up, WeMakeDevs × AWS (Environmental Hacks, Bharat Builds 2026), led a team of 4.", ["hackathon", "runner-up", "WeMakeDevs", "AWS", "leadership"], "projects[0]"),
  confirmed("oss.count", "oss", "4 merged pull requests across USearch, sktime and skpro.", ["open source", "pull requests"], "open-source heading"),
);

// ---------- skills, links, name ----------

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const c of s) {
    if (c === "(") depth++;
    if (c === ")") depth--;
    if ((c === "," || c === ";") && depth === 0) { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

const skillsBlock = general.slice(general.indexOf("\\section{Technical Skills}"), general.indexOf("\\section{Achievements}"));
const skills: SkillGroup[] = [...skillsBlock.matchAll(/\\textbf(?=\{)/g)].map((m) => {
  const label = readGroup(skillsBlock, m.index + m[0].length);
  const items = readGroup(skillsBlock, label.end);
  return { label: latexToText(label.content), items: splitTop(latexToText(items.content.replace(/^:\s*/, ""))) };
});

const center = general.slice(general.indexOf("\\begin{center}"), general.indexOf("\\end{center}"));
const name = /\\scshape ([^}]+)\}/.exec(center)?.[1].trim();
if (!name) throw new Error("name not found in heading");
const links = [...center.matchAll(/\\href\{(https?:[^}]*)\}\{\\(fa[A-Za-z]+)\\ ([^}]*)\}/g)].map((m) => ({
  label: m[3], url: m[1], icon: m[2],
}));

const profile: Profile = { version: 1, name, links, entries, facts, skills, prefs: {} };
const parsed = ProfileSchema.parse(profile);

const out = path.join(import.meta.dirname, "..", "data", "seed-profile.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(parsed, null, 2) + "\n");

// The LaTeX preamble, byte-for-byte, so the app can build a .tex on a server that has no access to the resume folder.
// Lines 1-2 are the template attribution; line 3 names one employer, so it is left out.
const lines = general.split("\n");
const preamble = lines.slice(0, 2).join("\n") + "\n\n" + general.slice(general.indexOf("\\documentclass"), general.indexOf("\\begin{document}"));
fs.writeFileSync(
  path.join(import.meta.dirname, "..", "src", "lib", "preamble.ts"),
  `// Generated by scripts/build-seed.ts from ${GENERAL}. Do not edit.\nexport const PREAMBLE = ${JSON.stringify(preamble)};\n`,
);

console.log(`wrote ${path.relative(process.cwd(), out)}: ${parsed.entries.length} entries, ${parsed.facts.length} facts, ${parsed.skills.length} skill groups`);
console.log(`scanned ${copies.length} .tex copies under ${RESUME_DIR}`);
for (const f of parsed.facts.filter((x) => x.status === "needs_review")) {
  console.log(`needs_review ${f.id}: ${f.alternatives?.map((a) => `${a.value} (${a.files} files)`).join(" | ")}`);
}
