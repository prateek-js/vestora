# Unified Wealth Management & Reinvestment Engine

An enterprise-grade personal wealth operating system that aggregates multi-asset investments (Mutual Funds, Demat equities, FDs/RDs, SGBs, Corporate & Sovereign Bonds, EPF/PPF, NPS, and liquid bank accounts) across global currencies (USD, EUR, INR). The platform tracks real-time net worth, detects maturing instruments, dynamically recommends curated reinvestment paths across 4 risk tiers, analyzes tax harvesting opportunities, and offers interactive macroeconomic stress testing (inflation, interest rates, geopolitics) with active portfolio shuffling.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following core design and architectural decisions have been incorporated based on your choices:

- **Confirmed Currency & Ecosystem**: Global multi-currency architecture supporting Indian instruments (`INR`: EPF, PPF, NPS Tier 1/2, SGB, ELSS, FD/RD) alongside US/EU instruments (`USD`, `EUR`: Index ETFs, 401(k), Treasury bonds, High-Yield Savings), with real-time base currency switching (INR / USD / EUR) and normalized FX rate conversion.
- **Confirmed Data Ingestion**: Hybrid ingestion workflow combining instant preloaded persona profiles (Aggressive Growth Tech Worker, Balanced NRI / Cross-Border, Conservative Senior Saver), CAMS/KFintech Consolidated Account Statement (CAS) PDF/CSV parsing, and granular manual transaction logging with validation.
- **Confirmed Simulation Engine**: Interactive macroeconomic stress-test laboratory equipped with real-time sliders (Inflation Δ, Central Bank Policy Rate Hikes/Cuts, Geopolitical Shock Index, Equity Drawdown) and interactive "Shuffle Portfolio" rebalancing against recommended allocations.
- **Curated Reinvestment Matrix**: Whenever an instrument nears or reaches maturity (RD, FD, SGB, Sovereign/Corporate Bond), the platform generates 5–8 high-impact reinvestment allocations segmented across Guaranteed (Sovereign/RBI/Treasuries), Low (Liquid/Corporate AAA), Moderate (Hybrid Arbitrage/Balanced Advantage), and High (Flexi-Cap/Global Tech) risk profiles.

---

## 1. Overview & Core Concept

### What It Does
The platform provides a consolidated financial command center:
1. **Unified Net Worth & Allocation Engine**: Real-time asset aggregation categorizing holdings into Liquid Cash, Fixed Income (FD/RD/Bonds), Sovereign Guaranteed (PPF/EPF/SGB), Retirement Annuities (NPS), and Equity/Mutual Funds with XIRR, CAGR, and unrealized gain/loss metrics.
2. **Maturity Radar & Intelligent Reinvestment**: Proactive tracking of maturing fixed deposits, recurring deposits, sovereign gold bonds, and debentures. Rather than leaving idle cash at low savings rates, the engine proposes an actionable 5–8 option reinvestment matrix tailored to the user's risk stance.
3. **Tax & Diversification Intelligence**: Automated audits detecting single-stock/sector concentration, tax-harvesting opportunities (e.g. ₹1.25L LTCG annual exemption in India or $3,000 capital loss harvesting under IRS rules), and tax-saving gaps (Section 80C, 80CCD(1B), 401(k) match).
4. **Macro Scenario Simulator**: A stress-testing sandbox that models the user's current vs. shuffled portfolio against varying inflation spikes, central bank rate regimes, and regional equity downturns over 1-year to 10-year horizons.

### Target Audience & Persona
- **Cross-Border Investors & Tech Professionals**: Individuals holding diversified assets across domestic (e.g., India PF/NPS/MF/FD) and international assets (RSUs, US equities, Euro bonds).
- **Active Wealth Builders**: Investors seeking to eliminate idle cash drag when fixed-term deposits or bonds mature.
- **Retirement & FIRE Planners**: Users who require stress-tested visibility into how their portfolio withstands inflation and interest rate cycles.

