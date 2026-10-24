"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildTex } from "@/lib/latex";
import { clearClock, loadProfile, saveApplication, saveProfile, seedProfile, startClock } from "@/lib/profile-store";
import { buildResume, resumeToText } from "@/lib/resume-model";
import { SAMPLES, type Sample } from "@/lib/samples";
import type { TailorResponse } from "@/lib/tailor-schemas";
import type { Fact, Profile } from "@/lib/types";
import Receipts from "./Receipts";
import ResumePreview from "./ResumePreview";

type Tab = "resume" | "match" | "cover" | "email" | "guard";
const TABS: { id: Tab; label: string }[] = [
  { id: "resume", label: "Resume" },
  { id: "match", label: "Match" },
  { id: "cover", label: "Cover note" },
  { id: "email", label: "Email" },
  { id: "guard", label: "Guard" },
];
const STEPS = ["Reading the job post", "Writing from your verified facts", "Checking every claim", "Fixing or blocking what failed"];
const STEP_AT_SECONDS = [0, 3, 12, 16];

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export default function TailorClient() {
  const [profile, setProfile] = useState<Profile>(() => seedProfile());
  const [jobText, setJobText] = useState("");
  const [steer, setSteer] = useState("");
  const [data, setData] = useState<TailorResponse | null>(null);
  const [fromSample, setFromSample] = useState<Sample | null>(null);
  const [tab, setTab] = useState<Tab>("resume");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const startedAt = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // The real profile (phone, prefs) lives only in this browser, so it can only be read after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setProfile(loadProfile()), []);

  // A link like /?sample=sde opens that saved sample straight away (handy for demos).
  useEffect(() => {
    const sample = SAMPLES.find((x) => x.id === new URLSearchParams(window.location.search).get("sample"));
    if (sample) loadSample(sample);
  }, []);

  // Progress through the pipeline steps while the one request runs.
  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setStep(STEP_AT_SECONDS.reduce((acc, at, i) => (s >= at ? i : acc), 0));
    }, 400);
    return () => clearInterval(id);
  }, [busy]);

  const model = useMemo(() => (data ? buildResume(profile, data.result) : null), [data, profile]);
  const factsById = useMemo(() => new Map(profile.facts.map((f) => [f.id, f])), [profile]);
  const facts = (ids: string[]) => ids.map((id) => factsById.get(id)).filter((f): f is Fact => !!f);
  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  function updateContact(patch: { email?: string; phone?: string }) {
    const next = { ...profile, ...patch };
    // Empty strings are stored as "not set", so the header never prints an empty slot.
    if (next.email === "") delete next.email;
    if (next.phone === "") delete next.phone;
    setProfile(next);
    saveProfile(next);
  }

  function onJobChange(v: string) {
    setJobText(v);
    if (v.trim() && !startedAt.current) startedAt.current = startClock();
  }

  async function generate() {
    if (busy) return;
    if (jobText.trim().length < 20) return setError("Paste a job post or a recruiter's email first.");
    setStep(0);
    setBusy(true);
    setError(null);
    setFromSample(null);
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, jobText, steer: steer.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `The server answered ${res.status}.`);
      setData(body as TailorResponse);
      setTab("resume");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function loadSample(s: Sample) {
    setJobText(s.jobText);
    setSteer(s.steer);
    setData(s.response);
    setFromSample(s);
    setTab("resume");
    setError(null);
    if (!startedAt.current) startedAt.current = startClock();
  }

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void generate();
    }
  };

  // ---- actions ----
  const textFor = (t: Tab): string => {
    if (!data || !model) return "";
    if (t === "resume") return resumeToText(model);
    if (t === "cover") return data.result.coverNote.paragraphs.map((p) => p.text).join("\n\n");
    if (t === "email") return data.result.email ? `Subject: ${data.result.email.subject}\n\n${data.result.email.body}` : "";
    if (t === "match")
      return data.result.match
        .map((m) => `${m.status.toUpperCase()}: ${data.analysis.requirements.find((r) => r.id === m.reqId)?.text ?? m.reqId}\n  ${m.note}`)
        .join("\n");
    return `${data.guard.verified}/${data.guard.claims} claims verified, ${data.guard.blocked.length} blocked`;
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(textFor(tab));
      flash("Copied.");
    } catch {
      flash("Copy was blocked by the browser. Select the text and copy it by hand.");
    }
  }

  const slug = (data?.analysis.company || "resume").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "resume";

  function downloadTex() {
    if (model) download(`${slug}-resume.tex`, buildTex(model), "application/x-tex");
  }

  function print() {
    setTab("resume");
    setTimeout(() => window.print(), 150);
  }

  async function downloadPdf() {
    if (!data) return;
    setNotice("Compiling with Tectonic…");
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, result: data.result }),
      });
      if (res.status === 501) {
        flash("Tectonic isn't available on this server, so I opened Print. Choose “Save as PDF”.");
        return print();
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not compile.");
      const pages = Number(res.headers.get("x-pages") ?? 1);
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href: url, download: `${slug}-resume.pdf` }).click();
      URL.revokeObjectURL(url);
      flash(pages > 1 ? `PDF saved, but it is ${pages} pages. Ask for fewer bullets.` : "PDF saved (1 page).");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not make the PDF.");
    }
  }

  function openMail() {
    const e = data?.result.email;
    if (!e) return;
    const body = e.body.length > 1800 ? e.body.slice(0, 1800) + "…" : e.body;
    window.location.href = `mailto:?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(body)}`;
  }

  function markSent() {
    if (!data) return;
    const started = startedAt.current ?? new Date().toISOString();
    const minutes = Math.max(0.1, Math.round(((Date.now() - new Date(started).getTime()) / 60000) * 10) / 10);
    saveApplication({
      id: crypto.randomUUID(),
      company: data.analysis.company || "Unknown",
      role: data.analysis.role || "Unknown",
      startedAt: started,
      sentAt: new Date().toISOString(),
      minutes,
      guard: { claims: data.guard.claims, verified: data.guard.verified, blocked: data.guard.blocked.length },
      jobExcerpt: jobText.slice(0, 300),
    });
    clearClock();
    startedAt.current = null;
    flash(`Saved to the Log: ${minutes} min from first paste to sent.`);
  }

  const g = data?.guard;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="no-print">
        <h1 className="text-2xl font-semibold tracking-tight">Tailored applications with receipts</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Paste a job post, say what to stress, and get a one-page resume, cover note and email. Every claim is checked against your verified facts.
        </p>

        <label htmlFor="job" className="mt-5 block text-sm font-medium">
          Paste a job post or a recruiter&apos;s email
        </label>
        <textarea
          id="job"
          value={jobText}
          onChange={(e) => onJobChange(e.target.value)}
          onKeyDown={onKey}
          rows={10}
          maxLength={15000}
          placeholder="Paste here…"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent p-3 text-base leading-relaxed dark:border-neutral-700"
        />

        <label htmlFor="steer" className="mt-4 block text-sm font-medium">
          Steer <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <textarea
          id="steer"
          value={steer}
          onChange={(e) => setSteer(e.target.value)}
          onKeyDown={onKey}
          rows={4}
          maxLength={2000}
          placeholder="🎙 Hold fn and talk: what should this version stress?"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent p-3 text-base leading-relaxed dark:border-neutral-700"
        />
        <p className="mt-1 text-xs text-neutral-500">The steer changes emphasis, never facts. Anything the facts don&apos;t prove is blocked.</p>

        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium">Your contact details for the resume header</summary>
          <p className="mt-1 text-xs text-neutral-500">Stays in this browser. It is never saved to the repo and never sent to the AI.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block">
              Email
              <input
                type="email"
                value={profile.email ?? ""}
                onChange={(e) => updateContact({ email: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent p-2 text-base dark:border-neutral-700"
              />
            </label>
            <label className="block">
              Phone
              <input
                type="tel"
                value={profile.phone ?? ""}
                onChange={(e) => updateContact({ phone: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent p-2 text-base dark:border-neutral-700"
              />
            </label>
          </div>
        </details>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={generate} disabled={busy} className={btnPrimary}>
            {busy ? "Working…" : "Generate"} <span className="ml-2 hidden text-xs opacity-70 sm:inline">⌘↵</span>
          </button>
          <span className="text-sm text-neutral-500">Try a sample:</span>
          {SAMPLES.map((s) => (
            <button key={s.id} onClick={() => loadSample(s)} className={btn}>
              {s.label}
            </button>
          ))}
        </div>

        {busy && (
          <ol className="mt-4 space-y-1 text-sm" aria-live="polite">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? "text-neutral-500 line-through" : i === step ? "font-semibold" : "text-neutral-400"}>
                {i < step ? "✓ " : i === step ? "… " : "· "}
                {s}
              </li>
            ))}
          </ol>
        )}

        {error && (
          <div role="alert" className="mt-4 rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-900">
            <p>{error}</p>
            <p className="mt-2">
              You can still see how it works:{" "}
              <button className="font-semibold underline" onClick={() => loadSample(SAMPLES[0])}>
                load a sample
              </button>
              .
            </p>
          </div>
        )}
      </div>

      {data && model && g && (
        <div ref={resultRef} className="mt-8 scroll-mt-4">
          <div className="no-print">
            {fromSample && (
              <p className="mb-3 rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
                This is a saved sample (real output, no API call).{" "}
                <button className="font-semibold underline" onClick={generate} disabled={busy}>
                  Run live
                </button>{" "}
                to generate it again.
              </p>
            )}
            <p className="text-sm font-medium" data-testid="guard-summary">
              {data.analysis.role} · {data.analysis.company} — {g.verified}/{g.claims} claims verified · {g.blocked.length} blocked
            </p>

            <div role="tablist" aria-label="Results" className="mt-3 flex gap-1 overflow-x-auto border-b border-neutral-300 dark:border-neutral-700">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`min-h-11 whitespace-nowrap px-3 text-sm ${tab === t.id ? "border-b-2 border-neutral-900 font-semibold dark:border-neutral-100" : "text-neutral-600 dark:text-neutral-400"}`}
                >
                  {t.label}
                  {t.id === "guard" && g.blocked.length > 0 && <span className="ml-1 rounded-full bg-amber-200 px-1.5 text-xs text-amber-900">{g.blocked.length}</span>}
                </button>
              ))}
            </div>

            <div className="my-3 flex flex-wrap gap-2">
              {tab === "resume" && (
                <>
                  <button className={btnPrimary} onClick={downloadPdf}>
                    Download PDF (Tectonic, on my Mac)
                  </button>
                  <button className={btn} onClick={print}>
                    Print / Save as PDF
                  </button>
                  <button className={btn} onClick={downloadTex}>
                    Download .tex
                  </button>
                </>
              )}
              {tab === "email" && data.result.email && (
                <button className={btnPrimary} onClick={openMail}>
                  Open in Mail
                </button>
              )}
              {tab !== "guard" && (
                <button className={btn} onClick={copy}>
                  Copy
                </button>
              )}
              <button className={btn} onClick={markSent}>
                Mark as sent
              </button>
            </div>
            {notice && (
              <p role="status" className="mb-2 rounded bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900">
                {notice}
              </p>
            )}
          </div>

          {tab === "resume" && <ResumePreview model={model} profile={profile} />}

          <div className="no-print">
            {tab === "match" && (
              <ul className="space-y-3">
                {data.result.match.map((m) => {
                  const req = data.analysis.requirements.find((r) => r.id === m.reqId);
                  const label = { met: "Met", partial: "Partial", missing: "Missing" }[m.status];
                  const tone = { met: "bg-emerald-100 text-emerald-900", partial: "bg-amber-100 text-amber-900", missing: "bg-neutral-200 text-neutral-800" }[m.status];
                  return (
                    <li key={m.reqId} className="rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
                        <span className="text-xs uppercase tracking-wide text-neutral-500">{req?.priority}</span>
                      </div>
                      <p className="mt-1 font-medium">{req?.text ?? m.reqId}</p>
                      <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{m.note}</p>
                      {m.factIds.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm underline">Receipts ({m.factIds.length})</summary>
                          <div className="mt-2 rounded bg-neutral-100 p-2 dark:bg-neutral-800">
                            <Receipts facts={facts(m.factIds)} />
                          </div>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {tab === "cover" && (
              <div className="max-w-2xl space-y-4">
                {data.result.coverNote.paragraphs.length === 0 && <p className="text-sm text-neutral-500">Every paragraph failed the fact check, so none is shown. See the Guard tab.</p>}
                {data.result.coverNote.paragraphs.map((p, i) => (
                  <div key={i}>
                    <p className="leading-relaxed">{p.text}</p>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs underline">Receipts</summary>
                      <div className="mt-2 rounded bg-neutral-100 p-2 dark:bg-neutral-800">
                        <Receipts facts={facts(p.factIds)} />
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}

            {tab === "email" &&
              (data.result.email ? (
                <div className="max-w-2xl">
                  <p className="text-sm text-neutral-500">Subject</p>
                  <p className="font-medium">{data.result.email.subject}</p>
                  <p className="mt-3 whitespace-pre-wrap leading-relaxed">{data.result.email.body}</p>
                  {/\[fill in/i.test(data.result.email.body) && <p className="mt-3 text-sm text-amber-800">Fill in the [fill in] parts before sending: they come from your preferences, which you haven&apos;t set.</p>}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs underline">Receipts</summary>
                    <div className="mt-2 rounded bg-neutral-100 p-2 dark:bg-neutral-800">
                      <Receipts facts={facts(data.result.email.factIds)} />
                    </div>
                  </details>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">The email failed the fact check and was removed. See the Guard tab.</p>
              ))}

            {tab === "guard" && (
              <div className="max-w-3xl space-y-5">
                <p className="text-lg font-semibold">
                  {g.verified}/{g.claims} claims verified · {g.blocked.length} blocked
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  A claim is a bullet, a cover-note paragraph or the email. Plain code, not the AI, checks each number, date, rank and tool against the facts it cites.
                </p>
                <section>
                  <h3 className="font-semibold">Blocked ({g.blocked.length})</h3>
                  {g.blocked.length === 0 && <p className="text-sm text-neutral-500">Nothing was blocked.</p>}
                  <ul className="mt-2 space-y-2">
                    {g.blocked.map((b, i) => (
                      <li key={i} className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-950">
                        <p className="font-medium">{b.where === "steer" ? "Your steer" : b.where}</p>
                        <p className="mt-1 break-words">{b.text}</p>
                        <ul className="mt-1 list-disc pl-5">
                          {b.reasons.map((r, j) => (
                            <li key={j}>{r}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3 className="font-semibold">Repaired once ({g.repaired.length})</h3>
                  <ul className="mt-2 space-y-2">
                    {g.repaired.map((r, i) => (
                      <li key={i} className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                        <p className="font-medium">{r.where}</p>
                        <p className="mt-1">Problem: {r.reasons.join(" ")}</p>
                        <p className="mt-1 line-through opacity-70">{r.before}</p>
                        <p className="mt-1">{r.after}</p>
                      </li>
                    ))}
                  </ul>
                </section>
                {data.warnings.length > 0 && (
                  <section>
                    <h3 className="font-semibold">Notes</h3>
                    <ul className="mt-1 list-disc pl-5 text-sm">
                      {data.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </section>
                )}
                <p className="text-xs text-neutral-500">
                  Timings: read {data.timingsMs.analyze} ms · write {data.timingsMs.compose} ms · check {data.timingsMs.guard} ms · repair {data.timingsMs.repair} ms · total {(data.timingsMs.total / 1000).toFixed(1)} s
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
