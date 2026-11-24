# Vestora demo journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new standalone `/demo/` page that takes a general investor through a short playable story, a "See it" benchmark and global-factor view, a "Play" rebalance simulator, and a final plan, using Vestora's real calculation code.

**Architecture:** A new Vite entry (`demo/index.html` → `src/pages/demoMain.tsx` → `src/demo/DemoApp.tsx`) with its own stylesheet and tokens. Pure, unit-tested logic lives in three small modules (`balance.ts`, `benchmarkMap.ts`, `splitEngine.ts`) plus a data module; chapter components are thin and read from one shared journey state. Nothing in the existing app changes except one line of `vite.config.ts`.

**Tech Stack:** Vite 8, React 19, Tailwind 4, Recharts, lucide-react (all existing). Tests use Node's built-in runner through the already-installed `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-24-rebalance-demo-journey-design.md`

## Global Constraints

- New page at `/demo/`; existing six screens and navigation untouched. The only existing file edited is `vite.config.ts` (add one `rollupOptions.input` entry).
- No new runtime dependencies. No new dev dependencies.
- Demo stylesheet must not import `src/index.css` (it overrides global `slate`, `emerald`, `indigo` ramps) and must define its own tokens.
- Do not call `initAnalytics` or `trackEvent`. Page has `<meta name="robots" content="noindex">`; do not touch `public/sitemap.xml`.
- Read-only on storage: never call `savePersistedPortfolio` or `clearPersistedPortfolio`.
- Palette: Ink `#14213D`, Mist `#EEF2F6`, Paper `#FFFFFF`, Level green `#02A26D` (means only "balanced / on target"), Tilt amber `#E8A33D`, Risk coral `#D8454B`. Bucket hues: equity `#4C5CE6`, debt `#1F8A9E`, gold `#C99A2E`, cash `#6B7A90`.
- Type: Bricolage Grotesque (headings, big numbers), Figtree (body/UI), tabular figures for numbers, system-font fallback. Sentence case; no all-caps tracked labels; no monospace labels.
- Money via `formatCurrency(amount, currency, { compact: true })` (`₹1.19 Cr`, `₹6.92 L`).
- Defaults: goal `BALANCED`, tax slab `30`, home loan `{ principal: 4500000, ratePct: 8.55, yearsLeft: 15 }` (the full app's INR defaults), projection horizon 5 years, factors `{ inflationRatePct: 6.5, interestRateHikeBps: 150, geopoliticalShockIndex: 5, equityMarketShockPct: -12, projectionHorizonYears: 5 }`.
- Locked-in sources (EPF, PPF, NPS) are visible but not selectable as the money to move. Amounts are gross with a note that tax or exit charges may apply.
- Works at 375px with no horizontal scroll, keyboard operable with visible focus, `prefers-reduced-motion` respected.
- Keep the existing note: figures are illustrative, not investment or tax advice.
- Git: do not commit until the owner asks. Before the first commit run `git config user.email prateekdesai1990@gmail.com` repo-locally (this repo is under `Coding/Self`; never touch global config). Commit messages end with `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

## Review Focus

1. A saved portfolio with no loan data (mode `personal`): the home-loan destination must be hidden and no loan numbers invented. (Task 5, Task 9)
2. A saved portfolio that is empty or has zero total value: fall back to the sample portfolio without errors. (Task 5)
3. A holding in a foreign currency (the sample's USD equity basket): all amounts and mixes are in base currency. (Task 4)
4. Splits that don't add up: amount above the source value, zero amount, destinations summing to more or less than the amount moved. (Task 4)
5. Benchmark call that hangs or fails (it fails on localhost today): page renders within the timeout using stored yields and labels the data "Sample data". (Task 5, Task 8)

## File Structure

| File | Responsibility |
|---|---|
| `vite.config.ts` (modify) | add `demo: path.resolve(__dirname, 'demo/index.html')` to `build.rollupOptions.input` |
| `demo/index.html` | entry HTML: noindex, fonts, `#root`, loads `/src/pages/demoMain.tsx` |
| `src/pages/demoMain.tsx` | `createRoot(...).render(<DemoApp />)`, imports `../demo/demo.css` |
| `src/demo/demo.css` | `@import "tailwindcss"`, `@theme` tokens, base type, focus ring, reduced-motion rules |
| `src/demo/balance.ts` (+ test) | beam tilt, balance score, plain-language gap sentence |
| `src/demo/benchmarkMap.ts` (+ test) | holding → benchmark mapping and comparison rows |
| `src/demo/splitEngine.ts` (+ test) | destination catalog, split evaluation, 5-year outcome |
| `src/demo/demoData.ts` (+ test) | pick sample vs saved portfolio, benchmark load with timeout |
| `src/demo/journeyState.ts` | `JourneyState` type, defaults, `useJourney()` hook |
| `src/demo/DemoApp.tsx` | shell: chapter bar, chapter switching, data loading |
| `src/demo/components/` | `Beam`, `ChapterBar`, `MixBar`, `Story`, `SeeIt`, `BenchmarkRows`, `FactorPanel`, `Play`, `PlanSummary` |

Tests run with: `node --import tsx --test src/demo/*.test.ts`. Each test file starts with `/// <reference types="node" />` because `tsconfig.json` restricts global `types` to `vite/client` and `npm run lint` must stay green.

---

### Task 1: Demo entry, tokens and empty shell

**Files:**
- Create: `demo/index.html`, `src/pages/demoMain.tsx`, `src/demo/demo.css`, `src/demo/DemoApp.tsx`
- Modify: `vite.config.ts` (the `input` object)

**Interfaces:**
- Produces: `export default function DemoApp(): JSX.Element` in `src/demo/DemoApp.tsx`; CSS tokens `--color-ink`, `--color-mist`, `--color-paper`, `--color-level`, `--color-tilt`, `--color-risk`, `--color-equity`, `--color-debt`, `--color-gold`, `--color-cash`, fonts `--font-display`, `--font-body`.

- [ ] **Step 1: Add the Vite input.** In `vite.config.ts` add `demo: path.resolve(__dirname, 'demo/index.html')` beside the other entries.
- [ ] **Step 2: Create `demo/index.html`** with `<meta name="robots" content="noindex">`, title "Vestora: see your money, try a rebalance", a Google Fonts link for `Bricolage Grotesque` (variable `opsz,wdth,wght`) and `Figtree` (variable `wght`), `<div id="root">`, and `<script type="module" src="/src/pages/demoMain.tsx">`. No OG/canonical/analytics tags.
- [ ] **Step 3: Create `src/demo/demo.css`** with `@import "tailwindcss"` and an `@theme` block defining the tokens from Global Constraints (`--font-display: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif`, `--font-body: 'Figtree', ui-sans-serif, system-ui, sans-serif`). Body: Mist background, Ink text, `font-variant-numeric: tabular-nums` on a `.num` utility, a 2px Ink focus ring with offset on `:focus-visible`, and `@media (prefers-reduced-motion: reduce)` setting `transition-duration: 0.01ms` and `animation: none` on `*`.
- [ ] **Step 4: Create `DemoApp.tsx`** returning a placeholder shell (top bar with "Vestora" and a "Full app" link to `/#overview`, one `<main>` with an `<h1>`), and `demoMain.tsx` rendering it.
- [ ] **Step 5: Verify.** Run `npm run lint` (expect no errors), `npm run build` (expect `dist/demo/index.html` listed alongside the five existing pages), then open `http://localhost:3000/demo/` and confirm: Mist background, Bricolage heading, no console errors, and `http://localhost:3000/` still renders the original app unchanged.

---

### Task 2: Beam and balance logic

**Files:**
- Create: `src/demo/balance.ts`, `src/demo/balance.test.ts`

**Interfaces:**
- Consumes: `BucketMix` (`{ equity, debt, gold, cash }`, percent) from `src/utils/smartDiversification.ts`.
- Produces:
  - `export interface BeamState { tiltDeg: number; level: boolean; score: number }`
  - `export function beamState(current: BucketMix, target: BucketMix): BeamState`
  - `export function balanceScore(current: BucketMix, target: BucketMix): number` (0 to 100)
  - `export function gapSentence(current: BucketMix, target: BucketMix): string`

- [ ] **Step 1: Write the failing tests** in `balance.test.ts` (node:test + `node:assert/strict`), with `current = {equity:60,debt:30,gold:5,cash:5}` and `target = {equity:50,debt:30,gold:10,cash:10}`:
  - `balanceScore(target, target) === 100`.
  - `balanceScore(current, target) === 60` (formula: `max(0, round(100 - 2 * sum(abs(c - t))))`).
  - `beamState(current, target)` returns `tiltDeg === 6` (`clamp((c.equity - t.equity) * 0.6, -14, 14)`), `level === false`, `score === 60`.
  - `beamState(target, target)` returns `tiltDeg === 0` (use `Object.is`-safe check, not `-0`), `level === true`. `level` means `score >= 90`.
  - `gapSentence(current, target) === 'Equity is 10 points over your target'`; with `equity:40` it says `'Equity is 10 points under your target'`; identical mixes give `'Your mix is on target'`. Ties on the largest gap pick the bucket order equity, debt, gold, cash.
- [ ] **Step 2: Run** `node --import tsx --test src/demo/balance.test.ts`. Expected: FAIL, module not found. This also proves the runner works; if `tsx` cannot run it, stop and report.
- [ ] **Step 3: Implement** the three functions in `src/demo/balance.ts` per the formulas above.
- [ ] **Step 4: Run** the same command. Expected: all pass. Then `npm run lint`, expected clean (confirms the `/// <reference types="node" />` line is enough).

---

### Task 3: Benchmark mapping

**Files:**
- Create: `src/demo/benchmarkMap.ts`, `src/demo/benchmarkMap.test.ts`

**Interfaces:**
- Consumes: `Holding`, `CurrencyCode` (`src/types/wealth.ts`); `AMFI_BENCHMARK_CONFIG`, `BenchmarkKey`, `LiveMarketBenchmarks` (`src/utils/smartDiversification.ts`); `convertCurrency` (`src/utils/currency.ts`).
- Produces:
  - `export function benchmarkIdFor(h: Holding): BenchmarkKey['id'] | null`
  - `export function annualisedReturnPct(h: Holding, todayIso: string): number | null`
  - `export interface BenchmarkRow { holding: Holding; benchmarkId: BenchmarkKey['id']; benchmarkName: string; holdingPct: number; benchmarkPct: number; deltaPct: number }`
  - `export function buildBenchmarkRows(holdings: Holding[], baseCurrency: CurrencyCode, benchmarks: LiveMarketBenchmarks | null, todayIso: string, limit?: number): { rows: BenchmarkRow[]; unbenchmarked: Holding[] }` (`limit` defaults to 6; rows are the largest holdings by base-currency value that have a benchmark; `unbenchmarked` lists every holding that has none or whose return cannot be computed)

- [ ] **Step 1: Write the failing tests** using small `Holding` fixtures built in the test file:
  - `benchmarkIdFor`: an MF named "UTI Nifty 50 Index Fund" → `NIFTY50`; "Parag Parikh Flexi Cap" and "ELSS Tax Saver" → `FLEXI_CAP`; "HDFC Arbitrage" → `ARBITRAGE`; "Liquid Fund" → `LIQUID`; "Gilt" → `GILT`; "Corporate Bond Fund" → `CORP_BOND`; `SOVEREIGN_GOLD_BOND` → `GOLD_FOF`; `CORP_BOND` category → `CORP_BOND`; `GOVT_BOND` → `GILT`; `FIXED_DEPOSIT`, `RECURRING_DEPOSIT`, `SAVINGS_CASH` → `LIQUID`; `EQUITY_STOCK` in INR → `NIFTY50`; `EQUITY_STOCK` in USD → `null`; `EPF`, `PPF`, `NPS` → `null`.
  - `annualisedReturnPct`: invested 100, current 121, purchased exactly two years before `todayIso` → within 0.1 of 10; purchased fewer than 90 days before → `null`; `interestRatePct` set on a deposit → returns that rate directly.
  - `buildBenchmarkRows` with `benchmarks = null`: `benchmarkPct` equals the config's `fallbackYieldPct`; `deltaPct = holdingPct - benchmarkPct`; with 8 benchmarkable holdings and `limit` 6, `rows.length === 6` sorted by value descending and `unbenchmarked` contains the EPF and USD holdings. With a live fund whose `cagr3yPct` is 15, `benchmarkPct === 15` (live 3-year CAGR, else 1-year CAGR, else fallback).
- [ ] **Step 2: Run** `node --import tsx --test src/demo/benchmarkMap.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Name matching is case-insensitive on `h.name`; evaluate in the order listed above (index/nifty before flexi, and "gold" before "bond"); MFs matching nothing default to `FLEXI_CAP`. Own return is `interestRatePct` when set, otherwise `((current/invested)^(365/days) - 1) * 100`.
- [ ] **Step 4: Run** the tests, expected pass; run `npm run lint`.

---

### Task 4: Split engine

**Files:**
- Create: `src/demo/splitEngine.ts`, `src/demo/splitEngine.test.ts`

**Interfaces:**
- Consumes: `Holding`, `CurrencyCode`, `MacroParameters`, `PortfolioAllocation` (`src/types/wealth.ts`); `SuggestedDestination`, `SmartDiversificationPlan`, `DiversificationGoal`, `BucketMix`, `analyzeAllocationProfile`, `AMFI_BENCHMARK_CONFIG`, `LiveMarketBenchmarks` (`src/utils/smartDiversification.ts`); `computePortfolioRiskScore` (`src/utils/taxAndDiversification.ts`); `computePortfolioAllocation`, `runMacroSimulation`, `SimulationResult` (`src/utils/simulationEngine.ts`); `calculateHomeLoanPrepaymentImpact` (`src/utils/marketDirectory.ts`); `convertCurrency`; `todayIso` (`src/utils/maturity.ts`).
- Produces:
  - `export type SegmentId = 'equity' | 'debt' | 'fd' | 'savings' | 'gold' | 'loan'`
  - `export const SEGMENT_LABELS: Record<SegmentId, string>` (`'Equity and index funds'`, `'Bonds and debt funds'`, `'Fixed deposits'`, `'Savings and liquid'`, `'Gold'`, `'Home-loan prepayment'`)
  - `export function segmentOf(d: SuggestedDestination): SegmentId`
  - `export function isLockedIn(h: Holding): boolean` (EPF, PPF, NPS)
  - `export function buildDestinationCatalog(plans: SmartDiversificationPlan[], holdings: Holding[], benchmarks: LiveMarketBenchmarks | null, baseCurrency: CurrencyCode, hasLoan: boolean): SuggestedDestination[]`
  - `export interface LoanInputs { principal: number; ratePct: number; yearsLeft: number }`
  - `export interface SplitInput { holdings: Holding[]; baseCurrency: CurrencyCode; goal: DiversificationGoal; sourceId: string; moveAmountInBase: number; allocations: Record<string, number>; catalog: SuggestedDestination[]; loan: LoanInputs | null }` (`allocations` maps destination id to amount in base currency)
  - `export interface SplitResult { holdingsAfter: Holding[]; unallocatedInBase: number; mixBefore: BucketMix; mixAfter: BucketMix; riskBefore: number; riskAfter: number; postureAfter: string; loanInterestSaved: number; loanMonthsSaved: number }`
  - `export function evaluateSplit(input: SplitInput): SplitResult`
  - `export function playOutcome(before: Holding[], after: Holding[], baseCurrency: CurrencyCode, params: MacroParameters): SimulationResult`

- [ ] **Step 1: Write the failing tests** with a fixture of four holdings (a savings account ₹4,00,000; an INR mutual fund ₹6,00,000; a USD equity basket worth $10,000; an EPF ₹5,00,000) and a catalog of an equity fund, a debt fund, an FD and a loan destination:
  - `segmentOf`: `HOME_LOAN` kind → `'loan'`; category `FIXED_DEPOSIT` → `'fd'`; `SAVINGS_CASH` → `'savings'`; `SOVEREIGN_GOLD_BOND` → `'gold'`; `CORP_BOND`/`GOVT_BOND` → `'debt'`; `MUTUAL_FUND`/`EQUITY_STOCK` → `'equity'`.
  - `isLockedIn`: EPF, PPF, NPS true; mutual fund false.
  - `evaluateSplit` moving the whole ₹4,00,000 savings account into the equity fund: `holdingsAfter` has no savings holding and one new holding worth ₹4,00,000; total value before equals total value after; `mixAfter.equity > mixBefore.equity` and `mixAfter.cash < mixBefore.cash`; `unallocatedInBase === 0`.
  - USD holding (Review Focus 3): total value used for mixes equals the INR-converted sum, so `mixBefore` buckets sum to 100 (within 0.01).
  - Partial move of 50% leaves a source holding at half value with `investedAmount` scaled by the same ratio.
  - Over-allocation (Review Focus 4): allocations summing above `moveAmountInBase` are not trimmed silently; `unallocatedInBase` is negative. `moveAmountInBase` above the source value is clamped to the source value. A zero move returns `holdingsAfter` equal to input and `riskAfter === riskBefore`.
  - Loan: allocating ₹2,00,000 to the loan destination with `loan = { principal: 4500000, ratePct: 8.55, yearsLeft: 15 }` removes that value from the source without adding a holding, and `loanInterestSaved > 0` and `loanMonthsSaved > 0`. With `loan = null` a loan allocation is ignored and left in `unallocatedInBase`.
  - `buildDestinationCatalog` with `hasLoan = false` contains no `'loan'` segment (Review Focus 1); every other segment that has a plan destination, a benchmark-config fallback (equity: `NIFTY50`, debt: `CORP_BOND`, gold: `GOLD_FOF`, savings: `LIQUID`) or portfolio FD holdings is present; ids are unique; the FD entry's `expectedRatePct` is the median `interestRatePct` of the portfolio's FD holdings and the FD segment is omitted when there are none.
  - `playOutcome` returns a `SimulationResult` where `trajectory.length === params.projectionHorizonYears + 1` (verify against `runMacroSimulation`'s actual length first and assert that) and its `shuffled*` series reflect the `after` allocation.
- [ ] **Step 2: Run** `node --import tsx --test src/demo/splitEngine.test.ts`. Expected: FAIL. If importing `smartDiversification` fails under Node because a utility touches `window` at import time, add `src/demo/testSetup.ts` defining a minimal `globalThis.window` and run with `--import ./src/demo/testSetup.ts`; note the extra flag in this plan's test command.
- [ ] **Step 3: Implement** `splitEngine.ts`. `evaluateSplit` builds synthetic holdings the way `simulatePlanRisk` in `smartDiversification.ts` does (scale the source by the moved ratio and drop it at ratio of 0.995 or more; add one holding per non-loan destination with `currentValue = investedAmount` converted into the destination's currency, `interestRatePct = expectedRatePct`, `purchaseDate = todayIso()`, zero gain, `taxTag = dest.taxTag ?? 'LTCG_EQUITY'`). Mixes come from `analyzeAllocationProfile(holdings, baseCurrency, goal).currentPct`; risk from `computePortfolioRiskScore`. Loan savings come from `calculateHomeLoanPrepaymentImpact(principal, ratePct, yearsLeft * 12, amount)`. `playOutcome` calls `runMacroSimulation(totalNetWorth, computePortfolioAllocation(before, base), computePortfolioAllocation(after, base), params)`. The catalog dedupes plan destinations by `id`, then adds the fallbacks listed in the test.
- [ ] **Step 4: Run** the tests, expected pass; run `npm run lint`.

---

### Task 5: Portfolio and benchmark data layer, journey state

**Files:**
- Create: `src/demo/demoData.ts`, `src/demo/demoData.test.ts`, `src/demo/journeyState.ts`

**Interfaces:**
- Consumes: `loadPersistedPortfolio`, `sampleHoldingsFor`, `PersistedPortfolio` (`src/utils/portfolioStorage.ts`); `DEMO_PROFILES` (`src/data/mockData.ts`); `fetchLiveMarketBenchmarks`, `LiveMarketBenchmarks`, `DiversificationGoal` (`src/utils/smartDiversification.ts`); `LoanInputs` (Task 4).
- Produces:
  - `export interface DemoPortfolio { holdings: Holding[]; baseCurrency: CurrencyCode; source: 'sample' | 'saved'; loan: LoanInputs | null }`
  - `export function pickPortfolio(persisted: PersistedPortfolio | null): DemoPortfolio` (saved only when `mode === 'personal'` and total value is above zero; saved portfolios get `loan: null`; sample gets the default loan)
  - `export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T>`
  - `export function loadBenchmarks(ms?: number): Promise<LiveMarketBenchmarks | null>` (default 4000 ms; resolves `null` on timeout or rejection)
  - In `journeyState.ts`: `export type Chapter = 'story' | 'see' | 'play' | 'plan'`; `export interface JourneyState { chapter: Chapter; goal: DiversificationGoal; factors: MacroParameters; sourceId: string | null; moveAmountInBase: number; allocations: Record<string, number> }`; `export const DEFAULT_FACTORS: MacroParameters`; `export function useJourney(): { state: JourneyState; set: (patch: Partial<JourneyState>) => void }`.

- [ ] **Step 1: Write the failing tests:**
  - `pickPortfolio(null)` → `source === 'sample'`, 9 holdings, `loan` equal to the default loan, base currency INR.
  - `pickPortfolio` with a `personal` portfolio of one ₹1,00,000 holding → `source === 'saved'`, `loan === null`.
  - Review Focus 2: `personal` with `holdings: []` and `personal` with a zero-value holding → `source === 'sample'`. `mode: 'demo'` → `'sample'`.
  - `withTimeout(new Promise(() => {}), 20, 'fallback')` resolves to `'fallback'`; a promise resolving in 5 ms resolves to its own value.
  - Review Focus 5: `loadBenchmarks` given a rejecting fetcher resolves `null`. To make this testable give `loadBenchmarks` an optional second parameter `fetcher = fetchLiveMarketBenchmarks`.
- [ ] **Step 2: Run** `node --import tsx --test src/demo/demoData.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files. `useJourney` is a `useState` wrapper starting at `chapter: 'story'`, `goal: 'BALANCED'`, `DEFAULT_FACTORS`, no source, zero amounts.
- [ ] **Step 4: Run** the tests, expected pass; run `npm run lint`.

---

### Task 6: Shell, chapter bar and Beam component

**Files:**
- Create: `src/demo/components/Beam.tsx`, `src/demo/components/ChapterBar.tsx`, `src/demo/components/MixBar.tsx`
- Modify: `src/demo/DemoApp.tsx`

**Interfaces:**
- Consumes: `beamState` (Task 2); `useJourney`, `Chapter` (Task 5); `pickPortfolio`, `loadBenchmarks` (Task 5).
- Produces:
  - `Beam(props: { tiltDeg: number; level: boolean; summary: string; leftWeights: { bucket: keyof BucketMix; pct: number }[]; rightWeights: { bucket: keyof BucketMix; pct: number }[]; size?: 'hero' | 'slim' })`: an SVG beam on a fulcrum, rotates to `tiltDeg` with a 700 ms ease-out-back transition, pan weights stacked in bucket colours, stroke turns Level green only when `level`. Has `role="img"` and `aria-label={summary}`. Left pan is growth (equity), right pan is steadier assets (debt, gold, cash).
  - `ChapterBar(props: { chapter: Chapter; reached: Chapter[]; onGo: (c: Chapter) => void })`: four buttons "The problem", "See it", "Play", "Your plan" with `aria-current="step"` on the active one; unreached chapters disabled; collapses to a progress strip under 640px.
  - `MixBar(props: { label: string; mix: BucketMix; target?: BucketMix })`: one stacked bar in bucket hues with a text legend (not colour alone) and an optional target tick row.
  - `DemoApp` owns: `useJourney()`, `pickPortfolio(loadPersistedPortfolio())`, benchmarks loaded once through `loadBenchmarks()` (state `benchmarks`, `benchmarkStatus: 'loading' | 'live' | 'sample'`), the `reached` list, and renders the active chapter component below the bar. Chapters are stubbed until their tasks.

- [ ] **Step 1: Implement** the three components and wire `DemoApp` with stub chapters that show the chapter name and a "Next" button advancing the journey.
- [ ] **Step 2: Verify in the browser** at 1440 and 375: chapter bar switches chapters and keeps the current one marked; the Beam hero tilts to 6° for `current = {60,30,5,5}` and renders level in green for the target mix (temporarily hard-code both in a throwaway story stub); with reduced motion on (`browser_emulate_media`) the beam changes without animating; the beam's `aria-label` reads "Equity is 10 points over your target"; no horizontal scroll at 375; Tab reaches every control with a visible ring.

---

### Task 7: Story chapter

**Files:**
- Create: `src/demo/components/Story.tsx`
- Modify: `src/demo/DemoApp.tsx` (render `Story` for `chapter === 'story'`)

**Interfaces:**
- Consumes: `Beam`, `beamState`, `gapSentence`, `balanceScore` (Tasks 2, 6); `DemoPortfolio` (Task 5).
- Produces: `Story(props: { portfolioSource: 'sample' | 'saved'; savedAvailable: boolean; onUseSaved: () => void; onDone: () => void })`.

- [ ] **Step 1: Implement** four beats from the spec (nine things and nobody has looked at them together; everyone pulls a different way, with three one-line biased voices; "Balance looks like this", playable; "Try it on a sample portfolio"). Hero treatment: a large Beam and a headline per beat; a "Skip story" control is always visible; progress dots show beat n of 4.
- [ ] **Step 2: Make beat 3 playable.** A fixed set of weight tokens (builder's choice of sizes) starts lopsided so that moving exactly one token across the beam reaches `level` (`score >= 90`). Tokens move by pointer drag or tap, and by keyboard (Enter or Space picks up, arrow keys choose a pan, Enter drops). Show the live balance score and `gapSentence`. When level, the Beam turns green and the beat's button changes to "Try it with a portfolio".
- [ ] **Step 3: Beat 4** shows "Use the sample portfolio" as the primary action and, only when `savedAvailable`, "Use my saved portfolio". Both call `onDone`; the second calls `onUseSaved` first.
- [ ] **Step 4: Verify in the browser:** the story takes about 60 seconds at a normal reading pace; beat 3 can be completed with the mouse and with the keyboard alone; skipping lands on "See it"; the screen at 375px stacks cleanly with no horizontal scroll; copy is plain language, sentence case, no all-caps labels.

---

### Task 8: See it chapter

**Files:**
- Create: `src/demo/components/SeeIt.tsx`, `src/demo/components/BenchmarkRows.tsx`, `src/demo/components/FactorPanel.tsx`
- Modify: `src/demo/DemoApp.tsx`

**Interfaces:**
- Consumes: `analyzeAllocationProfile`, `TARGET_MIX_BY_GOAL`, `DiversificationGoal` (`smartDiversification.ts`); `buildBenchmarkRows` (Task 3); `runMacroSimulation`, `computePortfolioAllocation` (`simulationEngine.ts`); `Beam`, `MixBar`; `JourneyState` (Task 5).
- Produces:
  - `SeeIt(props: { portfolio: DemoPortfolio; benchmarks: LiveMarketBenchmarks | null; benchmarkStatus: 'loading' | 'live' | 'sample'; journey: JourneyState; set: (p: Partial<JourneyState>) => void; onNext: () => void })`
  - `BenchmarkRows(props: { rows: BenchmarkRow[]; unbenchmarked: Holding[]; baseCurrency: CurrencyCode })`: one row per holding with name, its own return, the benchmark and its yield, and the difference; below it one line "No direct benchmark: {names}".
  - `FactorPanel(props: { factors: MacroParameters; onChange: (f: MacroParameters) => void })`: four labelled sliders with the Stress Lab's ranges (inflation 2 to 12 step 0.5; rate change -200 to 400 bps step 25; geopolitical stress 0 to 10; equity shock -30 to 20) and a 1/3/5/10-year horizon control, native `<input type="range">` with value text.

- [ ] **Step 1: Implement** the chapter: headline with portfolio value; slim Beam fed by `beamState(currentPct, targetPct)` plus `MixBar` current against target; a three-way goal control (Conservative, Balanced, Growth) writing `goal`; `BenchmarkRows`; a "Live data" or "Sample data" tag from `benchmarkStatus` (`loading` shows a quiet skeleton, never blocks the rest); `FactorPanel` and a Recharts line chart of `baselineNominal` against `scenarioNominal` from `runMacroSimulation(total, alloc, alloc, factors)`, with axis labels in `₹ Cr/L` and an end-value callout for each line. Primary button "Try a rebalance" calls `onNext`.
- [ ] **Step 2: Verify in the browser:** changing the goal changes the beam, gap sentence and target ticks; dragging a factor slider moves the chart end values immediately without layout shift; on localhost (where the live call fails today) the tag reads "Sample data", the page is fully usable within about 4 seconds, and the console shows no uncaught errors; EPF, NPS and the USD basket appear only in the "No direct benchmark" line; at 375px rows wrap rather than scroll sideways.

---

### Task 9: Play chapter

**Files:**
- Create: `src/demo/components/Play.tsx`
- Modify: `src/demo/DemoApp.tsx`

**Interfaces:**
- Consumes: `generateSmartDiversificationPlans`, `TARGET_MIX_BY_GOAL` (`smartDiversification.ts`); everything exported by Task 4; `Beam`, `MixBar`, `beamState`, `gapSentence`; `JourneyState`.
- Produces: `Play(props: { portfolio: DemoPortfolio; benchmarks: LiveMarketBenchmarks | null; journey: JourneyState; set: (p: Partial<JourneyState>) => void; onNext: () => void })`.

- [ ] **Step 1: Implement the setup.** Compute plans with `generateSmartDiversificationPlans(holdings, baseCurrency, { goal, taxSlabPct: 30, hasHomeLoan: portfolio.loan !== null, homeLoanRatePct, homeLoanPrincipal, homeLoanYearsLeft }, benchmarks)` (use `0` for the loan numbers when `loan` is null), then `buildDestinationCatalog(...)`. On first visit with no `sourceId`, preselect the first plan's source holding, its amount, and its destination amounts as the starting split.
- [ ] **Step 2: Implement the three panels.** (a) "Pick what to move": holdings list, locked-in ones disabled with the reason "Locked in until retirement", plus 25/50/75/100% presets and a slider for the amount. (b) "Where should it go": destination cards grouped by `SEGMENT_LABELS`, each with its rate and a slider (also a number field) capped at the amount still unallocated; a "Use the suggested split" button; "Unallocated: ₹x" always visible. (c) Live results from `evaluateSplit` and `playOutcome`: before and after `MixBar`s, the Beam fed by `mixAfter` against target, risk score before to after with posture, a 5-year line chart (scenario today, scenario after your split, baseline faint) using the factors from See it, and for loan prepayment the interest saved and months saved. Show the note "Amounts are before any tax or exit charges."
- [ ] **Step 3: Verify in the browser:** on the sample portfolio the default view already shows a change; moving the first slider changes the mix, beam, risk and chart immediately and smoothly; EPF/PPF/NPS cannot be selected; over-allocating is prevented or clearly flagged; with a saved personal portfolio (set `localStorage['vestora.portfolio.v1']` to a personal portfolio before loading) no loan destination or loan numbers appear; the See-it factor values carry into the Play chart; keyboard-only operation works; no layout shift when numbers change; 375px stacks with no horizontal scroll.

---

### Task 10: Your plan chapter

**Files:**
- Create: `src/demo/components/PlanSummary.tsx`, `src/demo/planLines.ts`, `src/demo/planLines.test.ts`
- Modify: `src/demo/DemoApp.tsx`

**Interfaces:**
- Consumes: `SplitInput`, `SplitResult`, `SEGMENT_LABELS`, `segmentOf` (Task 4); `gapSentence`.
- Produces:
  - `export interface PlanLine { text: string; reason: string }`
  - `export function planLines(source: Holding, input: SplitInput, result: SplitResult, formatMoney: (n: number) => string): PlanLine[]` (one line per non-zero allocation, "Move {amount} from {source name} into {destination title}", with a reason built from the segment and the change in that bucket's share, e.g. "Brings cash up 6 points toward your target")
  - `PlanSummary(props: { portfolio: DemoPortfolio; journey: JourneyState; splitInput: SplitInput; result: SplitResult; onBack: () => void })`

- [ ] **Step 1: Write the failing tests** for `planLines`: two allocations produce two lines in descending amount order; zero-amount allocations produce none; a loan allocation reads "Prepay {amount} of your home loan" and its reason mentions months saved; with nothing allocated the result is an empty array.
- [ ] **Step 2: Run** `node --import tsx --test src/demo/planLines.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `planLines.ts`, then `PlanSummary`: moves list, before and after (mix, risk, 5-year outcome), the Beam shown calm and large, the note on tax and exit charges plus the existing "illustrative, not investment or tax advice" line, a "Change the split" button (`onBack`), and a plain link "Open in the full app" to `/#rebalance`. When nothing is allocated show an empty state with a button back to Play.
- [ ] **Step 4: Run** the tests, expected pass; `npm run lint`; verify in the browser that the summary matches the Play numbers exactly, the link opens the original app at its Rebalance screen, and nothing was written to `localStorage` during the whole journey (check `vestora.portfolio.v1` is unchanged).

---

### Task 11: Quality pass and open the page

**Files:**
- Modify: any file in `src/demo/` as findings require.

- [ ] **Step 1: Static checks.** `npm run lint` (clean), `npm run build` (`dist/demo/index.html` produced), `node --import tsx --test src/demo/*.test.ts` (all pass). Confirm `git status` shows only the files named in this plan plus the two docs, and that `src/index.css`, existing components and `public/sitemap.xml` are untouched.
- [ ] **Step 2: Full journey at 1440 and 375** through Story, See it, Play, Your plan; screenshots saved under `.playwright-mcp/` as `demo-<chapter>-<width>.png`; console clean apart from the known third-party CORS message when the live call is blocked, which must not appear as an uncaught error.
- [ ] **Step 3: Offline and keyboard.** Block `api.mfapi.in` (`browser_run_code_unsafe` route abort) and confirm the page still works with the "Sample data" tag; complete the whole journey with the keyboard only; run the browser at reduced motion; check text contrast of Ink on Mist and Paper, white on Level green buttons, and amber text on Paper (use Ink for text and amber only for fills if it fails 4.5:1).
- [ ] **Step 4: Visual critique.** Look at each screenshot against the spec's visual direction: one memorable element (the beam), quiet surroundings, no gradient washes, identical-card grids or all-caps labels; remove anything decorative that does nothing.
- [ ] **Step 5: Open it for the owner.** Ensure the dev server is running (`npm run dev`, port 3000), then run `open http://localhost:3000/demo/` so it opens in their browser, and report what was built, what was verified with the commands and screenshots above, and anything not verified.
