# Batch 2B: Demo data round-trip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a visitor to `/demo/` build their own portfolio in memory (import a file, add or edit by hand, chat), see it through the whole journey, and save it by exporting a file that re-imports, while the demo still writes nothing to storage.

**Architecture:** Pure, unit-tested modules do the work (export builders and round-trip, file parsing, form validation, chapter flow, chat-action mapping); thin light-theme components wrap them. The personal portfolio is React state in `DemoApp` (`choice: 'sample' | 'saved' | 'personal'`), flowing into the existing chapters through the same `DemoPortfolio` shape. Existing utilities (`importStatement`, `importExcelBuffer`, `exportHoldingsToExcel/Csv`, `generatePortfolioPdfReport`, `buildExport`/`parsePortfolioExport`, `processLocalChatMessage`) are reused; no dark component is imported.

**Tech Stack:** Vite 8, React 19, Tailwind 4, xlsx, jspdf (all existing). Tests: `node --import tsx --test <files>`.

**Spec:** `docs/superpowers/specs/2026-11-24-theme-roundtrip-sharekit-design.md` (Project B). Requires Plan A merged on the same branch (`feat/batch2-ab`).

## Global Constraints

- The demo never writes storage: no `savePersistedPortfolio`, `clearPersistedPortfolio`, `localStorage.setItem` or `sessionStorage` anywhere under `src/demo/`. `loadPersistedPortfolio` (read-only) stays.
- No analytics: no `trackEvent`, no `initAnalytics`. `/demo/` stays `noindex`.
- Import formats: Excel (`.xlsx .xls .xlsm .xlsb .ods`), CSV/TSV, and Vestora JSON backup. PDF is export-only.
- Demo files import nothing from `src/components/` except `VestoraLogo`; light theme only, using the demo's tokens (`ink`, `mist`, `paper`, `level`, `tilt`, `risk`, `font-display`, `num`).
- Plain words, no jargon, no promises of returns. Privacy line: "Your numbers live only on this screen. Download a file to keep them." Chat says "Runs on your device. Nothing is sent anywhere."
- Works at 375px with no horizontal scroll; every control keyboard operable with visible focus; `prefers-reduced-motion` respected; every new chapter has an `<h1 tabIndex={-1}>` (DemoApp moves focus to `main h1` after a chapter change).
- Not in scope: edits to `AddHoldingModal` or any dark app screen (Project C restyles those), tax-tag UI, new calculations.
- Commit steps: run only after the owner OK'd per-task commits. Messages end with `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

## Review Focus