### Key Value Delivered
- **Zero Cash Drag**: Eliminates reinvestment delay by preemptively staging optimal deployment options before maturity dates.
- **Actionable Macro Resilience**: Users visually witness how inflation erodes bond returns or how rate hikes impact equity multiples, enabling proactive portfolio rebalancing.
- **Zero Manual Math**: Instant calculation of blended yield, portfolio XIRR, tax liabilities, and diversification health.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRIMARY USER WORKFLOWS                          │
└────────────────────────────────────────────────────────────────────────┘

 [1. Aggregate & Ingest]
   ├── Select Profile Preset (Aggressive NRI, Balanced Wealth, Conservative)
   ├── OR Upload CAS / Brokerage CSV statement
   └── OR Fast-Add Manual Holding (FD, SGB, MF, Equity, NPS, EPF)
           │
           ▼
 [2. Net Worth & Allocation Cockpit]
   ├── Inspect Real-Time Net Worth (Base Currency toggle: INR / USD / EUR)
   ├── Visual Asset-Class Breakdown (Equity, Fixed Income, Gold, Retirement)
   └── Automated Insights (Concentration warnings, Tax harvesting alerts)
           │
           ▼
 [3. Maturity Radar & Automated Reinvestment]
   ├── Inspect Maturing Instruments (Timeline view: 30d, 90d, 1yr)
   ├── Select Risk Profile: Guaranteed | Low | Moderate | High
   ├── Review 5–8 Curated Deployment Solutions with yield, liquidity & taxation
   └── Click "Deploy & Rebalance" to simulate re-allocation
           │
           ▼
 [4. Macro Stress Simulation & Portfolio Shuffle]
   ├── Adjust Sliders: Inflation (2%-12%), Rate Hikes (-200bps to +400bps), Shock
   ├── Compare Baseline Portfolio vs. Scenario Adjusted Trajectory (1-10 yrs)
   └── "Shuffle Portfolio": Drag allocation sliders to stress-test target mix
```

### Visual Identity & Theme
- **Aesthetic Direction**: High-density institutional financial terminal (inspired by Bloomberg/FactSet interfaces simplified into modern enterprise SaaS), avoiding consumer gimmicks while maintaining clean typographic hierarchy.
- **Color Palette & Contrast**:
  - `Canvas Canvas`: Crisp off-white `#F8FAFC` (Light) and deep obsidian slate `#0B0F19` (Dark).
  - `Surfaces`: Pure `#FFFFFF` card containers with subtle 1px hairline borders (`#E2E8F0` / `#1E293B`).
  - `Accent Indigo`: `#4F46E5` for primary actions and active navigation states.
  - `Financial Semantics`: Muted emerald `#059669` for gains/nominal states, warm amber `#D97706` for approaching maturities, and crimson `#DC2626` for concentration risks or drawdowns.
- **Typography & Hierarchy**:
  - *Display / Section Headings*: `Plus Jakarta Sans` (SemiBold 600, tight letter-spacing `-0.02em`).
  - *Body Prose & Controls*: `DM Sans` (Regular 400 and Medium 500, clean legibility).
  - *Data & Numbers*: Strictly `tabular-nums` monospace pairing (`font-mono` / `JetBrains Mono`) ensuring all monetary figures and percentages align vertically across columns.
- **Zero-Pill Discipline & Anti-Slop Cleanliness**:
  - Metadata rendered as quiet inline text separated by middle dots (`·`) without colored badge pills or capsule borders.
  - No fake compiler tickers, no pulsing green dots, and no nested cards-within-cards.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Reinvestment Recommendation Strategy (Curated 5–8 Solutions vs. Dynamic Algorithm)
- **Chosen Approach**: A dual-layer recommendation engine with 4 risk tiers (Guaranteed, Low, Medium, High). Each tier produces 2 distinct, highly curated product templates (totalling 8 standardized solutions) combining asset class, expected yield, tax treatment, liquidity lock-in, and suitability notes.
- **Why**: Cognitive overload paralyzes financial decisions. Providing 5–8 concrete, transparent choices (e.g., Senior Floating Rate Bonds vs. Arbitrage Mutual Funds vs. Multi-Asset Allocation) empowers rapid execution without overwhelming the investor.
- **Alternatives Considered**: Scraping thousands of live market tickers, which creates choice paralysis and introduces stale quote dependencies without verified suitability.

### Decision 2: Multi-Currency Normalization Model
- **Chosen Approach**: Store all monetary values in their native denomination currency (`INR`, `USD`, `EUR`, `GBP`) along with an active FX rate matrix. The UI allows seamless instantaneous switching of the base display currency, converting all charts, totals, and tables without data mutation.
- **Why**: Allows expatriates, NRIs, and global investors to track cross-border wealth (e.g. US RSUs alongside Indian EPF/PPF) in one coherent balance sheet.
- **Alternatives Considered**: Forcing a single currency (e.g. INR only), which breaks usability for foreign equities or dollar-denominated assets.

