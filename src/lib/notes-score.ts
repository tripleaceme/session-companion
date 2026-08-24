import { tierOf } from "./context-score";
import type { ContextTier } from "./types";

/**
 * How much the attendee actually wrote down.
 *
 * The mirror of the context score, and it exists for the same reason: the
 * debrief is bounded by its input just as the briefing is. Four bullet points
 * cannot produce a summary with detail in it, and the honest thing is to say so
 * before the model is asked rather than to let a thin summary imply a thin talk.
 *
 * Same square-root curve as the context score, so the two gauges behave alike:
 * early writing counts for a lot and padding counts for very little.
 */

/** Characters at which notes count as a complete record. */
const TARGET_CHARS = 1400;
/** Below this, the notes are a fragment and score nothing. */
const FLOOR_CHARS = 20;

export interface NotesScore {
  value: number;
  tier: ContextTier;
  chars: number;
  words: number;
}

export function scoreNotes(notes: string): NotesScore {
  const trimmed = notes.trim();
  const chars = trimmed.length;
  const words = trimmed ? trimmed.split(/\s+/).length : 0;

  const ratio = chars < FLOOR_CHARS ? 0 : Math.min(1, chars / TARGET_CHARS);
  const value = Math.round(100 * Math.sqrt(ratio));

  return { value, tier: tierOf(value), chars, words };
}

export const NOTES_TIER_COPY: Record<
  ContextTier,
  { label: string; verdict: string; advice: string }
> = {
  thin: {
    label: "Sparse notes",
    verdict: "Not much here to work from.",
    advice:
      "Whatever is missing will show up as a gap in the summary rather than as invented detail. Add a few lines, or photograph the page you wrote on.",
  },
  partial: {
    label: "Partial notes",
    verdict: "Enough for a summary, not yet for detail.",
    advice:
      "Add what surprised you and anything the speaker dodged — that is usually what makes a takeaway worth sharing.",
  },
  rich: {
    label: "Full notes",
    verdict: "Plenty to work from.",
    advice:
      "Enough to summarise honestly, and to grade the pre-session predictions against what was actually said.",
  },
};
