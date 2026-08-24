"use client";

import { useMemo } from "react";
import type { Briefing, BriefingRun, Grounding, Prediction } from "@/lib/types";

const GROUNDING_COPY: Record<Grounding, { label: string; meaning: string }> = {
  grounded: { label: "grounded", meaning: "restates something you supplied" },
  inferred: { label: "inferred", meaning: "a short step from what you supplied" },
  speculation: { label: "uncertain", meaning: "the topic name and general knowledge" },
};

export function GroundingTag({ value }: { value: Grounding }) {
  const copy = GROUNDING_COPY[value];
  return (
    <span className={`tag tag-${value}`} title={`Based on: ${copy.meaning}`}>
      {copy.label}
    </span>
  );
}

/** A single prediction, whose left rule and opacity encode how much to trust it. */
function ClaimRow({ item }: { item: Prediction }) {
  return (
    <li className={`claim-${item.grounding} py-2 pl-3.5`}>
      <p className="font-body text-[0.9375rem] leading-relaxed text-ink">{item.claim}</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-2">
        <GroundingTag value={item.grounding} />
        <span className="font-mono text-[0.625rem] text-ink-faint">
          from {item.basedOn}
        </span>
      </p>
    </li>
  );
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-rule pt-5">
      <h3 className="font-display text-xl text-ink">{title}</h3>
      {caption && <p className="mt-0.5 text-xs text-ink-faint">{caption}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * The grounding ledger — a tally of how the model classified its own claims.
 *
 * This is the number the talk actually turns on. Run the same session at 10/100
 * and 95/100 context and this row goes from almost all guesses to almost all
 * grounded, without a single word of the prompt changing.
 */
export function GroundingLedger({ briefing }: { briefing: Briefing }) {
  const counts = useMemo(() => {
    const all: Grounding[] = [
      ...briefing.likelyCoverage.map((p) => p.grounding),
      ...briefing.payAttentionTo.map((p) => p.grounding),
      ...briefing.questions.map((q) => q.grounding),
    ];
    return {
      grounded: all.filter((g) => g === "grounded").length,
      inferred: all.filter((g) => g === "inferred").length,
      speculation: all.filter((g) => g === "speculation").length,
      total: all.length,
    };
  }, [briefing]);

  const segments = [
    { key: "grounded", n: counts.grounded, className: "bg-rich" },
    { key: "inferred", n: counts.inferred, className: "bg-partial" },
    { key: "speculation", n: counts.speculation, className: "bg-thin" },
  ];

  return (
    <div className="panel p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">Grounding ledger</p>
        <p className="font-mono text-[0.625rem] text-ink-faint">
          {counts.total} claims
        </p>
      </div>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-rule" aria-hidden>
        {segments.map((s) =>
          s.n ? (
            <span
              key={s.key}
              className={`${s.className} transition-[flex-grow] duration-700`}
              style={{ flexGrow: s.n }}
            />
          ) : null,
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        {segments.map((s) => (
          <div key={s.key}>
            <dt className="font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-ink-faint">
              {s.key === "speculation" ? "uncertain" : s.key}
            </dt>
            <dd className="font-display text-2xl leading-none text-ink">{s.n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function BriefingView({ run }: { run: BriefingRun }) {
  const b = run.briefing;

  const confidenceTier =
    b.confidence === "high" ? "rich" : b.confidence === "medium" ? "partial" : "thin";

  return (
    <article className="space-y-6" data-tier={confidenceTier}>
      <header className="rise">
        <p className="label">The model&rsquo;s read on this session</p>
        <h2 className="font-display mt-2 text-2xl leading-snug text-ink sm:text-3xl">
          {b.headline}
        </h2>
      </header>

      {/* The self-assessment sits above the content, not buried under it. If the
          model thinks it is guessing, that should be the first thing you read. */}
      <div className="panel ticked rise p-4" style={{ animationDelay: "60ms" }}>
        <p className="flex items-center gap-2">
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-signal">
            {b.confidence} confidence
          </span>
          <span className="h-px flex-1 bg-rule" />
        </p>
        <p className="mt-2 font-body text-[0.9375rem] leading-relaxed text-ink-dim">
          {b.confidenceRationale}
        </p>
      </div>

      <div className="rise" style={{ animationDelay: "120ms" }}>
        <GroundingLedger briefing={b} />
      </div>

      <div className="rise space-y-6" style={{ animationDelay: "180ms" }}>
        <Section
          title="What it will probably cover"
          caption="Check the tag on each line before you rely on it."
        >
          <ul className="space-y-1">
            {b.likelyCoverage.map((item, i) => (
              <ClaimRow key={i} item={item} />
            ))}
          </ul>
        </Section>

        <Section title="What to pay attention to">
          <ul className="space-y-1">
            {b.payAttentionTo.map((item, i) => (
              <ClaimRow key={i} item={item} />
            ))}
          </ul>
        </Section>

        <Section
          title="Worth understanding beforehand"
          caption="Skim these on the way to the room."
        >
          <ul className="space-y-3">
            {b.prerequisites.map((p, i) => (
              <li key={i} className="panel p-3.5">
                <p className="font-mono text-[0.75rem] tracking-[0.04em] text-signal">
                  {p.concept}
                </p>
                <p className="mt-1.5 font-body text-[0.9375rem] leading-relaxed text-ink">
                  {p.primer}
                </p>
                <p className="mt-1.5 text-xs leading-snug text-ink-faint">{p.why}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Questions you could ask"
          caption="Tap to copy, then go and stand by the microphone."
        >
          <ul className="space-y-2">
            {b.questions.map((q, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(q.question)}
                  className="panel w-full p-3.5 text-left transition-colors hover:border-signal"
                >
                  <p className="font-body text-[0.9375rem] leading-relaxed text-ink">
                    &ldquo;{q.question}&rdquo;
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-2">
                    <GroundingTag value={q.grounding} />
                    <span className="text-xs text-ink-faint">{q.why}</span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </Section>

        {/* The loop-closer: the model naming its own blind spots as a to-do list. */}
        <Section
          title="What would make this better"
          caption="Paste any of these in above and run it again — then compare the two."
        >
          <ul className="space-y-2">
            {b.missingContext.map((m, i) => (
              <li
                key={i}
                className="flex gap-3 border-l border-dashed border-rule-strong py-1.5 pl-3.5"
              >
                <span className="font-mono text-[0.625rem] leading-6 text-signal">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-body text-[0.9375rem] leading-relaxed text-ink">
                    {m.ask}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-ink-faint">
                    {m.whyItHelps}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <footer className="border-t border-rule pt-3">
        <p className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-ink-faint">
          {run.model} · {(run.latencyMs / 1000).toFixed(1)}s · context {run.score.value}/100
        </p>
      </footer>
    </article>
  );
}
