# Vestora batch 2: light theme everywhere, demo data round-trip, game removal, share kit

Date: 2026-11-25 (batch 2; batch 1 = the /demo/ journey, built and reviewed, uncommitted)
Status: draft, awaiting approval

## Intent and why

Batch 1 proved the demo's light, calm look and its guided journey. The owner has
now approved that direction and asked for four things:

1. The demo's light theme becomes the theme for the whole product.
2. The demo header uses the real Vestora logo.
3. The original street-walking game ("Game Mode") is removed from the app as an
   interactive screen. Its street world and story become the narrative of the
   share reel (Project D) — the owner's decision: the game graduates from
   interaction to video, it is not simply deleted.
4. The demo gets the data round-trip the original story page had: import
   statements, add and edit holdings, the chat box, and export to Excel and PDF
   so the visitor can save progress and re-import it later — while the demo
   itself still stores nothing.
5. Once everything above is done: a small shareable story kit for LinkedIn,
   WhatsApp, Instagram and Product Hunt (images + a short reel).

The through-line: one product, one theme, one story. The demo journey is the
front door; the full app behind it keeps every capability but wears the same
clothes.

## Decisions already made by the owner

- Reskin everything now (not gradually).
- Full round-trip inside the demo (import, manual add, chat, export).
- Share kit = image set + short reel.

## Approaches considered

For the reskin (the only approach-level choice):

| | Approach | Trade-off |
|---|---|---|
| **C1 (chosen)** | Per-screen restyle in place: shift `index.css` tokens to light values, then edit each screen's dark utility classes, verified by screenshots | Real work across ~9,000 lines, but honest, reviewable screen by screen, and no behavioural risk if done as styling-only edits |
| C2 | Remap the Tailwind ramps in `index.css` only and hope semantic classes carry it | Fails immediately: components use literal `text-white`, `bg-white/10` etc. everywhere, so white-on-white breaks |
| C3 | Rebuild the screens fresh in the demo's component style | Throws away working, battle-tested logic (2,320 lines in RebalanceTab alone); highest regression risk |

Chosen: **C1**. Styling-only edits, screen by screen, each verified at 1440 and
375 with screenshots and a clean console before moving on.

## Project order

**A. Entry and brand** (small) → **B. Demo data round-trip** (medium) →
**C. Reskin all screens** (large) → **D. Share kit** (independent, last, so it
screenshots the finished product).

A comes first because it changes navigation C will then restyle. D needs the
finished product.

---

## Project A: Entry and brand

- Remove the street game from the product's UI: the `story` tab, the `#story`
  route, the Game Mode button in the navbar, and the OnboardingTour steps that
  reference it. Default tab becomes `overview`; unknown hashes fall back to
  `overview`. `#story` links in the wild (launch posts used them) land on
  Overview.
- **Keep `StreetStoryGame.tsx` in the repo, unrouted, until Project D ships** —
  its DOM/CSS street scene is the visual source material for the reel. Delete
  the file as the last step of D. (The file stays out of every bundle: nothing
  imports it once the route is gone.)
- The demo header replaces the text wordmark with the real logo
  (`VestoraLogo` component, light-background variant).
- The app navbar gains a prominent link to `/demo/` ("New here? Take the tour"
  or similar) so the journey remains reachable from the product.
- `#story` links in the wild (launch posts used them) land on Overview.

Verify: app boots to Overview; no dead links or console errors; `/demo/` shows
the logo; Game Mode is gone.

## Project B: Demo data round-trip

The demo keeps its promise: **nothing is written to localStorage, ever.** An
imported or hand-built portfolio lives in React state only. Saving = exporting
a file; that file re-imports.

- **Where it lives in the journey:** story beat 4 gains a third action, "Add my
  investments" (next to the sample and saved-portfolio actions). It opens a new
  **Portfolio editor** chapter between Story and See it (reached any time from
  the chapter bar once unlocked): a light-theme list of holdings with add,
  edit, delete, import, export and chat.
- **Reuse logic, not dark UI:** the existing utilities do the work —
  `importStatement`, `importExcelBuffer` (xlsx/csv/CAMS-style statements),
  `exportHoldingsToExcel/Csv`, `generatePortfolioPdfReport`, JSON backup
  (`buildExport`/`parsePortfolioExport`), and the holdings-validation rules.
  New light components wrap them; no dark component is imported into the demo.
- **Round-trip contract:** Excel and CSV exported by the demo import back
  losslessly (names, categories, institutions, invested/current values,
  currency, rates, dates); PDF is a human report, not an import format; JSON
  backup round-trips exactly (it already does in the app). A round-trip unit
  test pins this: export → import → same holdings.
- **Chat:** the demo gets the assistant chat (engine: `localChatEngine`, same
  one the app uses) as a slide-over panel available in every chapter. It edits
  the in-memory portfolio only. Same privacy line as the app: on-device,
  nothing sent anywhere.
- **Visible state:** while a personal in-memory portfolio is in play, a slim
  banner notes "Your numbers live only on this screen — download a file to
  keep them" with Export Excel / Export PDF / Export CSV buttons. Leaving or
  reloading is simply losing it, same model as the app's demo mode.
- The sample/saved choices from batch 1 stay. Choosing "Add my investments"
  starts an empty personal portfolio with three suggested starter rows.
- Analytics: none (batch 1 rule stands).

Verify: unit tests for the export→import round-trip; browser: add a holding by
hand and by chat, see it in See it/Play/Plan, export Excel and PDF, reload,
re-import the Excel, same numbers; localStorage untouched throughout.

