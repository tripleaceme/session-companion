import { NextResponse } from "next/server";
import { unzipSync } from "fflate";
import { DEFAULT_MODEL, client, thinkingConfigFor } from "@/lib/gemini";

export const maxDuration = 60;

const MAX_BYTES = 4_000_000;

type Kind = "image" | "pdf" | "docx";

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/**
 * Turn an uploaded file into plain text for the notes box.
 *
 * This route deliberately transcribes rather than summarises. The debrief step
 * is where interpretation is allowed to happen, and only from text the attendee
 * has seen and can edit. Compressing a photo of a slide into "key points" here
 * would hide a whole inference step behind a file picker.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "That upload could not be read.");
  }

  const file = form.get("file");
  const kind = String(form.get("kind") ?? "") as Kind;

  if (!(file instanceof File)) return fail(400, "No file was attached.");
  if (file.size === 0) return fail(400, "That file is empty.");
  if (file.size > MAX_BYTES) {
    return fail(413, `That file is too large. The limit is ${MAX_BYTES / 1_000_000} MB.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // A Word file is a ZIP archive, so it needs an unzipper rather than a model.
  // Doing this locally is faster, free, and cannot paraphrase.
  if (kind === "docx") {
    try {
      const text = extractDocx(bytes);
      if (!text.trim()) {
        return fail(422, "That Word file has no readable text in it.");
      }
      return NextResponse.json({ text, via: "docx" });
    } catch {
      return fail(
        422,
        "That does not look like a .docx file. Older .doc files are not supported — save as .docx or paste the text.",
      );
    }
  }

  if (kind !== "image" && kind !== "pdf") {
    return fail(400, "Unsupported file type.");
  }

  const apiKey =
    request.headers.get("x-gemini-key")?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return fail(500, "No Gemini API key is configured, so images and PDFs cannot be read.");
  }

  // Browsers sometimes report an empty MIME type; fall back to something valid.
  const mimeType =
    file.type || (kind === "pdf" ? "application/pdf" : "image/jpeg");

  try {
    const response = await client(apiKey).models.generateContent({
      model: DEFAULT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: Buffer.from(bytes).toString("base64") } },
            { text: kind === "pdf" ? PDF_PROMPT : IMAGE_PROMPT },
          ],
        },
      ],
      config: {
        systemInstruction: TRANSCRIBE_SYSTEM,
        temperature: 0,
        thinkingConfig: thinkingConfigFor(DEFAULT_MODEL),
      },
    });

    const text = (response.text ?? "").trim();
    if (!text) return fail(502, "Nothing readable came back. Try again, or a clearer photo.");

    return NextResponse.json({ text, via: DEFAULT_MODEL });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/\b429\b/.test(message)) {
      return fail(429, "Rate limited while reading that file. Try again in a moment.");
    }
    if (/\b503\b/.test(message)) {
      return fail(503, "Gemini is overloaded. Try that file again in a few seconds.");
    }
    console.error("[extract]", message);
    return fail(500, "Could not read that file.");
  }
}

const TRANSCRIBE_SYSTEM = `You transcribe. You do not summarise, interpret, tidy, or complete.

Rules:
1. Reproduce what is actually there, in the order it appears. Keep the writer's own wording, abbreviations, arrows and shorthand.
2. If something is genuinely illegible, write [illegible] rather than guessing at it. A gap the reader can see is worth more than a plausible invention.
3. Do not add headings, commentary, or "here is the transcription". Return the content only.
4. Preserve structure that carries meaning — bullets, numbering, indentation — using plain text markers.
5. If the image contains no text at all, describe what it shows in one plain sentence, prefixed with [image].`;

const IMAGE_PROMPT = `Transcribe every piece of text in this image. It is most likely a photo of handwritten notes, a notebook page, a whiteboard, or a slide from a conference talk.`;

const PDF_PROMPT = `Transcribe the text of this document, page by page, in order. Separate pages with a blank line. Skip page furniture like headers, footers and page numbers.`;

/* ------------------------------------------------------------------ *
 * .docx text extraction
 *
 * A .docx is a ZIP whose prose lives in word/document.xml. Paragraphs are
 * <w:p> elements and runs of text are <w:t>. Pulling those out is a few
 * lines and no dependency beyond an unzipper — far lighter than a full
 * document-conversion library, and enough for notes.
 * ------------------------------------------------------------------ */

function extractDocx(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("no document.xml");

  const xml = new TextDecoder().decode(doc);

  return (
    xml
      // Field codes (HYPERLINK, PAGEREF…) are markup, not prose.
      .replace(/<w:instrText[\s\S]*?<\/w:instrText>/g, "")
      // Structural marks become their plain-text equivalents before tags are stripped.
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:br\s*\/?>/g, "\n")
      .replace(/<w:tab\s*\/?>/g, "\t")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      // Ampersand last, so a literal "&amp;lt;" does not decode twice.
      .replace(/&amp;/g, "&")
      // Word emits a paragraph per line break; collapse the runs of blanks it leaves.
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
