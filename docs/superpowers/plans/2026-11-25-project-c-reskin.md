# Project C — Reskin all screens to the demo's exact look — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every app screen (Overview, Rebalance, Radar, Tax, Simulator, Navbar/shell, modals, drawer, tour, SEO pages) wears the demo's exact light look — Mist background, Paper cards, Bricolage Grotesque + Figtree, demo spacing — with the batch-2 deferred UI minors fixed along the way.

**Architecture:** Remap `index.css` Tailwind ramps to light/brand values first (so unrewritten pages land on-brand automatically), then rewrite each screen's dark utilities to the demo's named tokens in styling-only passes, one screen per task, each verified at 1440+375 against a dark baseline captured before anything changes. Shared dialog-a11y hook lands in `src/utils/` so the app drawer and demo ChatPanel can both use it (demo may import nothing from `src/components/` except `VestoraLogo`).

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4 (`@theme` in `index.css`), Recharts, Vite multi-entry (app `index.html`, `demo/index.html`, 4 static SEO pages in `public/../index.html` roots). Node test runner (`node --import tsx --test`), Playwright MCP for browser verification.

**Spec:** `docs/superpowers/specs/2026-11-24-theme-roundtrip-sharekit-design.md` (Project C section + Non-goals/Anti-goals). Projects A and B are already merged (through `74a898d` on main).

## Global Constraints

- **Behaviour lock:** styling-only edits. No logic, data, or copy changes — EXCEPT the fold-in minors listed in Task 8/9, which are behaviour fixes by design. Any other accidental logic edit found during a restyle is reverted. Diff review per task enforces this.
- **One-look rule:** screens take the demo's exact look (Mist bg, Paper cards, Bricolage/Figtree, demo spacing). Density is NOT preserved; dense screens may get longer. No new product features.
- **Contrast gate:** WCAG 4.5:1 for text, 3:1 for graphics on each screen's main pairs (same method as batch 1).
- Verify per screen: 1440 + 375 screenshots under `.playwright-mcp/` (named `c-<screen>-*`), console clean (only the 4 known `api.mfapi.in` CORS errors), no horizontal scroll at 375, focus visible, keyboard operable, `prefers-reduced-motion` respected.
- The screen's key numbers on the sample portfolio must be **identical** to the Task 1 baseline after its restyle.
- The demo never writes storage; `/demo/` stays `noindex`; no analytics. Full suite (`node --import tsx --test src/demo/*.test.ts src/utils/*.test.ts` — 144 tests) stays green in every task; `npm run lint` (tsc --noEmit) clean in every task; `npm run build` exits 0.
- Commit messages: imperative, no prefix, end with `Co-Authored-By: Claude Code <noreply@anthropic.com>`. Repo-local `git config user.email` must be `prateekdesai1990@gmail.com` (verify before each commit).

## Token mapping (the single reference for every restyle task)

**Ramp remap in `src/index.css` `@theme`** (values replace the dark overrides; classes not listed keep Tailwind defaults):

| Class | Old (dark) | New (light) | Why |
|---|---|---|---|
| `slate-950` | `#060911` | `#EEF2F6` (Mist) | dominant page bg |
| `slate-900` | `#0c111b` | `#FFFFFF` (Paper) | cards/surfaces |
| `slate-800` | `#182132` | `#FFFFFF` | secondary surfaces |
| `slate-700` | `#26334a` | `#D8E0EA` | borders/dividers on light |
| `slate-300` | default `#cbd5e1` | `#475569` | was muted-on-dark text; unreadable on light |
| `slate-400` | default `#94a3b8` | `#475569` | same |
| `slate-100` | default `#f1f5f9` | `#14213D` (Ink) | was body text on dark |
| `emerald-400` | `#34d99b` | keep | already brand |
| `emerald-500` | `#02c37e` | `#02A26D` (Level) | the brand green |
| `emerald-600` | `#02a26d` | keep | |
| `emerald-700` | `#047857` | keep | |
| `indigo-400/500/600` | current | keep | already the Equity blue |

