# Vestora Project D: Share kit — images, reel, captions, og:image swap

Date: 2026-11-27
Status: approved by owner (2026-11-27: option 1 — agent sources a licence-clear track)
Origin: the 2026-11-24 four-project plan (docs/superpowers/specs/2026-11-24-theme-roundtrip-sharekit-design.md)
— Projects A (entry/brand), B (demo round-trip), C (reskin) shipped; D is the
last. Owner decisions carried forward: share kit = image set + short reel;
reel audio is a licensed music track, no voiceover; the new LinkedIn card
replaces the site's live share image.

## Intent and why

Projects A–C rebuilt Vestora around one light look and one story: the `/demo/`
journey is the front door, the app behind it wears the same clothes. Nothing
outside the repo shows that yet — the live share image (`public/og-image.png`)
is still the dark-era card, and the launch kit (`public/launch-kit/`) is all
dark screenshots. D is the outward-facing capstone: a shareable story kit for
LinkedIn, WhatsApp, Instagram and Product Hunt that shows the finished
product, plus the reel that gives the removed street game its new home as
video (the 2026-11-24 decision: the game graduates to video, it is not
simply deleted).

The kit's one job: a person who has never seen Vestora should understand, in
one glance or one play, that it is a private, on-device planner that shows
you the honest shape of your money and rebalances it without commissions.
The privacy line ("everything stays on your device") carries into every asset.

## Goals

- A complete image set at the exact platform sizes, in the light theme, using
  the real product's look (real screenshot fragments where honest; narrative
  frames in the street-scene signage style; product frames use the beam).
- One 20–30 s vertical reel (1080×1920, 24–30 fps) retelling the street
  game's story, built with HyperFrames from the unrouted game's visual
  language (recovered from git history at `d36a6e5` — the file was deleted
  early in the minors sweep; its full canvas scene is preserved there).
- A captions file with ready-to-paste per-platform text and hashtags.
- The live og/twitter image points at the new light card.
- Licensed music on the reel, licence recorded, swappable without a re-render.

## Non-goals

- No new product features; no changes to the app or the demo journey (the
  og:image meta swap is the only repo change that ships in D).
- No sitemap, copy, robots.txt, or analytics changes; `/demo/` stays `noindex`.
- The kit is not localised; English only.
- No paid/licensed-per-seat stock subscriptions; the track comes from a
  free-commercial-use library or is commissioned.
- No voiceover, no captions burned into the reel (platform autoplay is muted;
  the story is told visually).

## Anti-goals (failure even if it works)

