# Vestora demo journey: design

Date: 2026-11-24
Status: draft, awaiting approval

## Intent and why

Vestora's theme is portfolio rebalancing. Today a first-time visitor lands on a
dense dashboard, or on a 1,400-line side-scrolling street game, and has to work
out for themselves why rebalancing matters and what to do next. For a demo, that
is too much, too early.

We want a new, separate page that takes a general (non-expert) investor on one
short journey:

1. **Feel the problem** through a short, playable story (about 60 seconds).
2. **See** where their investments stand against benchmarks and global factors.
3. **Play** with a rebalance: move money from a holding into funds, bonds, FDs,
   savings, or loan prepayment, and watch the effect live.
4. **Leave with a plan**: a clear list of what to move where, and why.

What the person should feel: *"I can see my money clearly, and I can try changes
safely before I make any."*

Audience: end users with no finance background. Not investors, not advisors.

## Goals

- A new standalone page at `/demo/`, opened in the browser when ready.
- The story is the entry point. It sets up the one idea of the product: a
  portfolio can be lopsided, and rebalancing levels it.
- "See it" shows each major holding against its relevant benchmark, plus the
  global factors (inflation, interest rates, geopolitical stress, equity market
  shock) that move the portfolio.
- "Play" lets the user pick a holding and split its money across destination
  segments (equity funds, bonds, FDs, savings, gold, home-loan prepayment) and
  see before/after allocation, risk score and 5-year outcome update live.
- "Your plan" summarises the moves, the reasons, and the before/after result.
- Real numbers: the demo runs on the existing calculation code and the existing
  sample (or the visitor's own saved) portfolio.
- Works offline-ish: if live market calls fail (they currently do on localhost
  because of CORS), the demo falls back to stored benchmark numbers and labels
  the data as sample data.
- Looks clearly better than the current screens, on desktop (1440) and mobile
  (375).

## Non-goals

- Not a redesign of the six existing screens. They stay exactly as they are.
- Not a marketing or pitch-deck page.
- No saving, no writing to the visitor's stored portfolio, no executing trades.
  The demo only reads.
- No new analytics events, no SEO work. The page is `noindex` and stays out of
  `sitemap.xml`.
- No PDF or Excel export from the demo (the existing app has these).
- No changes to the existing app's navigation. (A link to `/demo/` can come
  later.)

## Anti-goals (a failure even if it technically works)

- Numbers that are made up or disagree with the real app.
- A dark, neon "fintech terminal" look that feels like the current dashboard
  with more glow.
- Jargon-first copy. Plain words, sentence case, one job per sentence.
- Anything that looks like personalised investment advice. The existing
  "illustrative, not investment or tax advice" note carries over.
- A demo that breaks when the network is slow or blocked.

## Constraints

- Stack stays as is: Vite, React 19, Tailwind 4, Recharts, lucide-react.
  No new runtime dependencies without asking.
- The existing `src/index.css` overrides the global Tailwind `slate`, `emerald`
  and `indigo` ramps. The demo must not inherit or change those. It gets its
  own stylesheet with its own tokens.
- The repo has no test runner. Verification is `npm run lint` (tsc),
  `npm run build`, and visual checks in a browser.
- Indian number formatting (`₹1.19 Cr`, `₹6.92 L`) via the existing
  `formatCurrency`.
- Fonts load from Google Fonts like the rest of the site. System fonts are the
  fallback so the page is readable if the font request fails.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | New guided-journey page at `/demo/`, built from new components on top of the existing calculation code | Focused flow and a new look; covers the rebalancing story, not all six screens |
| B | Reskin all six existing screens in place | Safest for logic, but a heavy edit across ~12,000 lines that only changes colours; story still not the entry point, no single flow |
| C | Hand-built clickable prototype with made-up numbers | Fastest and could look best, but fake numbers can't double as a working demo |

Chosen: **A**, confirmed by the project owner. It matches the stated flow
(story, then see, then play) and keeps the real yield, tax and risk logic.

## Design

### Where it lives

- New Vite entry `demo/index.html`, added to `build.rollupOptions.input` in
  `vite.config.ts` (the only edit to existing config).
