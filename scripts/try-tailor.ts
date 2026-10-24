/**
 * Runs the real pipeline on a job file and prints a summary.
 *   npx tsx scripts/try-tailor.ts data/sample-jobs/<file>.txt [--steer "..."] [--json out.json]
 * Reads .env.local for the API key. Uses data/seed-profile.json.
 */
import fs from "node:fs";
import path from "node:path";
import { ProfileSchema } from "../src/lib/schemas";
import { tailor } from "../src/lib/tailor";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const file = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!file) {
  console.error('usage: npx tsx scripts/try-tailor.ts <job.txt> [--steer "..."] [--json out.json]');
  process.exit(1);
}

async function main() {
  const profile = ProfileSchema.parse(JSON.parse(fs.readFileSync("data/seed-profile.json", "utf8")));
  const jobText = fs.readFileSync(file, "utf8");
  const steer = flag("--steer");

  const r = await tailor({ profile, jobText, steer });
  const title = (id: string) => profile.entries.find((e) => e.id === id)?.title ?? id;
  const short = (s: string, n = 110) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  console.log(`\n${path.basename(file)}  ·  ${r.analysis.role} @ ${r.analysis.company}  ·  ${r.analysis.kind}/${r.analysis.roleFamily}`);
  if (steer) console.log(`steer: ${steer}`);

  console.log(`\nRESUME  (${r.result.bullets.length} bullets)`);
  for (const id of r.result.entryOrder) {
    console.log(`  ${title(id)}`);
    for (const b of r.result.bullets.filter((x) => x.entryId === id)) {
      console.log(`    - ${b.rewritten ? "[rewritten] " : ""}${short(b.text)}  {${b.factIds.join(", ")}}`);
    }
  }

  console.log("\nMATCH");
  for (const m of r.result.match) {
    const req = r.analysis.requirements.find((x) => x.id === m.reqId);
    console.log(`  ${m.status.padEnd(7)} ${short(req?.text ?? m.reqId, 70)}`);
  }

  console.log("\nCOVER NOTE");
  for (const p of r.result.coverNote.paragraphs) console.log(`  ${short(p.text, 200)}`);

  console.log("\nEMAIL");
  if (r.result.email) console.log(`  ${r.result.email.subject}\n  ${short(r.result.email.body.replace(/\s+/g, " "), 300)}`);
  else console.log("  (blocked)");

  console.log(`\nGUARD  ${r.guard.verified}/${r.guard.claims} claims verified  ·  ${r.guard.blocked.length} blocked  ·  ${r.guard.repaired.length} repaired`);
  for (const b of r.guard.blocked) console.log(`  BLOCKED ${b.where}: ${short(b.text, 90)}\n          ${b.reasons.join(" ")}`);
  for (const x of r.guard.repaired) console.log(`  REPAIRED ${x.where}: ${x.reasons.join(" ")}`);
  for (const w of r.warnings) console.log(`  note: ${w}`);

  const t = r.timingsMs;
  console.log(`\nTIMINGS  analyze ${t.analyze} ms · compose ${t.compose} ms · guard ${t.guard} ms · repair ${t.repair} ms · total ${(t.total / 1000).toFixed(1)} s`);

  const out = flag("--json");
  if (out) fs.writeFileSync(out, JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
