import {
  EMPTY_CONTEXT,
  STORAGE_KEY,
  BYOK_KEY,
  type SessionContext,
  type StoredSession,
} from "./types";

/** Guards against very old browsers and Safari private mode, where access throws. */
function safeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const probe = "__sc_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export const MAX_SESSIONS = 40;
export const MAX_RUNS_PER_SESSION = 25;

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSession(partial?: Partial<SessionContext>): StoredSession {
  const now = Date.now();
  return {
    id: newId(),
    name: "Untitled session",
    createdAt: now,
    updatedAt: now,
    context: { ...EMPTY_CONTEXT, ...partial },
    runs: [],
    notes: "",
    debriefs: [],
  };
}

/**
 * Reads and repairs whatever is in storage.
 *
 * Anything persisted in a browser is untrusted input: it may have been written
 * by an older build, hand-edited in devtools, or truncated by a quota error
 * mid-write. Every field is therefore re-established rather than assumed, so a
 * single bad record degrades into a usable one instead of blanking the app.
 */
export function loadSessions(): StoredSession[] {
  const store = safeLocalStorage();
  if (!store) return [];

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => {
        const base = createSession();
        return {
          ...base,
          id: typeof s.id === "string" ? s.id : base.id,
          name: typeof s.name === "string" && s.name ? s.name : base.name,
          createdAt: typeof s.createdAt === "number" ? s.createdAt : base.createdAt,
          updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : base.updatedAt,
          context: { ...EMPTY_CONTEXT, ...(s.context as object) },
          runs: Array.isArray(s.runs) ? s.runs : [],
          notes: typeof s.notes === "string" ? s.notes : "",
          debriefs: Array.isArray(s.debriefs) ? s.debriefs : [],
        } as StoredSession;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export interface SaveOutcome {
  ok: boolean;
  /** Set when we had to drop old data to make the write fit. */
  trimmed?: boolean;
  error?: string;
}

/**
 * Persist, shedding history rather than failing when the 5MB quota is hit.
 *
 * A conference attendee filling in long abstracts and pasted notes can realistically
 * reach the quota. Losing the oldest runs is a far better outcome than a write that
 * throws and silently loses the session they are working on right now.
 */
export function saveSessions(sessions: StoredSession[]): SaveOutcome {
  const store = safeLocalStorage();
  if (!store) return { ok: false, error: "This browser is blocking local storage." };

  const capped = sessions.slice(0, MAX_SESSIONS).map((s) => ({
    ...s,
    runs: s.runs.slice(-MAX_RUNS_PER_SESSION),
    debriefs: s.debriefs.slice(-MAX_RUNS_PER_SESSION),
  }));

  try {
    store.setItem(STORAGE_KEY, JSON.stringify(capped));
    return { ok: true };
  } catch {
    // Quota exceeded. Halve the archive, newest first, and retry once.
    try {
      const emergency = capped.slice(0, Math.max(1, Math.floor(capped.length / 2))).map((s) => ({
        ...s,
        runs: s.runs.slice(-3),
        debriefs: s.debriefs.slice(-3),
      }));
      store.setItem(STORAGE_KEY, JSON.stringify(emergency));
      return { ok: true, trimmed: true };
    } catch {
      return { ok: false, error: "Local storage is full and could not be trimmed." };
    }
  }
}

export function loadApiKey(): string {
  return safeLocalStorage()?.getItem(BYOK_KEY) ?? "";
}

export function saveApiKey(key: string): void {
  const store = safeLocalStorage();
  if (!store) return;
  if (key.trim()) store.setItem(BYOK_KEY, key.trim());
  else store.removeItem(BYOK_KEY);
}

/** Sidebar label: prefer the real title, fall back to speaker, then to a stub. */
export function deriveName(context: SessionContext): string {
  const title = context.title.trim();
  if (title) return title.length > 64 ? `${title.slice(0, 61)}…` : title;
  const speaker = context.speakerName.trim();
  if (speaker) return `Session with ${speaker}`;
  const desc = context.description.trim();
  if (desc) return `${desc.slice(0, 50)}…`;
  return "Untitled session";
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
