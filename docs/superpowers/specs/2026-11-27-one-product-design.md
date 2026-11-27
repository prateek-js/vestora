# One product, one look: copy clarity, ink primaries, unified chat

Date: 2026-11-27
Status: approved by owner (2026-11-27: "do the copy fixes, ink primaries app-wide, then unify the chats")
Origin: owner review of the deployed site found the two surfaces reading as
different products. Investigation confirmed four discrepancies: fonts (fixed
separately, 283d8c4), button-color roles, two different chat wrappers, and
zero copy explaining the demo/app split.

## Intent and why

The Nov 24 plan's through-line is "one product, one theme, one story": the
demo journey is the front door, the full app wears the same clothes. In
practice the app's button *language* was never converted (its 31 green
primaries are the pre-reskin dark UI's habit), the two chat surfaces grew
separate chrome around one shared engine, and nothing tells a first-time
visitor what each surface is for. This change finishes the reconciliation:
one button language, one chat, one sentence per surface explaining its job.

## Owner decisions (2026-11-27)

- Copy fixes for the demo/app split: do them.
- Button primaries app-wide: **ink** (the demo's language wins — it is the
  front door and the Nov 24 brand table assigns Ink to primary buttons,
  reserving Level green to mean "balanced / on target").
- Chats: unify into one wrapper component.

## Builder-check rulings (2026-11-27, verified against code)

1. **The demo keeps its own launcher; the drawer gains controlled mode.**
   DemoApp lazy-loads the chat specifically to keep the xlsx bundle out of
   the demo's first load (DemoApp.tsx:24-27) — a launcher inside the drawer
   would statically import the engine and break that promise, and would
   also duplicate the demo's "Ask about my portfolio" launcher and break its
   focus-restoration flow (DemoApp.tsx:91-116). The drawer gains optional
   controlled props: `open?: boolean`, `onClose?: () => void`,
   `hideLauncher?: boolean`. When `open` is provided the drawer is fully
   controlled (renders no launcher of its own); when absent it behaves
   exactly as today. The app mount passes nothing (unchanged); the demo
   passes its own state. `mapTabToTarget` becomes
   `(tab) => void` called *before* the drawer closes, and in controlled
   mode "close" means calling the `onClose` prop — the demo's adapter
   closes and navigates, preserving the current journey flow.
2. **One subtitle, chosen per surface via an optional prop.** Workstream 1
   item 4's copy is re-homed: the drawer gains `subtitle?: string`
   (default: the app's "On-device · Zero external API calls"); the demo
   passes "Edits this page's portfolio. Runs on your device." Do NOT edit
   ChatPanel.tsx:313 in workstream 1 — that file is deleted in workstream
   3; the copy lands as the demo's prop value there.
3. **The sweep criterion is the exact class pattern**
   `bg-emerald-500 hover:bg-emerald-700` (30 sites today → 0). The doc's
   earlier per-file distribution was tint-inclusive and is void. Near-miss
   solid-emerald sites keep their green as meaning: ValidatePortfolioModal
   selected-worksheet chips (:505, :573 — selected state, not primary
   action) and OnboardingTour progress dots (:308, :310 — progress state).
   Count snapshots are not contracts; the grep is the contract.
4. **Demo rebalance-via-chat keeps the journey's semantics.** The adapter
   wraps `onRebalanceHoldingById`: if the holding id is absent, push a
   "That holding is gone" note via the drawer's `notes` prop (the demo's
   existing `chatNotes` state) instead of silently no-oping; if present,
   close the chat and navigate to the Play chapter. Current demo behavior
   preserved; browser verification asserts the gone-holding note.

## Workstream 1 — copy fixes (small)

Four touch points, plain words, no jargon:

1. **Demo header's "Full app" link** (src/demo/DemoApp.tsx:217) → add a
   title/tooltip: "Your saved portfolio, every tool, nothing stored on our
   servers". Visible text stays "Full app" (short link text).
2. **App Navbar's "Take the tour"** (src/components/Navbar.tsx:172) →
   visible text becomes "New here? Take the tour"; title: "A 2-minute
   walk-through with a sample portfolio — the full app is one click away".
3. **App chat drawer header** (PortfolioChatDrawer.tsx:377) → subtitle
   "On-device · Zero external API calls" stays, but the h2 becomes
   "Portfolio chat" (the same name as the demo's panel — one product calls
   its chat the same thing in both places).
4. **Demo chat subtitle** — lands in workstream 3 as a prop value on the
   demo's drawer mount (builder-check ruling 2): the demo passes
   "Edits this page's portfolio. Runs on your device." — the honest
   difference from the app chat (which edits your saved portfolio).
   ChatPanel.tsx is not edited (it dies in WS3).

Verify: strings present in built bundle; no test regressions.

## Workstream 2 — ink primaries app-wide (mechanical, one sweep)

**Scope:** the 31 solid-green primary buttons
(`bg-emerald-500 hover:bg-emerald-700 text-white`) become
`bg-ink hover:bg-ink/90 text-paper` — the demo's exact primary pattern
(bg-ink/90 hover comes from Story.tsx:31). Rounded-full is NOT imposed on
the app (the app's rounded-lg/xl geometry is its own density language; the
one-look rule is about color roles, not corner radii — the demo keeps its
pills, the app keeps its rounded-lg).

