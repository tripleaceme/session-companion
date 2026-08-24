"use client";

import type { BriefingRun, Grounding } from "@/lib/types";
import { GroundingLedger, GroundingTag } from "./BriefingView";
import { TIER_COPY } from "@/lib/context-score";

/** Horizontal strip of every generation in this session, oldest to newest. */
export function RunStrip({
  runs,
  selectedId,
  onSelect,
  compareId,
  onToggleCompare,
}: {
  runs: BriefingRun[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  compareId: string | null;
  onToggleCompare: (id: string) => void;
}) {
  if (runs.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">Runs in this session</p>
        {runs.length > 1 && (
          <p className="font-mono text-[0.5625rem] text-ink-faint">
            shift-click a second run to compare
          </p>
        )}
      </div>

      <ol className="mt-2 flex gap-2 overflow-x-auto pb-2">
        {runs.map((run, i) => {
          const isSelected = run.id === selectedId;
          const isCompare = run.id === compareId;
          return (
            <li key={run.id} className="shrink-0">
              <button
                type="button"
                data-tier={run.score.tier}
                onClick={(e) => {
                  if (e.shiftKey && runs.length > 1) onToggleCompare(run.id);
                  else onSelect(run.id);
                }}
                aria-current={isSelected}
                className={`panel min-w-[7.5rem] px-3 py-2 text-left transition-all ${
                  isSelected
                    ? "border-signal"
                    : isCompare
                      ? "border-dashed border-signal"
                      : "hover:border-rule-strong"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-ink-faint">
                    run {String(i + 1).padStart(2, "0")}
                  </span>
                  {isCompare && (
                    <span className="font-mono text-[0.5rem] uppercase text-signal">vs</span>
                  )}
                </span>
                <span className="font-display block text-2xl leading-none text-signal">
                  {run.score.value}
                </span>
                <span className="mt-0.5 block font-mono text-[0.5625rem] text-ink-faint">
                  {TIER_COPY[run.score.tier].label.replace(" context", "")}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function tally(run: BriefingRun) {
  const all: Grounding[] = [
    ...run.briefing.likelyCoverage.map((p) => p.grounding),
    ...run.briefing.payAttentionTo.map((p) => p.grounding),
    ...run.briefing.questions.map((q) => q.grounding),
  ];
  const speculation = all.filter((g) => g === "speculation").length;
  return {
    total: all.length,
    speculation,
    pct: all.length ? Math.round((speculation / all.length) * 100) : 0,
  };
}

/**
 * Two runs, side by side.
 *
 * This view is the argument. Nothing about the model or the prompt differs
 * between the columns — only the context does. The delta strip at the top puts
 * a number on it so nobody has to take the point on faith.
 */
export function CompareView({ a, b }: { a: BriefingRun; b: BriefingRun }) {
  // Always read left-to-right as less context → more context.
  const [left, right] = a.score.value <= b.score.value ? [a, b] : [b, a];
  const leftTally = tally(left);
  const rightTally = tally(right);

  const contextDelta = right.score.value - left.score.value;
  const specDelta = rightTally.pct - leftTally.pct;

  return (
    <div className="space-y-5">
      <div className="panel p-4" data-tier={right.score.tier}>
        <p className="label">What changed</p>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-ink-faint">
              Context
            </dt>
            <dd className="font-display text-3xl leading-none text-ink">
              {contextDelta > 0 ? "+" : ""}
              {contextDelta}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-ink-faint">
              Uncertain claims
            </dt>
            <dd className="font-display text-3xl leading-none text-ink">
              {specDelta > 0 ? "+" : ""}
              {specDelta}
              <span className="text-lg text-ink-faint">%</span>
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-ink-faint">
              Confidence
            </dt>
            <dd className="font-mono text-sm text-ink">
              {left.briefing.confidence} → {right.briefing.confidence}
            </dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-rule pt-3 text-xs leading-relaxed text-ink-faint">
          Same model, same prompt, same session. The only variable is how much you told it.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {[left, right].map((run, i) => (
          <div key={run.id} data-tier={run.score.tier} className="space-y-4">
            <div className="flex items-baseline justify-between gap-2 border-b border-rule pb-2">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-signal">
                {i === 0 ? "Less context" : "More context"} · {run.score.value}/100
              </p>
              <p className="font-mono text-[0.5625rem] text-ink-faint">
                {leftTally.total ? `${tally(run).speculation} uncertain` : ""}
              </p>
            </div>

            <p className="font-display text-lg leading-snug text-ink">
              {run.briefing.headline}
            </p>

            <GroundingLedger briefing={run.briefing} />

            <div>
              <p className="label">What it will probably cover</p>
              <ul className="mt-2 space-y-1">
                {run.briefing.likelyCoverage.map((item, j) => (
                  <li key={j} className={`claim-${item.grounding} py-1.5 pl-3`}>
                    <p className="font-body text-sm leading-relaxed text-ink">
                      {item.claim}
                    </p>
                    <p className="mt-1">
                      <GroundingTag value={item.grounding} />
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="label">Questions it suggested</p>
              <ul className="mt-2 space-y-2">
                {run.briefing.questions.slice(0, 3).map((q, j) => (
                  <li key={j} className="text-sm leading-relaxed text-ink-dim">
                    &ldquo;{q.question}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
