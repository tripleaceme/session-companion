"use client";

import { useEffect, useState } from "react";
import { loadApiKey, saveApiKey } from "@/lib/storage";

/**
 * Rendered only while open, so mounting is what resets the draft. Syncing the
 * draft back to the prop in an effect would be a cascading render, and the lazy
 * initialiser below is safe precisely because this never renders on the server.
 */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [saved] = useState(loadApiKey);
  const [draft, setDraft] = useState(saved);

  // Escape closes. Bound on the document rather than the panel so it works no
  // matter where focus has wandered inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const commit = (key: string) => {
    saveApiKey(key);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 bg-paper/85 backdrop-blur-sm"
      />

      <div className="panel ticked rise relative w-full max-w-md p-6">
        <h2 id="settings-title" className="font-display text-2xl text-ink">
          Bring your own key
        </h2>
        <p className="prose-body mt-2 text-sm">
          The shared key is rate-limited, and in a room full of people all scanning the
          same QR code it will run out. Paste your own Gemini key and this browser will
          use it instead.
        </p>

        <label htmlFor="apikey" className="label mt-5 block">
          Gemini API key
        </label>
        <input
          id="apikey"
          type="password"
          value={draft}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="AIza…"
          onChange={(e) => setDraft(e.target.value)}
          className="field mt-1.5 font-mono text-sm"
        />

        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          Stored in this browser&rsquo;s local storage and sent only to this app&rsquo;s own
          server route, which forwards it to Google and keeps no copy. Get one free at{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer noopener"
            className="text-signal underline underline-offset-2"
          >
            aistudio.google.com/apikey
          </a>
          .
        </p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() => commit(draft)}
          >
            Save
          </button>
          {saved && (
            <button type="button" className="btn" onClick={() => commit("")}>
              Remove
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
