"use client";

import { useMemo } from "react";
import type { ContextTier } from "@/lib/types";

const TICKS = 32;

interface GaugeProps {
  tier: ContextTier;
  /** 0-100 */
  value: number;
  /** Small engraved label above the number, e.g. "Context supplied". */
  caption: string;
  /** Tier name, shown in the live signal colour. */
  statusLabel: string;
  /** One line of counting under the tier name, e.g. "4 of 9 fields". */
  statusDetail: string;
  verdict: string;
  advice: string;
  ariaLabel: string;
}

/**
 * The shared reading — one instrument, two inputs.
 *
 * Both halves of the app make the same argument (what you get out is bounded by
 * what you put in), so both are measured by the same gauge rather than by two
 * lookalike components that would drift apart the first time one is edited.
 *
 * Discrete ticks rather than a smooth bar, deliberately: a continuous fill
 * implies a precise measurement, and these scores are heuristics. Ticks read as
 * "about this much", which is the truth.
 */
export function Gauge({
  tier,
  value,
  caption,
  statusLabel,
  statusDetail,
  verdict,
  advice,
  ariaLabel,
}: GaugeProps) {
  const litCount = Math.round((value / 100) * TICKS);
  const ticks = useMemo(
    () => Array.from({ length: TICKS }, (_, i) => i < litCount),
    [litCount],
  );

  return (
    <section data-tier={tier} className="panel ticked p-5 sm:p-6" aria-label={ariaLabel}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label">{caption}</p>
          <p className="font-display mt-1 text-4xl leading-none text-ink sm:text-5xl">
            {value}
            <span className="text-2xl text-ink-faint sm:text-3xl">/100</span>
          </p>
        </div>
        <div className="text-right">
          <p
            className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-signal"
            role="status"
          >
            {statusLabel}
          </p>
          <p className="font-mono mt-1 text-[0.625rem] text-ink-faint">{statusDetail}</p>
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
        {value} out of 100. {statusLabel}. {verdict}
      </p>

      <div className="mt-4 border-t border-rule pt-4">
        <p className="font-body text-[0.9375rem] leading-relaxed text-ink">{verdict}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-faint">{advice}</p>
      </div>
    </section>
  );
}

/** The sidebar variant — a reading small enough to sit inside a list row. */
export function GaugeCompact({ tier, value }: { tier: ContextTier; value: number }) {
  const litCount = Math.round((value / 100) * 16);

  return (
    <div data-tier={tier} className="flex items-center gap-2">
      <div className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-[2px] rounded-full transition-colors duration-500 ${
              i < litCount ? "bg-signal" : "bg-rule"
            }`}
          />
        ))}
      </div>
      <span className="font-mono text-[0.625rem] tracking-wider text-signal">{value}</span>
    </div>
  );
}