1. A file that is the wrong kind or has no recognizable rows (PDF, image, empty sheet, malformed JSON) shows a plain inline error and leaves the portfolio unchanged. (Task 2)
2. A holding form with blank name, zero or negative invested amount, text in a number field, or a maturity date in the past gives a specific message or a matured flag, never `NaN` in the portfolio. (Task 3)
3. Deleting every holding after later chapters were reached: See it, Play and Your plan must lock, not render against an empty portfolio. (Task 7)
4. Editing a saved (localStorage) portfolio through the editor or chat works on a copy and never writes back. (Tasks 7, 10)
5. Chat actions that point at screens the demo does not have (Maturity Radar, Tax) or the removed story answer politely instead of doing nothing. (Task 9)

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/statementImport.ts` | Gains `buildHoldingsWorkbook` / `buildHoldingsCsv` (pure); existing exporters call them |
| `src/demo/roundTrip.test.ts` (new) | Export to import returns the same holdings (xlsx, csv, json) |
| `src/demo/personalPortfolio.ts` (+ `.test.ts`, new) | `parseImportedFile`, `readImportFile` |
| `src/demo/holdingDraft.ts` (+ `.test.ts`, new) | Form draft types, validation, `holdingFromDraft` |
| `src/demo/demoData.ts` (+ test) | `source` gains `'personal'`; `personalPortfolio`, `portfolioTotal` |
| `src/demo/journeyState.ts` (+ `journeyState.test.ts`, new) | `'mine'` chapter, `visibleChapters`, `nextChapter` |
| `src/demo/chatActions.ts` (+ test, new) | `chapterForTab` |
| `src/demo/exports.ts` (new) | `exportPortfolio(format, holdings, base)` over the existing exporters |
| `src/demo/components/HoldingForm.tsx`, `Editor.tsx`, `ExportBar.tsx`, `PersonalBanner.tsx`, `ChatPanel.tsx` (new) | Light UI |
| `src/demo/components/ChapterBar.tsx`, `Story.tsx`, `src/demo/DemoApp.tsx` | Wiring |

---

### Task 1: Export builders and the round-trip test

**Files:**
- Modify: `src/utils/statementImport.ts` (`exportHoldingsToExcel` ~764, `exportHoldingsToCsv` ~814)
- Create: `src/demo/roundTrip.test.ts`

**Interfaces:**
- Produces: `export function buildHoldingsWorkbook(holdings: Holding[], baseCurrency?: CurrencyCode): XLSX.WorkBook` and `export function buildHoldingsCsv(holdings: Holding[]): string` (the `﻿`-prefixed CSV text). `exportHoldingsToExcel` and `exportHoldingsToCsv` keep their signatures and output; they call these.

- [ ] **Step 1: Write the failing test** `src/demo/roundTrip.test.ts`. Fixture: `sampleHoldingsFor(DEMO_PROFILES[0])` plus one extra holding with a USD currency, `units`, `schemeCode`, a `maturityDate`, and `name: 'Axis "Bluechip", Direct – Growth'`, `notes: 'line one\nline two, with comma'`. Helper `core(h)` picks `name, category, institution, investedAmount, currentValue, currency, interestRatePct, purchaseDate, maturityDate`. Tests:
  - `excel export re-imports with the same holdings`: `XLSX.write(buildHoldingsWorkbook(fixture,'INR'), { type: 'array', bookType: 'xlsx' })` → `importExcelBuffer(buf, 'Portfolio', 'INR').parsed.holdings`; `deepEqual(imported.map(core), fixture.map(core))`.
  - `csv export re-imports with the same holdings`: `importStatement(buildHoldingsCsv(fixture), 'INR').holdings` same comparison.
  - `json backup re-imports exactly`: `parsePortfolioExport(JSON.stringify(buildExport('p','INR',fixture))).holdings` has same ids and `core` values.
  - `awkward text survives`: for the extra holding, `name` and `notes` equal after the xlsx and the csv round trip.
  - `a header-only export imports as nothing`: `importStatement(buildHoldingsCsv([]), 'INR').holdings.length === 0` and does not throw.

- [ ] **Step 2: Run to verify it fails**
  Run: `node --import tsx --test src/demo/roundTrip.test.ts`
  Expected: FAIL (`buildHoldingsWorkbook is not a function`).

- [ ] **Step 3: Extract `buildHoldingsWorkbook` and `buildHoldingsCsv`** from the two exporters (move the workbook/CSV construction, leave file download in the exporters). Output must be byte-for-byte what they produced before.

- [ ] **Step 4: Run, then fix real gaps.** Run the test again. Any `core` mismatch is a gap in the importer (spec risk "Import round-trip gaps"): fix the parser in `statementImport.ts` (`parsePortfolioSheet` column matching, number/date handling) so a file written by the exporter reads back whole. Do not rename `EXPORT_HEADERS` or change the export layout (users already hold files in it).
  Expected: all five tests PASS.

- [ ] **Step 5: Commit**
```bash
git add src/utils/statementImport.ts src/demo/roundTrip.test.ts
git commit -m "Pin the export/import round trip and expose pure export builders"
```

---

### Task 2: Import a file into a personal portfolio

**Files:**
- Create: `src/demo/personalPortfolio.ts`, `src/demo/personalPortfolio.test.ts`

**Interfaces:**
- Consumes: `buildHoldingsWorkbook`, `buildHoldingsCsv` (Task 1), `importExcelBuffer`, `importStatement`, `parsePortfolioExport`.
- Produces:
  - `export interface ImportedPortfolio { holdings: Holding[]; baseCurrency: CurrencyCode; skippedRows: number }`
  - `export function parseImportedFile(fileName: string, content: ArrayBuffer | string, fallbackCurrency: CurrencyCode): ImportedPortfolio` (throws `Error` with a plain, user-readable message)
  - `export async function readImportFile(file: File): Promise<{ fileName: string; content: ArrayBuffer | string }>` (ArrayBuffer for Excel extensions, text otherwise; not unit-tested, thin `File` wrapper)

- [ ] **Step 1: Write the failing test** (`personalPortfolio.test.ts`, reuse the Task 1 fixture style):
  - `reads an Excel export`: buffer from `XLSX.write(buildHoldingsWorkbook(...))`, name `mine.xlsx` → same holdings count and `skippedRows === 0`.
  - `reads a CSV export` and `reads a JSON backup` (json base currency comes from the file).
  - `uses the shared currency as base when every holding has one`: three USD holdings in a CSV → `baseCurrency === 'USD'`; mixed currencies → the fallback.
  - `rejects an unsupported file`: `parseImportedFile('statement.pdf', '', 'INR')` throws `/Excel, CSV or Vestora JSON/`.
  - `rejects a file with no investments`: header-only CSV throws `/No investments found/`.
  - `rejects broken JSON`: `parseImportedFile('x.json', '{oops', 'INR')` throws `/not a valid JSON/i`.

- [ ] **Step 2: Run to verify it fails**
  Run: `node --import tsx --test src/demo/personalPortfolio.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement** by extension: Excel via `importExcelBuffer`, `.csv/.tsv` via `importStatement`, `.json` via `parsePortfolioExport`; zero holdings throws `No investments found in <fileName>. Check that it has columns like Name, Category, Invested and Current value.`; unknown extension throws `Use an Excel, CSV or Vestora JSON file.` `skippedRows` = `parsed.skipped.length` (0 for JSON).

