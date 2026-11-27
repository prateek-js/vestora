# Vestora: INR-only — remove the multi-currency system

Date: 2026-11-26
Status: approved by owner (2026-11-26: "approve the design doc and build it")
Builder-check resolutions (2026-11-26): (1) saved non-INR holdings and old JSON backups re-denominate at load/restore via the pinned 86.50 rate and write back as INR — the returning-visitor figures-unchanged anti-goal governs; (2) h-106 stays OUT of the demo benchmark rows (owner: keep journey unchanged — benchmarkMap keys on instrument listing venue, not currency); (3) US Treasuries machinery deleted wholesale (owner: delete — foreign directory rows, hedge plan, concentration analysis, Rebalance US-Treasuries section, its live fetch, SEO claim); (4) Tax tab FX Risk Radar card deleted; (5) chat currency-set requests become no-op acknowledgments ("tracked in INR").
Origin: owner instruction "remove the currency part. for now we support only inr", refined 2026-11-26: pure INR, h-106 re-denominated.

## Intent and why

Vestora's only real market is India; USD/EUR support was scaffolding for a
scenario the product never served (one USD-denominated sample holding). The
currency system — a 3-currency switcher, ECB live-rate fetch, an FX badge,
conversion at every total, and currency columns in import/export — is
complexity that must be fed and never earned its keep. Removing it deletes
moving parts that can fail (a live API dependency) and simplifies every
total, import, export, and form in the app. Multi-currency remains fully
recoverable from git history.

## Owner decisions

- Pure INR: the CurrencyCode concept narrows to 'INR' and the conversion
  machinery goes away. Not "keep conversion, drop the switcher".
- h-106 ("US Equity Portfolio (Alphabet, Nvidia, Microsoft)") is
  re-denominated to INR, not deleted: the demo journey's story (a US-stock
  basket in an Indian portfolio) and all category/benchmark tests survive.
- The 86.50 benchmark rate is pinned as the re-denomination rate
  (₹33,30,250 = 38,500 × 86.50 current value; ₹19,03,000 = 22,000 × 86.50
  invested), the same rate the app showed before this change — no user-visible
  total changes.

## Goals

- One currency everywhere: every figure renders in ₹; no currency pickers, no
  FX badge, no live-rate fetch, no conversion calls.
- Zero-holding and existing-visitor behavior preserved (the welcome work's
  guarantees carry over unchanged).
- The demo journey stays byte-compatible in shape: same holdings count, same
  categories, same benchmark mapping, same story; only h-106's denomination
  and the currency pickers change.
- No user-visible total changes: every total the app shows today still shows
  the same number after the change.

## Non-goals

- No localization beyond INR (no i18n framework, no locale switching).
- No number-format changes beyond what dropping non-INR formatting requires
  (the en-IN lakh/crore grouping stays exactly as is).
- No schema migration: PersistedPortfolio keeps its fields, now pinned to
  INR values.
- No changes to Project D (share kit) scope.

## Design

**Type layer** (`src/types/wealth.ts`): `CurrencyCode = 'INR'`. The union
type keeps every `currency:`/`baseCurrency:` field compiling unchanged.

**Rates and conversion** (`src/utils/currency.ts`, `src/utils/liveRates.ts`):
- `FX_RATES` and `convertCurrency` are deleted. `convertCurrency(a, b, c)`
  callers collapse to the amount itself (from === to → amount today; with
  one currency the identity collapse is total). The ~85 call sites are
  mechanical: delete the call, keep the argument.
- `liveRates.ts` is deleted whole (the Frankfurter fetch, the localStorage
  FX cache, `LiveFxState`). Its only caller is App's fx effect.
- `formatCurrency` keeps only the INR branch (en-IN, lakh/crore compact
  grouping exactly as today).

**App wiring** (`src/App.tsx`): the fx effect, `fxAsOf`/`fxSource` state,
the `fxVersion` counter and its prop, and the two Navbar props die. The
initial memo's fallback pins `baseCurrency: 'INR'`.

**Navbar** (`src/components/Navbar.tsx`): the "Display Currency" section in
the menu is deleted (the section header, the INR/USD/EUR segmented control),
and the "FX: Benchmarks/ECB" status line is deleted. `fxAsOf`/`fxSource`
props die. `baseCurrency`/`setBaseCurrency` props die with the switcher —
App owns no currency state anymore (the `baseCurrency` state itself is
deleted; every consumer reads the constant INR or the holding's own
`currency` field, now always 'INR').

**Tabs/modals** (all `src/components/*`): every `baseCurrency` prop is
deleted from interfaces and call sites; `convertCurrency(x, c, base)`
becomes `x`. The welcome work's fxVersion prop on OverviewTab dies with the
system that needed it.

**Sample data** (`src/data/mockData.ts`): h-106 becomes INR-denominated
with re-denominated values: investedAmount 22000→1903000, currentValue
38500→3330250 (× 86.50), currency 'USD'→'INR'. Name/notes keep the
US-basket story but drop the "$" framing: name "US Equity Portfolio
(Alphabet, Nvidia, Microsoft)", notes updated to state the INR valuation
of the US basket, no "in USD" comments. All other holdings are already INR.

**Migration on load** (`src/utils/portfolioStorage.ts`, `backupRestore.ts`):
a returning visitor's saved non-INR holdings (and old JSON backups') figures
are re-denominated at the pinned 86.50 on load/restore and written back as
INR — their displayed totals never change (38500 USD → 3330250 INR, exactly
what the app showed). This is the owner-decision resolution of the
read-as-INR vs migrate tension: the figures-unchanged anti-goal governs.

