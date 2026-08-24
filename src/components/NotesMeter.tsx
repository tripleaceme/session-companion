"use client";

import { NOTES_TIER_COPY, type NotesScore } from "@/lib/notes-score";
import { Gauge } from "./Gauge";

/** The reading on the "After" side, in the same instrument as the Before side. */
export function NotesMeter({ score }: { score: NotesScore }) {
  const copy = NOTES_TIER_COPY[score.tier];

  return (
    <Gauge
      tier={score.tier}
      value={score.value}
      caption="Notes captured"
      statusLabel={copy.label}
      statusDetail={
        score.words ? `${score.words.toLocaleString()} words` : "nothing yet"
      }
      verdict={copy.verdict}
      advice={copy.advice}
      ariaLabel="How complete your notes are"
    />
  );
}