- Entry script `src/pages/demoMain.tsx`; components under `src/demo/`;
  stylesheet `src/demo/demo.css` with its own `@import "tailwindcss"` and its
  own tokens. It does not import `src/index.css` and does not call
  `initAnalytics`.
- `<meta name="robots" content="noindex">`; not added to `sitemap.xml`.

### Data and logic reused (read-only)

- Portfolio: `loadPersistedPortfolio()` if the visitor has one, otherwise
  `sampleHoldingsFor(DEMO_PROFILES[0])` (the Vikram sample). The demo never
  calls `savePersistedPortfolio`.
- Allocation and gaps: `analyzeAllocationProfile`,
  `TARGET_MIX_BY_GOAL` in `src/utils/smartDiversification.ts`.
- Suggested moves and destinations: `generateSmartDiversificationPlans`
  (source holding, destinations, loan interest saved, risk before/after).
- Benchmarks: `AMFI_BENCHMARK_CONFIG` fallback yields; `fetchLiveMarketBenchmarks`
  is tried with a short timeout and the page falls back silently to the stored
  yields, with a small "Sample data" or "Live" tag.
- Global factors and 5-year outcome: `runMacroSimulation`,
  `computeInputBasedShuffle` in `src/utils/simulationEngine.ts`.
- Totals, trend, summary: `src/utils/portfolioMetrics.ts`.
- Money formatting: `src/utils/currency.ts`.

### Visual direction

Subject: a portfolio that is out of balance and gets levelled. So the one
memorable element is a **balance beam** that tilts with the portfolio's mix. It
appears in the story (lopsided, then levelled by the player), stays as a slim
indicator through See and Play, and is level and calm on the final plan.
Everything around it stays quiet.

Palette (light, calm, not the dark terminal look):

| Name | Hex | Use |
|---|---|---|
| Ink | `#14213D` | text, beam, primary buttons |
| Mist | `#EEF2F6` | page background |
| Paper | `#FFFFFF` | panels |
| Level green | `#02A26D` | only means "balanced / on target" (the Vestora brand colour) |
| Tilt amber | `#E8A33D` | overweight / needs attention |
| Risk coral | `#D8454B` | risk and losses |

Asset buckets get fixed hues so a bucket is the same colour everywhere: equity
indigo `#4C5CE6`, debt teal `#1F8A9E`, gold amber `#C99A2E`, cash slate
`#6B7A90`.

Type: Bricolage Grotesque for headings and big numbers (character, variable
width), Figtree for body and UI. Numbers use tabular figures. No monospace for
labels. Sentence case, no all-caps tracked labels.

Layout: one centred reading column (about 1120px wide) with left-aligned text.
A slim chapter bar at the top (The problem, See it, Play, Your plan) that shows
progress and lets people jump back. On mobile the panels stack and the chapter
bar collapses to a progress strip.

```
Top bar:  Vestora          The problem · See it · Play · Your plan     Full app
Story:    [ headline + one line ]   [ beam, 9 weights piled on one side ]
          [ 4 tap-through beats; beat 3 is playable: move a weight to level it ]
See it:   [ Your mix vs target (bar) ]  [ holdings vs benchmark rows ]
          [ 4 global-factor controls feeding a small 5-year chart ]
Play:     [ Pick what to move ] -> [ Split it: destination cards + amount sliders ]
          [ live before/after mix, risk score, 5-year outcome, beam updates ]
Plan:     [ moves list with reasons ] [ before/after summary ] [ Open in full app ]
```

Motion: one orchestrated moment (the beam tilting and settling). Everything else
responds to the user's action only. Reduced-motion is respected (beam snaps
instead of swinging).

Self-review of the plan against the brief: the first draft used a dark
near-black base with an emerald accent, and a cream base with a warm accent was
the alternative; both are common generated defaults and neither is tied to
rebalancing. Revised to a cool light base, ink navy, and emerald reserved for
the single meaning "balanced", with the beam as the identity.

### Story (about 60 seconds, four beats)

1. "You own nine things and nobody has looked at them together." Weights pile on
   one side of the beam.
2. "Everyone you ask pulls a different way." Three short voices (a finance
   forum, a commission advisor, a wealth manager), each biased in one line.
3. "Balance looks like this." Playable: drag one weight across to level the beam;
   the player gets a simple balance score.
