"use client";

import { memo, useState } from "react";
import { FIELDS, type FieldSpec } from "@/lib/context-score";
import type { ContextScore, SessionContext } from "@/lib/types";

interface Props {
  context: SessionContext;
  score: ContextScore;
  onChange: (patch: Partial<SessionContext>) => void;
}

export function ContextForm({ context, score, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const primary = FIELDS.filter((f) => f.primary);
  const secondary = FIELDS.filter((f) => !f.primary);
  const secondaryFilled = secondary.filter(
    (f) => (context[f.key] ?? "").trim().length >= 3,
  ).length;

  return (
    <div className="space-y-6" data-tier={score.tier}>
      <div className="space-y-5">
        {primary.map((field) => (
          <Field
            key={field.key}
            field={field}
            value={context[field.key]}
            onChange={(v) => onChange({ [field.key]: v })}
          />
        ))}
      </div>

      <div className="border-t border-rule pt-5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-baseline gap-3">
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-signal">
              {expanded ? "− " : "+ "}
              Deeper context
            </span>
            <span className="font-mono text-[0.625rem] text-ink-faint">
              {secondaryFilled}/{secondary.length} supplied
            </span>
          </span>
          <span className="text-xs text-ink-faint">
            {expanded ? "hide" : "this is where the score moves"}
          </span>
        </button>

        {expanded && (
          <div className="mt-5 space-y-5">
            {secondary.map((field, i) => (
              <div
                key={field.key}
                className="rise"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <Field
                  field={field}
                  value={context[field.key]}
                  onChange={(v) => onChange({ [field.key]: v })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Memoised because the parent re-renders on every keystroke in *any* field —
 * context lives in one object at the session level. Without this, typing into
 * the abstract also re-renders the other eight textareas.
 */
const Field = memo(function Field({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: string;
  onChange: (value: string) => void;
}) {
  const length = value.trim().length;
  const filled = length >= 3;
  const saturation = Math.min(100, Math.round((length / field.target) * 100));
  const id = `ctx-${field.key}`;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-mono text-[0.6875rem] tracking-[0.08em] text-ink">
          {field.label}
        </label>
        <span className="flex items-center gap-2">
          {/* The weight is shown so the attendee can see which gap is worth closing. */}
          <span className="font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-ink-faint">
            worth {field.weight}
          </span>
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${
              filled ? "bg-signal" : "bg-rule-strong"
            }`}
          />
        </span>
      </div>

      {field.rows > 1 ? (
        <textarea
          id={id}
          rows={field.rows}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="field"
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="field"
        />
      )}

      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <p className="text-xs leading-snug text-ink-faint">{field.hint}</p>
        {filled && (
          <span className="shrink-0 font-mono text-[0.5625rem] text-ink-faint">
            {saturation >= 100 ? "full" : `${saturation}%`}
          </span>
        )}
      </div>
    </div>
  );
});