**Named demo tokens also added to `index.css` `@theme`** (values verbatim from `src/demo/demo.css`): `--color-ink: #14213d`, `--color-mist: #eef2f6`, `--color-paper: #ffffff`, `--color-level: #02a26d`, `--color-level-line: #029a67` (with its contrast comment), `--color-tilt: #e8a33d`, `--color-risk: #d8454b`, `--color-equity: #4c5ce6`, `--color-debt: #1f8a9e`, `--color-gold: #c99a2e`, `--color-cash: #6b7a90`, `--font-display: 'Bricolage Grotesque', ...`, `--font-body: 'Figtree', ...`.

**Screen-restyle mapping (per-screen reference; reviewer holds screens to it):**

| Dark utility | Light replacement |
|---|---|
| `bg-slate-950` (page) | `bg-mist` |
| `bg-slate-900` / `bg-slate-800` (card) | `bg-paper` (+ `border-slate-700` edge, demo card radius/shadow) |
| `bg-white/10`, `bg-white/5` (tint) | `bg-ink/5` |
| `text-white` on card/page | `text-ink` |
| `text-white` on `emerald-500`/`level`/green fill | KEEP `text-white` |
| `text-slate-100` | `text-ink` |
| `text-slate-300` / `text-slate-400` (muted) | `text-ink/70` / `text-ink/60` (or the remapped ramp) |
| `text-slate-500` | `text-ink/60` |
| `border-slate-700`/`800` | keep (remapped light edge) |
| `shadow-slate-950/60` | `shadow-ink/10` |
| `bg-gradient-from/to-slate-*` | mist/paper equivalents |
| Recharts `stroke`/`fill` `#0c111b`-family | `#14213d` ink; grid/axis → `#D8E0EA`; series → demo bucket hues |

---

### Task 1: Capture the dark baseline

**Files:**
- Create: none (evidence only — screenshots are git-ignored scratch; findings recorded in the task report)

**Interfaces:**
- Produces: baseline screenshots `.playwright-mcp/c-base-<screen>-<w>.png` for every screen below, and a baseline numbers list (per-screen key figures on the sample portfolio) in the task report — Tasks 3–10 and 11 verify against these.

- [ ] **Step 1: Screenshot every dark screen at 1440 and 375**

Playwright against the dev server on `http://localhost:3000` (already running; do not start/stop it). Screens: Overview (`/#overview`), Rebalance (`/#rebalance`), Maturity Radar (`/#radar`), Tax & Insights (`/#tax`), Simulator (`/#simulator`), Navbar/shell (any page top), each modal open (AddHolding, UploadStatement, ValidatePortfolio, NavRefresh, Reinvest, chat drawer), OnboardingTour first step, and one SEO page (`/ltcg-tax-harvesting-india/`). Full-page screenshots.

- [ ] **Step 2: Record per-screen key numbers on the sample portfolio**

Seed the sample portfolio the app loads by default; record per screen: Overview total net worth + holding count; Rebalance top plan's amount-moved figure; Radar maturity count; Tax unrealized-gain headline; Simulator 5-year end value. These go in the report file.

- [ ] **Step 3: Report (no commit)**

No code changes; nothing to commit. The report file (`.superpowers/sdd/<workspace>/task-1-report.md`) carries the screenshot list + numbers table.

---

### Task 2: Tokens, fonts and HTML shells

**Files:**
- Modify: `src/index.css` (whole `@theme` + base layer + scrollbar block)
- Modify: `index.html` (fonts link, theme-color meta)
- Modify: `ltcg-tax-harvesting-india/index.html`, `fd-maturity-reinvestment-guide/index.html`, `home-loan-vs-fd-calculator/index.html`, `mutual-fund-rebalance-india/index.html` (same three edits)
- Modify: `public/site.webmanifest`
- Modify: `demo/index.html` (theme-color only if it differs from Mist)
- Comment: `src/demo/demo.css` (`@theme` block gains a sync comment)

