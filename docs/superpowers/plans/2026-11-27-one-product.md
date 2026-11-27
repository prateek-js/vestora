# One Product, One Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the demo journey and the full app read as one product: explanatory copy on both surfaces, ink primary buttons app-wide, and a single shared chat component mounted in both.

**Architecture:** Three sequential workstreams. WS1: four copy touch points. WS2: a grep-driven class sweep (exact pattern `bg-emerald-500 hover:bg-emerald-700` → `bg-ink hover:bg-ink/90` with `text-white`→`text-paper`), file by file. WS3: promote `PortfolioChatDrawer` to the shared chat (add controlled-mode, `notes`, `subtitle`, `onOpenForm`, `mapTabToTarget` props), mount it in the demo through an adapter, delete `ChatPanel`.

**Tech Stack:** React + TS + Tailwind v4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-27-one-product-design.md` (includes the builder-check rulings — read them; they override the workstream text where they diverge)

## Global Constraints

- Sweep criterion: the exact class substring `bg-emerald-500 hover:bg-emerald-700` (30 sites at plan time; grep is the contract, snapshots are not). NEVER touch `bg-emerald-500/10` tints, `text-emerald-*`, the ValidatePortfolioModal selected chips (:505, :573) or OnboardingTour progress dots (:308, :310).
- Replacement pattern: `bg-ink hover:bg-ink/90` and `text-white` → `text-paper` within the same className string. Geometry (rounded-lg etc.) unchanged.
- The demo's chat stays lazy-loaded: DemoApp must keep importing the drawer via `lazy(() => import(...))` — no static import of the drawer or the engine into the demo's first load (DemoApp.tsx:24-27 promise).
- No changes to `src/utils/localChatEngine.ts` (the engine is already shared and tested).
- Green still means "balanced / on target": any emerald tint that encodes meaning survives the sweep untouched.
- Copy voice: plain words, no jargon, honest about what each surface does.

## Review Focus

The spec implies these failure modes; each owning task must check deliberately:

1. **Tint pollution:** the sweep touching a `bg-emerald-500/10` meaning-site. Check: post-sweep grep for `bg-emerald-500[^"]*text-white` outside the near-miss allowlist returns nothing, and the count of `emerald-500/` tints is unchanged from pre-sweep (44 at plan time) (Task 2).
2. **Stale chat bundle in the demo:** the drawer statically imported into the demo's first load, breaking the lazy promise. Check: after WS3, DemoApp's chat import is still `lazy(() => import(...))` and `grep -c "PortfolioChatDrawer" src/demo/DemoApp.tsx` shows no direct (non-lazy) import (Task 5).
3. **Lost demo chat behavior:** file-drop, notes rendering, or the gone-holding rebalance note missing after the swap. Check: the browser verify in Task 5 exercises all three explicitly (Task 5).
4. **Focus-restoration breakage:** DemoApp's focus effect reading a stale open flag. Check: the controlled `open` prop flows from the same `chatOpen` state the effect already watches (Task 5).
5. **Copy drift on the privacy line:** the demo's chat subtitle claiming the wrong scope. Check: the demo mount passes exactly "Edits this page's portfolio. Runs on your device." (Task 5).

---

### Task 1: Copy fixes

**Files:**
- Modify: `src/demo/DemoApp.tsx:217` (Full app link)
- Modify: `src/components/Navbar.tsx:171-178` (Take the tour link)
- Modify: `src/components/PortfolioChatDrawer.tsx:377` (h2 + subtitle prop groundwork happens in Task 4; here only the h2 text)

**Interfaces:**
- Produces: the approved copy strings, exact:
  - Full app link: `title="Your saved portfolio, every tool, nothing stored on our servers"` (visible text stays "Full app")
  - Tour link: visible text `New here? Take the tour` (keep `hidden sm:inline` wrapper for the icon-only small screens: text span becomes `New here? Take the tour`), `title="A 2-minute walk-through with a sample portfolio — the full app is one click away"`
  - Drawer h2: `Portfolio chat` (was "Portfolio Assistant")

- [ ] **Step 1: Edit the three copy sites**

DemoApp Full app `<a>` gains the title attr. Navbar tour `<a>`: text span → `New here? Take the tour`, title attr swapped to the approved string, aria-label updated to match. Drawer h2 → "Portfolio chat".

- [ ] **Step 2: Gates**

Run: `npm run lint && npm run build`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/demo/DemoApp.tsx src/components/Navbar.tsx src/components/PortfolioChatDrawer.tsx
git commit -m "feat: copy that explains the demo/app split and renames the app chat"
```

---

### Task 2: Ink primaries sweep

**Files:**
- Modify: every file containing the exact substring `bg-emerald-500 hover:bg-emerald-700` (30 sites at plan time across ~15 files under `src/components/` and `src/App.tsx`)

**Interfaces:**
- Consumes: nothing.
- Produces: zero remaining `bg-emerald-500 hover:bg-emerald-700` sites; every swept site reads `bg-ink hover:bg-ink/90` with `text-paper` where it said `text-white`. No other class in each string changes.

- [ ] **Step 1: Pre-sweep snapshot**

Run: `grep -rn 'bg-emerald-500 hover:bg-emerald-700' src/ | wc -l` and `grep -rn 'emerald-500/' src/ | wc -l`
Expected: 30 and 44 (record both numbers in the commit message body).

- [ ] **Step 2: Sweep file by file**

For each file: replace `bg-emerald-500 hover:bg-emerald-700` → `bg-ink hover:bg-ink/90`, and within those same className strings only, `text-white` → `text-paper`. Run `npm run build` after each file group (RebalanceTab alone first — 12+ sites — then the rest in one pass).

- [ ] **Step 3: Post-sweep verification**

Run: `grep -rn 'bg-emerald-500 hover:bg-emerald-700' src/ | wc -l` → **0**; `grep -rn 'emerald-500/' src/ | wc -l` → **44 unchanged**; `npm run lint && npm run build` → exit 0; suite: `node --import tsx --test src/demo/*.test.ts src/utils/*.test.ts` → all pass.

- [ ] **Step 4: Spot-check contrast on the two biggest swept surfaces**

RebalanceTab and OverviewTab render buttons as white-on-ink (13.9:1) — visually confirm one button of each via a quick `npm run dev` + Playwright screenshot, or accept the token math (ink #14213D vs white = 13.9:1, passes AA at any size).

- [ ] **Step 5: Commit**

```bash
git add -A src/
git commit -m "feat: ink primary buttons app-wide — one button language across demo and app"
```

---

### Task 3: Drawer gains controlled mode + adapter props

**Files:**
- Modify: `src/components/PortfolioChatDrawer.tsx`

**Interfaces:**
- Produces (all optional, backward-compatible — the existing App.tsx mount passes none of them and behaves byte-identically):
  - `open?: boolean` — when provided, the drawer is controlled: visibility follows the prop, the internal `isOpen` state is not used, and NO launcher button renders (controlled mode implies hidden launcher).
  - `onClose?: () => void` — controlled close; all internal close paths (X button, backdrop, action-driven closes) call it in controlled mode.
  - `notes?: { id: string; text: string }[]` — rendered as system lines in the feed (same treatment as ChatPanel's notes).
  - `subtitle?: string` — header subtitle; default the current string.
  - `onOpenForm?: (req: { mode: 'add' | 'edit'; holding?: Holding; draft?: Holding }) => void` — when provided, OPEN_ADD_MODAL/OPEN_EDIT_MODAL actions route here instead of the internal modal state.
  - `mapTabToTarget?: (tab: 'overview' | 'rebalance' | 'radar' | 'tax' | 'simulator') => void` — called before the close in NAVIGATE handling; when the mapper returns void (all calls do), the drawer closes (controlled) or closes itself (uncontrolled); when NOT provided, NAVIGATE behaves as today. The demo decides inside its mapper whether the tab maps to a chapter or should produce the "in the full app" note (passed via its own notes state).

- [ ] **Step 1: Implement the props**

Add the props to the interface and wire them: visibility = `openProvided ? open : internalIsOpen`; launcher rendered only when `!openProvided && !hideLauncher`. Subtitle uses `subtitle ?? 'On-device · Zero external API calls'`. Notes render below the welcome block. NAVIGATE: `mapTabToTarget?.(tab); close();` where `close()` calls `onClose?.()` if controlled else sets internal state. OPEN_*_MODAL: `onOpenForm ? onOpenForm(...) : <existing path>`.

- [ ] **Step 2: Verify the app is byte-identical in behavior**

Run: `npm run lint && npm run build` → 0. Manual: app chat opens/works identically (no props passed → uncontrolled path).

- [ ] **Step 3: Commit**

```bash
git add src/components/PortfolioChatDrawer.tsx
git commit -m "feat: PortfolioChatDrawer gains controlled mode and adapter props"
```

---

### Task 4: Mount the drawer in the demo, delete ChatPanel

**Files:**
- Modify: `src/demo/DemoApp.tsx` (adapter + swap)
- Delete: `src/demo/components/ChatPanel.tsx`

**Interfaces:**
- Consumes: Task 3's props.
- Produces: the demo's chat is the drawer, lazy-loaded; ChatPanel gone.

- [ ] **Step 1: Write the adapter in DemoApp**

Replace the `ChatPanelLazy` import with `lazy(() => import('../components/PortfolioChatDrawer').then(m => ({ default: m.PortfolioChatDrawer })))`. Keep the existing launcher button ("Ask about my portfolio", bottom-left) — it stays the demo's own (builder-check ruling 1) — and pass controlled props:

```tsx
<PortfolioChatDrawerLazy
  open={chatOpen}
  onClose={handleChatClose /* restores focus to chatLauncherRef per the existing effect */}
  notes={chatNotes}
  subtitle="Edits this page's portfolio. Runs on your device."
  holdings={personal?.holdings ?? []}
  portfolioMode="personal"
  profileName="You"
  onAddHolding={(h) => onEdit((hs) => [...hs, h])}
  onUpdateHolding={(h) => onEdit((hs) => hs.map(x => x.id === h.id ? h : x))}
  onDeleteHolding={(id) => onEdit((hs) => hs.filter(x => x.id !== id))}
  onReplaceHoldings={(hs) => onEdit(() => hs)}
  onAppendHoldings={(hs) => onEdit((old) => [...old, ...hs])}
  onNavigateToTab={() => { /* unreachable: mapTabToTarget handles nav */ }}
  mapTabToTarget={(tab) => {
    const chapter = chapterForTab(tab);
    if (chapter) { setChatOpen(false); onGoChapter(chapter); }
    else setChatNotes(prev => [...prev, { id: `${Date.now()}`, text: 'That view is in the full app at /#' + tab + '.' }]);
  }}
  onOpenForm={(req) => { setChatOpen(false); openChatForm(req); }}
  onRebalanceHoldingById={(id) => {
    if (!(personal?.holdings ?? []).some(h => h.id === id)) {
      setChatNotes(prev => [...prev, { id: `gone-${Date.now()}`, text: 'That holding is gone — it is no longer in your list, so there is nothing to move.' }]);
      return;
    }
    setChatOpen(false);
    rebalanceHolding(id);
  }}
