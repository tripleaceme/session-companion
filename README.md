# Session Companion

A conference companion for a single talk: prepare before it, debrief after it, and — the actual point — **watch how the amount of context you supply changes what the AI can honestly tell you**.

Built as the demo environment for a RenderCon talk on the question:

> How do we design AI features in React when the system doesn't always have enough information to give a reliable answer?

The app isn't the talk. The app is where the engineering problem is explored, live, by the audience.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # add your Gemini key
npm run dev                     # http://localhost:3000
```

Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

---

## What it does

### Before a session

Paste whatever you have about a talk — title, abstract, speaker name, bio, the announcement post, links, their prior talks and articles, and what you personally want out of it. Nine fields, all optional.

You get back what it will probably cover, what to pay attention to, concepts worth understanding beforehand, and questions you could ask on the mic.

### After a session

Paste your notes. You get a summary, the key takeaways, what was left unanswered, and a LinkedIn post you could actually publish — plus a scorecard grading the pre-session predictions against what actually happened.

### History

Every session is stored in `localStorage` and listed in the sidebar, ChatGPT-style. Click to reopen. Runs, notes and debriefs all come back. Nothing is sent anywhere except the prompts themselves.

---

## The three things that make it a teaching tool

**1. Context is measured, not assumed.** Every field carries a weight, and the meter scores the whole context out of 100 on a saturating curve — the first forty characters of an abstract count for far more than the fortieth to eightieth. The score tiers into thin / partial / rich.

**2. Every claim is tagged with its provenance.** The model classifies each prediction as `grounded` (restates something you supplied), `inferred` (a short step from it), or `speculation` (running on the topic name and general knowledge), and names the field it leaned on. Speculation renders with a dashed border and lower contrast — you can tell from six feet away.

The **grounding ledger** tallies this. It is the number the talk turns on:

| Context | Confidence | Grounded | Inferred | Guessed |
|---|---|---|---|---|
| Title only (12/100) | low | 0 | 0 | **8** |
| Everything (99/100) | high | 1 | 8 | 2 |

Same model. Same prompt. Same session. The only variable is how much you told it.

**3. The interface *is* the confidence reading.** `--signal` is rebound from the context tier, so the entire page — accent, glow, buttons, meter — sits in a warning rust at thin context and cools to sage at rich. Trust is the palette, not a badge.

---

## Running it live

The progression is done by hand, which is the honest version of it: paste only the **session title**, generate, and read the ledger. Then paste the abstract and speaker, generate again. Then open **Deeper context**, add the bio, the announcement post and their prior talks, and generate a third time.

Then **shift-click** an earlier run in the run strip to put two runs side by side, with the deltas computed for you.

Adding context without rewriting what's already there is what makes the comparison mean anything — if you also reword the abstract between runs, you can no longer say the added context caused the change.

Before the event:

- Point a QR code at your deployed URL.
- Expect the shared key to rate-limit under a room of people. The **API key** button lets any attendee paste their own and skip the queue; 429 and 503 are retried twice with backoff before an error is ever shown.

---

## Architecture

```
src/
  app/
    api/generate/route.ts   Server-only Gemini call. The API key never reaches the browser.
    page.tsx                Orchestrator: phases, panes, run selection.
  components/
    ContextMeter.tsx        The gauge and the per-field gap breakdown.
    ContextForm.tsx         Nine weighted fields + the cumulative presets.
    BriefingView.tsx        Grounding tags and the ledger.
    RunHistory.tsx          Run strip + the side-by-side comparison.
    DebriefView.tsx         Summary, takeaways, prediction scorecard, shareable post.
    Sidebar.tsx             Session archive.
  lib/
    gemini.ts               Response schemas, system prompts, thinking config.
    context-score.ts        Field weights and the scoring curve.
    session-store.ts        localStorage as an external store.
    storage.ts              Serialisation, quota handling, repair-on-read.
```

### Notes on the implementation

**Constrained decoding, not JSON parsing.** The response schemas are passed as `responseSchema`, which masks the sampler so Gemini physically cannot emit a token that breaks the shape. There is no JSON-repair code anywhere. `propertyOrdering` is load-bearing too: `claim` is generated before `grounding`, so the model commits to a claim and *then* judges it, rather than picking a confidence label and writing to fit.

**Absence is sent to the model.** The prompt renders a "Context NOT supplied" list alongside what was supplied. A model can't reason about a gap it can't see — naming the gaps is what lets it say "I'm speculating because I have no bio" instead of inventing one.

**`useSyncExternalStore`, not `useEffect`.** localStorage genuinely is state outside React, so it's modelled as an external store rather than copied into component state on mount. That removes the cascading render, makes hydration correct by construction (`getServerSnapshot` returns empty), and gives cross-tab sync for free.

**Derivation over synchronisation.** Nothing resets `selectedRunId` when you switch sessions. A stale id simply fails to match and the fallback picks the newest run. Same for the compare selection and for errors, which are tagged with the session they belong to.

**Model choice was measured.** `gemini-3.5-flash` is pinned rather than tracking `gemini-flash-latest`. On the rich-context preset, `gemini-3.7-flash` took ~19s to 3.5's ~5.8s and produced a *less* grounded ledger — and `gemini-flash-latest` was the only name returning 503s while every pinned model served fine. An alias that rolls forward mid-conference is not a risk this app needs.

---

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `GEMINI_API_KEY` | — | Required, unless every user brings their own. |
| `GEMINI_MODEL` | `gemini-3.5-flash` | |
| `GEMINI_THINKING_LEVEL` | `LOW` | `LOW` / `MEDIUM` / `HIGH` for Gemini 3.x. Not every model accepts every level. |
| `GEMINI_THINKING_BUDGET` | `0` | Only used if `GEMINI_MODEL` is a 2.5-series model. |

## Commands

```bash
npm run dev      # dev server
npm run build    # production build (type-checks)
npm run lint     # eslint
```
