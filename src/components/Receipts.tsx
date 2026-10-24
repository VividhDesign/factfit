import type { Fact } from "@/lib/types";

/** The facts a claim came from, with where each one was copied from. */
export default function Receipts({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return <p className="text-xs italic">No facts cited.</p>;
  return (
    <ul className="space-y-2">
      {facts.map((f) => (
        <li key={f.id} className="text-xs leading-snug">
          <div className="flex flex-wrap items-center gap-x-2">
            <code className="font-mono font-semibold">{f.id}</code>
            <span className={f.status === "verified" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700"}>
              {f.status === "verified" ? "✓ verified" : "needs review"}
            </span>
          </div>
          <p className="mt-0.5">{f.text}</p>
          <p className="mt-0.5 break-all opacity-60">source: {f.source}</p>
        </li>
      ))}
    </ul>
  );
}