**Benchmark map** (`src/demo/benchmarkMap.ts`): the currency === 'INR'
gate is replaced by a listing-venue notion (Indian-listed instruments only)
so re-denominated h-106 stays OUT of the demo benchmark rows — the demo
journey's SeeIt screen is unchanged (owner decision). USD-maps-to-null test
cases are re-pointed at the venue rule.

**US Treasuries machinery — deleted wholesale** (owner decision "delete it
all"): `fetchLiveUsTreasuryRates` and its fetch in `smartDiversification.ts`
/ `marketDirectory.ts`; the USD-denominated directory rows (US CD, VOO, QQQ,
live US Treasury rows); the "Cross-Currency & Sovereign Hedge" plan in
`smartDiversification.ts`; the currency-concentration analysis
(currencyTotals/dominantCurrency/singleCurrencySharePct); the "Live US
Treasuries" section and treasuryStatus UI in `RebalanceTab.tsx`; USD/EUR
options in the RebalanceTab stock picker and ValidatePortfolioModal; and
index.html's "US Treasuries" asset-class claims (both the feature list line
and the schema.org line, which becomes INR-only). The live Frankfurter
fetch dies with the FX system; no new external fetch replaces anything.

**Tax tab** (`src/components/TaxAndInsightsTab.tsx`): the
"Multi-Currency Asset Exposure / FX Risk Radar" card (~line 295-333) and its
advice paragraph are deleted (owner-decision resolution: with one currency
it is a meaningless "INR 100.0%" bar).

**Chat engine** (`src/utils/localChatEngine.ts`): the USD/EUR/€/$
recognition branches collapse to ₹/INR/Rs. only. "add $500 of X" now parses
as a bare number in INR — acceptable (the number was always going to be
interpreted in the ledger's currency); the ₹, INR, Rs. forms keep their
explicit recognition. Requests to SET a holding's currency (e.g. "make it
USD") become a no-op acknowledgment that holdings are tracked in INR; the
currency-set plumbing and its "currency → USD" changed-label die.

**Demo** (`src/demo/*`): `CURRENCIES` arrays in Editor.tsx and
HoldingForm.tsx narrow to `['INR']` (the pickers collapse to a single
option and may be simplified or removed, builder's choice, plain words).
`convertCurrency` calls collapse to their amount. The demo's loan math,
benchmark map, chat seeds, split engine keep working: they read
`holding.currency` which is now always 'INR'. Multi-currency test cases
(demoData.test.ts USD cases, benchmarkMap.test.ts USD case,
splitEngine.test.ts 86.5 multiplier) are re-pointed at the INR guarantee.

**Import/export** (`src/utils/statementImport.ts`, `backupRestore.ts`,
`pdfReport.ts`): the currency column parse (`parseCurrencyCode`) keeps
accepting any header value but pins the result to INR (a statement in USD
numbers still imports, its figures re-denominated at the pinned 86.50 —
same rule as the storage loader). JSON backups: `baseCurrency` field kept
for backward compatibility, pinned to 'INR' on restore; non-INR holdings
in old backups re-denominate at 86.50 on restore and the restored state is
written back as INR.
- Excel template generator keeps its currency parameter but only ever
  emits the INR template.

**SEO copy** (`index.html`): the schema.org description "across INR, USD,
EUR, GBP, SGD, and AED" becomes "across INR" (single-page edit); the
"US Treasuries" asset-class claims go with the Treasuries deletion.

**Welcome/zero-holding guarantees**: unaffected — no behavior of the
welcome, the legacy-id shim, or the empty states depends on currency
conversion; the T5 Simulator guard keeps working (its guard is on span,
not FX).

## Anti-goals (failure even if it works)

- Any user-visible total changes value (the pinned 86.50 rate guarantees
  this; ₹1.22 Cr stays ₹1.22 Cr).
- A returning visitor's saved portfolio fails to load or loads with
  different numbers (the h-106 re-denomination matches what the app already
  DISPLAYED for them: 38500 × 86.50 — their figures are unchanged; new
  saves are pure INR).
- The demo journey breaks or changes its numbers (its totals flow through
  the same pinned-rate identity).
- Any new external fetch appears (Frankfurter dies; nothing replaces it).

## Risks

- The h-106 notes/EDU copy across the demo journey may mention "$" values
  in strings (builder sweeps for `$` in demo strings and updates copy to
  INR framing; totals are unaffected since they flow through pinned 86.50;
  the builder check found this sweep near-empty — the journey's strings
  never reference h-106 or dollar amounts).
- The benchmark venue rule must be designed so genuine Indian-listed
  holdings never lose their benchmark rows (the sample's benchmarkable set
  must stay exactly the same holdings as today).
- The Treasuries deletion touches a live-fetch path with its own status UI
  and error states — the builder must remove the UI section cleanly without
  breaking the Rebalance tab's remaining sections.
- Tests that explicitly exercise multi-currency are re-pointed at the INR
  guarantee; the suite must end green.

## Left to the builder

- Exact demo Editor/HoldingForm picker treatment (single option vs removal;
  plain words, no jargon).
- The demo `$` copy sweep (strings only, no totals).
- The chat-engine regex simplification depth (collapse to ₹/INR/Rs. only;
  keep `formatCurrency`-driven output which is already INR).
- Whether `baseCurrency` props die entirely or linger as a vestigial
  always-'INR' (plan should kill them; vestigial fields are debt).
- Whether parseCurrencyCode stays (accept-and-pin-to-INR) or its call sites
  inline the pin.
- The exact venue-rule shape for the benchmark map (any rule that keeps the
  sample's benchmarkable set byte-identical to today's and is honest about
  "Indian-listed").
