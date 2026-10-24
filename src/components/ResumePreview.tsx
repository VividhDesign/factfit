"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ModelBullet, ModelEntry, ResumeModel } from "@/lib/resume-model";
import type { Entry, Fact, Profile } from "@/lib/types";
import Receipts from "./Receipts";

const dash = (s?: string) => s?.replace(/---/g, "—").replace(/--/g, "–");

function Heading({ entry }: { entry: Entry }) {
  const isSub = entry.section === "education" || entry.section === "research";
  if (!isSub) {
    return (
      <div className="rp-row">
        <span>
          <b>{entry.title}</b>
          {entry.subtitle && (
            <>
              {" | "}
              <i>{entry.subtitle}</i>
            </>
          )}
        </span>
        <span className="rp-links">
          {(entry.links ?? []).map((l, i) => (
            <span key={l.url}>
              {i > 0 && " | "}
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            </span>
          ))}
        </span>
      </div>
    );
  }
  const second = entry.section === "education" ? entry.subtitle : [entry.org, entry.subtitle].filter(Boolean).join(" — ");
  return (
    <>
      <div className="rp-row">
        <b>{entry.title}</b>
        <span>{entry.location}</span>
      </div>
      <div className="rp-row rp-small">
        <i>{second}</i>
        <i>{dash(entry.dates)}</i>
      </div>
    </>
  );
}

function Bullet({ b, facts }: { b: ModelBullet; facts: Fact[] }) {
  const [open, setOpen] = useState(false);
  return (
    <li
      className="rp-bullet"
      tabIndex={0}
      aria-label="Show where this bullet came from"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      <span dangerouslySetInnerHTML={{ __html: b.html }} />
      {open && (
        <div className="rp-receipts no-print" role="tooltip" onClick={(e) => e.stopPropagation()}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">Receipts</p>
          <Receipts facts={b.factIds.map((id) => facts.find((f) => f.id === id)).filter((f): f is Fact => !!f)} />
        </div>
      )}
    </li>
  );
}

function EntryBlock({ e, facts }: { e: ModelEntry; facts: Fact[] }) {
  return (
    <div className="rp-entry">
      <Heading entry={e.entry} />
      {e.bullets.length > 0 && (
        <ul className="rp-list">
          {e.bullets.map((b, i) => (
            <Bullet key={i} b={b} facts={facts} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ResumePreview({ model, profile }: { model: ResumeModel; profile: Profile }) {
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const el = pageRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    // Content height plus the page's own padding, against a Letter page of the same width (the page-break marker is excluded).
    const measure = () => {
      const cs = getComputedStyle(el);
      const used = content.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      setOverflow(used > el.clientWidth * (11 / 8.5) + 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [model]);

  const contact = [model.phone, model.email, ...model.links.map((l) => l.label)].filter(Boolean);

  return (
    <div>
      <p className="no-print mb-2 text-xs text-neutral-500">Hover or tap a bullet to see its receipts: the verified facts it came from.<span className="sm:hidden"> Swipe sideways to read the full page.</span></p>
      {overflow && (
        <p role="alert" className="no-print mb-2 rounded border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This resume is longer than one page. Ask for fewer bullets in the steer, or the PDF will run onto a second page.
        </p>
      )}
      <div className="no-print-scroll overflow-x-auto">
        <div className="resume-wrap">
          <div ref={pageRef} className="resume-page" id="resume-page">
            <div ref={contentRef}>
            <h1 className="rp-name">{model.name}</h1>
            <p className="rp-contact">{contact.join(" | ")}</p>
            {model.sections.map((s) => (
              <section key={s.title}>
                <h2 className="rp-h2">{s.title}</h2>
                {s.kind === "entries" && s.entries!.map((e) => <EntryBlock key={e.entry.id} e={e} facts={profile.facts} />)}
                {s.kind === "skills" && (
                  <div className="rp-skills">
                    {s.skills!.map((g) => (
                      <p key={g.label}>
                        <b>{g.label}</b>: {g.items.join(", ")}
                      </p>
                    ))}
                  </div>
                )}
                {s.kind === "list" && (
                  <ul className="rp-list rp-ach">
                    {s.items!.map((b, i) => (
                      <Bullet key={i} b={b} facts={profile.facts} />
                    ))}
                  </ul>
                )}
              </section>
            ))}
            </div>
            <div className="rp-pagebreak no-print" aria-hidden>
              <span>end of page 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
