# Welcome first-run (sample vs scratch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first visit shows a full-screen welcome — "Explore with sample data" (recommended) or "Start from scratch" — then starts the onboarding tour; returning visitors never see it; the two extra demo personas and the navbar persona dropdown disappear; and the Overview header shows live-FX totals on first paint.

**Architecture:** `App` decides on mount from `loadPersistedPortfolio()`: null → full-screen `WelcomeScreen` (early return, persist effect paused while it shows) whose two choices reuse the existing sample-reset / start-blank handlers, so the resulting state flows through the app's normal save effect — no direct storage writes. An `fxVersion` counter in `App` (bumped when `refreshFxRates()` resolves) is passed into `OverviewTab` and added to every FX-reading memo's deps, fixing first-paint staleness.

**Tech Stack:** React 19 + TypeScript + Tailwind v4 named tokens (`bg-mist`, `bg-paper`, `text-ink`, `border-level`), node:test via tsx (`node --import tsx --test`), Playwright MCP for browser verification.

**Spec:** `docs/superpowers/specs/2026-11-25-welcome-first-run-design.md`

## Global Constraints

- Sample data is byte-for-byte untouched: `DEMO_PROFILES[0]` (`profile-nri-tech`, "Vikram Malhotra", 9 holdings `h-101`…`h-109`) and the `/demo/` journey stay exactly as they are; the demo never writes storage.
- A returning visitor — anyone with a persisted portfolio, including the legacy ids `profile-growth-builder` / `profile-conservative` — never sees the welcome and never loses their saved data.
- The welcome persists only through the app's normal save effect; `WelcomeScreen` never touches `localStorage` directly.
- No new analytics events. The existing `profile_switched` event dies with the dropdown; the existing events inside `handleResetToSample` / `handleStartBlank` are reused as-is.
- Exact copy is pinned: title "Welcome to Vestora"; context line "Plan your rebalance in your browser — nothing leaves your device."; cards "Explore with sample data" / "Start from scratch" with a "Recommended" tag on the sample card; empty-state heading "You haven't added any investments yet." with buttons "Add holding" / "Import a file".
- Styling uses the named light-theme tokens only — no hardcoded hex, no inline styles, Tailwind classes only (repo pre-check rules).
- Escape on the welcome does nothing; there is no dismissal path — the visitor must pick one.
- Every task: `node --import tsx --test src/demo/*.test.ts src/utils/*.test.ts` green, `npm run lint` clean, `npm run build` exit 0. Commits are conventional with the `Co-Authored-By: Claude Code <noreply@anthropic.com>` trailer; repo identity is already `prateekdesai1990@gmail.com`. Nothing gets pushed.

## Review Focus

- A visitor whose saved portfolio carries a removed persona id (`profile-growth-builder`, `profile-conservative`) must boot into their exact saved state — pinned by the legacy-id unit test in Task 1.
- Corrupt or foreign JSON under `vestora.portfolio.v1` must degrade to "first visit" (welcome shows), never a crash — pinned by the corrupt-JSON unit test in Task 1 and the fresh-visit browser step in Task 3.
- Reloading immediately after either welcome choice must not re-ask and must restore the chosen state — pinned by the two reload browser steps in Task 3.
- Zero holdings on every tab must render without crash, NaN, or Infinity — walked tab-by-tab in Task 5.
- A failed/offline FX fetch must leave the header at benchmark figures (never NaN) even though `fxVersion` still bumps — pinned by the blocked-fetch browser step in Task 2.

---

### Task 1: One persona, no navbar dropdown, legacy-storage compatibility