- [ ] **Step 4: Run to verify it passes**
  Run: `node --import tsx --test src/demo/personalPortfolio.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/demo/personalPortfolio.ts src/demo/personalPortfolio.test.ts
git commit -m "Add file import for the demo's personal portfolio"
```

---

### Task 3: Holding form logic

**Files:**
- Create: `src/demo/holdingDraft.ts`, `src/demo/holdingDraft.test.ts`

**Interfaces:**
- Produces:
  - `export interface HoldingDraft { name: string; category: AssetCategory; institution: string; investedAmount: string; currentValue: string; currency: CurrencyCode; interestRatePct: string; purchaseDate: string; maturityDate: string; notes: string }`
  - `export const STARTER_CATEGORIES: { label: string; category: AssetCategory }[]` = Mutual fund (`MUTUAL_FUND`), Fixed deposit (`FIXED_DEPOSIT`), Savings account (`SAVINGS_CASH`)
  - `export function emptyDraft(category: AssetCategory, currency: CurrencyCode): HoldingDraft` (purchase date today)
  - `export function draftFromHolding(h: Holding): HoldingDraft`
  - `export function holdingFromDraft(draft: HoldingDraft, existing?: Holding): { ok: true; holding: Holding } | { ok: false; error: string }`
  - `export function defaultTaxTag(category: AssetCategory): TaxTag`: `MUTUAL_FUND`, `EQUITY_STOCK` → `LTCG_EQUITY`; `PPF`, `EPF` → `TAX_EXEMPT_EEE`; `NPS` → `80CCD`; all others → `SLAB_INCOME`.

- [ ] **Step 1: Write the failing test** (error strings copied from `AddHoldingModal`):
  - blank name → `Please provide a name for the investment.`
  - invested `'0'`, `'-5'`, `'abc'` → `Please enter a valid invested amount.`
  - current value `'-1'` or `'x'` → `Please enter a valid current valuation.`; `'0'` is allowed
  - rate `'abc'` → `Please enter a valid annual rate %.`; blank rate → `interestRatePct` undefined
  - success: invested `'100000'`, value `'125000.5'` → `unrealizedGain 25000.5`, `unrealizedGainPct 25`, name trimmed, institution defaults to `Direct Account`, `taxTag` from `defaultTaxTag`
  - maturity `'2020-01-01'` → `isMatured true`; `'2999-01-01'` → `isMatured false`, `daysToMaturity > 0`
  - editing keeps `existing.id` and other fields (`...existing`); two new holdings made back to back have different `id`s (prefix `h-custom-`, plus a random suffix)