### Decision 3: Macro Stress Simulation Engine (Deterministic Factor Model vs. Monte Carlo)
- **Chosen Approach**: Deterministic multi-factor asset sensitivity model. Each asset class has calibrated sensitivity coefficients (Equity Beta to shock, Bond Duration sensitivity to rate hikes, Real Asset / Gold sensitivity to inflation spikes).
- **Why**: Provides predictable, real-time, zero-latency feedback as the user drags sliders, making cause-and-effect instantly intuitive for portfolio shuffling.
- **Alternatives Considered**: Pure Monte Carlo simulation, which is computationally opaque and does not provide immediate tactile slider feedback for interactive "what-if" shuffling.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                SYSTEM ARCHITECTURE                                     │
└────────────────────────────────────────────────────────────────────────────────────────┘

 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │                                   CLIENT (REACT + TS)                                │
 │                                                                                      │
 │  ┌────────────────────────────────────────────────────────────────────────────────┐  │
 │  │                         TOP NAVIGATION & GLOBAL CONTROLS                       │  │
 │  │  • Wordmark: "VantageWealth"   • Currency Toggle (INR/USD/EUR)  • Quick Ingest │  │
 │  └────────────────────────────────────────────────────────────────────────────────┘  │
 │                                                                                      │
 │  ┌─────────────────────────────────┐  ┌───────────────────────────────────────────┐  │
 │  │      PORTFOLIO AGGREGATOR       │  │        MATURITY RADAR & REINVEST          │  │
 │  │  • Asset Category Breakdown     │  │  • Maturing Instruments Calendar          │  │
 │  │  • Net Worth Metric Cards       │  │  • Risk Tier Selector (Guaranteed/Low/    │  │
 │  │  • Real-Time Asset Ledger Grid  │  │    Medium/High)                           │  │
 │  │  • CAS / CSV Ingestion Parser   │  │  • 5–8 Curated Reinvestment Solutions     │  │
 │  └─────────────────────────────────┘  └───────────────────────────────────────────┘  │
 │                                                                                      │
 │  ┌─────────────────────────────────┐  ┌───────────────────────────────────────────┐  │
 │  │    TAX & DIVERSIFICATION AUDIT  │  │        MACRO SIMULATOR & SHUFFLE          │  │
 │  │  • LTCG/STCG Harvesting Alerts  │  │  • Macro Stress Sliders (Inflation, Rate)│  │
 │  │  • Concentration Risk Heatmap   │  │  • Multi-Year Wealth Trajectory Chart     │  │
 │  │  • Tax Optimization Suggestions │  │  • Interactive Portfolio Shuffler         │  │
 │  └─────────────────────────────────┘  └───────────────────────────────────────────┘  │
 └──────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │                               DATA ENGINE & STATE CORE                               │
 │                                                                                      │
 │  ┌─────────────────────────┐  ┌──────────────────────────┐  ┌─────────────────────┐  │
 │  │  Holdings Store         │  │  Reinvestment Engine     │  │ Macro Stress Engine │  │
 │  │  • Holdings CRUD        │  │  • Maturity Detection    │  │ • Duration Shock    │  │
 │  │  • FX Normalization     │  │  • Risk Tier Filtering   │  │ • Equity Beta Shock │  │
 │  │  • Category Aggregation │  │  • 5-8 Allocation Matrix │  │ • Inflation Drag    │  │
 │  └─────────────────────────┘  └──────────────────────────┘  └─────────────────────┘  │
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

### Relational Database Schema & TypeScript Domain Models

Below is the production database schema (PostgreSQL DDL / Drizzle ORM representation) designed for persistence:

```sql
-- 1. Users & Configuration
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    base_currency VARCHAR(3) DEFAULT 'INR' CHECK (base_currency IN ('INR', 'USD', 'EUR')),
    risk_profile VARCHAR(32) DEFAULT 'MODERATE' CHECK (risk_profile IN ('GUARANTEED', 'LOW', 'MODERATE', 'HIGH')),
    tax_regime VARCHAR(32) DEFAULT 'NEW' CHECK (tax_regime IN ('OLD', 'NEW', 'US_STANDARD')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Financial Accounts (Banks, Demat, EPF, NPS)
CREATE TABLE financial_accounts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    institution_name VARCHAR(128) NOT NULL,
    account_type VARCHAR(64) NOT NULL CHECK (account_type IN (
        'SAVINGS_BANK', 'DEMAT_BROKER', 'EPFO_PORTAL', 'PPF_ACCOUNT',
        'NPS_CRA', 'FIXED_DEPOSIT', 'BOND_REGISTRY'
    )),
    account_number_mask VARCHAR(16),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    current_balance NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Consolidated Investment Holdings
CREATE TABLE holdings (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) REFERENCES financial_accounts(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    asset_class VARCHAR(64) NOT NULL CHECK (asset_class IN (
        'MUTUAL_FUND', 'EQUITY_STOCK', 'FIXED_DEPOSIT', 'RECURRING_DEPOSIT',
        'SOVEREIGN_GOLD_BOND', 'GOVT_BOND', 'CORP_BOND', 'EPF', 'PPF',
        'NPS_TIER_1', 'NPS_TIER_2', 'CASH_SAVINGS'
    )),
    instrument_name VARCHAR(255) NOT NULL,
    symbol_or_isin VARCHAR(64),
    units NUMERIC(16, 4) DEFAULT 1.0000,
    average_buy_price NUMERIC(16, 2) NOT NULL,
    current_market_price NUMERIC(16, 2) NOT NULL,
    total_invested_amount NUMERIC(16, 2) NOT NULL,
    current_valuation NUMERIC(16, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    interest_rate_pct NUMERIC(6, 2), -- Applicable for FD, RD, Bonds, EPF
    purchase_date DATE NOT NULL,
    maturity_date DATE,              -- Nullable for open-ended equity/funds
    auto_reinvest_preference VARCHAR(32) DEFAULT 'RECOMMEND_OPTIONS',
    tax_treatment VARCHAR(64) NOT NULL, -- '80C_ELIGIBLE', 'LTCG_EQUITY', 'DEBT_SLAB', 'EXEMPT_EEE'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Maturity & Reinvestment Recommendations
CREATE TABLE reinvestment_recommendations (
    id VARCHAR(64) PRIMARY KEY,
    holding_id VARCHAR(64) REFERENCES holdings(id) ON DELETE CASCADE,
    risk_category VARCHAR(32) NOT NULL CHECK (risk_category IN ('GUARANTEED', 'LOW', 'MODERATE', 'HIGH')),
    solution_name VARCHAR(255) NOT NULL,
    instrument_type VARCHAR(64) NOT NULL,
    expected_yield_pct NUMERIC(5, 2) NOT NULL,
    tenure_months INT NOT NULL,
    liquidity_rating VARCHAR(32) NOT NULL, -- 'HIGH_T_PLUS_1', 'MEDIUM_LOCKIN_3Y', 'LOCKED_TILL_60'
    tax_efficiency_notes TEXT NOT NULL,
    rationale TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- 5. Macro Stress Testing Scenarios
CREATE TABLE simulation_scenarios (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    scenario_name VARCHAR(128) NOT NULL,
    inflation_rate_pct NUMERIC(5, 2) NOT NULL,
    interest_rate_delta_bps INT NOT NULL,
    equity_market_shock_pct NUMERIC(5, 2) NOT NULL,
    gold_price_delta_pct NUMERIC(5, 2) NOT NULL,
    projection_horizon_years INT DEFAULT 5,
    shuffled_allocation_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### TypeScript Data Contracts

```typescript
export type CurrencyCode = 'INR' | 'USD' | 'EUR';

export type AssetCategory = 
  | 'MUTUAL_FUND'
  | 'EQUITY_STOCK'
  | 'FIXED_DEPOSIT'
  | 'RECURRING_DEPOSIT'
  | 'SOVEREIGN_GOLD_BOND'
  | 'GOVT_BOND'
  | 'CORP_BOND'
  | 'EPF'
  | 'PPF'
  | 'NPS'
  | 'SAVINGS_CASH';

export type RiskProfile = 'GUARANTEED' | 'LOW' | 'MODERATE' | 'HIGH';

export interface Holding {
  id: string;
  name: string;
  category: AssetCategory;
  institution: string;
  investedAmount: number;
  currentValue: number;
  currency: CurrencyCode;
  interestRatePct?: number;
  purchaseDate: string;
  maturityDate?: string;
  daysToMaturity?: number;
  unrealizedGain: number;
  unrealizedGainPct: number;
  taxTag: '80C' | 'LTCG_EQUITY' | 'STCG' | 'TAX_EXEMPT_EEE' | 'SLAB_INCOME';
}

