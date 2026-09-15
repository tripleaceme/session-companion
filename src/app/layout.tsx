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

/**
 * Social previews need an absolute URL, so opengraph-image.png cannot be
 * resolved without a base.
 *
 * The canonical host is hardcoded rather than read from Vercel's generated
 * `VERCEL_PROJECT_PRODUCTION_URL`, which would point every shared card at the
 * *.vercel.app address even when the page was opened on the real domain. This
 * page is statically rendered, so it cannot look at the request host — the
 * canonical name has to be a build-time fact. SITE_URL still overrides it for
 * anyone running a fork on a different host.
 */
const siteUrl =
  process.env.SITE_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://talkabout.ayoadeabel.tech"
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "TalkAbout Sessions — context in, judgement out",
  description:
    "Prepare for a conference talk, then debrief it. Watch how the amount of context you supply changes what the AI can honestly tell you.",
  applicationName: "TalkAbout Sessions",
  openGraph: {
    title: "TalkAbout Sessions",
    description:
      "Get a preview of the session you're about to attend.",
    type: "website",
    siteName: "TalkAbout Sessions",
    // Resolved against metadataBase. Without it a card shared from the old
    // *.vercel.app host would claim that host as the canonical page.
    url: "/",
  },
  alternates: { canonical: "/" },
  twitter: {
    card: "summary_large_image",
    title: "TalkAbout Sessions",
    description:
      "See what the speaker is likely to cover, what to expect, and the questions worth taking with you."
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
