import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type Schema,
  type ThinkingConfig,
} from "@google/genai";
import type { SessionContext } from "./types";
import { FIELDS, scoreContext, TIER_COPY } from "./context-score";

/**
 * Pinned deliberately rather than tracking the `gemini-flash-latest` alias — an
 * alias that rolls forward mid-conference would change the demo's output between
 * the rehearsal and the room, and it was also the only name that returned 503s
 * while every pinned model was serving fine.
 *
 * 3.5-flash over 3.7-flash on measurement, not vibes: on the rich-context preset
 * 3.7 took ~19s to 3.5's ~5.8s, and produced a *less* grounded ledger. Nineteen
 * seconds in front of a live audience reads as a broken app.
 */
export const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

export function client(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

/**
 * Gemini 3.x takes a coarse `thinkingLevel`; 2.5 takes a numeric `thinkingBudget`.
 * Sending the wrong one is a 400, so the shape is chosen from the model name —
 * which matters because GEMINI_MODEL is user-overridable.
 *
 * LOW is the default because the response schema already carries most of the
 * structural load, and a room of people scanning the same QR code will read a
 * fifteen-second wait as a broken app.
 */
export function thinkingConfigFor(model: string): ThinkingConfig {
  if (model.startsWith("gemini-3")) {
    const level = (process.env.GEMINI_THINKING_LEVEL ?? "LOW").toUpperCase();
    return {
      thinkingLevel:
        level in ThinkingLevel
          ? ThinkingLevel[level as keyof typeof ThinkingLevel]
          : ThinkingLevel.LOW,
    };
  }
  return { thinkingBudget: Number(process.env.GEMINI_THINKING_BUDGET ?? 0) };
}

/* ------------------------------------------------------------------ *
 * Response schemas
 *
 * Passing these as `responseSchema` puts Gemini into constrained decoding:
 * the sampler is masked so it physically cannot emit a token that would
 * break the shape. We therefore never write defensive JSON-repair code.
 *
 * `propertyOrdering` is not cosmetic — the model generates fields in this
 * order, so putting `claim` before `grounding` means it commits to a claim
 * and *then* judges it, rather than picking a confidence label first and
 * writing to fit.
 * ------------------------------------------------------------------ */

const grounding: Schema = {
  type: Type.STRING,
  enum: ["grounded", "inferred", "speculation"],
  description:
    "grounded = restates something explicitly present in the supplied context. " +
    "inferred = a reasonable step from the supplied context. " +
    "speculation = you are drawing on general knowledge or the topic name alone.",
};

const prediction: Schema = {
  type: Type.OBJECT,
  properties: {
    claim: { type: Type.STRING, description: "One specific, falsifiable sentence." },
    grounding,
    basedOn: {
      type: Type.STRING,
      description:
        "Name the exact context field you leaned on, e.g. 'session description' or " +
        "'speaker bio'. If you had nothing, write 'general knowledge of the topic'.",
    },
  },
  required: ["claim", "grounding", "basedOn"],
  propertyOrdering: ["claim", "grounding", "basedOn"],
};

export const BRIEFING_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: {
      type: Type.STRING,
      description: "One sentence, under 140 characters, on what this session probably is.",
    },
    confidence: { type: Type.STRING, enum: ["low", "medium", "high"] },
    confidenceRationale: {
      type: Type.STRING,
      description:
        "Two sentences maximum, addressed to the attendee, naming what you had and " +
        "what you lacked. Be blunt when you were working from almost nothing.",
    },
    likelyCoverage: { type: Type.ARRAY, items: prediction, minItems: "3", maxItems: "6" },
    payAttentionTo: { type: Type.ARRAY, items: prediction, minItems: "2", maxItems: "5" },
    prerequisites: {
      type: Type.ARRAY,
      minItems: "2",
      maxItems: "5",
      items: {
        type: Type.OBJECT,
        properties: {
          concept: { type: Type.STRING },
          why: { type: Type.STRING, description: "Why it matters for THIS session." },
          primer: {
            type: Type.STRING,
            description: "A genuinely useful 1-2 sentence explanation, not a definition stub.",
          },
        },
        required: ["concept", "why", "primer"],
        propertyOrdering: ["concept", "why", "primer"],
      },
    },
    questions: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "6",
      items: {
        type: Type.OBJECT,
        properties: {
          question: {
            type: Type.STRING,
            description:
              "Something a thoughtful peer would ask on the mic. Never generic " +
              "('what are best practices?'), never answerable by the abstract.",
          },
          why: { type: Type.STRING, description: "What a good answer would reveal." },
          grounding,
        },
        required: ["question", "why", "grounding"],
        propertyOrdering: ["question", "why", "grounding"],
      },
    },
    missingContext: {
      type: Type.ARRAY,
      minItems: "1",
      maxItems: "4",
      items: {
        type: Type.OBJECT,
        properties: {
          ask: {
            type: Type.STRING,
            description:
              "A concrete thing the attendee could go and paste in, phrased as a request.",
          },
          whyItHelps: {
            type: Type.STRING,
            description: "Which part of this briefing it would upgrade, specifically.",
          },
        },
        required: ["ask", "whyItHelps"],
        propertyOrdering: ["ask", "whyItHelps"],
      },
    },
  },
  required: [
    "headline",
    "confidence",
    "confidenceRationale",
    "likelyCoverage",
    "payAttentionTo",
    "prerequisites",
    "questions",
    "missingContext",
  ],
  propertyOrdering: [
    "headline",
    "confidence",
    "confidenceRationale",
    "likelyCoverage",
    "payAttentionTo",
    "prerequisites",
    "questions",
    "missingContext",
  ],
};

