/**
 * Client-side handling for notes captured as files rather than typed.
 *
 * Three routes, chosen by what the file actually is:
 *
 *   .txt / .md   read here in the browser — no round trip, no model, no cost.
 *   .docx        unzipped on the server; it is a ZIP, not a picture of words.
 *   image / pdf  read by Gemini, which handles both natively.
 *
 * Whatever comes back is written into the notes textarea, where the attendee can
 * see and edit it before generating. That is deliberate: an app whose argument is
 * "you should be able to audit what the model was told" must not quietly swallow
 * a photograph into a prompt the user never sees.
 */

export type AttachmentKind = "text" | "image" | "pdf" | "docx";

export interface AttachmentStatus {
  id: string;
  name: string;
  /** "other" is a file we refused — it has no extraction route. */
  kind: AttachmentKind | "other";
  state: "reading" | "done" | "error";
  /** Characters contributed to the notes, once extracted. */
  chars?: number;
  error?: string;
}

const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
];

/** What the file input advertises. `capture` on a second input opens the camera. */
export const ACCEPT =
  ".txt,.md,.markdown,.text,.docx,.pdf,image/png,image/jpeg,image/webp,image/heic,image/heif";

export const MAX_FILES = 10;
/** Vercel rejects serverless request bodies over 4.5MB; leave room for encoding overhead. */
export const MAX_UPLOAD_BYTES = 3_800_000;
const MAX_TEXT_BYTES = 1_000_000;

export function classify(file: File): AttachmentKind | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (IMAGE_TYPES.includes(type) || /\.(png|jpe?g|webp|heic|heif|gif)$/.test(name)) {
    return "image";
  }
  // Deliberately narrower than `text/*`: a browser reports .mjs, .csv and .html
  // as text types too, and silently ingesting a source file someone mis-clicked
  // is worse than telling them it isn't a notes format. The extension check
  // comes first because some browsers report no type at all for .md.
  if (
    /\.(txt|md|markdown|text)$/.test(name) ||
    type === "text/plain" ||
    type === "text/markdown"
  ) {
    return "text";
  }

  return null;
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Plain text never leaves the browser — reading it server-side would buy nothing. */
export async function readTextFile(file: File): Promise<string> {
  if (file.size > MAX_TEXT_BYTES) {
    throw new Error(`That text file is ${humanSize(file.size)}; the limit is 1 MB.`);
  }
  return (await file.text()).trim();
}

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Shrink a photo before uploading it.
 *
 * A modern phone camera produces 3-6MB files, which blow past Vercel's 4.5MB body
 * limit and crawl over conference wifi. Nothing is lost by capping the long edge at
 * 1600px: text in a slide photo or a page of handwriting is comfortably legible to
 * the model at that size, and the upload drops to a few hundred kilobytes.
 *
 * Returns the original file untouched if the browser cannot decode it — Chrome
 * cannot decode HEIC, for instance, but Gemini can, so passing it through is
 * strictly better than failing.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (file.size <= 400_000) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    // Already small enough in both dimensions — re-encoding would only lose quality.
    if (scale === 1 && file.size <= MAX_UPLOAD_BYTES) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Send one file to the extractor. One request per file, so status is per-file. */
export async function extractOnServer(
  file: File,
  kind: AttachmentKind,
  apiKey: string,
): Promise<string> {
  const payload = kind === "image" ? await prepareImage(file) : file;

  if (payload.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `${humanSize(payload.size)} is too large to upload — the limit is ${humanSize(MAX_UPLOAD_BYTES)}.`,
    );
  }

  const body = new FormData();
  body.append("file", payload, file.name);
  body.append("kind", kind);

  const response = await fetch("/api/extract", {
    method: "POST",
    headers: apiKey ? { "x-gemini-key": apiKey } : undefined,
    body,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error ?? "Could not read that file.");
  return String(data.text ?? "").trim();
}

/** A quiet marker so the model — and the attendee — can see where text came from. */
export function withProvenance(name: string, text: string): string {
  return `--- from ${name} ---\n${text}`;
}