**Interfaces:**
- Produces: the remapped ramps + named demo tokens (table above) available to every screen; `font-display`/`font-body` base families. All later tasks style against these. `demo.css` keeps its own `@theme static` (batch-1 ruling: Tailwind emits only used vars, and Beam/MixBar read `var(--color-*)` inline) with a comment `/* values mirror index.css — keep in sync */`; the spec's "one source" is satisfied in spirit — single visual source of truth — without restructuring the demo entry's CSS loading mid-reskin.

- [ ] **Step 1: Remap the ramps and add the named tokens in `src/index.css`**

Apply the Token mapping table exactly: replace the four dark slate overrides, add `slate-100/300/400` overrides, change `emerald-500`, add the eleven named demo tokens + two font tokens. Keep the `text-2xs` utility.

- [ ] **Step 2: Rewrite the base layer + scrollbar to the demo's light base**

Body: `background-color: var(--color-mist); color: var(--color-ink); font-family: var(--font-body)`. Headings h1–h6: `font-family: var(--font-display)`, `line-height: 1.08`, `letter-spacing: -0.015em`, `font-stretch: 88%`. Mono/`tabular-nums` stay JetBrains Mono. Adopt demo.css's `:focus-visible` ring and `prefers-reduced-motion` block verbatim. Scrollbar: track `rgba(238,242,246,.85)`, thumb `rgba(216,224,234,.9)`, hover thumb the Level green at ~.55.

- [ ] **Step 3: Font links and HTML shells (5 HTML files + webmanifest)**

In `index.html` + the four SEO heads: REPLACE the DM Sans/Plus Jakarta Google Fonts URL with the demo's exact URL (`https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,300..800&family=Figtree:wght@300..800&display=swap` — the `wdth` axis is required by `font-stretch: 88%`), KEEP the JetBrains Mono link, set `<meta name="theme-color" content="#EEF2F6">`, and change the body tag's `selection:text-slate-950` to `selection:text-white` (leave the rest of the body class — the remap turns `bg-slate-950 text-slate-100` into Mist/Ink automatically). `public/site.webmanifest`: `background_color` and `theme_color` → `#EEF2F6`.

- [ ] **Step 4: Verify and commit**