export const DEBRIEF_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description:
        "3-5 sentences capturing what the session actually argued, in the attendee's own register.",
    },
    takeaways: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "6",
      items: {
        type: Type.OBJECT,
        properties: {
          point: { type: Type.STRING, description: "A short, quotable claim." },
          detail: { type: Type.STRING, description: "One or two sentences of substance." },
        },
        required: ["point", "detail"],
        propertyOrdering: ["point", "detail"],
      },
    },
    unanswered: {
      type: Type.ARRAY,
      minItems: "1",
      maxItems: "5",
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          why: {
            type: Type.STRING,
            description: "Why the notes leave this open — what gap in them points to it.",
          },
        },
        required: ["question", "why"],
        propertyOrdering: ["question", "why"],
      },
    },
    predictionReview: {
      type: Type.ARRAY,
      description:
        "Judge each earlier prediction against the notes. Empty array if none were supplied.",
      items: {
        type: Type.OBJECT,
        properties: {
          claim: { type: Type.STRING, description: "Echo the prediction verbatim." },
          verdict: {
            type: Type.STRING,
            enum: ["confirmed", "contradicted", "not-covered"],
          },
          note: {
            type: Type.STRING,
            description:
              "Point at the specific line in the notes that decides it. If the notes " +
              "are silent, say 'not-covered' rather than stretching for a match.",
          },
        },
        required: ["claim", "verdict", "note"],
        propertyOrdering: ["claim", "verdict", "note"],
      },
    },
    linkedInPost: {
      type: Type.STRING,
      description:
        "A publishable LinkedIn post in the attendee's voice: a concrete hook, 2-3 " +
        "specific things learned, one honest reflection, and a credit to the speaker " +
        "by name if known. No emoji walls, no 'Excited to share', no hashtag spam " +
        "(three at most). Use single line breaks between short paragraphs.",
    },
  },
  required: ["summary", "takeaways", "unanswered", "predictionReview", "linkedInPost"],
  propertyOrdering: [
    "summary",
    "takeaways",
    "unanswered",
    "predictionReview",
    "linkedInPost",
  ],
};

/* ------------------------------------------------------------------ *
 * Prompts
 * ------------------------------------------------------------------ */

