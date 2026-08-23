import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Newsreader, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/* Three faces, three jobs — display, prose, instrumentation. next/font self-hosts
   each one at build time, so there is no external request and no layout shift. */

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Session Companion — context in, judgement out",
  description:
    "Prepare for a conference talk, then debrief it. Watch how the amount of context you supply changes what the AI can honestly tell you.",
  applicationName: "Session Companion",
  openGraph: {
    title: "Session Companion",
    description:
      "Give it a little about a talk, or give it a lot. See exactly how much of the answer was grounded and how much was guessed.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0a09",
  width: "device-width",
  initialScale: 1,
  // Attendees will pinch to read the briefing on a phone in a dim hall.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${newsreader.variable} ${plexMono.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
