# Vestora: first-run welcome screen — one sample, or start from scratch

Date: 2026-11-25
Status: approved by owner (approach (a) chosen 2026-11-25; doc written from that choice)
Depends on: Project C (reskin) lands first — both touch Navbar/App shell; C is mid-flight.

## Intent and why

Today the app seeds every first visit with a full sample portfolio and offers three
switchable "demo personas" in the navbar. The owner wants one sample dataset only —
highlighted for visitors who want it — and a real start-from-scratch path with a
first-run welcome so new users choose deliberately instead of silently inheriting
sample numbers.

## Owner decisions

- Approach (a): a full-screen welcome on first visit with two choices —
  "Explore with sample data" (highlighted, recommended) and "Start from scratch".
- After choosing, the existing OnboardingTour begins.
- Exactly one sample dataset survives (the one the /demo/ journey uses:
  `DEMO_PROFILES[0]`); the other two personas and the navbar "Demo Persona"
  dropdown go away.

## Goals

- A first visit asks: sample or scratch — one click either way, sample visually
  recommended.
- Scratch mode is a real empty state: purposeful, pointing at Add holding and
  Import, never a blank screen.
- The tour greets the chosen mode: same steps either way (they explain
  export/privacy/tour-reopen, which matter in both modes).
- Existing visitors (a saved portfolio in localStorage) never see the welcome.

## Non-goals

- No changes to the /demo/ journey — its sample/saved/add-mine choice already
  exists and stays.
- No new personas, no persona management, no analytics.
- No changes to what the sample portfolio contains (the demo journey shares it).
- No changes to Project C's styling; this lands after C, wearing the light theme.

## Design

- **Welcome screen** (`src/components/WelcomeScreen.tsx`, new): light-theme
  full-screen (Mist bg, Paper cards, demo type). Title "Welcome to Vestora", one
  line of plain-words context ("Plan your rebalance in your browser — nothing
  leaves your device."). Two cards:
  - **Explore with sample data** — highlighted (Level-green edge + "Recommended"
    tag), one click loads the sample and starts the tour.
  - **Start from scratch** — plain card, sets an empty portfolio and starts the
    tour.
  Keyboard operable, focus lands on the highlighted card; Escape does not skip
  the choice (the visitor must pick one; a small "skip the tour" link inside the
  tour itself still exists).
- **Gating:** App decides on mount: if `loadPersistedPortfolio()` returns a
  portfolio, boot straight into it (no welcome, no forced tour). If not, show the
  welcome instead of the seeded sample. Both choices are recorded by writing the
  resulting portfolio state through the app's existing save path
  (`savePersistedPortfolio`) — an empty-scratch choice persists an explicit empty
  portfolio so a reload doesn't re-ask.
- **Scratch empty states:** Overview (the only tab a fresh visitor lands on) gets
  a purposeful empty state: "You haven't added any investments yet." with two
  buttons — Add holding / Import a file — reusing the existing modals. Other tabs
  keep their existing behaviour with zero holdings (Rebalance etc. already
  degrade; a spot-check task verifies no tab breaks on empty).
- **Persona cleanup:** `DEMO_PROFILES[1]` and `[2]` removed from `mockData.ts`
  (their `holdings:` arrays too); the navbar "Demo Persona" select is deleted;
  `handleProfileSwitch` collapses away. The demo journey's
  `sampleHoldingsFor(DEMO_PROFILES[0])` is untouched.
- **Tour link:** existing "Tour" button in the navbar keeps working exactly as
  today (reopen anytime).
- **FX first-paint fix (owner-approved addition, 2026-11-25):** the Overview
  header total (`totalValuation` useMemo keyed on holdings/baseCurrency) shows
  stale benchmark-FX figures on first paint because the module-level `FX_RATES`
  is mutated by `refreshFxRates()` without retriggering the memo. Fix as part
  of this work: make the header recompute when FX rates change (e.g. an
  fx-version in the memo deps or lifting the conversion), so first paint shows
  live-FX numbers (₹1,22,15,620, not ₹1,19,68,450 on the sample).

## Anti-goals (failure even if it works)

- A returning visitor is shown the welcome or loses their saved portfolio.
- The sample data changes (demo journey depends on it byte-for-byte).
- A scratch user lands on a broken tab (crash or NaN figures with zero holdings).
- The welcome writes anything except through the app's normal save path.

## Risks

- Zero-holding paths in Rebalance/Radar/Tax/Simulator were never a supported
  entry state — the spot-check task must walk all four tabs empty and fix any
  crash (styling fixes only; behaviour fixes belong here, not to C).
- The empty-portfolio persistence must not collide with the demo's
  never-write rule (different surface: the app writes, the demo doesn't — both
  already true).

## Left to the builder

- Exact welcome copy beyond the fixed lines above.
- Tour first-step tweak if any (e.g. a sentence acknowledging the chosen mode) —
  optional, builder's call, plain words.
- How the empty-state buttons anchor to the existing modals.