**Not in scope (stays green on purpose — green still means "balanced /
on target / go"):**

- `bg-emerald-500/10` tinted state cards and selected-chip highlights (43
  sites) — those are *meaning*, not primary action.
- emerald *text* (`text-emerald-700`) accents.
- The emerald ramp in index.css stays remapped as-is.
- PortfolioChatDrawer's launcher button: becomes ink like every other
  primary (it is a button, not a status).

**Distribution:** RebalanceTab 25→~12 solid sites, OverviewTab 11, Validate
PortfolioModal 10, MacroSimulatorTab 8, MaturityRadarTab 7, SeoLandingPage 6
(these are calculator CTAs — ink, consistent with the app), the rest 1-4 each.
A grep-driven sweep, file by file, each verified by build.

Verify: `grep -c 'bg-emerald-500 hover:bg-emerald-700'` → only the
intentional remainders (none); all tests green; build green; contrast —
ink-on-paper text is 13.9:1 (passes), white-on-ink 13.9:1 (passes, same as
demo).

## Workstream 3 — one chat wrapper (the project piece)

**Approach:** promote the *app's* `PortfolioChatDrawer` (563 lines, the
superset: quick chips, file-drop, clear-history, confirm-add flow) into the
single shared component at `src/components/PortfolioChatDrawer.tsx`, then
mount it in the demo (`DemoApp`) replacing `ChatPanel` (429 lines, deleted).
The demo keeps its in-memory promise: the drawer's callbacks already map
1:1 (both feed `localChatEngine` and both implement the full action set —
verified case-by-case). Differences to absorb:

- **`onEdit(fn)` vs discrete callbacks:** the drawer takes discrete
  callbacks (onAddHolding, onUpdateHolding, onDeleteHolding…); the demo
  wires those same ops through `onEdit` — thin adapter in DemoApp, no
  component change.
- **`notes` prop (demo-only):** app-shell messages like the empty-list
  routing note. Add an optional `notes?: {id, text}[]` prop to the drawer,
  rendered as system lines (demo already renders them this way).
- **`onOpenForm({mode, holding})` (demo-only):** maps to the drawer's
  OPEN_ADD_MODAL/OPEN_EDIT_MODAL handling, which routes to a modal; the demo
  passes its HoldingForm opener. Optional prop `onOpenForm?: (req) => void`
  — when absent, the drawer uses its existing modal behavior.
- **`onGoChapter` (demo-only):** the drawer's `onNavigateToTab` gets an
  optional adapter prop `mapTabToTarget?: (tab) => void` — called before
  the close; the demo translates tabs to chapters, closes via its
  controlled `onClose`, navigates; unmapped tabs keep the drawer's
  "That view is in the full app" line.
- **Controlled mode (builder-check ruling 1):** `open?`/`onClose?`/
  `hideLauncher?` props as ruled above; the demo lazy-imports the drawer
  exactly as it lazy-imports ChatPanel today (bundle promise kept).
- **Rebalance semantics (builder-check ruling 4):** demo adapter wraps
  `onRebalanceHoldingById` with the gone-holding note + close-and-navigate.
- **`subtitle?` prop (builder-check ruling 2):** per-surface subtitle;
  app keeps its default, demo passes its own line.
- **Chat look:** one visual language — the drawer's (it is the denser,
  more capable surface, and the app is where users spend time). Ink primary
  buttons per workstream 2. The demo's chat becomes visually the same panel.
- **Chat context:** the demo currently forces `portfolioMode: 'personal'`
  and `profileName: 'You'`; it keeps doing so through its props (no engine
  change).
- **What dies:** `src/demo/components/ChatPanel.tsx` (429 lines) — deleted;
  its `notes` and file-drop behaviors live on in the drawer. The demo's
  drag-drop overlay comes free (the drawer has one).

**Tests:** existing chat-engine tests (localChatEngine.test.ts) are wrapper-
agnostic and stay green. New: a light render test is NOT practical without a
DOM harness — instead the demo's browser verify (chat opens, sends "summary",
navigates chapters, adds a holding via chat) plus the app's chat unchanged.

Verify: demo journey chat behaviors (open from any chapter, add/edit via
chat, navigate via chat, file drop reads a CSV), app chat unchanged, all
tests green, build green.

## Non-goals

- No engine (localChatEngine) changes — the brain is already shared.
- No rounded-full imposition on the app's geometry.
- No changes to emerald tint semantics (green still means balanced).
- No new features in either chat beyond the props listed above.

## Anti-goals (failure even if it works)

- Any button that was green-primary becoming a *tinted* emerald card
  (meaning gets polluted by the sweep).
- The demo chat losing file-drop or notes behavior in the swap.
- A second chat component surviving in the tree (ChatPanel must be gone,
  not deprecated).

## Risks

- The 31-site sweep touches 15 files; per-file build verification keeps the
  blast radius legible.
- The drawer's confirm-add flow assumes a modal exists; in the demo the
  OPEN_ADD_MODAL action must reach HoldingForm via onOpenForm — wired in the
  adapter, browser-verified.