4. "Try it on a sample portfolio." Button goes to See it. A small "use my saved
   portfolio" option appears if one exists.

Skippable at any time. Replaces the street-walking game for the demo only.

### How the numbers work (decided after a build review)

The existing plan generator produces fixed, pre-computed plans; Play needs a
user-chosen split. So the build adds **one new pure module**
(`src/demo/splitEngine.ts`) and no changes to existing utilities.

- **Split to numbers.** A split (source holding, amount, destinations) becomes a
  list of synthetic holdings, the same way `generateSmartDiversificationPlans`
  builds its internal "after" list. That list feeds `computePortfolioRiskScore`
  (risk before/after) and `computePortfolioAllocation` (the five buckets the
  simulator uses).
- **Destinations and rates.** The destination cards come from the plan
  generator's own suggested destinations, so rates and tax tags match the full
  app. Where a destination type has no live or suggested rate, it uses the
  stored `AMFI_BENCHMARK_CONFIG` fallback yields, or the sample FD and savings
  rates already in the app's data. The destination types are: equity and index
  funds, debt and bond funds, FDs, savings and liquid, gold, and home-loan
  prepayment. They map onto the existing bucket logic, so there is no new
  taxonomy for calculations.
- **What can move.** Any holding except locked-in retirement money (EPF, PPF,
  NPS), which is shown but can't be picked as a source. Amounts are shown gross.
  A short note says tax or exit charges may apply; the demo does not deduct them.
- **Inputs.** The same defaults as the full app: Balanced goal, 30% tax slab,
  home loan included at 8.55%. The demo exposes only the goal (Conservative,
  Balanced, Growth) as a three-way choice in See it. The loan destination is
  hidden when the portfolio has no loan.
- **Five-year outcome.** Always `runMacroSimulation` over the chosen horizon
  (default 5 years). See it shows baseline against scenario for the portfolio as
  it is today. Play uses the same factor settings and compares scenario-today
  against scenario-after-your-split, with baseline as a faint reference line. The
  factor values live in one shared journey state so they carry from See it into
  Play. `computeInputBasedShuffle` is used only for the "suggested" starting
  split, never for the user's own split.
- **Benchmark rows in See it.** A small mapping from holding category to
  benchmark (equity and index funds to Nifty 50 or flexi cap, bond and
  corporate debt to corporate bond fund, gold to gold FoF, cash to liquid, and
  so on). Each row compares the holding's own return or yield with its benchmark
  yield. Holdings with no honest benchmark (EPF, NPS, US equity basket) are
  listed in a short "No direct benchmark" line and are not compared. Rows show
  the six largest holdings by value.
- **Open in the full app.** A plain link to `/#rebalance`. No plan is carried
  over, which is consistent with the demo never writing to storage.

### Quality floor

Responsive from 375px with no horizontal scroll; keyboard operable (sliders and
buttons, visible focus); the beam has a text equivalent ("Equity is 11 points
over target"); contrast checked; no layout shift when numbers change; amounts
update on slider drag without lag.

## Verification

`npm run lint`, `npm run build` (demo entry builds alongside the existing five),
then in a real browser at 1440 and 375: console clean, full journey completed,
a rebalance played with a mix that changes the numbers, the offline fallback
checked by blocking the benchmark call, and a keyboard-only pass. Screenshots
before and after are kept in `.playwright-mcp/` (git-ignored).

## Left to the builder

- Exact copy for the three biased voices and the plan summary lines.
- Component split inside `src/demo/`, state shape for the journey.
- Slider versus numeric-input details for splitting money, as long as keyboard
  use works.
- Which of the plan's suggested moves is the default selection in Play.
- Balance-score formula for the story mini-game.

## Calls made without a decision from the owner (please check)

- Light theme instead of the current dark theme.
- Bricolage Grotesque and Figtree as the typefaces.
- The story is new and shorter; the existing street game is not reused.
- The demo reads the visitor's saved portfolio but never writes to it.
- `noindex`, no sitemap entry, no analytics.
- Amounts are shown gross, with a note that tax or exit charges may apply.
- Only the goal is exposed as a setting; tax slab and loan use the full app's
  defaults.
- The benchmark list shows the six largest holdings, and holdings without an
  honest benchmark are named but not compared.
- "Open in the full app" is a plain link, with no plan carried over.
