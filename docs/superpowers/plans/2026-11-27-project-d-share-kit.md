# Project D: Share Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the outward-facing share kit — 7 light-theme images at exact platform sizes, one 20–30 s vertical reel (the street game's story rebuilt in HyperFrames), a captions file — and point the site's live og:image at the new LinkedIn card.

**Architecture:** HTML frames under `tools/share-kit/frames/` rendered to PNG by Playwright at exact viewport sizes; a HyperFrames project under `tools/share-kit/reel/` renders the reel; all outputs land in `public/share-kit/` (git-tracked). The only repo change that ships is the og:image meta swap in 5 HTML heads.

**Tech Stack:** Playwright 1.65.1 (via `npx playwright screenshot`, already available), HyperFrames v0.9.102 (via `npx hyperframes`, requires Node ≥22 — use `source ~/.nvm/nvm.sh && nvm use 22.23.1` for every reel command), the repo's existing design tokens.

**Spec:** `docs/superpowers/specs/2026-11-27-project-d-share-kit-design.md`

## Global Constraints

- Exact image sizes (spec table): LinkedIn 1200×627, WhatsApp 1080×1920 (×2), Instagram 1080×1350, Product Hunt 1270×760 (×3). Verified with `file`, never asserted.
- Design tokens, verbatim (src/index.css): Ink `#14213D`, Mist `#EEF2F6`, Paper `#FFFFFF`, Level `#02A26D`, Level-line `#029A67`, Tilt `#E8A33D`, Risk `#D8454B`, Equity `#4C5CE6`, Debt `#1F8A9E`, Gold `#C99A2E`, Cash `#6B7A90`. Fonts: Bricolage Grotesque (display), Figtree (body).
- Copy rules: no jargon, no return promises, no upward-trend/chart-as-advice imagery; privacy line ("Everything stays on your device. Nothing is sent anywhere.") appears in the product-facing assets (statuses, LinkedIn card, end card).
- Product numbers shown must be the verified sample figures (₹1,19,68,450 total; ₹33,30,250 h-106) — never invented figures.
- Reel: 20–30 s, 1080×1920, 30 fps, no voiceover, licensed music with licence text in captions.md, end card holds ≥3 s, delivered MP4 under ~15 MB.
- og:image swap touches image metas only — no copy, sitemap, robots, or analytics changes; `demo/index.html` untouched (noindex); old `public/og-image.png` stays on disk but unreferenced.
- English only. Every new file under `tools/share-kit/` and `public/share-kit/`.

## Review Focus

The spec implies these failure modes; no task's unit tests exercise them — each owning task must check deliberately:

1. **Stale og:image height (630 vs 627):** the current heads declare 1200×630; a new 627-tall card with a stale meta gets cropped or letterboxed by LinkedIn/WhatsApp. Check: every swapped head declares `og:image:height` 627 (Task 3).
2. **Broken share card (404 og:image):** a referenced path that doesn't exist at deploy shows a blank card on every share. Check: the referenced path exactly matches the committed file's path/case, and the file exists (Task 3).
3. **Thumbnail illegibility:** text below ~28 px at 1080×1920 vanishes at status size. Check: every image reviewed at ~25% zoom (Task 2).
4. **Reel font fallback:** fonts not bundled in the HyperFrames project render in a system font and break the look. Check: Bricolage/Figtree woff2 files exist in `reel/assets/fonts/`, referenced via `@font-face`; `npx hyperframes check --json` clean (Task 5/6).
5. **Advice-adjacent imagery:** an upward-trending chart in a frame reads as a return promise. Check: every frame and reel scene reviewed against the anti-goal — the only chart-like graphic is the balance beam, and it lands level (Tasks 1–2, 6).

---

### Task 1: Frames scaffold, render script, and the LinkedIn card

**Files:**
- Create: `tools/share-kit/frames/tokens.css`
- Create: `tools/share-kit/frames/linkedin-card.html`
- Create: `tools/share-kit/render-frames.sh`
- Output: `public/share-kit/linkedin-card.png`

