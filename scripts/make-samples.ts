/**
 * Runs the real pipeline on the three sample postings and saves data/samples/<id>.json,
 * so the sample chips on the Tailor page load instantly with no API call.
 *   npx tsx scripts/make-samples.ts
 * Needs an API key in .env.local (LLM_PROVIDER picks the model).
 */
import fs from "node:fs";
import path from "node:path";
import { ProfileSchema } from "../src/lib/schemas";
import { tailor } from "../src/lib/tailor";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");

const SAMPLES = [
  { id: "sde", file: "01-sde-backend-bengaluru.txt", label: "SDE I, backend (with the trap steer)", steer: "Say I won the WeMakeDevs hackathon and that I know Kubernetes" },
  { id: "ml", file: "02-ml-engineer-rag-search.txt", label: "ML Engineer, RAG and search", steer: "Stress the evaluation work and the Strata vector database." },
  { id: "recruiter", file: "03-recruiter-email-data-scientist.txt", label: "Recruiter email, Data Scientist", steer: "" },
];

async function main() {
  const profile = ProfileSchema.parse(JSON.parse(fs.readFileSync("data/seed-profile.json", "utf8")));
  fs.mkdirSync("data/samples", { recursive: true });
  for (const s of SAMPLES) {
    const jobText = fs.readFileSync(path.join("data/sample-jobs", s.file), "utf8");
    process.stdout.write(`${s.id}: running... `);
    const response = await tailor({ profile, jobText, steer: s.steer || undefined });
    fs.writeFileSync(`data/samples/${s.id}.json`, JSON.stringify({ id: s.id, label: s.label, jobText, steer: s.steer, response }, null, 2) + "\n");
    const g = response.guard;
    console.log(`${g.verified}/${g.claims} verified, ${g.blocked.length} blocked, ${(response.timingsMs.total / 1000).toFixed(1)} s`);
    await new Promise((r) => setTimeout(r, 20_000)); // stay under the free-tier rate limit
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