export const BRIEFING_SYSTEM = `You prepare conference attendees for a talk they are about to walk into.

You are frequently given very little to work with. That is the normal case, not an error — and it is the one thing you must never paper over.

Rules you do not break:

1. TAG EVERY CLAIM HONESTLY. "grounded" means the supplied context says it. "inferred" means you took a short, defensible step from the supplied context. "speculation" means you are running on the topic name and general knowledge. When context is thin, most of your output is speculation and you must say so. Do not launder a guess as an inference.

2. NEVER INVENT FACTS ABOUT A REAL PERSON. If you are given a speaker's name but no bio, you know their name and nothing else. Do not assign them an employer, a nationality, a job history, a conference record, or opinions. Do not claim to recognise them. Say what the talk might cover, not who you imagine they are.

3. NO HEDGE-PADDING. Never write "it likely depends" or "this may or may not". Commit to specific, falsifiable predictions and let the grounding tag carry the uncertainty. A wrong specific prediction is useful to an attendee; a vague safe one is not.

4. BE USEFUL AT LOW CONTEXT ANYWAY. Thin context does not license a thin answer. Make your best real guesses, label them speculation, and use missingContext to tell the attendee exactly what to go and fetch.

5. WRITE FOR A PERSON IN A SEAT. Second person, plain language, no marketing register, no "delve", no "in today's fast-paced landscape". Assume they are technical and short on time.`;

export const DEBRIEF_SYSTEM = `You help a conference attendee consolidate a session they just watched.

Their notes are the only authority. Rules:

1. NEVER ADD FACTS THE NOTES DO NOT SUPPORT. Do not enrich the summary with what you assume the speaker "probably" said. If the notes are fragmentary, produce a fragmentary-but-honest summary and put the gaps in "unanswered".

2. GRADE THE EARLIER PREDICTIONS STRICTLY. "confirmed" needs support in the notes. Silence is "not-covered", never a soft confirm. If the notes contradict a prediction, say "contradicted" plainly — the attendee learns more from that than from a flattering score.

3. THE LINKEDIN POST MUST SOUND HUMAN. Written as the attendee, from their notes, about what genuinely surprised or changed for them. No "Excited to share", no emoji rows, no engagement bait, at most three hashtags.

4. PRESERVE THEIR VOICE. If their notes are terse and technical, the summary is terse and technical.`;

/** Renders only the fields the attendee actually filled, so absence is visible to the model. */
export function renderContext(context: SessionContext): string {
  const supplied: string[] = [];
  const missing: string[] = [];

  for (const field of FIELDS) {
    const value = (context[field.key] ?? "").trim();
    if (value.length >= 3) {
      supplied.push(`### ${field.label}\n${value}`);
    } else {
      missing.push(field.label);
    }
  }

  const score = scoreContext(context);
  const tier = TIER_COPY[score.tier];

  return [
    `## Context supplied by the attendee`,
    supplied.length ? supplied.join("\n\n") : "_Nothing at all was supplied._",
    ``,
    `## Context NOT supplied`,
    missing.length ? missing.map((m) => `- ${m}`).join("\n") : "_Everything was supplied._",
    ``,
    `## Measured context completeness: ${score.value}/100 — ${tier.label}`,
    `Calibrate to this. At this level: ${tier.verdict}`,
  ].join("\n");
}

export function briefingPrompt(context: SessionContext): string {
  return `${renderContext(context)}

## Your task
Produce the pre-session briefing. Ground what you can in the text above, name the field you used in \`basedOn\`, and mark everything else as speculation. Then tell the attendee, in \`missingContext\`, precisely what to go and paste in to make this better.`;
}

export function debriefPrompt(
  context: SessionContext,
  notes: string,
  earlierPredictions: string[],
): string {
  const predictionBlock = earlierPredictions.length
    ? `## Predictions made before the session
${earlierPredictions.map((p) => `- ${p}`).join("\n")}

Grade each one against the notes. Echo the claim verbatim in your review.`
    : `## Predictions made before the session
None. Return an empty predictionReview array.`;

  return `${renderContext(context)}

## The attendee's notes from the session
${notes}

${predictionBlock}

## Your task
Summarise the session from the notes, pull out the takeaways, name what was left unanswered, grade the earlier predictions, and draft a LinkedIn post the attendee could actually publish.`;
}
