"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Tailor" },
  { href: "/facts", label: "Facts" },
  { href: "/log", label: "Log" },
  { href: "/audit", label: "Audit" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          FactFit
        </Link>
        <nav className="flex gap-4 text-sm" aria-label="Main">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={active ? "font-semibold underline underline-offset-4" : "text-neutral-600 hover:underline dark:text-neutral-400"}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <a
          href="https://github.com/VividhDesign/factfit#built-by-voice-with-wispr-flow"
          className="ml-auto text-xs text-neutral-500 hover:underline"
        >
          Built by voice with Wispr Flow
        </a>
      </div>
    </header>
  );
}