Run: `npm run lint && node --import tsx --test src/demo/*.test.ts src/utils/*.test.ts && npm run build` — clean/green/exit 0. Browser: `/` boots light but with wrong text colours in unrewritten screens (EXPECTED intermediate — screens are rewritten in Tasks 3–9; the spec's Task-2→9 arc accepts this); SEO pages readable; demo unaffected. Screenshot `c-tokens-home-1440.png` for the record.

```bash
git add src/index.css index.html demo/index.html public/site.webmanifest ltcg-tax-harvesting-india/index.html fd-maturity-reinvestment-guide/index.html home-loan-vs-fd-calculator/index.html mutual-fund-rebalance-india/index.html src/demo/demo.css
git commit -m "Remap the app theme to the demo's light tokens"
```

---

### Task 3: App shell and Navbar

**Files:**
- Modify: `src/App.tsx` (shell chrome, tab backgrounds, 15 dark sites)
- Modify: `src/components/Navbar.tsx` (35 dark sites)

**Interfaces:**
- Consumes: remapped ramps + named tokens (Task 2).
- Produces: the light shell every later task renders inside.

- [ ] **Step 1: Restyle both files per the mapping table**

Navbar: Mist/paper surfaces, ink text, Level-green accents, the `/demo/` tour link stays prominent. Shell: page bg Mist, modals' backdrop unchanged, body copy ink.

- [ ] **Step 2: Verify and commit**

Lint + suite + build green. Browser 1440+375: navbar and shell match the demo's header look; screenshots `c-shell-*`; console clean; Overview numbers match baseline (they render inside this shell). No horizontal scroll at 375.

```bash
git add src/App.tsx src/components/Navbar.tsx
git commit -m "Light the app shell and navbar"
```

---

### Task 4: OverviewTab

**Files:**
- Modify: `src/components/OverviewTab.tsx` (80 dark sites)

- [ ] **Step 1: Restyle per the mapping table** — cards → Paper + light edges; dense tables adopt the demo's spacing/type scale (density not preserved); Recharts colours → ink/`#D8E0EA`/bucket hues; `text-white` only on green fills.

- [ ] **Step 2: Verify and commit**

Lint + suite + build green. Browser 1440+375: screenshots `c-overview-*`; **total net worth and holding count identical to Task 1 baseline**; no horizontal scroll at 375; chat drawer button visible.

```bash
git add src/components/OverviewTab.tsx
git commit -m "Light the Overview tab"
```

---

### Task 5: RebalanceTab

**Files:**
- Modify: `src/components/RebalanceTab.tsx` (118 dark sites — the largest restyle)

- [ ] **Step 1: Restyle per the mapping table** — same rules as Task 4; source/destination pickers, plan cards, and the sticky summary bar adopt the demo card language; sliders/radios keep visible focus.

- [ ] **Step 2: Verify and commit**

Lint + suite + build green. Browser 1440+375: screenshots `c-rebalance-*`; **top plan's amount-moved figure identical to baseline**; no horizontal scroll at 375.

```bash
git add src/components/RebalanceTab.tsx
git commit -m "Light the Rebalance tab"
```

---

### Task 6: Maturity Radar and Tax & Insights

**Files:**
- Modify: `src/components/MaturityRadarTab.tsx` (35 dark sites)
- Modify: `src/components/TaxAndInsightsTab.tsx` (21 dark sites)

- [ ] **Step 1: Restyle both per the mapping table** (batched — two smaller tabs, same shape of change).

- [ ] **Step 2: Verify and commit**

Lint + suite + build green. Browser 1440+375: screenshots `c-radar-*`, `c-tax-*`; **radar maturity count and tax unrealized-gain headline identical to baseline**; no horizontal scroll at 375.

```bash
git add src/components/MaturityRadarTab.tsx src/components/TaxAndInsightsTab.tsx
git commit -m "Light the Maturity Radar and Tax tabs"
```

---

### Task 7: Macro Simulator

**Files:**
- Modify: `src/components/MacroSimulatorTab.tsx` (40 dark sites)

- [ ] **Step 1: Restyle per the mapping table** — factor sliders and the stress chart adopt the demo tokens; chart series use bucket hues.

- [ ] **Step 2: Verify and commit**

Lint + suite + build green. Browser 1440+375: screenshots `c-sim-*`; **5-year end value identical to baseline**; no horizontal scroll at 375.

```bash
git add src/components/MacroSimulatorTab.tsx
git commit -m "Light the Macro Simulator tab"
```

---

### Task 8: Modals, drawer, tour — plus tap targets and the shared dialog hook

**Files:**
- Modify: `src/components/AddHoldingModal.tsx`, `src/components/UploadStatementModal.tsx`, `src/components/ValidatePortfolioModal.tsx`, `src/components/NavRefreshModal.tsx`, `src/components/ReinvestModal.tsx`, `src/components/PortfolioChatDrawer.tsx`, `src/components/OnboardingTour.tsx`
- Create: `src/utils/dialogA11y.ts` (pure focus helpers, unit-tested) + `src/utils/dialogA11y.test.ts`
- Modify: `src/utils/dialogA11y.ts` consumed by `PortfolioChatDrawer.tsx` in this task; demo `ChatPanel.tsx` adopts it in Task 9

**Interfaces:**
- Produces (Task 9 consumes): `src/utils/dialogA11y.ts` exporting
  `export function getFocusable(container: HTMLElement): HTMLElement[]` (visible, enabled, focusable elements in DOM order) and
  `export function nextFocusIndex(current: number, count: number, shift: boolean): number` (wrap-around: Tab at last → 0, Shift+Tab at first → count−1; single-focusable containers return the same index). A thin `useDialogA11y` React hook may live beside them (hook itself is not unit-tested — no DOM runner; browser-verified).

- [ ] **Step 1: Write the failing tests for the pure helpers**

`src/utils/dialogA11y.test.ts`: `nextFocusIndex` wraps forward from the last, backward from the first, holds a single-element container, and advances normally mid-list; `getFocusable` skips `disabled` buttons and `tabIndex={-1}` nodes (jsdom-free: test `nextFocusIndex` purely; for `getFocusable`, construct minimal DOM via `document.createElement` in a guarded test — the Node runner exposes no DOM, so if `document` is unavailable the test asserts the helper's contract via a stubbed container implementing `querySelectorAll`; keep the stub minimal and honest). RED first.

- [ ] **Step 2: Implement `dialogA11y.ts` to GREEN**, then restyle the six modals/drawer/tour per the mapping table. Tap targets: the ~32px row buttons in Validate/AddHolding (`px-2.5 py-1 text-2xs` sites) get `min-h-[40px]` / larger padding. Drawer adopts `useDialogA11y` + `aria-modal="dialog"` role behaviour: focus trapped inside, Escape closes, focus restores to the launcher — matching the demo panel's contract.

- [ ] **Step 3: Verify and commit**

Lint + suite green (new tests pass, RED evidence in report). Browser 1440+375: every modal opens light, Tab cycles inside it, Escape closes and restores focus; screenshots `c-modal-*` (one per modal), `c-tour-*`. Numbers unchanged.

```bash
git add src/utils/dialogA11y.ts src/utils/dialogA11y.test.ts src/components/AddHoldingModal.tsx src/components/UploadStatementModal.tsx src/components/ValidatePortfolioModal.tsx src/components/NavRefreshModal.tsx src/components/ReinvestModal.tsx src/components/PortfolioChatDrawer.tsx src/components/OnboardingTour.tsx
git commit -m "Light the modals and share a dialog focus trap"
```

---

### Task 9: SEO landing pages

**Files:**
- Modify: `src/components/SeoLandingPage.tsx` (36 `text-white`, 26 `bg-slate-950` sites; 671 lines)

**Ruling (recorded):** the spec hoped this page inherits the light theme automatically. The remap does most of it, but `text-white` on light surfaces is invisible and unfixable by remap — so this page gets its own styling-only task. The spec's "not a per-screen task" line is superseded by its own contrast gate.

- [ ] **Step 1: Restyle per the mapping table** — calculators, cards and FAQ blocks adopt Paper/Ink; `text-white` only on green fills.

- [ ] **Step 2: Verify and commit**

Lint + suite + build green. Browser 1440+375 on ONE representative route (`/ltcg-tax-harvesting-india/`) plus a 375 check of the other three: screenshots `c-seo-*`; page light, calculators render numbers, no invisible text; console clean.

```bash
git add src/components/SeoLandingPage.tsx
git commit -m "Light the SEO calculator pages"
```

---

### Task 10: Demo fold-in minors

**Files:**
- Modify: `src/demo/DemoApp.tsx` (NAVIGATE/START_BLANK wiring, error boundary)
- Modify: `src/demo/components/ChatPanel.tsx` (adopts `useDialogA11y` from Task 8)
- Modify: `src/demo/components/ChapterBar.tsx` (mobile bar navigable)
- Modify: `src/demo/components/Story.tsx` (relabel one duplicate button)
- Create: `src/demo/components/DemoErrorBoundary.tsx`

**Interfaces:**
- Consumes: `useDialogA11y`/`getFocusable`/`nextFocusIndex` from Task 8 (`src/utils/dialogA11y.ts`).
- Produces: nothing downstream.

- [ ] **Step 1: Chat-path portfolio seeding** — in `DemoApp.tsx`, chat NAVIGATE to overview and OPEN_ADD_MODAL from an un-forked sample path seed `personal` from the CURRENT portfolio (a copy), not `{ holdings: [], baseCurrency: 'INR' }`; only "Add my investments" starts empty. Chat START_BLANK / delete-to-empty while on see/play/plan routes to `mine` with an assistant note (plain words, e.g. "Your list is empty — add an investment to see your numbers.").

- [ ] **Step 2: ChatPanel adopts `useDialogA11y`** (focus trap + `aria-modal`), keeping Escape/focus-restore behaviour identical.

- [ ] **Step 3: Remaining minors** — `DemoErrorBoundary` (class component, ~10 lines, "Couldn't load this part. Please refresh.") wraps the lazy Editor and ChatPanel Suspense mounts; 375px chapter bar becomes navigable (buttons on the segment strip, `aria-current` preserved, same locked-chapter semantics as desktop); demo `main` gains bottom padding so the fixed launcher never covers the Continue button at max scroll; story beat-4 button relabels to avoid the duplicate "Edit my investments" label (e.g. banner keeps its label, Story's becomes "Open my investments").

- [ ] **Step 4: Verify and commit**

Lint + suite (144) green. Browser 1440+375, storage spy installed: every fold-in demonstrated (chat "overview" from sample path shows the sample's holdings in Your numbers; START_BLANK from See it routes to Your numbers with the note; Tab cycles inside the chat panel; 375 chapter bar jumps chapters; launcher/Continue don't overlap at max scroll; a forced chunk error shows the boundary message — simulate by temporarily throwing in a lazy import, revert the throw). Screenshots `c-fold-*`. `setItem` spy records zero calls; localStorage keys unchanged.

```bash
git add src/demo/DemoApp.tsx src/demo/components/ChatPanel.tsx src/demo/components/ChapterBar.tsx src/demo/components/Story.tsx src/demo/components/DemoErrorBoundary.tsx
git commit -m "Fold the deferred demo minors into the light reskin"
```

---

### Task 11: Whole-app verification and contrast gate

**Files:**
- Modify: only files a discovered defect forces (fix-only)

- [ ] **Step 1: Static + suite + build sweep**

`npm run lint && node --import tsx --test src/demo/*.test.ts src/utils/*.test.ts && npm run build` — green/exit 0. `grep -rn "DM Sans\|Plus Jakarta" index.html demo/index.html src/` — no hits. `grep -rn "StreetStoryGame" src/ --include="*.tsx" --include="*.ts" | grep -v "src/components/StreetStoryGame.tsx"` — no hits (game still unrouted).

- [ ] **Step 2: Contrast table**

Compute (same method as batch 1) the main pairs per screen: body text ink/Mist, muted ink-variants/Paper, white-on-Level fills, chart series on Paper. All text ≥ 4.5:1, graphics ≥ 3:1. Record the table in the report.

- [ ] **Step 3: Full visual sweep at 1440 + 375**

Every screen (Tasks 3–9's list + demo untouched-check): screenshots `c-final-*`; no horizontal scroll; focus visible; keyboard-operable; reduced-motion respected; console clean apart from the 4 known CORS errors. **Numbers identical to Task 1 baseline on every screen.** Demo journey spot-check: one full pass, storage spy zero calls.

- [ ] **Step 4: Commit fixes (or none)**

```bash
git add -A src
git commit -m "Fix contrast and layout defects found in the reskin sweep"
```

---

## Review Focus

1. **Numbers identical after reskin** — a styling-only pass must move no figure. Test: Task 1 baseline table vs Task 11 Step 3 per-screen re-check.
2. **White-on-white / invisible text on light surfaces** — every `text-white` that sat on a dark surface becomes `text-ink`; only green-fill whites survive. Test: Task 11 contrast table; each screen task's reviewer checks the mapping table row.
3. **SEO pages fully light and readable** — the remap alone leaves `text-white` traps in `SeoLandingPage`. Test: Task 9's 375 check on all four routes.
4. **Focus trap correctness in both dialogs** — Tab must cycle inside (drawer + demo panel), Escape closes, focus restores to the launcher. Test: Task 8 unit tests for `nextFocusIndex` (RED→GREEN) + browser Tab/Escape walk in Tasks 8 and 10.
5. **The demo still never writes storage** — fold-ins touch DemoApp/ChatPanel state paths. Test: Task 10 `setItem` spy (zero calls) + full suite green.
