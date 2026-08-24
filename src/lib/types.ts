/**
 * Domain model for the TalkAbout Sessions.
 *
 * The central idea of the app (and the talk it exists for) is that an AI answer
 * is only as trustworthy as the context behind it. So context is not a loose bag
 * of strings — it is a *measured* input with a score, and every generated result
 * permanently remembers the exact context snapshot that produced it.
 */

/** The raw context an attendee can give us about a session. All fields optional. */
export interface SessionContext {
  title: string;
  description: string;
  speakerName: string;
  speakerBio: string;
  announcement: string;
  links: string;
  priorWork: string;
  audience: string;
  attendeeGoal: string;
}

export type ContextKey = keyof SessionContext;

export const EMPTY_CONTEXT: SessionContext = {
  title: "",
  description: "",
  speakerName: "",
  speakerBio: "",
  announcement: "",
  links: "",
  priorWork: "",
  audience: "",
  attendeeGoal: "",
};

/**
 * How confident the model claims to be in a single statement.
 * We deliberately force a three-way split rather than a 0-100 number:
 * a number invites false precision, a label invites judgement.
 */
export type Grounding = "grounded" | "inferred" | "speculation";

export interface Prediction {
  claim: string;
  grounding: Grounding;
  /** Which context the model says it leaned on. "general knowledge" when it had none. */
  basedOn: string;
}

export interface Prerequisite {
  concept: string;
  why: string;
  primer: string;
}

export interface SuggestedQuestion {
  question: string;
  why: string;
  grounding: Grounding;
}

export interface MissingContext {
  ask: string;
  whyItHelps: string;
}

export interface Briefing {
  headline: string;
  confidence: "low" | "medium" | "high";
  confidenceRationale: string;
  likelyCoverage: Prediction[];
  payAttentionTo: Prediction[];
  prerequisites: Prerequisite[];
  questions: SuggestedQuestion[];
  missingContext: MissingContext[];
}

export type Verdict = "confirmed" | "contradicted" | "not-covered";

export interface PredictionReview {
  claim: string;
  verdict: Verdict;
  note: string;
}

export interface Takeaway {
  point: string;
  detail: string;
}

export interface Debrief {
  summary: string;
  takeaways: Takeaway[];
  unanswered: { question: string; why: string }[];
  /** Scores the *earlier* briefing against what actually happened in the room. */
  predictionReview: PredictionReview[];
  linkedInPost: string;
}

export type ContextTier = "thin" | "partial" | "rich";

export interface ContextScore {
  /** 0-100 */
  value: number;
  tier: ContextTier;
  /** Per-field contribution, for the meter breakdown. */
  parts: { key: ContextKey; label: string; earned: number; weight: number }[];
  filledCount: number;
  totalCount: number;
}

/**
 * A single generation, frozen together with the context that caused it.
 * This pairing is the whole point: you can scroll back through runs and watch
 * the answer change as context accumulates.
 */
export interface BriefingRun {
  id: string;
  createdAt: number;
  /** Snapshot — NOT a reference. Later edits to the session must not rewrite history. */
  context: SessionContext;
  score: ContextScore;
  briefing: Briefing;
  model: string;
  latencyMs: number;
}

export interface DebriefRun {
  id: string;
  createdAt: number;
  notes: string;
  debrief: Debrief;
  model: string;
  latencyMs: number;
}

export interface StoredSession {
  id: string;
  /** Display name in the sidebar; derived from the title, editable later. */
  name: string;
  createdAt: number;
  updatedAt: number;
  /** The live, editable context. Runs hold their own frozen copies. */
  context: SessionContext;
  runs: BriefingRun[];
  notes: string;
  debriefs: DebriefRun[];
}

export const STORAGE_KEY = "session-companion.v1";
export const BYOK_KEY = "session-companion.apikey";