**Interfaces:**
- Consumes: repo tokens (values above); Playwright via `npx playwright screenshot --viewport-size "<W>,<H>" file://... out.png`.
- Produces: `tokens.css` (CSS custom properties `--ink --mist --paper --level --level-line --tilt --risk --equity --debt --gold --cash` with the spec's hex values, plus the two Google Fonts `<link>`s consumed by every frame via `<link rel="stylesheet" href="tokens.css">`); `render-frames.sh` — a bash loop mapping `frames/<name>.html` → `public/share-kit/<name>.png` with a per-frame `WxH` table, exiting non-zero if any output is missing.

- [ ] **Step 1: Write `tokens.css` and `linkedin-card.html`**

The card: Mist background, Ink headline "Your money, honestly weighed." (Bricolage, ~56 px), Figtree sub-line "FDs, funds, stocks, gold and a home loan — seen together, on your device." (~24 px, Ink/70), a level balance-beam SVG (pivot + arm + two pans holding bucket-colored bars, Level-line stroke, drawn inline — static geometry, no JS), and the URL `vestora-wealth.ai.studio/demo/` bottom-left (~20 px) with the privacy line bottom-right (~18 px). No other copy.

- [ ] **Step 2: Write `render-frames.sh`**

```bash
#!/usr/bin/env bash
# Renders tools/share-kit/frames/*.html to public/share-kit/ at exact sizes.
set -euo pipefail
cd "$(dirname "$0")/.."
declare -A SIZES=(
  [linkedin-card]="1200,627"
  [whatsapp-status-1]="1080,1920"
  [whatsapp-status-2]="1080,1920"
  [instagram-post]="1080,1350"
  [ph-problem]="1270,760"
  [ph-beam]="1270,760"
  [ph-rebalance]="1270,760"
)
mkdir -p public/share-kit
fail=0
for name in "${!SIZES[@]}"; do
  src="tools/share-kit/frames/$name.html"
  out="public/share-kit/$name.png"
  [ -f "$src" ] || { echo "SKIP (no frame): $src"; continue; }
  npx playwright screenshot --viewport-size "${SIZES[$name]}" "file://$(pwd)/$src" "$out"
done
for name in "${!SIZES[@]}"; do
  [ -f "public/share-kit/$name.png" ] || { echo "MISSING: $name.png"; fail=1; }
done
exit $fail
```

- [ ] **Step 3: Render and verify dimensions**

Run: `bash tools/share-kit/render-frames.sh && file public/share-kit/linkedin-card.png`
Expected: PNG image data, **1200 x 627**.

- [ ] **Step 4: Look at it**

Read `public/share-kit/linkedin-card.png` as an image. Expected: light theme, headline legible, beam level, no clipped text, nothing advice-shaped.

- [ ] **Step 5: Commit**

```bash
git add tools/share-kit public/share-kit
git commit -m "feat: share-kit frame pipeline and the LinkedIn og card"
```

---

### Task 2: The six remaining frames

**Files:**
- Create: `tools/share-kit/frames/whatsapp-status-1.html`, `whatsapp-status-2.html`, `instagram-post.html`, `ph-problem.html`, `ph-beam.html`, `ph-rebalance.html`
- Create: `tools/share-kit/frames/assets/` (screenshot fragments captured from the running dev server)
- Output: 6 PNGs in `public/share-kit/`

**Interfaces:**
- Consumes: `tokens.css`, `render-frames.sh` (Task 1); the dev server on localhost:3000 for the product screenshot; the street scene's signage copy from `git show d36a6e5:src/components/StreetStoryGame.tsx` (BUILDINGS array — signTop/signSub strings are the source material).
- Produces: complete image set.

- [ ] **Step 1: Capture the product screenshot fragments**

Dev server up (`npm run dev` if not running). Playwright: fresh-visit `/demo/` on the sample portfolio, screenshot the plan-summary region at 1440 width → `tools/share-kit/frames/assets/demo-plan.png`; Overview headline region → `assets/overview.png`. Only verified figures may appear (₹1,19,68,450 / ₹33,30,250).

- [ ] **Step 2: Write the four narrative/product frames**

- `whatsapp-status-1` (street narrative, vertical): three building façades with the game's signage — "FINANCE SITES / 47 OPEN TABS · GENERIC TIPS", "ADVISOR / HIS CUT ON EVERY SALE", "WEALTH MANAGER / 1% OF EVERYTHING, EVERY YEAR" — Ink on Mist, Tilt accents, a simple walker figure; closing line "There's a door at the end of the street."
- `whatsapp-status-2` (product): level beam SVG large, "Vestora. Your money, honestly weighed.", privacy line, URL.
- `instagram-post`: the arrival — door + logo + beam, "The street ends at a door. Behind it, your money makes sense.", privacy line.
- `ph-problem`: "Nine investments. Nobody looking at them together." with a scattered-holdings motif (name-tag cards: FD, Mutual Fund, Stocks, Gold, Home Loan…).

- [ ] **Step 3: Write the two product frames**

- `ph-beam`: level beam + "See the honest shape of your money. Rebalance without commissions." + URL.
- `ph-rebalance`: the captured `demo-plan.png` fragment in a Paper card + "Try the guided rebalance → vestora-wealth.ai.studio/demo/".

- [ ] **Step 4: Render and verify all seven**

Run: `bash tools/share-kit/render-frames.sh && file public/share-kit/*.png`
Expected: all 7 PNGs at their exact sizes (627/1920×2/1350/760×3).

- [ ] **Step 5: Thumbnail legibility pass**

Read each PNG; also view one downscaled to ~25% (e.g. `sips -Z 480 public/share-kit/whatsapp-status-1.png --out /tmp/t1.png`). Expected: headline and URL legible at thumbnail size; adjust font sizes and re-render if not.

- [ ] **Step 6: Anti-goal sweep**

Look at all 7: no upward-trend imagery, no return promises, no jargon. Fix and re-render if any found.

- [ ] **Step 7: Commit**

```bash
git add tools/share-kit public/share-kit
git commit -m "feat: share-kit image set for WhatsApp, Instagram and Product Hunt"
```

---

### Task 3: og:image swap

**Files:**
- Modify: `index.html:41-46` (og:image block + the matching `twitter:image` metas)
- Modify: `ltcg-tax-harvesting-india/index.html`, `fd-maturity-reinvestment-guide/index.html`, `home-loan-vs-fd-calculator/index.html`, `mutual-fund-rebalance-india/index.html` (their og:image/twitter:image blocks)

**Interfaces:**
- Consumes: `public/share-kit/linkedin-card.png` (Task 1, committed).
- Produces: all five heads pointing at the new card with correct dimensions.

- [ ] **Step 1: Swap the metas and JSON-LD image in all five heads**

`og:image` and `twitter:image` content → `/share-kit/linkedin-card.png`; `og:image:width` → 1200; `og:image:height` → **627** (the old value 630 is exactly the bug Review Focus 1 names); `og:image:alt` → "Vestora — your money, honestly weighed". In `index.html` only: the JSON-LD structured-data `"image"` field (currently the old og-image.png URL) → the new card's absolute URL (builder-check ruling: the spec's "no longer referenced by any head" covers it; leaving it stale keeps the dark card in Google's rich results). Touch image fields only.

- [ ] **Step 2: Verify every head**

Run: `grep -rn "og-image.png\|1200\" \|630" index.html ltcg-tax-harvesting-india/index.html fd-maturity-reinvestment-guide/index.html home-loan-vs-fd-calculator/index.html mutual-fund-rebalance-india/index.html | grep -i "image"` and `grep -rln "share-kit/linkedin-card.png" index.html */index.html | wc -l`
Expected: no head references `/og-image.png` or `630` in an image meta; **5** files reference `share-kit/linkedin-card.png`.

- [ ] **Step 3: Verify the file resolves**

Run: `ls public/share-kit/linkedin-card.png`
Expected: exists (the referenced path `/share-kit/linkedin-card.png` maps onto `public/` at deploy).

- [ ] **Step 4: Commit**

```bash
git add index.html ltcg-tax-harvesting-india fd-maturity-reinvestment-guide home-loan-vs-fd-calculator mutual-fund-rebalance-india
git commit -m "feat: point og/twitter images at the light-theme share card"
```

---

### Task 4: Captions file

**Files:**
- Create: `public/share-kit/captions.md`

**Interfaces:**
- Consumes: the assets (Tasks 1–2) so each caption names its image; the spec's voice rules.
- Produces: ready-to-paste text per platform + the licence note slot Task 5 fills.

- [ ] **Step 1: Write captions.md**

Top of file, before any caption: a bold **"Do not post publicly until current main is deployed and production /demo/ is verified"** note (builder-check ruling — production still serves the Nov-24 dark build). Then the sections: **LinkedIn** (post text pairing with the card), **WhatsApp Status** (short lines for status 1 and 2), **Instagram** (caption for the post, references the reel), **Product Hunt** (gallery line per frame + a maker's first comment). Plain voice, no jargon, no return promises; the privacy line appears in each platform's text; hashtag sets (#PersonalFinance #India #Privacy #Fintech — nothing spammy). Bottom section: **Music licence** — "Track: <title> by <artist> (<source URL>), licence <name/URL>." with a placeholder to fill in Task 5.

- [ ] **Step 2: Anti-goal read-through**

Read every line against the spec's anti-goals. Expected: nothing promising returns, no jargon, privacy line present per platform.

- [ ] **Step 3: Commit**

```bash
git add public/share-kit/captions.md
git commit -m "docs: share-kit captions for LinkedIn, WhatsApp, Instagram and Product Hunt"
```

---

### Task 5: Reel project — scaffold, fonts, music

**Files:**
- Create: `tools/share-kit/reel/` (HyperFrames project via `npx hyperframes init`)
- Create: `tools/share-kit/reel/assets/fonts/` (Bricolage Grotesque + Figtree woff2)
- Create: `tools/share-kit/reel/assets/music.mp3` + licence recorded in captions.md

**Interfaces:**
- Consumes: HyperFrames CLI under Node 22 (`source ~/.nvm/nvm.sh && nvm use 22.23.1` before EVERY `npx hyperframes` command — Node 20 fails hard).
- Produces: a valid empty project (`npx hyperframes check --json` clean) with bundled fonts and a licensed track, ready for Task 6's composition.

- [ ] **Step 1: Init the project**

Run: `source ~/.nvm/nvm.sh && nvm use 22.23.1 && cd tools/share-kit && npx hyperframes init reel --skip-skills --skill=hyperframes`
Expected: `reel/` scaffolded with `index.html` root composition.

- [ ] **Step 2: Bundle the fonts**

Download Bricolage Grotesque (display weight range used) and Figtree (400–800) woff2 files into `reel/assets/fonts/`; wire `@font-face` in the project so families resolve by name (Review Focus 4). No network fetches in the composition itself.

- [ ] **Step 3: Source the music track**

**CC0-only sourcing rule (builder-check ruling):** the repo is public on GitHub, so the tracked MP3 must be freely redistributable — source the track from a CC0 library (Freesound's CC0 filter, Wikimedia Commons CC0; NOT Pixabay/YT Audio Library, whose licences cover use-in-a-work but not standalone redistribution). Mood unchanged: minimal, warm, lightly optimistic instrumental, no vocals, natural lift around two-thirds through, landing as the beam levels (~70–80% mark). Save as `reel/assets/music.mp3`. Fill captions.md's licence section with title, artist, source URL, and CC0 dedication link. If no suitable CC0 track exists after a real search: gitignore the audio, record source + re-download instructions in captions.md, and note the reproducibility gap in the ledger.

- [ ] **Step 4: Verify the scaffold**

Run: `cd tools/share-kit/reel && npx hyperframes check --json`
Expected: no errors (warnings weighed; font/asset paths resolve).

- [ ] **Step 5: Commit**

```bash
git add tools/share-kit/reel public/share-kit/captions.md
git commit -m "feat: reel project scaffold with bundled fonts and licensed track"
```

---

### Task 6: Reel composition

**Files:**
- Modify: `tools/share-kit/reel/index.html` + scene files in `tools/share-kit/reel/compositions/`

**Interfaces:**
- Consumes: Task 5's project, fonts, `assets/music.mp3`; the street game's beats and signage copy (recovered source material); the beam geometry from `src/demo/components/Beam.tsx` (pivot/arm/pans proportions, restaged for 1080×1920).
- Produces: a checked, reviewed 28 s composition ready to render.

- [ ] **Step 1: Write the storyboard as scenes (28 s total, 30 fps)**

Per the HyperFrames contract (every timed element `class="clip"` with `data-start`/`data-duration`; timelines registered; no unseeded randomness; no CSS transforms on GSAP elements; content inside the 90% action-safe box, key text inside 80% title-safe):

- S1 0–4 s — street Establishes: Mist-day street, signage style from the game, walker enters. Text: "Your money walks past a lot of advice."
- S2 4–10 s — three passes, ~2 s each: FINANCE SITES (47 OPEN TABS · GENERIC TIPS) → ADVISOR (HIS CUT ON EVERY SALE) → WEALTH MANAGER (1% OF EVERYTHING, EVERY YEAR).
- S3 10–14 s — the door: plain Paper façade, Vestora logo, "One door at the end of the street."
- S4 14–22 s — inside: the beam starts tilted (equity pan heavy, Tilt accent), swings level with the game's cubic-bezier feel as the music lifts; "See the honest shape of your money."
- S5 22–28 s — end card, ≥3 s hold: logo + "Vestora. Your money, honestly weighed." + `vestora-wealth.ai.studio/demo/` + privacy line.

- [ ] **Step 2: Add the music**

One `<audio id="music" src="assets/music.mp3">` in the root, timed to the root duration; the S4 lift should coincide with the track's build (adjust S4 start or track trim if needed).

- [ ] **Step 3: Gate**

Run: `npx hyperframes check --json` — fix every error, weigh every warning.
Then: `npx hyperframes snapshot --review` and read the snapshots — text legible at 1080×1920, beam swing lands 70–80% through, end card holds ≥3 s, nothing advice-shaped (Review Focus 5). Iterate until clean.

- [ ] **Step 4: Commit**

```bash
git add tools/share-kit/reel
git commit -m "feat: reel composition — the street story ends at a level beam"
```

---

### Task 7: Render the reel and the final sweep

**Files:**
- Output: `public/share-kit/vestora-reel-9x16.mp4`

**Interfaces:**
- Consumes: Task 6's checked composition.
- Produces: the complete kit.

- [ ] **Step 1: Render**

Run: `cd tools/share-kit/reel && npx hyperframes render` (Node 22). Move the MP4 to `public/share-kit/vestora-reel-9x16.mp4`.

- [ ] **Step 2: Verify the deliverable**

Run: `file public/share-kit/vestora-reel-9x16.mp4 && ls -lh public/share-kit/`
Expected: MP4 present, under ~15 MB (re-render at a lower bitrate if over). Watch the video end-to-end: beam swing lands, end card ≥3 s with legible URL, audio present and synced.

- [ ] **Step 3: Whole-kit sweep**

`ls public/share-kit/` — 7 PNGs + MP4 + captions.md, all committed. Re-run Task 3's grep to confirm the og:image still resolves. Read captions.md once more against the anti-goals with the final assets in hand.

- [ ] **Step 4: Commit and finish**

```bash
git add public/share-kit tools/share-kit
git commit -m "feat: render the share-kit reel"
```

Then: whole-branch review (per execution method), and report the kit contents to the owner. `StreetStoryGame.tsx` is already deleted (minors sweep, ahead of the old spec's "last step of D"); nothing further to remove.
