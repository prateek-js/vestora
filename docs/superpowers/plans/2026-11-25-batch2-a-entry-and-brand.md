# Batch 2A: Entry and brand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the street game from the app's UI (Overview becomes the landing tab), link the product to `/demo/`, and show the real logo in the demo header.

**Architecture:** Tab/hash/SEO routing moves out of `App.tsx` into one small pure module with unit tests, so the new default tab and the `#story` fallback are pinned. The game's UI hooks (tab, navbar header, Game Mode button, chat shortcut) are deleted; `StreetStoryGame.tsx` stays in the repo, unimported, as source material for the Project D reel.

**Tech Stack:** Vite 8, React 19, Tailwind 4, lucide-react (all existing). Tests: `node --import tsx --test <files>`.

**Spec:** `docs/superpowers/specs/2026-11-24-theme-roundtrip-sharekit-design.md` (Project A)

## Global Constraints

- Default tab becomes `overview`; unknown hashes and `#story` land on Overview.
- Keep `src/components/StreetStoryGame.tsx` and `src/assets/images/*` in the repo, unrouted and unimported, until Project D ships. Do not delete them in this plan.
- No SEO, sitemap or analytics changes. `/demo/` stays `<meta name="robots" content="noindex">`. The landing page (`/`, no hash) must keep exactly the title and description it has today (`VIEW_SEO.story` values).
- Styling is not touched here (the reskin is Project C): new markup in the dark navbar uses the navbar's existing dark classes.
- No new dependencies.
- Work on a new branch `feat/batch2-ab` created from `feat/demo-journey` (batch 1 is unmerged; do not merge it). Repo-local git email is already `prateekdesai1990@gmail.com`; never touch global config.
- Commit steps: run them only after the owner has OK'd per-task commits at the start of execution. Commit messages end with `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

## Review Focus

1. `/#story` (old launch-post links), `/#Story`, and garbage hashes like `/#nonsense` or `/#street-stage` land on Overview, never a blank screen. (Task 1)
2. `/` with no hash stays at `/` and keeps the landing title and description; it must not be rewritten to `/#overview` or "Portfolio Overview". (Task 1)
3. Typing "story" or "game" in the chat must not navigate to the removed tab or crash; it points the visitor to `/demo/`. (Task 2)
4. The new "Take the tour" link keeps an accessible name when its label is hidden on small screens, and is keyboard reachable. (Task 2)
5. The demo header must not overflow horizontally at 375px once the logo is added. (Task 3)

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/tabRouting.ts` (new) | `AppTab`, `tabFromHash`, `planUrlSync`: pure hash/tab/SEO decisions |
| `src/utils/tabRouting.test.ts` (new) | Pins the routing rules |
| `src/utils/seo.ts` | `SeoViewKey` loses `'story'`, gains `'home'` (same copy) |
| `src/App.tsx` | Uses `tabRouting`; story render block and `StreetStoryGame` import removed |
| `src/components/Navbar.tsx` | Story header, Game Mode button and `'story'` tab removed; "Take the tour" link added |
| `src/utils/localChatEngine.ts`, `src/components/PortfolioChatDrawer.tsx` | `'story'` removed from tab unions; story/game shortcut now points at `/demo/` |
| `src/utils/localChatEngine.test.ts` (new) | Pins the story/game shortcut |
| `src/demo/DemoApp.tsx` | Header shows `VestoraLogo` + wordmark |

---

### Task 1: Tab routing module and SEO landing key

**Files:**
- Create: `src/utils/tabRouting.ts`, `src/utils/tabRouting.test.ts`
- Modify: `src/utils/seo.ts` (type and `VIEW_SEO` key), `src/App.tsx:44-113` (tab state, hash handling, SEO effect)

**Interfaces:**
- Produces (`src/utils/tabRouting.ts`):
  - `export type AppTab = 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator'`
  - `export function tabFromHash(hash: string): AppTab` (case-insensitive; anything unknown, including `''`, `'#story'`, `'#street-stage'`, returns `'overview'`)
  - `export interface UrlSync { seoView: SeoViewKey; nextHash: string | null }`
  - `export function planUrlSync(tab: AppTab, currentHash: string): UrlSync`
- `src/utils/seo.ts`: `export type SeoViewKey = 'home' | AppTab-names` (i.e. `'home' | 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator'`); the old `story` entry is renamed `home`, text unchanged.

