import type { MetadataRoute } from "next";

/**
 * What makes the browser offer "Install".
 *
 * `display: standalone` is the point of the exercise: once installed, the app
 * opens in its own window with no URL bar, so an attendee taps an icon on their
 * home screen instead of finding a link again in a conference hall.
 *
 * The orientation is deliberately left unset. Locking to portrait would stop
 * someone turning their phone sideways to read a wide briefing comparison.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TalkAbout Sessions",
    short_name: "TalkAbout",
    description:
      "Get a preview of the session you're about to attend — what the speaker is likely to cover, what to expect, and the questions worth taking with you.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0a09",
    theme_color: "#0b0a09",
    categories: ["productivity", "education", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops icons to its own shape; the maskable variant keeps the
      // mark inside the safe zone so nothing is sliced off.
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