**Files:**
- Modify: `src/data/mockData.ts` (delete `PROFILE_GROWTH_BUILDER` ~line 294 and `PROFILE_CONSERVATIVE` ~line 425 with their holdings arrays; `INITIAL_PROFILES` becomes `[PROFILE_GLOBAL_NRI]`)
- Modify: `src/components/Navbar.tsx:239-259` (delete the "Demo Persona" select block; update the `Currency & Demo Persona` comment at line 217), `NavbarProps` lines 34-35 (`currentProfile`, `setProfile`), the destructure at lines 58-59, and the now-unused `DEMO_PROFILES` import (line 3) and `UserProfile` import (line 2, keep `CurrencyCode`)
- Modify: `src/App.tsx:171-178` (delete `handleProfileSwitch`), line 510 (stop passing `setProfile`), line 509 (stop passing `currentProfile`), line 7 (drop `UserProfile` from the type import). `currentProfile` itself stays — `profileName` still consumes it.
- Modify: `src/utils/portfolioStorage.ts:31` (accept legacy persona ids)
- Test: `src/utils/portfolioStorage.test.ts` (new)

**Interfaces:**
- Consumes: existing `loadPersistedPortfolio` / `savePersistedPortfolio` / `sampleHoldingsFor` signatures (unchanged).
- Produces: `DEMO_PROFILES` is a single-element array whose `[0]` is the demo journey's profile; `loadPersistedPortfolio` accepts any persisted `profileId` in `{profile-nri-tech, profile-growth-builder, profile-conservative, custom}` and returns null otherwise. Later tasks rely on `DEMO_PROFILES[0]` being the only profile.

- [ ] **Step 1: Write the failing test**

Create `src/utils/portfolioStorage.test.ts`:

```ts
/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PROFILES } from '../data/mockData.ts';
import {
  loadPersistedPortfolio,
  savePersistedPortfolio,
  sampleHoldingsFor,
} from './portfolioStorage.ts';

// portfolioStorage reads window.localStorage at call time — stub it in memory.
const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  },
};

test('exactly one sample persona survives, byte-identical to the demo journey', () => {
  assert.equal(DEMO_PROFILES.length, 1);
  assert.equal(DEMO_PROFILES[0].id, 'profile-nri-tech');
  assert.equal(DEMO_PROFILES[0].name, 'Vikram Malhotra');
  assert.equal(DEMO_PROFILES[0].baseCurrency, 'INR');
  const sample = sampleHoldingsFor(DEMO_PROFILES[0]);
  assert.deepEqual(sample.map((h) => h.id), [
    'h-101', 'h-102', 'h-103', 'h-104', 'h-105',
    'h-106', 'h-107', 'h-108', 'h-109',
  ]);
  assert.equal(sample[0].isMatured, true); // h-101 rebased 15 days past maturity
});

test('a portfolio saved under a removed persona id still loads (no data loss on upgrade)', () => {
  store.clear();
  savePersistedPortfolio({
    profileId: 'profile-growth-builder',
    baseCurrency: 'INR',
    holdings: [],
    mode: 'personal',
  });
  const loaded = loadPersistedPortfolio();
  assert.ok(loaded);
  assert.equal(loaded.profileId, 'profile-growth-builder');
});

test('an unknown profile id is still rejected', () => {
  store.clear();
  savePersistedPortfolio({
    profileId: 'profile-zzz',
    baseCurrency: 'INR',
    holdings: [],
    mode: 'personal',
  });
  assert.equal(loadPersistedPortfolio(), null);
});

test('corrupt JSON in storage returns null instead of throwing', () => {
  store.clear();
  store.set('vestora.portfolio.v1', '{not json');
  assert.equal(loadPersistedPortfolio(), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/utils/portfolioStorage.test.ts`
Expected: FAIL — `DEMO_PROFILES.length` is 3, and the legacy-id load returns null.

- [ ] **Step 3: Implement**

- `src/data/mockData.ts`: delete the two persona constants and their holdings; `INITIAL_PROFILES: UserProfile[] = [PROFILE_GLOBAL_NRI]`. `rebaseSampleMaturities` and `DEMO_PROFILES` are untouched (they map over the list).
- `src/utils/portfolioStorage.ts`: extend the known-profile check with a legacy list:

```ts
const LEGACY_PROFILE_IDS = ['profile-growth-builder', 'profile-conservative'];
const knownProfile =
  DEMO_PROFILES.some((p) => p.id === parsed.profileId) ||
  parsed.profileId === 'custom' ||
  LEGACY_PROFILE_IDS.includes(parsed.profileId);
```