export interface ReinvestmentOption {
  id: string;
  solutionName: string;
  riskTier: RiskProfile;
  instrumentType: string;
  expectedAnnualYieldPct: number;
  recommendedAllocationPct: number;
  lockInPeriod: string;
  taxImplication: string;
  whyRecommended: string;
  suitability: string;
}

export interface MacroParameters {
  inflationRatePct: number;          // e.g., 6.5%
  interestRateHikeBps: number;       // e.g., +150 bps
  geopoliticalShockIndex: number;    // 0 to 10 scale
  equityMarketShockPct: number;      // e.g., -15%
  projectionHorizonYears: number;    // 1 to 10 years
}

export interface PortfolioAllocation {
  equities: number;       // Percentage
  fixedIncome: number;
  goldCommodity: number;
  retirementPensions: number;
  liquidCash: number;
}
```

---

## 5. Technical Roadmap & Task Breakdown

### Stage 1: Core Domain Engine & Data Store
- Build multi-currency normalization engine (`INR` ⇄ `USD` ⇄ `EUR`) with active FX exchange rates.
- Implement comprehensive financial data store loaded with 3 realistic pre-populated wealth profiles:
  1. *Global Tech NRI* (₹1.85 Cr / $220k total assets: US RSUs, Indian NRE FDs, ELSS mutual funds, SGB tranches, EPF).
  2. *Balanced Wealth Builder* (₹85 Lakhs: Nifty 50 Index, Corporate AAA Bonds, Maturing FDs, PPF, NPS Tier-1).
  3. *Conservative Wealth Preserver* (₹60 Lakhs: Maturing RDs, Sovereign Gold Bonds, Senior Citizen FDs, Sovereign G-Secs).
- Provide CAS / CSV portfolio statement parser and quick-entry modal with validation.

### Stage 2: Net Worth Cockpit & Analytics
- Create high-density visual dashboard with multi-currency balance header and metric strips.
- Breakdown pie/bar visualization for asset allocation (Equities, Fixed Income, Gold, Retirement, Liquid).
- Data table with sorting, search, category filtering, days-to-maturity countdown, and tabular numeral alignment.

### Stage 3: Maturity Radar & Intelligent 8-Solution Reinvestment Matrix
- Real-time maturity tracker identifying all deposits, bonds, and SGBs maturing within 30, 90, or 365 days.
- 4-Tier Curated Reinvestment Engine providing 5–8 distinct, actionable deployment solutions:
  - **Guaranteed Risk**: RBI Floating Rate Savings Bonds (8.05%), Sovereign G-Secs (7.15%), PPF/EPF top-up.
  - **Low Risk**: Corporate AAA Short-Term Yield (7.65%), High-Yield Arbitrage Funds (7.2% tax-advantaged equity taxation).
  - **Moderate Risk**: Balanced Advantage Multi-Asset Fund (10.5%), REITs / InvITs dividend yield pipeline (8.2%).
  - **High Risk**: Flexi-Cap Global Equity Index (13.5%), Factor-driven momentum ETF (14.2%).
- Interactive "Execute Simulated Reinvestment" action that re-allocates maturing capital into the selected strategy.

### Stage 4: Tax Optimization & Concentration Audit
- Tax harvesting analysis: Computes unrealized Long Term Capital Gains (LTCG) vs. annual tax-exempt limits (e.g. ₹1.25L in India or US capital loss offset).
- Concentration risk detector: Warns if single stock or asset class exceeds 35% of total net worth.
- Tax-saving checklist (80C shortfall, 80CCD(1B) NPS ₹50k extra deduction, ELSS).

### Stage 5: Macro Simulation Laboratory & Portfolio Shuffler
- Interactive stress-test controls: Inflation rate (2% to 12%), Interest rate hikes (-200 bps to +400 bps), and Geopolitical / Market shock (-30% to +20%).
- Multi-year wealth trajectory modeling showing real inflation-adjusted wealth vs. nominal wealth.
- Portfolio Shuffler: User adjusts target allocation percentages (Equities vs. Debt vs. Gold vs. Cash) to visualize how rebalancing shields against the simulated macro shock.