## Project C: Reskin all screens to the light theme

- **Tokens first:** `src/index.css` swaps its dark ramp overrides for the demo
  palette (Ink `#14213D`, Mist `#EEF2F6`, Paper `#FFFFFF`, Level green
  `#02A26D`, Tilt amber `#E8A33D`, Risk coral `#D8454B`; bucket hues as in the
  demo). The emerald/indigo overrides go away in favour of the shared ramp.
  Fonts become Bricolage Grotesque + Figtree (already loaded in index.html).
- **Then screens, one task each, styling-only:** Navbar, OverviewTab,
  RebalanceTab, MaturityRadarTab, TaxAndInsightsTab, MacroSimulatorTab, the six
  modals/drawers, OnboardingTour, and the App shell. Dark utilities become
  their light equivalents (`bg-slate-950`→`bg-mist`, `text-white`→`text-ink`,
  `bg-slate-800`→`bg-paper`, borders and shadows restyled); charts (Recharts
  stroke/fill/grid colours) are updated per screen.
- **Behaviour lock:** no logic, data, or copy changes. Any accidental logic
  edit found during a restyle is reverted. Diff review per task enforces this.
- **Contrast gate:** computed WCAG ratios for each screen's main pairs must
  pass (4.5:1 text, 3:1 graphics), same method as batch 1.
- The demo page itself is untouched except for anything C teaches us (e.g. a
  token that needs to move into the shared theme).
- The street game's assets (marketing images it referenced) stay or go with A.

Verify: per screen — 1440 + 375 screenshots (saved under `.playwright-mcp/`),
console clean, no horizontal scroll at 375, focus visible, and the screen's
numbers identical to before the reskin on the sample portfolio (spot-check
totals against batch-1 screenshots).

## Project D: Share kit

Built last, from the finished product. Reuses the launch-kit idea
(`public/launch-kit/` exists from the earlier launch; the new kit lands in
`public/share-kit/` with a captions file).

- **Images** (rendered from HTML frames via Playwright at exact sizes, light
  theme, real product screenshots where honest; narrative frames borrow the
  street scene's signage style, product frames use the beam):
  - LinkedIn link card 1200×627
  - WhatsApp status 1080×1920 (2 variants)
  - Instagram feed post 1080×1350 (the reel gets a cover frame from the same
    scene)
  - Product Hunt gallery 1270×760 (3 frames: problem, beam, rebalance)
- **Reel (the street game's new home):** one 20–30 s vertical 1080×1920 MP4
  retelling the street game's story — the walker passes the finance sites,
  commission advisor and wealth manager (each pitching its bias), arrives at
  Vestora, where the beam swings level — ending on the product URL. Serves
  Instagram Reels, YouTube Shorts and WhatsApp status alike (all 9:16). Built
  with HyperFrames, rebuilding the street scene as animated frames driven from
  the (now unrouted) game's visual language rather than screen-recording a
  browser. After the reel is rendered, `StreetStoryGame.tsx` is deleted.
- **Captions file** (`captions.md`): ready-to-paste text per platform with
  hashtags, in the plain voice of the product. No invented claims; the privacy
  line ("everything stays on your device") carries over.

Verify: images at exact dimensions, legible at thumbnail size; reel plays at
24–30 fps with legible text at 1080×1920; captions reviewed against the
anti-goals (no jargon, no promises of returns).

## Non-goals

- No new product features in the six screens (styling only).
- No backend, no accounts, no cloud sync — the export file *is* the save.
- No changes to the demo journey's chapter flow beyond the new editor chapter.
- No SEO/sitemap/analytics changes; `/demo/` stays `noindex`.
- The share kit is not localised; English only.

## Anti-goals (failure even if it works)

- A reskin that quietly changes a calculation or a number.
- A demo that writes anything to localStorage.
- White-on-white or near-invisible text anywhere.
- Share images that promise returns or look like investment advice.
- Two competing "stories" in the product.

## Risks

- **Reskin regression risk** is the big one: mitigated by styling-only edits,
  per-screen diffs, before/after screenshot comparison, and the numbers-identical
  spot check.
- **Import round-trip gaps:** existing Excel export templates may not feed the
  importer cleanly; the round-trip test will force any fix early in B.
- **Chat engine assumptions:** `localChatEngine` may assume app-only state
  shapes; if so, adapt its inputs, not its logic.
- Batch 1 is still uncommitted; C's large diff will sit on top. Owner may want
  a commit checkpoint before C starts (recommended; needs the personal git
  email set repo-locally first).

## Calls made without a decision from the owner (please check)

- The reel's story is the street game's (biased-advice walk → arrival → beam
  levels), per the owner's question; the pure beam story is dropped from the
  reel but stays as the demo journey's interactive story.
- The demo's editor chapter sits between Story and See it, unlocked from story
  beat 4 and always reachable afterwards.
- Excel + CSV + JSON are the import formats; PDF is export-only (it is a
  report, not data).
- The demo's chat is the same local engine, available in every chapter.
- The reel is built with HyperFrames; images are HTML frames screenshotted.
- The app navbar links to `/demo/` with a short label.

## Left to the builder

- Exact light-class mappings per screen (mechanical, guided by the token table).
- Editor chapter's component split and empty-state copy.
- Which Recharts palette entries move to CSS variables.
- Storyboard frames and copy for the reel and each share image.
- Captions text per platform.
