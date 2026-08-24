"use client";

import { useCallback, useRef, useState } from "react";
import {
  ACCEPT,
  MAX_FILES,
  type AttachmentStatus,
  classify,
  extractOnServer,
  humanSize,
  readTextFile,
  withProvenance,
} from "@/lib/attachments";
import { loadApiKey, newId } from "@/lib/storage";

const KIND_LABEL: Record<string, string> = {
  text: "txt",
  image: "img",
  pdf: "pdf",
  docx: "doc",
  other: "??",
};

interface Props {
  notes: string;
  onChange: (notes: string) => void;
  /** Atomic append — several files can finish while the textarea is being typed in. */
  onAppend: (text: string) => void;
}

export function NotesInput({ notes, onChange, onAppend }: Props) {
  const [attachments, setAttachments] = useState<AttachmentStatus[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const patch = useCallback((id: string, next: Partial<AttachmentStatus>) => {
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...next } : a)));
  }, []);

  /**
   * Files are processed one at a time rather than in parallel.
   *
   * Three photos fired at once is three concurrent Gemini calls on a key that a
   * whole conference room may be sharing — the fastest route to a 429. Sequential
   * is slower on paper and better in the room, and it lets each row report its own
   * progress instead of everything landing at once.
   */
  const ingest = useCallback(
    async (incoming: File[]) => {
      if (!incoming.length) return;

      const room = MAX_FILES - attachments.length;
      const batch = incoming.slice(0, Math.max(0, room));
      if (!batch.length) return;

      const rows: AttachmentStatus[] = batch.map((file) => ({
        id: newId(),
        name: file.name || "pasted image",
        kind: classify(file) ?? "other",
        state: "reading",
      }));
      setAttachments((prev) => [...prev, ...rows]);

      const apiKey = loadApiKey();

      for (let i = 0; i < batch.length; i++) {
        const file = batch[i];
        const row = rows[i];
        const kind = classify(file);

        if (!kind) {
          patch(row.id, {
            state: "error",
            error: "Unsupported file type. Try txt, docx, pdf, or an image.",
          });
          continue;
        }

        try {
          const text =
            kind === "text" ? await readTextFile(file) : await extractOnServer(file, kind, apiKey);

          if (!text) {
            patch(row.id, { state: "error", error: "No readable text found." });
            continue;
          }

          onAppend(withProvenance(row.name, text));
          patch(row.id, { state: "done", chars: text.length });
        } catch (error) {
          patch(row.id, {
            state: "error",
            error: error instanceof Error ? error.message : "Could not read that file.",
          });
        }
      }
    },
    [attachments.length, onAppend, patch],
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    ingest(Array.from(event.dataTransfer.files));
  };

  // Screenshotting a slide and hitting paste is the fastest capture there is.
  const onPaste = (event: React.ClipboardEvent) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length) {
      event.preventDefault();
      ingest(files);
    }
  };

  const busy = attachments.some((a) => a.state === "reading");

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-[3px] transition-colors ${
          dragging ? "ring-2 ring-signal ring-offset-2 ring-offset-paper" : ""
        }`}
      >
        <textarea
          value={notes}
          rows={16}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          placeholder={
            "- what they claimed\n- what surprised you\n- what they dodged\n\nOr drop in a photo of your notebook, a slide, a PDF or a Word file — it gets transcribed into here, where you can edit it."
          }
          className="field font-mono text-[0.8125rem] leading-relaxed"
        />

        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[3px] bg-paper/85">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-signal">
              Drop to transcribe
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="btn"
        >
          {busy ? "Reading…" : "Attach files"}
        </button>

        {/* `capture` opens the rear camera directly on a phone. Hidden on desktop,
            where it would just be a second file picker. */}
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          disabled={busy}
          className="btn touch-only"
        >
          Take a photo
        </button>

        <span className="ml-auto font-mono text-[0.625rem] text-ink-faint">
          {notes.trim().length} chars
        </span>
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          ingest(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          ingest(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <p className="text-xs leading-relaxed text-ink-faint">
        Photos, PDFs and Word files are transcribed into the box above — not summarised.
        Read what lands there before you generate; it is the only thing the model will
        be working from.
      </p>

      {attachments.length > 0 && (
        <ul className="space-y-1.5 border-t border-rule pt-3">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 shrink-0 font-mono text-[0.5625rem] uppercase tracking-[0.1em] ${
                  a.state === "error" ? "text-thin" : "text-ink-faint"
                }`}
              >
                {KIND_LABEL[a.kind] ?? "file"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[0.6875rem] text-ink">
                  {a.name}
                </span>
                <span
                  className={`block text-xs leading-snug ${
                    a.state === "error" ? "text-thin" : "text-ink-faint"
                  }`}
                >
                  {a.state === "reading" && <span className="blink">transcribing…</span>}
                  {a.state === "done" && `added ${a.chars?.toLocaleString()} characters`}
                  {a.state === "error" && a.error}
                </span>
              </span>
              {a.state === "done" && (
                <span className="mt-0.5 shrink-0 font-mono text-[0.625rem] text-rich">✓</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {attachments.length >= MAX_FILES && (
        <p className="font-mono text-[0.625rem] text-ink-faint">
          {MAX_FILES}-file limit reached for this session.
        </p>
      )}
    </div>
  );
}

/** Re-exported so the page can show the same size language in errors. */
export { humanSize };
