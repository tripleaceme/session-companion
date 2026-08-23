import { createSession, loadSessions, saveSessions } from "./storage";
import { STORAGE_KEY, type StoredSession } from "./types";

/**
 * The session archive as an external store.
 *
 * localStorage genuinely *is* state outside React, so it is modelled as one and
 * read through `useSyncExternalStore` rather than copied into component state by
 * an effect. Three things fall out of that:
 *
 *   - No cascading render on mount, and no `setState`-in-effect.
 *   - Hydration safety by construction: `getServerSnapshot` returns a frozen
 *     empty snapshot, so the server and the client's first paint always agree.
 *   - Cross-tab sync for free, because the `storage` event is just another
 *     source of change for the same store.
 */

export interface Snapshot {
  hydrated: boolean;
  sessions: StoredSession[];
  warning: string | null;
}

const EMPTY: Snapshot = { hydrated: false, sessions: [], warning: null };

// Cached so repeated getSnapshot() calls return an identical reference. Returning
// a fresh object each time makes useSyncExternalStore loop forever.
let snapshot: Snapshot = EMPTY;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function commit(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  emit();
}

export function getSnapshot(): Snapshot {
  return snapshot;
}

export function getServerSnapshot(): Snapshot {
  return EMPTY;
}

function hydrate() {
  const loaded = loadSessions();
  commit({
    hydrated: true,
    // Never present an empty app: an attendee who has just scanned the QR code
    // should land in a session they can start typing into.
    sessions: loaded.length ? loaded : [createSession()],
  });
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced, because context fields are typed into character by character. */
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const outcome = saveSessions(snapshot.sessions);
    const warning = !outcome.ok
      ? (outcome.error ?? "Could not save your history.")
      : outcome.trimmed
        ? "Storage was full — the oldest runs were dropped to make room."
        : null;
    if (warning !== snapshot.warning) commit({ warning });
  }, 400);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // The first subscriber triggers hydration. This runs inside React's effect
  // phase, so the read happens after the client's first paint has matched the
  // server's — but the mutation lives here, in the store, not in a component.
  if (!snapshot.hydrated) hydrate();

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      commit({ sessions: loadSessions() });
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** All writes funnel through here so every mutation is persisted and broadcast. */
export function update(
  fn: (sessions: StoredSession[]) => StoredSession[],
): void {
  commit({ sessions: fn(snapshot.sessions) });
  schedulePersist();
}

/** Applies a change to one session and floats it to the top of the archive. */
export function updateSession(
  id: string,
  fn: (session: StoredSession) => StoredSession,
): void {
  update((sessions) => {
    const index = sessions.findIndex((s) => s.id === id);
    if (index === -1) return sessions;
    const updated = { ...fn(sessions[index]), updatedAt: Date.now() };
    return [updated, ...sessions.filter((_, i) => i !== index)];
  });
}