- `src/components/Navbar.tsx`: delete the Demo Persona select block (lines 239-259), the `currentProfile`/`setProfile` props (interface + destructure), the `DEMO_PROFILES` import, and rename the section comment to `Currency`.
- `src/App.tsx`: delete `handleProfileSwitch`; remove `setProfile={handleProfileSwitch}` and `currentProfile={currentProfile}` from the Navbar call; drop `UserProfile` from the type import. `currentProfile` (line 164) stays for `profileName`.
- After these deletions, `npm run lint` is the arbiter for any import that became unused (e.g. `UserProfile` in Navbar if nothing else consumes it, `trackEvent` if the dropdown was its only caller) — remove exactly what lint flags, nothing else.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run lint && node --import tsx --test src/demo/*.test.ts src/utils/*.test.ts && npm run build`
Expected: lint clean, all tests green (existing demo tests only use `DEMO_PROFILES[0]`), build exits 0.

- [ ] **Step 5: Browser sanity**

Playwright MCP on `http://localhost:3000`: app boots into the 9-holding sample; the Menu opens without a "Demo Persona" select; no console errors.

- [ ] **Step 6: Commit**

```bash
git add src/data/mockData.ts src/utils/portfolioStorage.ts src/utils/portfolioStorage.test.ts src/components/Navbar.tsx src/App.tsx
git commit -m "feat: keep one sample persona and drop the navbar persona dropdown

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: FX first-paint fix (fxVersion recompute signal)

**Files:**
- Modify: `src/App.tsx:137-151` (fx state effect) and the `OverviewTab` call site (~line 566)
- Modify: `src/components/OverviewTab.tsx` (`OverviewTabProps` ~line 168, destructure ~line 181, FX memos from line 202)

**Interfaces:**
- Consumes: nothing from Task 1 beyond a green suite.
- Produces: `OverviewTabProps` gains `fxVersion: number` — App bumps it once per `refreshFxRates()` resolution. Later tasks' `OverviewTab` call sites must keep passing it.

- [ ] **Step 1: Reproduce the staleness (failing observation, browser)**

Playwright MCP, fresh profile on `http://localhost:3000`:
1. Before navigation, route-mock `**api.frankfurter.dev**` to fulfill with `{"date":"2026-11-25","rates":{"INR":92.92,"EUR":1.0763}}` and clear `vestora.fxCache.v1` from localStorage.
2. Navigate and wait for the network to settle.
3. Expected today (the bug): the Overview header total stays **₹1,19,68,450** (benchmark USD→INR 86.50 × the $38,500 holding) with no user interaction. Screenshot `fx-stale-first-paint.png`.

- [ ] **Step 2: Implement**

- `src/App.tsx`: add `const [fxVersion, setFxVersion] = useState(0);` next to the fx state (line ~138); inside the existing effect's `.then`, after `setFxSource(state.source)`, add `setFxVersion((v) => v + 1);`. Pass `fxVersion={fxVersion}` to `OverviewTab`.
- `src/components/OverviewTab.tsx`: add `fxVersion: number;` to `OverviewTabProps` and to the destructure. Then add `fxVersion` to the dependency array of **every `useMemo` whose callback calls `convertCurrency`** — grep inside the component body; the memos starting at lines 202, 209, 295, 303, 341, 376 are the expected set (downstream memos derive from these and need nothing).

- [ ] **Step 3: Verify the fix (browser)**

Repeat Step 1's mock and reload. Expected: header total reads **₹1,22,15,620** (8,638,200 + 38,500 × 92.92) with no click or scroll after load. Screenshot `fx-live-first-paint.png`. Then mock the API to return HTTP 500, clear the cache, reload: header stays **₹1,19,68,450** with no NaN anywhere and no console errors (the bump fires with `source: 'benchmark'` and must be harmless).

- [ ] **Step 4: Full gates**

Run: `npm run lint && node --import tsx --test src/demo/*.test.ts src/utils/*.test.ts && npm run build`
Expected: clean / green / exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/OverviewTab.tsx
git commit -m "fix: recompute FX-dependent Overview memos when live rates land

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: WelcomeScreen, first-run gating, and tour start

**Files:**
- Create: `src/components/WelcomeScreen.tsx`
- Modify: `src/App.tsx` (initial memo ~lines 47-64, new state ~line 92, persist effect ~lines 154-162, two new handlers near `handleResetToSample` ~line 390, early return before the main JSX ~line 501, `OnboardingTour` call site ~line 809)
- Modify: `src/components/OnboardingTour.tsx` (props + privacy-step copy)

**Interfaces:**
- Consumes: Task 1's single-profile `DEMO_PROFILES`; existing `handleResetToSample` and `handleStartBlank`.
- Produces: `WelcomeScreen` with props `{ onChooseSample: () => void; onChooseScratch: () => void }`; `OnboardingTourProps` gains optional `startedFromScratch?: boolean`; App state `welcomeChoice: 'sample' | 'scratch' | null`.

- [ ] **Step 1: Implement the gating in `App.tsx`**

- `initial` memo: add `needsWelcome: boolean` to both branches. Persisted branch: `needsWelcome: false`. Fallback branch replaces the sample seed —
  `profileId: 'custom'`, `baseCurrency: DEMO_PROFILES[0].baseCurrency`, `holdings: []`, `mode: 'personal'`, `prepayments: []`, `needsWelcome: true`.
- `const [welcomeOpen, setWelcomeOpen] = useState<boolean>(initial.needsWelcome);` and `const [welcomeChoice, setWelcomeChoice] = useState<'sample' | 'scratch' | null>(null);` next to `isTourOpen`.
- Persist effect: first line `if (welcomeOpen) return;` and add `welcomeOpen` to its dependency array — nothing writes while the choice is pending.
- Handlers (place next to `handleResetToSample`):

```tsx
const handleChooseSample = () => {
  handleResetToSample();
  setWelcomeChoice('sample');
  setWelcomeOpen(false);
  setIsTourOpen(true);
};

const handleChooseScratch = () => {
  handleStartBlank();
  setWelcomeChoice('scratch');
  setWelcomeOpen(false);
  setIsTourOpen(true);
};
```

- Early return, after all hooks and `handleRestoreFile`, before the main JSX return:

```tsx
if (welcomeOpen) {
  return <WelcomeScreen onChooseSample={handleChooseSample} onChooseScratch={handleChooseScratch} />;
}
```

- `OnboardingTour` call site: add `startedFromScratch={welcomeChoice === 'scratch'}`.

- [ ] **Step 2: Implement `WelcomeScreen.tsx`**

Props exactly `{ onChooseSample: () => void; onChooseScratch: () => void }`. Full-screen `min-h-screen bg-mist text-ink` centered column, `max-w-md`, page `h1` "Welcome to Vestora", context line "Plan your rebalance in your browser — nothing leaves your device." (exact). Two stacked full-width `<button type="button">` cards on `bg-paper` rounded-xl:
- Sample card: `border-2 border-level`, a "Recommended" pill (`bg-level text-paper`), title "Explore with sample data", sub-line "A realistic portfolio loads so you can explore every tool — you can clear it and start fresh anytime." Gets focus on mount (`autoFocus`).
- Scratch card: `border border-slate-700 hover:border-ink/40`, title "Start from scratch", sub-line "Begin with an empty ledger and add holdings or import a file when you're ready."
No Escape handler, no backdrop, no dismiss path — nothing closes the screen except the two buttons.

- [ ] **Step 3: Tour copy for scratch choosers**

`OnboardingTourProps` gains `startedFromScratch?: boolean` (default false). When true, the privacy step's description becomes exactly: "We don't store your portfolio on any server. Your ledger starts empty — add holdings or import a file whenever you're ready." (tip and all other steps unchanged). Implementation: derive the step list inside the component by overriding the `privacy` step's description when the flag is set.

- [ ] **Step 4: Verify the whole flow matrix (browser)**

Playwright MCP on `http://localhost:3000`:
1. Clear localStorage → navigate: welcome renders, the sample card holds focus (`document.activeElement`), Escape does nothing (welcome persists), no console errors.
2. Click "Explore with sample data": app renders the 9-holding ledger and the tour is open on its privacy step (sample wording). Close the tour.
3. Reload: boots straight into the sample — no welcome, no auto-tour.
4. Clear localStorage → choose "Start from scratch": Overview renders (empty-ledger state) and the tour opens with the scratch wording.
5. Reload: boots into the empty portfolio — no welcome, no re-ask.
6. Visit `/demo/`: the demo journey still works with its sample (untouched).

- [ ] **Step 5: Full gates**

Run: `npm run lint && node --import tsx --test src/demo/*.test.ts src/utils/*.test.ts && npm run build`
Expected: clean / green / exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/WelcomeScreen.tsx src/components/OnboardingTour.tsx src/App.tsx
git commit -m "feat: first-run welcome screen choosing sample or scratch, then tour

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Purposeful scratch empty state on Overview

**Files:**
- Modify: `src/components/OverviewTab.tsx:1281-1308` (the `holdings.length === 0` ledger block)

**Interfaces:**
- Consumes: existing `onOpenAddModal` and `onOpenValidateModal(tab?)` props (signatures unchanged).
- Produces: nothing downstream.

- [ ] **Step 1: Rewrite the empty-state copy and buttons**

Inside the existing block, keep the icon circle; replace the text and buttons:
- Heading: "You haven't added any investments yet." (exact)
- Body line: "Add your holdings one by one or import a statement — your numbers stay on this device."
- Primary button (first): "Add holding" → `onOpenAddModal`, emerald solid style.
- Secondary button: "Import a file" → `onOpenValidateModal('excel')`, mist/outline style.
(Same handlers the block uses today; only labels, order, and copy change.)

- [ ] **Step 2: Verify (browser)**

Scratch boot (clear localStorage → welcome → "Start from scratch", close the tour): Overview shows the exact heading and the two buttons; "Add holding" opens the Add Holding modal; "Import a file" opens the Validate & Simulate modal on its Excel tab; header KPIs read ₹0 sensibly — no NaN. Close both modals with Escape; no console errors.

- [ ] **Step 3: Full gates**

Run: `npm run lint && node --import tsx --test src/demo/*.test.ts src/utils/*.test.ts && npm run build`
Expected: clean / green / exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/OverviewTab.tsx
git commit -m "feat: purposeful empty state for scratch portfolios on Overview

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Zero-holding spot-check across Rebalance, Radar, Tax, Simulator

**Files:**
- Modify (only if defects found): `src/components/RebalanceTab.tsx`, `src/components/MaturityRadarTab.tsx`, `src/components/TaxAndInsightsTab.tsx`, `src/components/MacroSimulatorTab.tsx`

**Interfaces:**
- Consumes: the scratch boot from Task 3 (empty holdings, mode `personal`).
- Produces: any crash/NaN fixes; nothing downstream.

- [ ] **Step 1: Walk all four tabs empty (browser)**

From a scratch boot with the tour closed, visit `#rebalance`, `#radar`, `#tax`, `#simulator` in turn. For each: the tab renders, visible text contains no "NaN", "Infinity", or "undefined", no console errors, and any empty figures read sensibly (zeroed or guidance, not garbage). Screenshot each tab `scratch-<tab>.png`. Also step through the full tour in scratch mode — every step advances, no crash even where a spotlight target is absent (the tour centers its popover when the target is missing).

- [ ] **Step 2: Fix any defects found**

Crash or NaN with zero holdings is a launch blocker (spec anti-goal). Fix minimally in the owning tab; guard divisions with the existing zero-check patterns (e.g. `totalInvested > 0 ? … : 0`) and let empty arrays render their natural empty state. Styling-only blemishes may also be fixed here; deeper behaviour changes go back to the owner.

- [ ] **Step 3: Full gates**

Run: `npm run lint && node --import tsx --test src/demo/*.test.ts src/utils/*.test.ts && npm run build`
Expected: clean / green / exit 0.

- [ ] **Step 4: Commit (only if Step 2 changed files)**

```bash
git add src/components/
git commit -m "fix: keep Rebalance, Radar, Tax and Simulator sane with zero holdings

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

If nothing was found, state that plainly in the task report — a clean walk with no commit is a passing outcome.
