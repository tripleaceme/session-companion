"use client";

import { useState } from "react";
import { relativeTime } from "@/lib/storage";
import { scoreContext } from "@/lib/context-score";
import { ContextMeter } from "./ContextMeter";
import type { StoredSession } from "@/lib/types";

interface Props {
  sessions: StoredSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onOpenSettings: () => void;
  /** Mobile only — the drawer's dismiss handler. */
  onDismiss?: () => void;
}

export function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClearAll,
  onOpenSettings,
  onDismiss,
}: Props) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="flex h-full flex-col bg-inset/70">
      <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-4">
        <div>
          <p className="font-display text-lg leading-none text-ink">TalkAbout Sessions</p>
          <p className="label mt-1">History · stored on your device</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close history"
            className="btn px-2 py-1 lg:hidden"
          >
            ✕
          </button>
        )}
      </div>

      <div className="px-3 py-3">
        <button type="button" onClick={onNew} className="btn w-full">
          + New session
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Saved sessions">
        <ul className="space-y-1">
          {sessions.map((session) => {
            const score = scoreContext(session.context);
            const isActive = session.id === activeId;
            return (
              <li key={session.id}>
                <div
                  data-tier={score.tier}
                  className={`group relative rounded-[3px] border px-3 py-2.5 transition-colors ${
                    isActive
                      ? "border-signal bg-raised"
                      : "border-transparent hover:border-rule hover:bg-raised/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(session.id)}
                    className="block w-full text-left"
                  >
                    <p className="truncate pr-6 font-body text-sm leading-snug text-ink">
                      {session.name}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <ContextMeter score={score} compact />
                      <span className="font-mono text-[0.5625rem] text-ink-faint">
                        {session.runs.length > 0 && `${session.runs.length} run${session.runs.length > 1 ? "s" : ""} · `}
                        {relativeTime(session.updatedAt)}
                      </span>
                    </div>
                  </button>

                  {/* Always reachable by keyboard; only visible on hover with a pointer. */}
                  <button
                    type="button"
                    onClick={() => onDelete(session.id)}
                    aria-label={`Delete ${session.name}`}
                    className="absolute right-2 top-2 rounded px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-faint opacity-0 transition-opacity hover:text-thin focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="footer-rail space-y-2 px-3">
        <button type="button" onClick={onOpenSettings} className="btn w-full">
          API key
        </button>

        {confirmClear ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onClearAll();
                setConfirmClear(false);
              }}
              className="btn flex-1 border-thin text-thin"
            >
              Delete all
            </button>
            <button type="button" onClick={() => setConfirmClear(false)} className="btn flex-1">
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="btn w-full border-transparent text-ink-faint"
          >
            Clear history
          </button>
        )}
      </div>
    </div>
  );
}