- [ ] **Step 1: Write the failing test** `src/utils/tabRouting.test.ts` (header `/// <reference types="node" />`, import from `./tabRouting.ts`). Tests and assertions:
  - `tabFromHash maps known hashes, any case`: `'#radar'→'radar'`, `'#RADAR'→'radar'`, `'#tax'`, `'#simulator'`, `'#rebalance'`, `'#overview'` each map to themselves.
  - `tabFromHash sends empty, old and unknown hashes to overview`: `''`, `'#story'`, `'#Story'`, `'#street-stage'`, `'#why-vestora'`, `'#nonsense'` all → `'overview'`.
  - `the landing page keeps its own SEO and URL`: `planUrlSync('overview','')` deepEquals `{ seoView: 'home', nextHash: null }`.
  - `an old #story link is rewritten to #overview`: `planUrlSync('overview','#story')` deepEquals `{ seoView: 'overview', nextHash: '#overview' }`.
  - `a tab already in the URL needs no rewrite`: `planUrlSync('radar','#RADAR')` → `{ seoView: 'radar', nextHash: null }`; `planUrlSync('overview','#overview')` → `{ seoView: 'overview', nextHash: null }`.
  - `a tab opened from a bare URL gets its hash`: `planUrlSync('radar','')` → `{ seoView: 'radar', nextHash: '#radar' }`.