/>
```

(The drawer's engine callbacks cover START_BLANK/RESET_SAMPLE/EXPORT internally via its own `onEdit` + exportPortfolio wiring — the demo passes only `onEdit`-style discrete callbacks, `onOpenForm` → the existing `openChatForm`, and `mapTabToTarget` → the existing `go`/`goMineFromChat` from DemoApp's current ChatPanel mount. `chapterForTab` lives in the journey module — reuse it, don't copy it.)

- [ ] **Step 2: Delete ChatPanel**

`git rm src/demo/components/ChatPanel.tsx`. Fix any import that referenced it (DemoApp only).

- [ ] **Step 3: Gates**

Run: `grep -c "ChatPanel" src/demo/DemoApp.tsx` → 0; `grep -n "lazy(() => import" src/demo/DemoApp.tsx` → the drawer import is lazy; `npm run lint && npm run build` → 0; suite → all pass.

- [ ] **Step 4: Browser verify (Playwright on localhost:3000/demo/)**

1. Chat opens from the "Ask about my portfolio" launcher (bottom-left), panel slides in — visually the drawer's design with the demo subtitle.
2. Send "portfolio summary" → reply renders.
3. "add HDFC FD 5L at 7.4%" → preview → confirm → holding lands in the editor list.
4. Drop a CSV file onto the panel → parsed and read (file-drop behavior preserved).
5. Chat-driven navigate (e.g. "open rebalance") → panel closes, chapter changes.
6. Rebalance a holding from chat after deleting it manually → the "gone" note appears in the panel.
7. First load does NOT fetch the xlsx chunk (network: no statementImport chunk until the editor/chat opens).

- [ ] **Step 5: Commit**

```bash
git add -A src/
git commit -m "feat: one chat component across demo and app — ChatPanel retires"
```

---

### Task 5: Final sweep + whole-branch review

**Files:**
- Read-only verification; fix pass on findings.

- [ ] **Step 1: Full gates**

Run: `npm run lint && node --import tsx --test src/demo/*.test.ts src/utils/*.test.ts && npm run build`
Expected: clean / all pass / exit 0.

- [ ] **Step 2: Whole-branch review**

Generate the review package from the pre-work base commit and dispatch a fresh reviewer (most capable model) on the diff, with the spec + this plan and the Review Focus items above as the focus list.

- [ ] **Step 3: Fix pass**

Critical/Important findings → one TDD fix pass. Minors → ledger.

- [ ] **Step 4: Finish**

Report to the owner with before/after summary; push decision stays with the owner.
