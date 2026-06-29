import { GRADIENT_TEXT } from "./_shared";

/** Section heading eyebrow + title + optional lead, used by every section. */
export function SectionHeading({
  eyebrow,
  title,
  highlight,
  lead,
}: {
  eyebrow: string;
  title: string;
  highlight?: string;
  lead?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-sky-300/90">
        {eyebrow}
      </span>
      <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
        {title}
        {highlight ? (
          <>
            {" "}
            <span className={GRADIENT_TEXT}>{highlight}</span>
          </>
        ) : null}
      </h2>
      {lead ? (
        <p className="mt-4 text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">
          {lead}
        </p>
      ) : null}
    </div>
  );
}
