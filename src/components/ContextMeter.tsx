"use client";

import { useMemo } from "react";
import type { ContextScore } from "@/lib/types";
import { TIER_COPY } from "@/lib/context-score";

const TICKS = 32;

/**
 * The context gauge.
 *
 * Rendered as discrete ticks rather than a smooth progress bar for two reasons.
 * One is aesthetic — it belongs to the instrument metaphor. The other matters
 * more: a continuous bar implies a continuous, precise measurement, and this
 * score is a heuristic. Ticks read as "about this much", which is the truth.
 */
export function ContextMeter({
  score,
  compact = false,
}: {
  score: ContextScore;
  compact?: boolean;
}) {
  const copy = TIER_COPY[score.tier];
  const litCount = Math.round((score.value / 100) * TICKS);

  const ticks = useMemo(
    () => Array.from({ length: TICKS }, (_, i) => i < litCount),
    [litCount],
  );

  if (compact) {
    return (
      <div data-tier={score.tier} className="flex items-center gap-2">
        <div className="flex gap-[2px]" aria-hidden>
          {ticks.slice(0, 16).map((lit, i) => (
            <span
              key={i}
              className={`h-3 w-[2px] rounded-full transition-colors duration-500 ${
                lit ? "bg-signal" : "bg-rule"
              }`}
            />
          ))}
        </div>
        <span className="font-mono text-[0.625rem] tracking-wider text-signal">
          {score.value}
        </span>
      </div>
    );
  }

  return (
    <section
      data-tier={score.tier}
      className="panel ticked p-5 sm:p-6"
      aria-label="Context completeness"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label">Context supplied</p>
          <p className="font-display mt-1 text-4xl leading-none text-ink sm:text-5xl">
            {score.value}
            <span className="text-ink-faint text-2xl sm:text-3xl">/100</span>
          </p>
        </div>
        <div className="text-right">
          <p
            className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-signal"
            role="status"
          >
            {copy.label}
          </p>
          <p className="font-mono mt-1 text-[0.625rem] text-ink-faint">
            {score.filledCount} of {score.totalCount} fields
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-[3px]" aria-hidden>
        {ticks.map((lit, i) => (
          <span
            key={i}
            style={{ transitionDelay: `${i * 14}ms` }}
            className={`h-6 flex-1 rounded-[1px] transition-colors duration-500 ${
              lit ? "bg-signal" : "bg-rule"
            }`}
          />
        ))}
      </div>

      {/* Screen readers get the number and the judgement, not 32 ticks. */}
      <p className="sr-only">
        Context completeness {score.value} out of 100. {copy.label}. {copy.verdict}
      </p>

      <div className="mt-4 border-t border-rule pt-4">
        <p className="font-body text-[0.9375rem] leading-relaxed text-ink">
          {copy.verdict}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-faint">{copy.advice}</p>
      </div>
    </section>
  );
}

/** Per-field contribution bars — shows *which* gap is costing the most. */
export function ContextBreakdown({ score }: { score: ContextScore }) {
  const ranked = [...score.parts].sort(
    (a, b) => b.weight - b.earned - (a.weight - a.earned),
  );

  return (
    <div data-tier={score.tier} className="space-y-2">
      <p className="label">Where the gaps are</p>
      {ranked.map((part) => {
        const pct = Math.round((part.earned / part.weight) * 100);
        return (
          <div key={part.key} className="flex items-center gap-3">
            <span className="w-36 shrink-0 truncate font-mono text-[0.625rem] text-ink-faint">
              {part.label}
            </span>
            <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-rule">
              <span
                className="block h-full rounded-full bg-signal transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right font-mono text-[0.625rem] text-ink-faint">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
