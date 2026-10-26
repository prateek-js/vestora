# Product Hunt Launch Kit

Everything below is ready-to-paste when creating the listing at
<https://www.producthunt.com/posts/new>. Assets in `public/`:

| File | Purpose | Spec |
| --- | --- | --- |
| `logo-240.png` | Gallery thumbnail | 240×240 ✅ |
| `logo-512.png` | Square logo (spare) | 512×512 |
| `og-image.png` | First gallery image / social card | 1270×760 ✅ |

**Gallery tip:** after the OG image, add 3–5 more 1270×760 shots — Maturity
Radar tab, Tax tab, Macro Stress Lab, and one reinvest-modal action shot.
Screenshot at a 1270×760 viewport with the demo banner dismissed.

---

## Name

**Vestora**

## Tagline (≤ 60 chars — this is what wins or loses the listing)

> The maturity radar for your idle-wealth problem

Alternates:
- `Know what matures next — and where to redeploy it`
- `Stop matured FDs dying in zero-yield savings accounts`

## Description (first paragraph is the meta description)

Vestora is a client-side wealth terminal for Indian retail investors who hold
FDs, RDs, bonds, and SGBs that quietly mature and then sit in zero-yield
savings accounts. It consolidates your full balance sheet — mutual funds,
demat equity, FD/RD, SGBs, EPF, PPF, NPS, and cash across INR/USD/EUR — then
flags every instrument nearing maturity and proposes vetted reinvestment
options across four risk tiers. Live AMFI NAVs and ECB FX rates keep
valuations honest, the tax auditor surfaces harvestable LTCG and unused
80C/80CCD(1B) headroom, and a macro stress lab shows what inflation spikes
and rate hikes do to your purchasing power before they happen.

No account. No server. Import your CAS or MF Central export, add holdings
manually, or explore with sample data — everything parses and persists in
your browser, and a JSON export moves it anywhere.

## Maker comment (post as first comment, 12:01 AM PT on launch day)

I built Vestora out of my own frustration: an HDFC FD matured and sat idle for
months because I never got a reminder at the right moment, and by the time I
noticed, it had bled weeks of yield. Every tracker I tried showed me *what I
own* but none showed me *what is about to mature* — which is the only window
where redeploying capital is easy.

So Vestora is built around that moment:

- **Maturity Radar** — instruments maturing in 10/30/90 days, with 8 curated
  reinvestment options across Guaranteed → High-Growth tiers, projected
  first-year yield on your actual matured amount, and one-click rebalance
  modeling.
- **Tax audit** — harvestable equity LTCG against the ₹1.25L exemption,
  80C/80CCD(1B) utilization, and single-asset concentration warnings.
- **Macro Stress Lab** — drag inflation/rate/geopolitical sliders and watch
  your wealth trajectory re-shape before committing capital.
- **Multi-currency** — INR/USD/EUR normalization for the NRI balance sheet,
  with live ECB reference rates (cached 6h, benchmark fallback offline).
- **Live NAV refresh** — pulls today's published NAVs from AMFI's feed
  (mfapi.in, keyless) and re-values funds as units × NAV.
- **Real statement import** — drop a CAS (CAMS/KFintech), bank FD registry, or
  MF Central holdings export (CSV) and it parses client-side with column
  auto-mapping, a preview, and honest skipped-row reporting.
- **Portable backups** — export the ledger as JSON, restore on any device.

Two deliberate choices I'll defend in the comments:

1. **It's fully client-side.** Financial data is the most sensitive data you
   have. Vestora has no backend, no account, and no telemetry on your
   holdings — the ledger lives in your browser's localStorage, CSV parsing
   happens in-page, and even the NAV/FX fetches are anonymous GETs to public
   feeds. The tradeoff: no automatic broker/depository sync. Direct MF
   Central and Account Aggregator integration is the #1 roadmap item if this
   resonates, but those require regulated FIU partnerships — I won't fake it
   with credential scraping.
2. **It's India-first.** SGBs, EPF, 80C, the ₹1.25L LTCG exemption — the
   instruments most global trackers treat as exotic are the core of the model.
   If you hold US assets alongside Indian ones, it normalizes both.

I'd genuinely love feedback from this community — especially on the maturity
radar UX and whether the reinvestment suggestions feel credible. All figures
in the demo are illustrative sample data, not advice.

## First 5 topics

`Fintech` · `Personal Finance` · `Investing` · `Wealth Management` · `React`

---

## Launch-week checklist

- [ ] Deploy to Vercel + point a domain (vestora.app or similar)
- [ ] Set `VITE_POSTHOG_TOKEN` in Vercel env and verify events arrive
- [ ] Record 30–60s demo video (Maturity Radar → Deploy & Rebalance flow)
- [ ] Capture 4 extra gallery screenshots (1270×760, banner dismissed)
- [ ] Schedule for Tue–Thu, 12:01 AM PT
- [ ] Prep 3–4 launch-day replies (pricing/roadmap/privacy questions)
- [ ] Line up hunter or self-ship (self-shipping is fine and on-brand here)

## Suggested gallery captions

1. OG image — "One terminal for the whole balance sheet"
2. Maturity Radar — "Nothing matures unnoticed"
3. Reinvest modal — "Model the redeploy before you commit"
4. Tax tab — "Harvest the exemption, audit the deductions"
5. Stress Lab — "Break your portfolio on purpose"
