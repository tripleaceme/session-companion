"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSessions } from "@/hooks/useSessions";
import { scoreContext, hasMinimumContext } from "@/lib/context-score";
import { loadApiKey, newId } from "@/lib/storage";
import { ContextBreakdown, ContextMeter } from "@/components/ContextMeter";
import { ContextForm } from "@/components/ContextForm";
import { BriefingView } from "@/components/BriefingView";
import { CompareView, RunStrip } from "@/components/RunHistory";
import { DebriefView } from "@/components/DebriefView";
import { Sidebar } from "@/components/Sidebar";
import { SettingsDialog } from "@/components/SettingsDialog";
import { EmptyState, ErrorPanel, LoadingPanel } from "@/components/Feedback";
import { NotesInput } from "@/components/NotesInput";
import type { Briefing, Debrief, SessionContext } from "@/lib/types";

type Phase = "before" | "after";
type Pane = "input" | "output";

interface ApiError {
  error: string;
  hint?: string;
}

/** Failures are tagged with the session they belong to, so switching sessions
 *  clears the error by derivation rather than by an effect that resets state. */
interface Failure extends ApiError {
  sessionId: string;
}

export default function Page() {
  const store = useSessions();
  const {
    hydrated,
    active,
    updateContext,
    setNotes,
    appendNotes,
    addRun,
    addDebrief,
    storageWarning,
  } = store;

  const [phase, setPhase] = useState<Phase>("before");
  const [pane, setPane] = useState<Pane>("input");
  // "Requested", not "selected": a null or stale id resolves to the newest run.
  const [requestedRunId, setRequestedRunId] = useState<string | null>(null);
  const [compareRunId, setCompareRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "briefing" | "debrief">(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const score = useMemo(
    () => scoreContext(active?.context ?? ({} as SessionContext)),
    [active?.context],
  );

  // Retune the ambient page glow to the current reading. The gradient lives on
  // body::after, which resolves --signal from :root, so the class has to go on
  // <html> rather than on a component wrapper.
  useEffect(() => {
    document.documentElement.dataset.tier = score.tier;
  }, [score.tier]);

  const call = useCallback(async (body: Record<string, unknown>) => {
    // Read the key at call time rather than holding it in state. It only ever
    // matters at the moment of the request, and this keeps the dialog the single
    // owner of the value.
    const key = loadApiKey();
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { "x-gemini-key": key } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw data as ApiError;
    return data as { result: unknown; model: string; latencyMs: number };
  }, []);

  const runBriefing = useCallback(async () => {
    if (!active) return;
    setBusy("briefing");
    setFailure(null);
    setPane("output");

    try {
      const data = await call({ mode: "briefing", context: active.context });
      const id = newId();
      addRun({
        id,
        createdAt: Date.now(),
        // Freeze the context as it was at generation time so the run stays a
        // truthful record even after the attendee edits the fields.
        context: { ...active.context },
        score,
        briefing: data.result as Briefing,
        model: data.model,
        latencyMs: data.latencyMs,
      });
      setRequestedRunId(id);
      setCompareRunId(null);
    } catch (e) {
      const f = e as ApiError;
      setFailure({
        sessionId: active.id,
        error: f?.error ?? "Something went wrong reaching the model.",
        hint: f?.hint,
      });
    } finally {
      setBusy(null);
    }
  }, [active, addRun, call, score]);

  const runDebrief = useCallback(async () => {
    if (!active) return;
    setBusy("debrief");
    setFailure(null);
    setPane("output");

    // Hand the model its own earlier predictions so it can grade them.
    const latest = active.runs[active.runs.length - 1];
    const predictions = latest
      ? [...latest.briefing.likelyCoverage, ...latest.briefing.payAttentionTo].map(
          (p) => p.claim,
        )
      : [];

    try {
      const data = await call({
        mode: "debrief",
        context: active.context,
        notes: active.notes,
        predictions,
      });
      addDebrief({
        id: newId(),
        createdAt: Date.now(),
        notes: active.notes,
        debrief: data.result as Debrief,
        model: data.model,
        latencyMs: data.latencyMs,
      });
    } catch (e) {
      const f = e as ApiError;
      setFailure({
        sessionId: active.id,
        error: f?.error ?? "Something went wrong reaching the model.",
        hint: f?.hint,
      });
    } finally {
      setBusy(null);
    }
  }, [active, addDebrief, call]);

  if (!hydrated || !active) {
    return (
      <div className="relative z-10 flex min-h-dvh items-center justify-center">
        <p className="label blink">Loading your history…</p>
      </div>
    );
  }

  const runs = active.runs;

  // Everything below is derived from the requested ids rather than kept in sync
  // with them. Switching sessions leaves ids behind that belong to the session
  // we just left; they simply fail to match, and the fallbacks take over.
  const selectedRun =
    runs.find((r) => r.id === requestedRunId) ?? runs[runs.length - 1] ?? null;
  const selectedRunId = selectedRun?.id ?? null;
  const compareRun = runs.find((r) => r.id === compareRunId) ?? null;
  const visibleFailure = failure?.sessionId === active.id ? failure : null;
  const latestDebrief = active.debriefs[active.debriefs.length - 1] ?? null;
  const canBrief = hasMinimumContext(active.context) && !busy;
  const canDebrief = active.notes.trim().length >= 20 && !busy;

  const sidebar = (
    <Sidebar
      sessions={store.sessions}
      activeId={store.activeId}
      onSelect={(id) => {
        store.select(id);
        setDrawerOpen(false);
        setPane("input");
      }}
      onNew={() => {
        store.startNew();
        setDrawerOpen(false);
        setPhase("before");
        setPane("input");
      }}
      onDelete={store.remove}
      onClearAll={store.clearAll}
      onOpenSettings={() => {
        setSettingsOpen(true);
        setDrawerOpen(false);
      }}
      onDismiss={() => setDrawerOpen(false)}
    />
  );

  return (
    <div className="relative z-10 flex h-dvh overflow-hidden">
      <aside className="hidden w-72 shrink-0 border-r border-rule lg:block">{sidebar}</aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close history"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-paper/85 backdrop-blur-sm"
          />
          <div className="relative h-full w-[19rem] max-w-[85vw] border-r border-rule bg-paper">
            {sidebar}
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-rule px-4 py-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open history"
            className="btn px-2.5 py-1.5 lg:hidden"
          >
            ☰
          </button>

          <div className="flex rounded-[3px] border border-rule p-0.5" role="tablist">
            {(
              [
                ["before", "Before"],
                ["after", "After"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={phase === key}
                onClick={() => {
                  setPhase(key);
                  setPane("input");
                }}
                className={`rounded-[2px] px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] transition-colors ${
                  phase === key
                    ? "bg-signal text-paper"
                    : "text-ink-faint hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="hidden min-w-0 flex-1 truncate font-body text-sm text-ink-dim sm:block">
            {active.name}
          </p>

          {/* On mobile the two panes share the screen, so give them a switch. */}
          <div className="ml-auto flex rounded-[3px] border border-rule p-0.5 lg:hidden">
            {(
              [
                ["input", phase === "before" ? "Context" : "Notes"],
                ["output", phase === "before" ? "Briefing" : "Debrief"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPane(key)}
                aria-pressed={pane === key}
                className={`rounded-[2px] px-2.5 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] transition-colors ${
                  pane === key ? "text-signal" : "text-ink-faint"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {storageWarning && (
          <p className="shrink-0 border-b border-rule bg-raised px-4 py-1.5 font-mono text-[0.625rem] text-thin">
            {storageWarning}
          </p>
        )}

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
          {/* ---------------- Input column ---------------- */}
          <section
            className={`min-h-0 overflow-y-auto border-rule lg:block lg:border-r ${
              pane === "input" ? "block" : "hidden"
            }`}
          >
            {phase === "before" ? (
              <div className="flex min-h-full flex-col px-4 pt-5 sm:px-5">
                <div className="flex-1 space-y-6">
                <ContextMeter score={score} />

                <button
                  type="button"
                  onClick={() => setShowBreakdown((v) => !v)}
                  className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-ink-faint hover:text-signal"
                >
                  {showBreakdown ? "Hide" : "Show"} the breakdown
                </button>
                {showBreakdown && (
                  <div className="rise">
                    <ContextBreakdown score={score} />
                  </div>
                )}

                <ContextForm
                  context={active.context}
                  score={score}
                  onChange={updateContext}
                />
                </div>

                <div className="footer-rail sticky bottom-0 -mx-4 mt-6 bg-paper/95 px-4 backdrop-blur sm:-mx-5 sm:px-5">
                  <button
                    type="button"
                    onClick={runBriefing}
                    disabled={!canBrief}
                    className="btn btn-primary w-full"
                    data-tier={score.tier}
                  >
                    {busy === "briefing"
                      ? "Working…"
                      : runs.length
                        ? `Run again at ${score.value}/100`
                        : "Brief me"}
                  </button>
                  {/* Always shown. This is true at 12/100 and at 80/100, unlike
                      the empty-state prompt it replaced, which only made sense
                      before the form had anything in it at all. */}
                  <p className="mt-2 text-center text-xs text-ink-faint">
                    The more you give, the better the briefing.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-full flex-col px-4 pt-5 sm:px-5">
                <div className="flex-1 space-y-4">
                  <p className="label">Your notes from the session</p>

                  <NotesInput
                    notes={active.notes}
                    onChange={setNotes}
                    onAppend={appendNotes}
                  />
                </div>

                <div className="footer-rail sticky bottom-0 -mx-4 mt-6 bg-paper/95 px-4 backdrop-blur sm:-mx-5 sm:px-5">
                  <button
                    type="button"
                    onClick={runDebrief}
                    disabled={!canDebrief}
                    className="btn btn-primary w-full"
                  >
                    {busy === "debrief" ? "Working…" : "Create Summary"}
                  </button>
                  <p className="mt-2 text-center text-xs text-ink-faint">
                    Create a summary based on the notes you&rsquo;ve added.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ---------------- Output column ---------------- */}
          <section
            className={`min-h-0 overflow-y-auto px-4 py-5 sm:px-6 lg:block ${
              pane === "output" ? "block" : "hidden"
            }`}
          >
            <div className="mx-auto max-w-3xl space-y-6">
              {phase === "before" ? (
                <>
                  {runs.length > 0 && (
                    <RunStrip
                      runs={runs}
                      selectedId={selectedRunId}
                      onSelect={(id) => {
                        setRequestedRunId(id);
                        setCompareRunId(null);
                      }}
                      compareId={compareRunId}
                      onToggleCompare={(id) =>
                        setCompareRunId((current) =>
                          current === id || id === selectedRunId ? null : id,
                        )
                      }
                    />
                  )}

                  {visibleFailure && (
                    <ErrorPanel
                      error={visibleFailure.error}
                      hint={visibleFailure.hint}
                      onRetry={runBriefing}
                      onOpenSettings={() => setSettingsOpen(true)}
                    />
                  )}

                  {busy === "briefing" && <LoadingPanel mode="briefing" />}

                  {!busy && selectedRun && compareRun && (
                    <CompareView a={selectedRun} b={compareRun} />
                  )}

                  {!busy && selectedRun && !compareRun && <BriefingView run={selectedRun} />}

                  {!busy && !selectedRun && !visibleFailure && (
                    <EmptyState
                      title="Nothing generated yet"
                      body="Give it whatever you have about the session. Then add more and run it again."
                    />
                  )}
                </>
              ) : (
                <>
                  {visibleFailure && (
                    <ErrorPanel
                      error={visibleFailure.error}
                      hint={visibleFailure.hint}
                      onRetry={runDebrief}
                      onOpenSettings={() => setSettingsOpen(true)}
                    />
                  )}

                  {busy === "debrief" && <LoadingPanel mode="debrief" />}

                  {!busy && latestDebrief && <DebriefView run={latestDebrief} />}

                  {!busy && !latestDebrief && !visibleFailure && (
                    <EmptyState
                      title="Come back after the talk"
                      body="Paste or upload your notes and you'll get a summary, the takeaways you can post on social media.
                      You also get to see what went unanswered and a scorecard showing how the pre-session predictions actually held up."
                    />
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Mounted only while open, so opening it is what loads the saved key and
          closing it is what discards the draft — no effect keeps them in sync. */}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
