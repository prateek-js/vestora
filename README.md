# Vestora - Unified Wealth & Reinvestment OS

> **All-in-one multi-asset wealth tracker, automated maturity reinvestment engine across 4 risk tiers, tax harvesting auditor, and macroeconomic stress-test laboratory.**

[![React 19](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)](https://tailwindcss.com/)

---

## 🚀 Product Hunt Value Proposition

Retail and high-earning investors frequently face **idle cash drag** and **fragmented visibility**:
- Fixed Deposits, Recurring Deposits, Sovereign Gold Bonds, and debentures mature and sit in zero-yield savings accounts.
- Cross-border assets (Indian EPF/PPF/NPS/MF alongside US RSUs and ETFs) lack a unified balance sheet.
- Macroeconomic shocks (inflation spikes, central bank rate hikes) erode purchasing power and duration-heavy bonds without real-time stress testing.

**Vestora** solves this in one unified terminal:
1. **Consolidated Net Worth Cockpit**: Unified valuation across Mutual Funds, Demat equities, FDs, RDs, SGBs, Corporate Bonds, EPF, PPF, NPS, and liquid bank savings.
2. **Multi-Currency Normalization**: Seamless conversion across **INR (₹)**, **USD ($)**, and **EUR (€)** with normalized FX benchmark rates.
3. **Maturity Radar & 8-Solution Curated Reinvestment Matrix**: Preemptively flags instruments maturing within 30, 90, or 365 days. Proposes 5–8 vetted institutional alternatives categorized by risk appetite:
   - **Guaranteed Risk**: RBI Floating Rate Savings Bonds (FRSB), SGB Secondary EEE Bullion.
   - **Low Risk**: Corporate AAA Short-Term Debt, Equity Arbitrage Tax-Advantaged Funds (7.25% yield with 12.5% equity tax treatment).
   - **Moderate Risk**: Dynamic Balanced Advantage Funds, Commercial Grade-A REITs & InvITs dividend pipelines.
   - **High Growth Risk**: Flexi-Cap Global Tech Mega-Caps, Systematic Quality & Momentum Factor ETFs.
4. **Tax Harvesting & Deductions Audit**: Identifies unrealized equity LTCG eligible for annual tax exemption resets (₹1.25 Lakh / $1,500), audits Section 80C and dedicated Section 80CCD(1B) NPS ₹50,000 extra deduction limits, and warns of single-asset concentration (>20%).
5. **Macro Stress Lab & Portfolio Shuffler**: Stress-test portfolio purchasing power against custom sliders (Inflation 2%–12%, Rate Hikes -200 to +400 bps, Geopolitical Shock 0–10, Equity Drawdowns). Interactive "Portfolio Shuffler" provides tactile sliders to model rebalancing before committing capital.

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript (ES2022)
- **Bundler**: Vite 8
- **Styling**: Tailwind CSS v4 + Institutional Financial Design Constitution (DM Sans + Plus Jakarta Sans + JetBrains Mono Tabular Numerals)
- **Icons**: Lucide React
- **Persistence**: Browser `localStorage` — fully client-side, no backend
- **Data Architecture**: Client-side normalization engine with ready-to-deploy PostgreSQL / Drizzle ORM relational schema (hosted version).

---

## 📦 Getting Started

```bash
# Clone the repository
git clone https://github.com/<your-username>/vestora.git
cd vestora

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to view the application.

---

## 🔒 Privacy & Data

Vestora runs entirely in your browser:

- **Persistence** — holdings live in `localStorage` (`vestora.portfolio.v1`).
  There is no backend, no account, and no analytics on your financial data.
- **Live data** — NAVs come from the public AMFI feed (mfapi.in) and FX rates
  from ECB reference rates (Frankfurter API), both fetched anonymously with
  6-hour caching; benchmark fallbacks keep the app fully offline-capable.
- **Statement import** — CAS (CAMS/KFintech), bank deposit registries, and
  MF Central holdings exports (CSV/TSV) are parsed in-page; files never leave
  your device.
- **Portability** — export the ledger as JSON from *Manage Portfolio Data*
  (reset icon in the navbar) and restore it on any other browser.

> **Disclaimer:** Vestora is a tracking and scenario-modeling tool. All figures are
> self-reported or illustrative sample data, yields are indicative, and nothing in
> the app is investment, tax, or legal advice.

---

## 🗄️ Architecture Notes

Client-side normalization engine (`src/utils/`). Statement parsing in
`statementImport.ts` auto-detects format from header rows; `navRefresh.ts`
maps holdings to AMFI scheme codes (one-time, guided) for live NAVs. Direct
MF Central / Account Aggregator integration requires a regulated FIU
partnership and is on the post-launch roadmap.
