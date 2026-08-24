import {
  type ContextKey,
  type ContextScore,
  type ContextTier,
  type SessionContext,
} from "./types";

export interface FieldSpec {
  key: ContextKey;
  label: string;
  hint: string;
  placeholder: string;
  /** Share of the 100-point context budget this field can contribute. */
  weight: number;
  /** Characters at which this field is considered "fully supplied". */
  target: number;
  rows: number;
  /** Fields we show first, before the attendee expands the rest. */
  primary: boolean;
}

/**
 * Weights are opinionated: a real speaker bio and a link to past work move the
 * needle far more than a job title, because they are what let the model stop
 * guessing and start grounding. Ordering here is the on-screen order.
 */
export const FIELDS: FieldSpec[] = [
  {
    key: "title",
    label: "Session title",
    hint: "The talk as it appears on the schedule.",
    placeholder: "Designing AI Features When the Model Doesn't Know Enough",
    weight: 12,
    target: 40,
    rows: 2,
    primary: true,
  },
  {
    key: "speakerName",
    label: "Speaker",
    hint: "Name, and role if you have it.",
    placeholder: "Ayoade Adegbite — Data Engineer",
    weight: 6,
    target: 24,
    rows: 1,
    primary: true,
  },
  {
    key: "description",
    label: "Session description",
    hint: "The abstract from the programme. The single most useful thing you can paste.",
    placeholder:
      "Paste the full abstract here, since every sentence measurably sharpens the briefing.",
    weight: 18,
    target: 400,
    rows: 5,
    primary: true,
  },
  {
    key: "speakerBio",
    label: "Speaker bio",
    hint: "Tells the model what this person actually knows and cares about.",
    placeholder:
      "Their conference bio, LinkedIn headline, or the blurb under their photo.",
    weight: 14,
    target: 300,
    rows: 4,
    primary: false,
  },
  {
    key: "announcement",
    label: "Speaker announcement",
    hint: "The post that announced them. Often hints at the angle better than the abstract.",
    placeholder:
      "The tweet / Instagram / LinkedIn / website post that the conference published when announcing this talk.",
    weight: 12,
    target: 300,
    rows: 4,
    primary: false,
  },
  {
    key: "priorWork",
    label: "Prior talks, articles, projects",
    hint: "The strongest signal of all since people talk about what they've been building.",
    placeholder:
      "Titles of past talks, blog posts, open-source projects, a company they founded…",
    weight: 14,
    target: 250,
    rows: 4,
    primary: false,
  },
  {
    key: "links",
    label: "Links & profiles",
    hint: "Website, GitHub, LinkedIn. Paste URLs or better, paste what's on them.",
    placeholder: "https://…  (one per line)",
    weight: 10,
    target: 120,
    rows: 3,
    primary: false,
  },
  {
    key: "audience",
    label: "Track & audience level",
    hint: "A beginner track and an architecture track produce very different briefings.",
    placeholder: "Track · Level · Duration",
    weight: 6,
    target: 40,
    rows: 2,
    primary: false,
  },
  {
    key: "attendeeGoal",
    label: "What you want out of it",
    hint: "Your own stake in the talk. Steers what the model tells you to watch for.",
    placeholder:
      "I ship AI features at work and keep getting burned by confident wrong answers.",
    weight: 8,
    target: 120,
    rows: 3,
    primary: false,
  },
];

export const TOTAL_WEIGHT = FIELDS.reduce((sum, f) => sum + f.weight, 0);

export function tierOf(value: number): ContextTier {
  if (value < 31) return "thin";
  if (value < 66) return "partial";
  return "rich";
}

export const TIER_COPY: Record<
  ContextTier,
  { label: string; verdict: string; advice: string }
> = {
  thin: {
    label: "Thin context",
    verdict: "Mostly pattern-matching on the title.",
    advice:
      "Expect plausible-sounding guesses. Read the output as a hypothesis, not a briefing.",
  },
  partial: {
    label: "Partial context",
    verdict: "Grounded in places, inventing in others.",
    advice:
      "The mix is the risk: correct claims sit beside confident guesses. Check the tags.",
  },
  rich: {
    label: "Rich context",
    verdict: "Most claims trace back to something you supplied.",
    advice:
      "Still not omniscient — but now you can audit it. Speculation should be rare.",
  },
};

/**
 * Score a context object out of 100.
 *
 * Each field saturates on a square-root curve rather than linearly: the first
 * forty characters of an abstract carry far more information than the fortieth
 * to eightieth, so early input is rewarded and padding is not. Fields under
 * three characters earn nothing at all, which stops "n/a" from inflating trust.
 */
export function scoreContext(context: SessionContext): ContextScore {
  let filledCount = 0;

  const parts = FIELDS.map((field) => {
    const raw = (context[field.key] ?? "").trim();
    if (raw.length >= 3) filledCount += 1;

    const ratio = raw.length < 3 ? 0 : Math.min(1, raw.length / field.target);
    const earned = field.weight * Math.sqrt(ratio);

    return { key: field.key, label: field.label, earned, weight: field.weight };
  });

  const total = parts.reduce((sum, p) => sum + p.earned, 0);
  const value = Math.round((total / TOTAL_WEIGHT) * 100);

  return {
    value,
    tier: tierOf(value),
    parts,
    filledCount,
    totalCount: FIELDS.length,
  };
}

/** True when there is enough to attempt anything at all. */
export function hasMinimumContext(context: SessionContext): boolean {
  return (
    context.title.trim().length >= 3 ||
    context.description.trim().length >= 3 ||
    context.speakerName.trim().length >= 3
  );
}
