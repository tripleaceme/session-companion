/**
 * Install state, modelled as an external store.
 *
 * Everything here — whether the browser has offered an install, whether we are
 * already running as an installed app, which platform we are on — is knowable
 * only in the browser, and only after mount. That is the same shape as the
 * session archive, so it is read the same way: `useSyncExternalStore`, with an
 * empty server snapshot, rather than a `setState` inside an effect.
 */

const DISMISSED_KEY = "talkabout.install-dismissed";

export interface PwaSnapshot {
  /** False until the client has had a chance to look. */
  ready: boolean;
  /** Chrome/Edge/Android fired beforeinstallprompt, so a real prompt exists. */
  installable: boolean;
  /** Already installed, or launched from the home screen. */
  standalone: boolean;
  /** iOS Safari never fires the event; it needs Share → Add to Home Screen. */
  ios: boolean;
  dismissed: boolean;
}

const EMPTY: PwaSnapshot = {
  ready: false,
  installable: false,
  standalone: false,
  ios: false,
  dismissed: false,
};

let snapshot: PwaSnapshot = EMPTY;
const listeners = new Set<() => void>();

/** The captured event, kept out of the snapshot because it is not serialisable. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let deferredPrompt: InstallPromptEvent | null = null;

function commit(patch: Partial<PwaSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

export function getSnapshot(): PwaSnapshot {
  return snapshot;
}

export function getServerSnapshot(): PwaSnapshot {
  return EMPTY;
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function detectStandalone(): boolean {
  // iOS uses a non-standard navigator flag; everyone else has the media query.
  const iosStandalone =
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

function detectIos(): boolean {
  const ua = window.navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so the touch-point check is what
  // separates an iPad from a desktop Safari that cannot install at all.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1)
  );
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  const onBeforeInstall = (event: Event) => {
    // Suppress Chrome's own mini-infobar so the prompt appears where we choose.
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    commit({ installable: true });
  };

  const onInstalled = () => {
    deferredPrompt = null;
    commit({ installable: false, standalone: true });
  };

  window.addEventListener("beforeinstallprompt", onBeforeInstall);
  window.addEventListener("appinstalled", onInstalled);

  if (!snapshot.ready) {
    commit({
      ready: true,
      standalone: detectStandalone(),
      ios: detectIos(),
      dismissed: readDismissed(),
    });
  }

  return () => {
    listeners.delete(listener);
    window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

/** Returns false when the browser had nothing to show (iOS, or already installed). */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  // The event is single-use; Chrome fires a fresh one if the user declines and
  // later becomes eligible again.
  deferredPrompt = null;
  commit({ installable: false });

  return outcome === "accepted";
}

export function dismissInstall(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // A browser blocking storage just means the banner returns next visit.
  }
  commit({ dismissed: true });
}

/**
 * Registers the service worker.
 *
 * Production only: in development Turbopack serves modules that change on every
 * edit, and a worker caching them turns "did my change apply?" into a coin toss.
 */
export function registerServiceWorker(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register("/sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => warmAssetCache())
    .catch(() => {
      // An install failure should never break the page; the app works online
      // exactly as before, it simply will not open offline.
    });
}

/**
 * Hand the worker the assets this page just loaded, so they are cached now.
 *
 * On a first visit the worker is not yet controlling the page, so its fetch
 * handler never sees the scripts, styles and fonts Next requested — offline
 * would then depend on the browser's HTTP cache, which is evictable. The
 * Performance API already knows exactly what was fetched, and the filenames are
 * content-hashed, so replaying that list is both cheap and safe.
 *
 * This matters at a conference: someone opens the app once on the venue wifi,
 * and it has to keep working when the room fills up and the signal dies.
 */
function warmAssetCache(): void {
  const worker = navigator.serviceWorker.controller ?? null;
  if (!worker) return;

  const urls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => {
      try {
        const url = new URL(name);
        return (
          url.origin === location.origin &&
          (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))
        );
      } catch {
        return false;
      }
    });

  if (urls.length) worker.postMessage({ type: "WARM_CACHE", urls });
}
