/** Server-only: compile a .tex with a local tectonic. Not available on Vercel, where the API answers 501. */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function tectonicPath(): string | null {
  const candidates = [process.env.TECTONIC_PATH, "/opt/homebrew/bin/tectonic", "/usr/local/bin/tectonic"];
  return candidates.find((p): p is string => !!p && existsSync(p)) ?? null;
}

export interface Compiled {
  pdf: Buffer;
  pages: number;
}

export async function compileTex(tex: string, timeoutMs = 120_000): Promise<Compiled> {
  const bin = tectonicPath();
  if (!bin) throw new Error("tectonic is not installed");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "factfit-"));
  try {
    await fs.writeFile(path.join(dir, "resume.tex"), tex);
    await new Promise<void>((resolve, reject) => {
      const p = spawn(bin, ["--keep-logs", "resume.tex"], { cwd: dir });
      let err = "";
      p.stderr.on("data", (d) => (err += d));
      const timer = setTimeout(() => {
        p.kill();
        reject(new Error("tectonic timed out"));
      }, timeoutMs);
      p.on("error", reject);
      p.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`tectonic failed: ${err.slice(-400)}`));
      });
    });
    const pdf = await fs.readFile(path.join(dir, "resume.pdf"));
    const log = await fs.readFile(path.join(dir, "resume.log"), "utf8").catch(() => "");
    const pages = Number(/Output written on resume\.xdv \((\d+) page/.exec(log)?.[1] ?? 0);
    return { pdf, pages };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
