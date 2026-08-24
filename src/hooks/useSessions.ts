"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  update,
  updateSession,
} from "@/lib/session-store";
import { createSession, deriveName } from "@/lib/storage";
import type {
  BriefingRun,
  DebriefRun,
  SessionContext,
  StoredSession,
} from "@/lib/types";

export interface SessionsApi {
  /** False until the store's first client-side read. Render a placeholder until then. */
  hydrated: boolean;
  sessions: StoredSession[];
  active: StoredSession | null;
  activeId: string | null;
  storageWarning: string | null;
  select: (id: string) => void;
  startNew: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  updateContext: (patch: Partial<SessionContext>) => void;
  setNotes: (notes: string) => void;
  appendNotes: (text: string) => void;
  addRun: (run: BriefingRun) => void;
  addDebrief: (run: DebriefRun) => void;
}

export function useSessions(): SessionsApi {
  const { hydrated, sessions, warning } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Which session is open is view state, not archive state — it belongs to this
  // tab and should not be persisted or broadcast.
  const [requestedId, setRequestedId] = useState<string | null>(null);

  // Derived, not synchronised. A requested id left over from a session that was
  // deleted (or that belongs to another tab) simply fails to match and we fall
  // back to the newest session — no effect needed to "correct" the state.
  const active =
    sessions.find((s) => s.id === requestedId) ?? sessions[0] ?? null;
  const activeId = active?.id ?? null;

  const mutateActive = useCallback(
    (fn: (session: StoredSession) => StoredSession) => {
      if (!activeId) return;
      updateSession(activeId, fn);
    },
    [activeId],
  );

  const startNew = useCallback(() => {
    // Don't pile up empties: reuse a pristine session if one already exists.
    const pristine = getSnapshot().sessions.find(
      (s) => !s.runs.length && !s.debriefs.length && !s.context.title.trim(),
    );
    if (pristine) {
      setRequestedId(pristine.id);
      return;
    }
    const fresh = createSession();
    update((all) => [fresh, ...all]);
    setRequestedId(fresh.id);
  }, []);

  const remove = useCallback((id: string) => {
    update((all) => {
      const next = all.filter((s) => s.id !== id);
      return next.length ? next : [createSession()];
    });
    // Clearing the request lets the derivation above pick the newest survivor.
    setRequestedId((current) => (current === id ? null : current));
  }, []);

  const clearAll = useCallback(() => {
    update(() => [createSession()]);
    setRequestedId(null);
  }, []);

  const updateContext = useCallback(
    (patch: Partial<SessionContext>) => {
      mutateActive((session) => {
        const context = { ...session.context, ...patch };
        // Keep the sidebar label following the title, unless it was renamed by hand.
        const autoNamed =
          session.name === "Untitled session" ||
          session.name === deriveName(session.context);
        return {
          ...session,
          context,
          name: autoNamed ? deriveName(context) : session.name,
        };
      });
    },
    [mutateActive],
  );

  const setNotes = useCallback(
    (notes: string) => mutateActive((session) => ({ ...session, notes })),
    [mutateActive],
  );

  /**
   * Append rather than replace.
   *
   * Transcriptions land one file at a time and the attendee may well be typing
   * between them. Reading the current notes into a component and writing back a
   * concatenated string would drop whichever change lost the race; deriving the
   * new value from the session inside the store cannot.
   */
  const appendNotes = useCallback(
    (text: string) =>
      mutateActive((session) => ({
        ...session,
        notes: session.notes.trim() ? `${session.notes.trimEnd()}\n\n${text}` : text,
      })),
    [mutateActive],
  );

  const addRun = useCallback(
    (run: BriefingRun) =>
      mutateActive((session) => ({ ...session, runs: [...session.runs, run] })),
    [mutateActive],
  );

  const addDebrief = useCallback(
    (run: DebriefRun) =>
      mutateActive((session) => ({
        ...session,
        debriefs: [...session.debriefs, run],
      })),
    [mutateActive],
  );

  return {
    hydrated,
    sessions,
    active,
    activeId,
    storageWarning: warning,
    select: setRequestedId,
    startNew,
    remove,
    clearAll,
    updateContext,
    setNotes,
    appendNotes,
    addRun,
    addDebrief,
  };
}
