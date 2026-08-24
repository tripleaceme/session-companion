"use client";

import { useEffect, useState } from "react";

/**
 * The loading state names the stages the model genuinely moves through, in order.
 *
 * `propertyOrdering` in the response schema forces Gemini to generate the headline,
 * then the confidence judgement, then the claims, then the missing-context list —
 * so these captions describe real progress rather than decorating a spinner. An
 * app about not misleading people should not start by misleading them here.
 */
const BRIEFING_STAGES = [
  "Reading what you supplied",
  "Noting what you left out",
  "Judging how much it can honestly claim",
  "Drafting predictions",
  "Tagging each one as grounded, inferred or uncertain",
];

const DEBRIEF_STAGES = [
  "Reading your notes",
  "Pulling out what was actually argued",
  "Grading the earlier predictions against the notes",
  "Drafting something you could publish",
];

export function LoadingPanel({ mode }: { mode: "briefing" | "debrief" }) {
  const stages = mode === "briefing" ? BRIEFING_STAGES : DEBRIEF_STAGES;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Advance to the last caption and hold there rather than looping — a caption
    // that starts over implies the work restarted.
    const timer = setInterval(
      () => setIndex((i) => Math.min(i + 1, stages.length - 1)),
      1100,
    );
    return () => clearInterval(timer);
  }, [stages.length]);

  return (
    <div className="panel ticked p-6" role="status" aria-live="polite">
      <div className="relative h-[3px] overflow-hidden rounded-full bg-rule">
        <span className="sweep absolute inset-0 block" />
      </div>

      <ol className="mt-5 space-y-2">
        {stages.map((stage, i) => (
          <li
            key={stage}
            className={`flex items-baseline gap-3 transition-opacity duration-300 ${
              i <= index ? "opacity-100" : "opacity-25"
            }`}
          >
            <span
              className={`font-mono text-[0.625rem] ${
                i === index ? "text-signal blink" : "text-ink-faint"
              }`}
            >
              {i < index ? "✓" : i === index ? "▸" : "·"}
            </span>
            <span
              className={`font-mono text-[0.6875rem] tracking-[0.04em] ${
                i <= index ? "text-ink-dim" : "text-ink-faint"
              }`}
            >
              {stage}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ErrorPanel({
  error,
  hint,
  onRetry,
  onOpenSettings,
}: {
  error: string;
  hint?: string;
  onRetry?: () => void;
  onOpenSettings?: () => void;
}) {
  return (
    <div className="panel p-5" data-tier="thin" role="alert">
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-signal">
        Didn&rsquo;t work
      </p>
      <p className="mt-2 font-body text-[0.9375rem] leading-relaxed text-ink">{error}</p>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{hint}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn">
            Try again
          </button>
        )}
        {onOpenSettings && (
          <button type="button" onClick={onOpenSettings} className="btn">
            Use my own key
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="panel flex min-h-[16rem] flex-col items-center justify-center p-8 text-center">
      <p className="font-display text-2xl leading-snug text-ink">{title}</p>
      <p className="prose-body mt-2 max-w-sm text-sm">{body}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
