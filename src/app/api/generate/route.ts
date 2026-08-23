import { NextResponse } from "next/server";
import {
  BRIEFING_SCHEMA,
  BRIEFING_SYSTEM,
  DEBRIEF_SCHEMA,
  DEBRIEF_SYSTEM,
  DEFAULT_MODEL,
  briefingPrompt,
  client,
  debriefPrompt,
  thinkingConfigFor,
} from "@/lib/gemini";
import { EMPTY_CONTEXT, type SessionContext } from "@/lib/types";
import { hasMinimumContext } from "@/lib/context-score";

// A POST handler that reads its body is dynamic by definition, and `nodejs` is
// the default runtime in Next 16 (the `runtime` export now only exists to opt
// into the deprecated edge runtime), so neither export is needed here.
// Gemini Flash answers in a few seconds; 60s is headroom for a cold start.
export const maxDuration = 60;

const MAX_FIELD_CHARS = 8_000;
const MAX_NOTES_CHARS = 40_000;

type Mode = "briefing" | "debrief";

interface GenerateBody {
  mode?: Mode;
  context?: Partial<SessionContext>;
  notes?: string;
  predictions?: string[];
}

/** Coerce whatever the client sent into a full, length-capped SessionContext. */
function sanitizeContext(input: Partial<SessionContext> | undefined): SessionContext {
  const out = { ...EMPTY_CONTEXT };
  if (!input) return out;
  for (const key of Object.keys(EMPTY_CONTEXT) as (keyof SessionContext)[]) {
    const value = input[key];
    if (typeof value === "string") out[key] = value.slice(0, MAX_FIELD_CHARS);
  }
  return out;
}

function fail(status: number, error: string, hint?: string) {
  return NextResponse.json({ error, hint }, { status });
}

export async function POST(request: Request) {
  let body: GenerateBody;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Request body was not valid JSON.");
  }

  const mode: Mode = body.mode === "debrief" ? "debrief" : "briefing";
  const context = sanitizeContext(body.context);

  if (!hasMinimumContext(context)) {
    return fail(
      400,
      "Give me at least a title, a description, or a speaker name.",
      "Even one of the three is enough to start — that's rather the point.",
    );
  }

  // A key the user pasted in wins over the server's. During a live demo the shared
  // key is the thing that rate-limits, so "bring your own" has to be a real escape
  // hatch rather than dead code that only runs when the server has nothing.
  const byok = request.headers.get("x-gemini-key")?.trim();
  const apiKey = byok || process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return fail(
      500,
      "No Gemini API key is configured.",
      "Set GEMINI_API_KEY in .env.local, or add your own key in the app's settings.",
    );
  }

  const notes = (body.notes ?? "").slice(0, MAX_NOTES_CHARS).trim();
  if (mode === "debrief" && notes.length < 20) {
    return fail(400, "Add some notes from the session first.");
  }

  const predictions = Array.isArray(body.predictions)
    ? body.predictions.filter((p) => typeof p === "string").slice(0, 12)
    : [];

  const startedAt = Date.now();

  try {
    const text = await withRetry(async () => {
      const response = await client(apiKey).models.generateContent({
        model: DEFAULT_MODEL,
        contents:
          mode === "briefing"
            ? briefingPrompt(context)
            : debriefPrompt(context, notes, predictions),
        config: {
          systemInstruction: mode === "briefing" ? BRIEFING_SYSTEM : DEBRIEF_SYSTEM,
          responseMimeType: "application/json",
          responseSchema: mode === "briefing" ? BRIEFING_SCHEMA : DEBRIEF_SCHEMA,
          temperature: 0.8,
          thinkingConfig: thinkingConfigFor(DEFAULT_MODEL),
        },
      });
      return response.text;
    });
    if (!text) {
      // Almost always a safety block or an empty candidate.
      return fail(
        502,
        "Gemini returned an empty response.",
        "This usually clears on a retry.",
      );
    }

    // Safe to parse without a try/catch guard around shape: constrained decoding
    // guarantees the schema. We still catch malformed text defensively.
    return NextResponse.json({
      result: JSON.parse(text),
      model: DEFAULT_MODEL,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = extractStatus(message);

    if (status === 429) {
      return fail(
        429,
        "Gemini's rate limit is full right now.",
        "Wait a few seconds and try again — or paste your own API key in settings to skip the queue.",
      );
    }
    if (status === 503) {
      return fail(
        503,
        "Gemini is overloaded at the moment.",
        "We already retried twice. Give it a few seconds and go again.",
      );
    }
    if (status === 401 || status === 403) {
      return fail(401, "That Gemini API key was rejected.", "Check the key and try again.");
    }

    console.error("[generate]", message);
    return fail(500, "Gemini call failed.", message.slice(0, 300));
  }
}

/**
 * Retry the transient statuses only.
 *
 * 429 and 503 are the two failures a live audience will actually produce — a
 * shared key under a rate limit, and a popular model under load. Both clear on
 * their own within a second or two, so absorbing them here means most attendees
 * never see an error at all. Everything else (a bad key, a malformed request)
 * is deterministic, and retrying it just wastes the attendee's time.
 */
const RETRYABLE = new Set([429, 503, 500, 502]);
const BACKOFF_MS = [700, 1600];

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = extractStatus(
        error instanceof Error ? error.message : String(error),
      );
      if (status === null || !RETRYABLE.has(status)) throw error;
      if (attempt === BACKOFF_MS.length) break;
      await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt]));
    }
  }

  throw lastError;
}

/** The SDK folds the HTTP status into the error message string. */
function extractStatus(message: string): number | null {
  const match = message.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? Number(match[1]) : null;
}