- [ ] **Step 2: Run to verify it fails**
  Run: `node --import tsx --test src/utils/tabRouting.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement `tabRouting.ts` and rename the SEO key.** `planUrlSync` rule: `overview` with an empty hash is the landing view (`home`, no rewrite); every other case uses the tab's own SEO view and returns `'#'+tab` only when the lowercased current hash differs. Rename `VIEW_SEO.story` to `home`, update the `?? VIEW_SEO.story` fallback in `syncDocumentSeo`, and change `SeoViewKey` as above.

- [ ] **Step 4: Wire `App.tsx`.** Delete the local `ActiveTab`/`HASH_TO_TAB`; import `AppTab`, `tabFromHash`, `planUrlSync`. Initial state `tabFromHash(window.location.hash)` (guard `typeof window`); the `hashchange` handler calls `setActiveTab(tabFromHash(window.location.hash))`; the SEO effect becomes: `const { seoView, nextHash } = planUrlSync(activeTab, window.location.hash); syncDocumentSeo(seoView); if (nextHash) window.history.replaceState(null, '', nextHash);`. Do not touch anything else in this task (the `'story'` render block is Task 2).

- [ ] **Step 5: Run to verify it passes**
  Run: `node --import tsx --test src/utils/tabRouting.test.ts && npm run lint`
  Expected: all tests PASS. Lint may report `'story'` mismatches in `Navbar.tsx` and chat types; those are fixed in Task 2, so only confirm no errors originate in the files this task changed.

- [ ] **Step 6: Commit**
```bash
git checkout -b feat/batch2-ab
git add src/utils/tabRouting.ts src/utils/tabRouting.test.ts src/utils/seo.ts src/App.tsx
git commit -m "Route tabs through a tested module; Overview is the default landing tab"
```

---

### Task 2: Remove the game from the UI, add the tour link

**Files:**
- Modify: `src/App.tsx` (remove `StreetStoryGame` import and the `activeTab === 'story'` block), `src/components/Navbar.tsx`, `src/utils/localChatEngine.ts:29,66,1625-1628`, `src/components/PortfolioChatDrawer.tsx:42`
- Create: `src/utils/localChatEngine.test.ts`
- Do not modify or delete: `src/components/StreetStoryGame.tsx`, `src/assets/images/*`

**Interfaces:**
- Consumes: `AppTab` from `src/utils/tabRouting.ts` (Task 1).
- Produces: `Navbar.tsx` no longer exports its own `AppTab`; it imports Task 1's type. The chat `NAVIGATE` and `onNavigateToTab` unions become the five `AppTab` names.

- [ ] **Step 1: Write the failing test** `src/utils/localChatEngine.test.ts`: `story and game shortcuts point to the tour and navigate nowhere`. Call `processLocalChatMessage('story', ctx, cb)` and again with `'game'`, where `ctx = { holdings: [], baseCurrency: 'INR', portfolioMode: 'demo', profileName: 'Test' }` and every `cb` member is a stub that records calls. Assert: the reply `title === 'Guided tour'`, `reply.text` contains `/demo/`, and no callback was called.

- [ ] **Step 2: Run to verify it fails**
  Run: `node --import tsx --test src/utils/localChatEngine.test.ts`
  Expected: FAIL (`onNavigateToTab` called / title is "Opened Interactive Story"). If the module cannot load under Node for an environment reason, note it and replace this test with the browser check in Step 7 rather than changing the engine's imports.

- [ ] **Step 3: Chat engine and drawer.** In `localChatEngine.ts` remove `'story'` from the `NAVIGATE` action union and `onNavigateToTab`; replace the `story|game` shortcut body with a reply `{ title: 'Guided tour', text: 'The street game has been replaced by a short guided tour. Open /demo/ to walk through how a rebalance works.' }` (no callback). Same union change in `PortfolioChatDrawer.tsx`.

- [ ] **Step 4: Navbar.** Import `AppTab` from `../utils/tabRouting` and delete the local type; drop `story` from `TAB_NAMES`; delete the whole `if (activeTab === 'story') { ... }` header branch; replace the Game Mode `<button>` with `<a href="/demo/">` using the same dark classes, a `Compass` icon (lucide) and the label "Take the tour" in the `hidden sm:inline` span, plus `aria-label="Take the guided tour"` and `title="A short guided tour of how rebalancing works"`. Remove imports left unused (`Gamepad2`, and `ArrowRight` if nothing else uses it).

- [ ] **Step 5: App.** Remove the `StreetStoryGame` import and its render block. Remove state/handlers left unused by that removal only if lint flags them.

- [ ] **Step 6: Run to verify it passes**
  Run: `node --import tsx --test src/utils/*.test.ts && npm run lint && npm run build`
  Expected: tests PASS, lint clean, build succeeds.
  Then: `ls dist/assets | grep -i marketing` prints nothing (game images are out of the bundle), and `grep -rn "StreetStoryGame" src --include=*.tsx -l` lists only `StreetStoryGame.tsx` itself.

- [ ] **Step 7: Browser check** (`npm run dev`, Playwright MCP, 1440 and 375, screenshots saved under `.playwright-mcp/`):
  - `/` opens on Overview, URL stays `/`, `document.title` is `Vestora - Unified Wealth & Reinvestment OS`.
  - `/#story` and `/#nonsense` open Overview and the URL becomes `#overview`.
  - No "Game Mode" anywhere; "Take the tour" navigates to `/demo/`; at 375 the icon-only link has an accessible name (`aria-label`) and is reachable with Tab.
  - Typing `story` in the chat shows the "Guided tour" reply. Console has no errors.

- [ ] **Step 8: Commit**
```bash
git add src/App.tsx src/components/Navbar.tsx src/components/PortfolioChatDrawer.tsx src/utils/localChatEngine.ts src/utils/localChatEngine.test.ts
git commit -m "Remove the street game from the app UI and link to the guided tour"
```

---

### Task 3: Real logo in the demo header

**Files:**
- Modify: `src/demo/DemoApp.tsx:71`

**Interfaces:**
- Consumes: `VestoraLogo` (`src/components/VestoraLogo.tsx`, props `size?: number`, `className?: string`). The component is a plain SVG with its own dark tile and reads well on Mist, so no separate light variant is created. This is the only file under `src/components/` the demo may import.

- [ ] **Step 1: Replace the wordmark span** with a flex wrapper containing `<VestoraLogo size={32} />` and the text span `Vestora` with classes `font-display text-xl font-semibold max-sm:sr-only` (text stays available to screen readers when hidden under 640px).

- [ ] **Step 2: Verify**
  Run: `npm run lint`
  Expected: clean. Then in the browser at `/demo/`, 1440 and 375: logo and wordmark visible at 1440, logo only at 375, `document.documentElement.scrollWidth <= window.innerWidth` at 375 on every chapter, console clean. Run `node --import tsx --test src/demo/*.test.ts` and confirm all 88 existing tests still pass.

- [ ] **Step 3: Whole-plan check.** `npm run build` succeeds; `git status` shows no changes to `public/sitemap.xml`, `demo/index.html` or `vite.config.ts`.

- [ ] **Step 4: Commit**
```bash
git add src/demo/DemoApp.tsx
git commit -m "Show the Vestora logo in the demo header"
```
