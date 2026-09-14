"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  dismissInstall,
  getServerSnapshot,
  getSnapshot,
  promptInstall,
  registerServiceWorker,
  subscribe,
} from "@/lib/pwa";

/**
 * A slim strip offering to install the app.
 *
 * It sits in the same slot as the storage warning rather than in the sidebar
 * footer: that footer shares a fixed height with the action bar beside it, and
 * a third button there would push the two out of line again.
 */
export function InstallBanner() {
  const pwa = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [showIosHelp, setShowIosHelp] = useState(false);

  // Registering a worker is a side effect on a browser API — exactly what an
  // effect is for, and it sets no React state.
  useEffect(() => registerServiceWorker(), []);

  // Nothing to offer: already installed, dismissed, or a desktop browser that
  // never fired the event and has no manual route worth explaining.
  if (!pwa.ready || pwa.standalone || pwa.dismissed) return null;
  if (!pwa.installable && !pwa.ios) return null;

  return (
    <div className="shrink-0 border-b border-rule bg-raised">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-signal">
          Install
        </p>
        <p className="min-w-0 flex-1 text-xs leading-snug text-ink-dim">
          Add TalkAbout to your home screen — it opens like an app, and your saved
          sessions stay readable with no signal.
        </p>

        {pwa.installable ? (
          <button
            type="button"
            onClick={() => promptInstall()}
            className="btn px-3 py-1.5 text-[0.625rem]"
          >
            Install
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIosHelp((v) => !v)}
            aria-expanded={showIosHelp}
            className="btn px-3 py-1.5 text-[0.625rem]"
          >
            {showIosHelp ? "Hide" : "How"}
          </button>
        )}

        <button
          type="button"
          onClick={dismissInstall}
          aria-label="Dismiss install prompt"
          className="px-1.5 font-mono text-[0.75rem] text-ink-faint hover:text-ink"
        >
          ✕
        </button>
      </div>

      {/* iOS Safari has no install event at all, so the only honest thing to do
          is name the two taps it actually takes. */}
      {showIosHelp && (
        <p className="border-t border-rule px-4 py-2 text-xs leading-relaxed text-ink-faint">
          Tap <span className="text-ink">Share</span> at the bottom of Safari, then{" "}
          <span className="text-ink">Add to Home Screen</span>.
        </p>
      )}
    </div>
  );
}