- Share images that promise returns or read as investment advice.
- Jargon in any caption or frame ("alpha", "wealth OS", "rebalance your
  portfolio with optimal allocation") — plain words only.
- Two competing "stories" in one kit: the reel and the images tell the same
  street-to-beam story the demo journey tells.
- Any asset that shows a number the real product cannot produce (invented
  portfolio figures).

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **D1 (chosen)** | HTML frames rendered via Playwright at exact pixel sizes (images) + a HyperFrames project for the reel, both built from the repo's real tokens/components | Pixel-exact sizes, the kit is reproducible from the repo, and the reel keeps the street scene alive in an editable form; costs a HyperFrames render dependency |
| D2 | Reuse the old launch-kit frames, recoloured to light | Fast, but the old frames are AI-illustrated scenes with the old narrative; recolouring them to the new brand would look off and the street scene (the story) is absent |
| D3 | Screen-record the real product and cut a reel from footage | Most "honest" but contradicts the 2026-11-25 owner decision (the reel retells the street game's story, which no screen recording contains); also unrepeatable |

Chosen: **D1**. It is the approach the 2026-11-24 spec already picked; this
doc pins its details now that the product it screenshots is finished.

## The assets

All land in `public/share-kit/` (git-tracked, so they ship with the repo):

**Images** (HTML frames under `tools/share-kit/frames/` rendered by a small
Playwright script; every frame uses the real tokens: Mist `#EEF2F6`, Paper
`#FFFFFF`, Ink `#14213D`, Level green `#02A26D`, Tilt amber `#E8A33D`, Bricolage
Grotesque + Figtree):

| Asset | Size | Content |
|---|---|---|
| `linkedin-card.png` | 1200×627 | The beam swinging level over one plain line — this becomes the live og:image |
| `whatsapp-status-1.png` | 1080×1920 | The street scene narrative: 47 open tabs, the biased advisors, the door |
| `whatsapp-status-2.png` | 1080×1920 | The product: beam + the privacy line + the /demo/ URL |
| `instagram-post.png` | 1080×1350 | The street→Vestora arrival, square-ish; the reel's cover frame comes from the same scene |
| `ph-problem.png` | 1270×760 | Gallery frame 1: the investor's scattered money story |
| `ph-beam.png` | 1270×760 | Gallery frame 2: the beam level, the product URL |
| `ph-rebalance.png` | 1270×760 | Gallery frame 3: the demo journey's plan screen (real screenshot fragment) |

Product frames use real screenshot fragments (captured from the running app on
the sample portfolio — the same verified totals: ₹1,19,68,450, ₹33,30,250) or
the actual `Beam` component rendered standalone; narrative frames borrow the
street scene's signage style (its buildings, tags like "47 OPEN TABS · GENERIC
TIPS", the walker) rebuilt as static HTML/CSS/SVG from the recovered game's
visual language. No asset claims returns, no price predictions, no "2x your
wealth".

**Reel** — `public/share-kit/vestora-reel-9x16.mp4`, a HyperFrames project
under `tools/share-kit/reel/` (project git-tracked; rendered MP4 git-tracked
too):

- 20–30 s, 1080×1920, 30 fps, silent narration, licensed music.
- Story (from the street game's beats, restaged in the light theme's
  language): a walker on a street passes Finance Sites (47 open tabs, generic
  tips) → the Commission Advisor (pitching products for his cut) → the Wealth
  Manager (pitching management for an AUM fee) → arrives at a plain door with
  the Vestora logo → inside, the beam swings from tilted to level → end card:
  "Vestora. Your money, honestly weighed." + `vestora-wealth.ai.studio/demo/`
  + the privacy line.
- The beam swing is the emotional payoff and must land ~70–80% through; the
  end card holds ≥3 s so the URL is readable at a glance.
- Music: sourced by the agent from a licence-clear library (Pixabay Audio or
  YouTube Audio Library tier — free for commercial use, no attribution
  required preferred, attribution noted in captions.md if required). Mood:
  minimal, warm, lightly optimistic — a pulse that lifts as the beam levels,
  no vocals, no cinematic drop. The track file lands in the reel project's
  `assets/`; the licence text and source URL go in `captions.md`. The MP4 is
  muxed with the chosen track, but the track file sits separately in the
  project so a swap is a one-line change and a re-render.
- Built per the HyperFrames contract (timeline-safe clips, seeded determinism,
  no CSS-transform/GSAP conflicts, fonts via `@font-face` from
  `assets/fonts/` — Bricolage Grotesque and Figtree files included, since the
  renderer has no network).

**Captions** — `public/share-kit/captions.md`: ready-to-paste text for
LinkedIn, WhatsApp status, Instagram, and Product Hunt (gallery copy + first
comment), with hashtags, in the product's plain voice. No invented claims; no
promises of returns; the privacy line carries over; the licence note sits at
the bottom.

**og:image swap** — `index.html` and the four SEO page heads
(`ltcg-tax-harvesting-india/`, `fd-maturity-reinvestment-guide/`,
`home-loan-vs-fd-calculator/`, `mutual-fund-rebalance-india/`):
`og:image`/`twitter:image` (+ `og:image:alt`, width/height 1200×627) point at
`/share-kit/linkedin-card.png`. The old `public/og-image.png` file stays on
disk (harmless, and old links may still reference it) but is no longer
referenced by any head. Image paths only — no copy, no sitemap, no robots
changes (the deliberate, minimal exception the 2026-11-24 spec already
allows).

## Builder-check rulings (2026-11-27)

- **Deploy is the owner's separate step.** The live site is still the Nov-24 dark build, and production `/demo/` may not yet serve the demo journey — so publication of the kit is strictly post-deploy. `captions.md` carries a "do not post publicly until the current main is deployed and /demo/ verified" note at the top. No deploy task in this plan.
- **Music licence: CC0-only sourcing rule.** The repo is public on GitHub; a standalone git-tracked MP3 from Pixabay/YT Audio Library would be redistribution the licences don't allow. The track must come from a CC0 source (Freesound/Wikimedia CC0 filter) so the tracked file is clean; if no suitable CC0 track exists, gitignore the audio, record source + re-download instructions in captions.md, and accept the reproducibility gap. Muxed MP4 is fine either way.
- **JSON-LD image is in scope** (index.html's structured-data `"image"` field still points at the old og-image.png — the spec's "no longer referenced by any head" wording covers it; swapped alongside the metas in Task 3). **`public/launch-kit/` stays** — it's the historical record of the first launch; the new kit is a different directory and the old one is unreferenced by any head. No deletion task.

## What's left to the builder

- Exact street-scene staging in the frames (the recovered game's buildings,
  signage copy, and walker are source material, not a spec — restage freely in
  the light theme).
- The reel's exact second-by-second timing (within the 20–30 s and ≥3 s
  end-card holds above), easing, and music cut points.
- The specific track choice (within the mood constraint) and its licence note.
- Frame typography details (sizes/weights) within the demo's type scale.
- Whether a product screenshot fragment is better cropped or re-rendered as
  live DOM per frame — whichever is more honest and sharper at size.

## Verify

- Images: exact pixel dimensions (file-verified, not asserted), legible at
  thumbnail size (check at ~25% zoom), light theme throughout, no dark-era
  colors.
- Reel: plays at 30 fps at 1080×1920, text legible at a glance, beam swing
  lands, end card holds ≥3 s, audio present and licensed, file under ~15 MB
  (WhatsApp/Instagram-friendly).
- og:image: every head resolves to `/share-kit/linkedin-card.png`; the file
  exists at build time (a 404 og:image is a broken share card).
- Captions: reviewed against the anti-goals — no jargon, no return promises,
  privacy line present, licence noted.
- Whole thing reproducible: `tools/share-kit/` contains the frames and reel
  project; a fresh render from them matches the committed assets.
