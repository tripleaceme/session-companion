"use client";

import { useState } from "react";
import type { DebriefRun, Verdict } from "@/lib/types";

const VERDICT_STYLE: Record<Verdict, { label: string; className: string; rule: string }> = {
  confirmed: {
    label: "confirmed",
    className: "text-confirmed",
    rule: "border-l border-confirmed",
  },
  contradicted: {
    label: "contradicted",
    className: "text-contradicted",
    rule: "border-l border-contradicted",
  },
  "not-covered": {
    label: "not covered",
    className: "text-uncovered",
    rule: "border-l border-dashed border-rule-strong",
  },
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function DebriefView({ run }: { run: DebriefRun }) {
  const d = run.debrief;

  const scored = d.predictionReview.length;
  const hits = d.predictionReview.filter((p) => p.verdict === "confirmed").length;

  return (
    <article className="space-y-6" data-tier="rich">
      <section className="rise">
        <p className="label">What the session actually was</p>
        <p className="mt-2 font-body text-base leading-relaxed text-ink">{d.summary}</p>
      </section>

      {/* The scoreboard: how the pre-session guesses held up against reality.
          This is the honest half of the loop — an AI feature grading its own
          earlier output against evidence the user, not the model, supplied. */}
      {scored > 0 && (
        <section className="panel ticked rise p-4" style={{ animationDelay: "60ms" }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="label">How the pre-session briefing held up</p>
            <p className="font-mono text-[0.6875rem] text-signal">
              {hits}/{scored} confirmed
            </p>
          </div>
          <ul className="mt-3 space-y-2">
            {d.predictionReview.map((p, i) => {
              const style = VERDICT_STYLE[p.verdict];
              return (
                <li key={i} className={`${style.rule} py-1.5 pl-3`}>
                  <p className="font-body text-sm leading-relaxed text-ink-dim">
                    {p.claim}
                  </p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-2">
                    <span
                      className={`font-mono text-[0.5625rem] uppercase tracking-[0.12em] ${style.className}`}
                    >
                      {style.label}
                    </span>
                    <span className="text-xs text-ink-faint">{p.note}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rise border-t border-rule pt-5" style={{ animationDelay: "120ms" }}>
        <h3 className="font-display text-xl text-ink">Key takeaways</h3>
        <ul className="mt-3 space-y-3">
          {d.takeaways.map((t, i) => (
            <li key={i} className="border-l border-rule-strong py-1 pl-3.5">
              <p className="font-mono text-[0.75rem] leading-relaxed text-signal">
                {t.point}
              </p>
              <p className="mt-1 font-body text-[0.9375rem] leading-relaxed text-ink-dim">
                {t.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rise border-t border-rule pt-5" style={{ animationDelay: "180ms" }}>
        <h3 className="font-display text-xl text-ink">Left unanswered</h3>
        <p className="mt-0.5 text-xs text-ink-faint">
          Worth catching the speaker in the hallway for.
        </p>
        <ul className="mt-3 space-y-2">
          {d.unanswered.map((u, i) => (
            <li key={i} className="border-l border-dashed border-rule-strong py-1 pl-3.5">
              <p className="font-body text-[0.9375rem] leading-relaxed text-ink">
                {u.question}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-ink-faint">{u.why}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rise border-t border-rule pt-5" style={{ animationDelay: "240ms" }}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-xl text-ink">Shareable summary</h3>
          <CopyButton text={d.linkedInPost} label="Copy post" />
        </div>
        <div className="panel mt-3 p-4">
          <p className="whitespace-pre-wrap font-body text-[0.9375rem] leading-relaxed text-ink-dim">
            {d.linkedInPost}
          </p>
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          Read it before you post it. It was written from your notes, and your notes
          are the only thing keeping it honest.
        </p>
      </section>

      <footer className="border-t border-rule pt-3">
        <p className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-ink-faint">
          {run.model} · {(run.latencyMs / 1000).toFixed(1)}s
        </p>
      </footer>
    </article>
  );
}