- [ ] **Step 2: Run to verify it fails**
  Run: `node --import tsx --test src/demo/holdingDraft.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement** mirroring `AddHoldingModal.handleSubmit` (use `todayIso`, `daysBetween` from `src/utils/maturity.ts`). Do not edit `AddHoldingModal`.

- [ ] **Step 4: Run to verify it passes**
  Run: `node --import tsx --test src/demo/holdingDraft.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/demo/holdingDraft.ts src/demo/holdingDraft.test.ts
git commit -m "Add form validation for hand-entered holdings in the demo"
```

---

### Task 4: Personal portfolios in demo data

**Files:**
- Modify: `src/demo/demoData.ts`, `src/demo/demoData.test.ts`

**Interfaces:**
- Produces: `DemoPortfolio.source: 'sample' | 'saved' | 'personal'`; `export function personalPortfolio(holdings: Holding[], baseCurrency: CurrencyCode): DemoPortfolio` (`source: 'personal'`, `loan: null`); `export function portfolioTotal(p: { holdings: Holding[]; baseCurrency: CurrencyCode }): number` (sum in base currency, 0 when empty).

- [ ] **Step 1: Add failing tests** to `demoData.test.ts`: `a personal portfolio has no loan and its own source`; `portfolioTotal converts mixed currencies to the base` (one INR 100000 and one USD 1000 holding → equals `100000 + convertCurrency(1000,'USD','INR')`); `portfolioTotal of nothing is 0`.

- [ ] **Step 2: Run to verify it fails**
  Run: `node --import tsx --test src/demo/demoData.test.ts`
  Expected: FAIL (functions not defined).

- [ ] **Step 3: Implement**; reuse the file's existing private `totalValue` for `portfolioTotal`. Fix any TypeScript fallout from the widened `source` union (`Story.tsx` handled in Task 7).

- [ ] **Step 4: Run to verify it passes**
  Run: `node --import tsx --test src/demo/*.test.ts`
  Expected: PASS, all earlier tests still pass.

- [ ] **Step 5: Commit**
```bash
git add src/demo/demoData.ts src/demo/demoData.test.ts
git commit -m "Let the demo portfolio be one the visitor built"
```

---

### Task 5: The "Your numbers" chapter in the journey

**Files:**
- Modify: `src/demo/journeyState.ts`, `src/demo/components/ChapterBar.tsx`
- Create: `src/demo/journeyState.test.ts`

**Interfaces:**
- Produces: `Chapter = 'story' | 'mine' | 'see' | 'play' | 'plan'`; `CHAPTERS` stays the four core chapters; `export function visibleChapters(hasPersonal: boolean): { id: Chapter; label: string }[]` (inserts `{ id: 'mine', label: 'Your numbers' }` after `story` when true); `export function nextChapter(from: Chapter): Chapter | null` (`story→see`, `mine→see`, `see→play`, `play→plan`, `plan→null`). `ChapterBar` props change to `{ chapters: { id: Chapter; label: string }[]; chapter: Chapter; reached: Chapter[]; onGo }`; the mobile "n of N" count uses `chapters.length`.

- [ ] **Step 1: Write the failing test** `journeyState.test.ts`: `without a personal portfolio the journey has four chapters` (ids `story,see,play,plan`); `with one, Your numbers sits between the story and See it` (ids `story,mine,see,play,plan`, label `Your numbers`); `nextChapter walks the journey and ends at the plan` (each mapping above, `plan` → `null`).

- [ ] **Step 2: Run to verify it fails**
  Run: `node --import tsx --test src/demo/journeyState.test.ts`
  Expected: FAIL (`visibleChapters is not a function`).

- [ ] **Step 3: Implement** in `journeyState.ts`; update `ChapterBar` to take `chapters` instead of importing `CHAPTERS`.

- [ ] **Step 4: Run to verify it passes**
  Run: `node --import tsx --test src/demo/*.test.ts`
  Expected: PASS. (`npm run lint` fails in `DemoApp.tsx` until Task 7 wires the new props; that is expected here.)

- [ ] **Step 5: Commit**
```bash
git add src/demo/journeyState.ts src/demo/journeyState.test.ts src/demo/components/ChapterBar.tsx
git commit -m "Add the Your numbers chapter to the journey model"
```

---

### Task 6: Export bar, banner and the editor chapter

**Files:**
- Create: `src/demo/exports.ts`, `src/demo/components/ExportBar.tsx`, `src/demo/components/PersonalBanner.tsx`, `src/demo/components/HoldingForm.tsx`, `src/demo/components/Editor.tsx`

**Interfaces:**
- Consumes: `holdingFromDraft`, `draftFromHolding`, `emptyDraft`, `STARTER_CATEGORIES` (Task 3); `parseImportedFile`, `readImportFile` (Task 2); `portfolioTotal` (Task 4).
- Produces:
  - `export type ExportFormat = 'xlsx' | 'csv' | 'pdf' | 'json'`; `export function exportPortfolio(format: ExportFormat, holdings: Holding[], baseCurrency: CurrencyCode): void` calling `exportHoldingsToExcel`, `exportHoldingsToCsv`, `generatePortfolioPdfReport({ holdings, baseCurrency, portfolioMode: 'personal', profileName: 'My portfolio' })`, and `downloadPortfolioExport(buildExport('demo-personal', baseCurrency, holdings))`.
  - `ExportBar({ holdings, baseCurrency, formats?: ExportFormat[] })` (default `['xlsx','pdf','csv']`, buttons "Excel", "PDF", "CSV", disabled with no holdings).
  - `PersonalBanner({ holdings, baseCurrency })`: slim bar with the privacy line and `ExportBar`.
  - `HoldingForm({ initial: HoldingDraft; existing?: Holding; onSave(h: Holding): void; onCancel(): void })`: labelled fields, inline `role="alert"` error, category/currency selects, optional maturity and rate fields.
  - `Editor({ holdings, baseCurrency, onChange(next: Holding[]): void; onImported(p: ImportedPortfolio): void; onBaseCurrency(c: CurrencyCode): void; onContinue(): void; openRequest?: { mode: 'add'; draft?: Holding } | { mode: 'edit'; holding: Holding } | null; onOpenRequestHandled?(): void })`. Contents: `<h1 tabIndex={-1}>` "Your investments"; holdings list (name, category, institution, value in base; Edit and Delete per row); empty state with three starter buttons (label from `STARTER_CATEGORIES`, e.g. "Add a mutual fund", opening the form with that category and no amounts); "Add an investment"; "Import a file" (hidden file input, replaces what is listed, says so); base-currency select (INR, USD, EUR); `ExportBar`; inline import error; "Continue" disabled until `portfolioTotal > 0`, with a hint saying why.

- [ ] **Step 1: Implement `exports.ts`, `ExportBar`, `PersonalBanner`** as specified. No new unit test (thin wrappers over tested code); covered by Task 10's browser run.

- [ ] **Step 2: Implement `HoldingForm` and `Editor`** in the demo's light style (paper cards, `rounded-xl`, ink borders at 15% opacity, `rounded-full` ink primary button, visible focus from `demo.css`). Delete asks for no confirmation but is undoable in-session via a "Removed X. Undo" notice that lasts until the next change.

- [ ] **Step 3: Verify it type-checks in isolation**
  Run: `npx tsc --noEmit 2>&1 | grep -E "src/demo/(exports|components/(ExportBar|PersonalBanner|HoldingForm|Editor))"`
  Expected: no output (errors elsewhere in `DemoApp.tsx` are resolved in Task 7).

- [ ] **Step 4: Commit**
```bash
git add src/demo/exports.ts src/demo/components/ExportBar.tsx src/demo/components/PersonalBanner.tsx src/demo/components/HoldingForm.tsx src/demo/components/Editor.tsx
git commit -m "Add the demo's investment editor, exports and privacy banner"
```

---

### Task 7: Wire the personal portfolio into the journey

**Files:**
- Modify: `src/demo/DemoApp.tsx`, `src/demo/components/Story.tsx`

**Interfaces:**
- Consumes: Tasks 4 to 6. `Editor` is loaded with `React.lazy` so the spreadsheet code stays out of the first load.
- Produces: `Story` gains props `hasPersonal: boolean` and `onAddMine: () => void`. Beat 4 gets a third action, `Add my investments` (`Edit my investments` when `hasPersonal`), after the sample and saved buttons; beat-4 copy handles `source === 'personal'` ("You are using the portfolio you built, with N investments worth X.").

- [ ] **Step 1: DemoApp state.** Replace `useSaved` with `choice: 'sample' | 'saved' | 'personal'` and add `personal: { holdings: Holding[]; baseCurrency: CurrencyCode } | null`. `portfolio` is memoized (`personalPortfolio(...)` when `choice === 'personal' && personal`). Replace `maxIndex` with `reached: Chapter[]` (add on `go`). `next()` uses `nextChapter`. The chapter bar gets `visibleChapters(personal !== null)`.

- [ ] **Step 2: Editing helper.** `editPersonal(fn: (h: Holding[]) => Holding[])`: sets `choice` to `'personal'` and updates `personal`, starting from a copy of the current `portfolio` holdings and base currency when `personal` is null (so editing a saved portfolio never touches storage). The Editor's `onChange`, `onImported` (replace holdings and base currency) and `onBaseCurrency` go through it.

- [ ] **Step 3: Gate empty portfolios.** When `choice === 'personal'` and `portfolioTotal(portfolio) <= 0`, pass `ChapterBar` a `reached` list with only `story` and `mine`, and make `go()` ignore `see`, `play` and `plan`. Going to `mine` via `go('mine')` sets `choice` to `'personal'`.

- [ ] **Step 4: Render.** `mine` chapter renders `Editor` inside `Suspense` (fallback: plain text "Loading your investments"); `onContinue` calls `next()`. Show `PersonalBanner` under the header in every chapter while `choice === 'personal'` and there are holdings.

- [ ] **Step 5: Story.** Add the third action and personal copy; "Add my investments" with no personal data calls `onAddMine`, which creates `{ holdings: [], baseCurrency: 'INR' }`, sets `choice` to `'personal'` and calls `go('mine')`.

- [ ] **Step 6: Verify**
  Run: `npm run lint && node --import tsx --test src/demo/*.test.ts`
  Expected: lint clean; all tests pass (88 existing + new).
  Browser (`/demo/`, 1440 and 375): sample path unchanged; "Add my investments" opens Your numbers; starter buttons open the form with the category set; adding two holdings enables Continue; See it, Play and Your plan show those holdings; deleting everything locks See it, Play and Your plan in the bar; no horizontal scroll at 375; console clean.

- [ ] **Step 7: Commit**
```bash
git add src/demo/DemoApp.tsx src/demo/components/Story.tsx
git commit -m "Wire the personal portfolio through the demo journey"
```

---

### Task 8: Chat action mapping

**Files:**
- Create: `src/demo/chatActions.ts`, `src/demo/chatActions.test.ts`

**Interfaces:**
- Produces: `export type ChatTab = 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator'`; `export function chapterForTab(tab: ChatTab): Chapter | null`: `overview → 'mine'`, `rebalance → 'play'`, `simulator → 'see'`, `radar` and `tax → null` (not in the demo).

- [ ] **Step 1: Write the failing test**: each mapping above, and `chapterForTab('radar')` is `null`.

- [ ] **Step 2: Run to verify it fails**
  Run: `node --import tsx --test src/demo/chatActions.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement**, then re-run.
  Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add src/demo/chatActions.ts src/demo/chatActions.test.ts
git commit -m "Map chat navigation onto the demo's chapters"
```

---

### Task 9: Chat panel

**Files:**
- Create: `src/demo/components/ChatPanel.tsx`
- Modify: `src/demo/DemoApp.tsx`

**Interfaces:**
- Consumes: `processLocalChatMessage`, `parseFileForChat`, `ChatActionKind`, `ChatActionItem`, `ChatMetricRow` from `src/utils/localChatEngine.ts`; `chapterForTab` (Task 8); `exportPortfolio` (Task 6).
- Produces: `ChatPanel({ open, onClose, holdings, baseCurrency, onEdit(fn: (h: Holding[]) => Holding[]): void, onSetBaseCurrency(c: CurrencyCode): void, onGoChapter(c: Chapter): void, onRebalanceHolding(id: string): void, onOpenForm(req: { mode: 'add'; draft?: Holding } | { mode: 'edit'; holding: Holding }): void })`. A launcher button "Ask about my portfolio" stays visible in every chapter; the panel is `React.lazy` loaded on first open.

- [ ] **Step 1: Build the panel** as a light slide-over (`role="dialog"`, `aria-label="Portfolio chat"`, Escape closes, focus moves to the message box on open and back to the launcher on close, messages in an `aria-live="polite"` region, 375px full-width). It calls `processLocalChatMessage(text, { holdings, baseCurrency, portfolioMode: 'personal', profileName: 'You' }, callbacks)` and `parseFileForChat` for attached files. Callbacks mutate through `onEdit` (`onAddHolding`, `onUpdateHolding`, `onDeleteHolding`, `onReplaceHoldings`, `onAppendHoldings`), `onSetBaseCurrency`, `exportPortfolio` for the four export callbacks, and `onNavigateToTab` → `chapterForTab` (when null, add an assistant message: "That view is in the full app at /#<tab>."). Action buttons follow the app drawer's behaviour for every `ChatActionKind` (`SUGGEST_PROMPT`, `UNDO_HOLDINGS`, `APPLY_IMPORT`, `EXPORT`, `NAVIGATE`, `SET_CURRENCY`, `START_BLANK` → empty list, `RESET_SAMPLE` → copy of `sampleHoldingsFor(DEMO_PROFILES[0])`, `REBALANCE_HOLDING`, `OPEN_EDIT_MODAL`, `OPEN_ADD_MODAL`, `CONFIRM_ADD_HOLDING`, `CONFIRM_UPDATE_HOLDING`). Shows "Runs on your device. Nothing is sent anywhere."

- [ ] **Step 2: Wire into `DemoApp`.** `onEdit` is Task 7's `editPersonal`. `onRebalanceHolding(id)` sets `sourceId` to `id` then `go('play')`. `onOpenForm` stores a request, calls `go('mine')`, and passes it to `Editor` as `openRequest`, cleared via `onOpenRequestHandled`.

- [ ] **Step 3: Verify**
  Run: `npm run lint && node --import tsx --test src/demo/*.test.ts`
  Expected: clean, PASS.
  Browser: on the sample path say "Add HDFC FD 5L at 7.4%" and confirm; the banner appears, the Your numbers chapter appears, the sample's other holdings are kept as a copy; "story" and "radar" questions answer without breaking; Escape closes and returns focus; 375px panel fits.

- [ ] **Step 4: Commit**
```bash
git add src/demo/components/ChatPanel.tsx src/demo/DemoApp.tsx
git commit -m "Add the on-device chat panel to the demo"
```

---

### Task 10: End-to-end round trip and storage guard

**Files:** none new (fixes go in the file that is wrong).

- [ ] **Step 1: Static guard**
  Run: `grep -rnE "setItem|savePersistedPortfolio|clearPersistedPortfolio|sessionStorage|trackEvent|initAnalytics" src/demo`
  Expected: no output.

- [ ] **Step 2: Browser round trip** (`/demo/`, Playwright MCP, screenshots under `.playwright-mcp/`): before acting, snapshot `Object.keys(localStorage)` and wrap `Storage.prototype.setItem` to record calls. Add a holding by hand and one by chat; confirm both appear in See it, Play and Your plan with totals matching the editor's list; export Excel and PDF (downloads trigger, PDF opens with the holdings); reload; "Add my investments" then Import the Excel file; totals and holding count match what was exported. Finally, `localStorage` keys are identical to the snapshot and the `setItem` spy recorded nothing.

- [ ] **Step 3: Whole-plan checks**
  Run: `npm run lint && node --import tsx --test src/demo/*.test.ts src/utils/*.test.ts && npm run build`
  Expected: all pass. Check at 1440 and 375 that no horizontal scroll appears on Story, Your numbers, See it, Play, Your plan; console clean.

- [ ] **Step 4: Commit any fixes found**
```bash
git add -A src
git commit -m "Fix issues found in the demo round-trip run"
```
