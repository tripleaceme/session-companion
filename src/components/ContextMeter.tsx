"use client";

import type { ContextScore } from "@/lib/types";
import { TIER_COPY } from "@/lib/context-score";
import { Gauge, GaugeCompact } from "./Gauge";

/** The reading on the "Before" side: how much is known about the session. */
export function ContextMeter({
  score,
  compact = false,
}: {
  score: ContextScore;
  compact?: boolean;
}) {
  if (compact) return <GaugeCompact tier={score.tier} value={score.value} />;

  const copy = TIER_COPY[score.tier];

  return (
    <Gauge
      tier={score.tier}
      value={score.value}
      caption="Context supplied"
      statusLabel={copy.label}
      statusDetail={`${score.filledCount} of ${score.totalCount} fields`}
      verdict={copy.verdict}
      advice={copy.advice}
      ariaLabel="Context completeness"
    />
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
