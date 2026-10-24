export default function Placeholder({ title, blurb, phase }: { title: string; blurb: string; phase: string }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">{blurb}</p>
      <p className="mt-6 inline-block rounded border border-dashed border-neutral-400 px-3 py-1 text-sm text-neutral-500">
        Coming in {phase}
      </p>
    </section>
  );
}
