export type SeoPageSlug =
  | 'home-loan-vs-fd-calculator'
  | 'mutual-fund-rebalance-india'
  | 'fd-maturity-reinvestment-guide'
  | 'ltcg-tax-harvesting-india';

export interface SeoFaqItem {
  q: string;
  a: string;
}

export interface SeoComparisonRow {
  option: string;
  typicalReturn: string;
  taxImpact: string;
  verdict: string;
}

export interface SeoPageContent {
  slug: SeoPageSlug;
  navLabel: string;
  eyebrow: string;
  title: string;
  metaDescription: string;
  h1: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  comparisonHeading: string;
  comparisonRows: SeoComparisonRow[];
  keyTakeaways: string[];
  faqs: SeoFaqItem[];
}

export const SEO_PAGES: Record<SeoPageSlug, SeoPageContent> = {
  'home-loan-vs-fd-calculator': {
    slug: 'home-loan-vs-fd-calculator',
    navLabel: 'Home Loan vs FD Calculator',
    eyebrow: 'DEBT VS POST-TAX YIELD MATH',
    title: 'Home Loan Prepayment vs FD Calculator – Vestora Wealth',
    metaDescription:
      'Compare guaranteed tax-free home loan interest savings against post-tax FD returns in seconds. See exact EMI tenure saved & net gain — 100% private tool.',
    h1: 'Home Loan Prepayment vs Fixed Deposit Calculator (India)',
    subtitle:
      'Should you prepay your floating-rate home loan or lock surplus cash into a bank FD? Compare real post-tax FD returns against guaranteed, tax-free home loan interest savings side by side.',
    ctaLabel: 'Open Full Rebalance Simulator',
    ctaHref: '/#rebalance',
    secondaryCtaLabel: 'Enter Portfolio Overview',
    secondaryCtaHref: '/#overview',
    comparisonHeading: 'Post-Tax Reality: Bank FD Renewal vs Home Loan Principal Prepayment',
    comparisonRows: [
      {
        option: 'Bank Fixed Deposit (6.5% – 7.0%)',
        typicalReturn: '6.75% pre-tax',
        taxImpact: 'Taxed at slab (30% → ~4.65% net)',
        verdict: 'Loses ~3.9% p.a. against an 8.55% home loan',
      },
      {
        option: 'Home Loan Principal Prepayment',
        typicalReturn: '8.55% effective',
        taxImpact: '100% tax-free guaranteed savings',
        verdict: 'Beats every bank FD and taxable debt fund risk-free',
      },
      {
        option: 'Hybrid Split (Loan + Direct Index MF)',
        typicalReturn: '10.0% – 11.5% blended',
        taxImpact: '12.5% LTCG (₹1.25L/yr exempt)',
        verdict: 'Best when you want debt relief plus long-term growth',
      },
    ],
    keyTakeaways: [
      'A 6.75% Fixed Deposit in the 30% tax bracket delivers just 4.73% effective post-tax return (4.65% with cess).',
      'Prepaying ₹1 Lakh of home loan principal at 8.55% early in tenure saves significantly more than ₹1 Lakh in cumulative interest over a 15-year loan.',
      'Always retain 6 months of emergency liquidity in high-yield liquid funds or sweep FDs before making lump-sum loan prepayments.',
    ],
    faqs: [
      {
        q: 'Is it better to prepay a home loan or keep money in an FD?',
        a: 'In almost every scenario where your home loan rate (8.3%–9.2%) exceeds your post-tax FD return (~4.5%–5.5%), prepaying home loan principal generates a higher, guaranteed, tax-free return than renewing a Fixed Deposit.',
      },
      {
        q: 'What about Section 24(b) home loan interest tax deduction?',
        a: 'Under the New Tax Regime (the default for most salaried Indian taxpayers), Section 24(b) interest deduction on self-occupied property is not available. Even under the Old Tax Regime, the deduction is capped at ₹2 Lakh per year—any interest above that cap receives zero tax shield.',
      },
      {
        q: 'Do banks charge prepayment penalties on floating-rate home loans in India?',
        a: 'No. Per RBI directives, banks and HFCs cannot levy foreclosure or partial prepayment charges on floating-rate home loans granted to individual borrowers.',
      },
    ],
  },
  'mutual-fund-rebalance-india': {
    slug: 'mutual-fund-rebalance-india',
    navLabel: 'Mutual Fund Rebalance',
    eyebrow: '0% COMMISSION · DIRECT-GROWTH MATH',
    title: 'Mutual Fund Rebalance & Direct Plan Calculator – Vestora',
    metaDescription:
      'Calculate hidden regular mutual fund commission drag and rebalance across Direct-Growth MFs, NPS Tier-I & RBI G-Secs with 0% fees and 100% on-device math.',
    h1: 'Mutual Fund Rebalance & Direct vs Regular Commission Calculator',
    subtitle:
      'Regular mutual fund plans silently deduct 0.8%–1.5% every single year in distributor commissions—compounding into lakhs lost over a decade. Measure your exact fee leak and build an unbiased Direct rebalance plan.',
    ctaLabel: 'Explore 40,000+ Live Direct MFs',
    ctaHref: '/#rebalance',
    secondaryCtaLabel: 'Audit Your Portfolio',
    secondaryCtaHref: '/#overview',
    comparisonHeading: 'Regular Distributor Plans vs Direct-Growth Portfolio Rebalancing',
    comparisonRows: [
      {
        option: 'Regular Plan via Bank / Broker',
        typicalReturn: '11.0% net CAGR',
        taxImpact: '1.0%–1.5% annual trail fee compounds away',
        verdict: 'Conflicts of interest; pushes high-commission NFOs',
      },
      {
        option: 'Direct-Growth Mutual Fund (AMFI)',
        typicalReturn: '12.2% net CAGR',
        taxImpact: '0% distributor commission; lowest TER',
        verdict: 'Same fund manager & portfolio, higher compounding',
      },
      {
        option: 'Unified Vestora Rebalance Plan',
        typicalReturn: 'Risk-matched blend',
        taxImpact: 'Optimizes ₹1.25L LTCG harvest + NPS + Loans',
        verdict: 'Rebalances across all asset classes with 0% AUM fee',
      },
    ],
    keyTakeaways: [
      'A 1.1% expense ratio difference on a ₹15 Lakh portfolio compounding at 12% costs over ₹10.8 Lakh in lost wealth over 15 years.',
      'Rebalancing once a year using fresh inflows or tax-free ₹1.25L LTCG tranches lets you switch from Regular to Direct plans while minimizing tax friction.',
      'Vestora pulls live NAVs across 40,000+ AMFI schemes and Kuvera Direct-Growth category rankings strictly inside your browser.',
    ],
    faqs: [
      {
        q: 'How much money do Regular mutual fund commissions actually cost?',
        a: 'Distributor trail commissions typically range from 0.8% to 1.5% per year on equity funds. Because this fee is deducted from NAV every day regardless of market performance, it reduces final 15-year wealth by 14% to 22%.',
      },
      {
        q: 'Can I switch from Regular to Direct mutual funds without paying heavy tax?',
        a: 'Yes. Units held for more than 12 months in equity funds qualify for ₹1.25 Lakh of tax-free Long-Term Capital Gains (LTCG) per financial year. You can stagger switches across financial years to harvest gains tax-free.',
      },
      {
        q: 'Does Vestora Wealth sell mutual funds or earn commissions?',
        a: 'No. Vestora Wealth is a 100% client-side, zero-commission portfolio terminal. It never collects brokerage, trail fees, or AUM fees.',
      },
    ],
  },
  'fd-maturity-reinvestment-guide': {
    slug: 'fd-maturity-reinvestment-guide',
    navLabel: 'Matured FD Reinvestment',
    eyebrow: 'MATURITY RADAR & SMART REDEPLOYMENT',
    title: 'Matured FD Reinvestment Calculator & Guide – Vestora',
    metaDescription:
      "Don't auto-renew a matured FD at 4.5% post-tax. Compare RBI G-Secs, Arbitrage/Direct Mutual Funds, NPS Tier-I & Loan Prepayment in one unbiased calculator.",
    h1: 'Where to Invest a Matured FD in India? Post-Tax Reinvestment Calculator',
    subtitle:
      'Auto-renewing a matured Fixed Deposit in the 30% tax slab traps your capital below inflation. Compare smarter, risk-tiered alternatives—RBI G-Secs, Arbitrage Funds, Direct Equity MFs, NPS Tier-I, and Debt Prepayment.',
    ctaLabel: 'Open Maturity Radar Tool',
    ctaHref: '/#radar',
    secondaryCtaLabel: 'Simulate Capital Split',
    secondaryCtaHref: '/#rebalance',
    comparisonHeading: 'Where to Deploy a Matured FD Across 4 Risk Tiers',
    comparisonRows: [
      {
        option: 'Auto-Renew Bank FD (6.5%)',
        typicalReturn: '4.55% post-tax (30% slab)',
        taxImpact: 'Interest taxed annually even before maturity',
        verdict: 'Erodes real purchasing power after inflation',
      },
      {
        option: 'RBI G-Secs & Sovereign T-Bills',
        typicalReturn: '6.8% – 7.2% sovereign',
        taxImpact: 'Zero credit risk; lock-in multi-year yields',
        verdict: 'Stronger sovereign safety than private bank FDs',
      },
      {
        option: 'Arbitrage Funds (Short-Term Parking)',
        typicalReturn: '7.0% – 7.5% pre-tax',
        taxImpact: 'Equity taxation (12.5% LTCG / 20% STCG)',
        verdict: 'Saves 10%–18% tax vs FDs for 30% slab investors',
      },
      {
        option: 'Balanced Split (Loan + Direct MF + NPS)',
        typicalReturn: '9.5% – 11.5% blended',
        taxImpact: 'Tax-free loan savings + 80CCD(1B) + LTCG cap',
        verdict: 'Maximizes risk-adjusted net worth across horizons',
      },
    ],
    keyTakeaways: [
      'Bank FD interest is taxed every year on an accrual basis—reducing compounding even on cumulative FDs.',
      'For high-slab investors needing 6–24 month safety, Arbitrage Funds enjoy equity tax treatment (20% STCG or 12.5% LTCG with ₹1.25L exemption) instead of 30%+ slab tax.',
      'Splitting a matured FD into an emergency buffer + loan prepayment + Direct MF/NPS avoids putting 100% of matured cash into one suboptimal bucket.',
    ],
    faqs: [
      {
        q: 'What happens if I let my Fixed Deposit auto-renew?',
        a: 'Banks automatically renew matured FDs at their prevailing card rate for the same tenure. You pay slab tax up to 30% + cess every year on accrued interest and miss higher post-tax or debt-reduction opportunities.',
      },
      {
        q: 'Are Arbitrage Funds safer than Equity Mutual Funds for FD money?',
        a: 'Yes. Arbitrage funds hedge cash-and-futures price spreads with near-zero directional stock risk, delivering liquid-fund-like stability while qualifying for lower equity capital gains taxation.',
      },
      {
        q: 'How can I track multiple FD, Bond, and SGB maturity dates in one place?',
        a: 'Vestora Wealth includes an on-device Maturity Radar that flags matured and upcoming FDs, SGBs, and corporate bonds across 30, 60, and 90 days—with zero server uploads.',
      },
    ],
  },
  'ltcg-tax-harvesting-india': {
    slug: 'ltcg-tax-harvesting-india',
    navLabel: 'LTCG Tax Harvesting',
    eyebrow: 'INDIAN TAX ALPHA · ₹1.25L EXEMPTION + NPS',
    title: 'LTCG Tax Harvesting & 80CCD(1B) Calculator – Vestora',
    metaDescription:
      'Calculate your annual ₹1.25 Lakh equity LTCG tax-free harvesting savings plus Section 80C & 80CCD(1B) NPS tax deductions — free, private Indian tax tool.',
    h1: 'LTCG Tax Harvesting (₹1.25 Lakh) & NPS 80CCD(1B) Calculator',
    subtitle:
      'Indian equity investors get ₹1.25 Lakh of completely tax-free Long-Term Capital Gains every single financial year—yet most let it expire unused on March 31. Calculate your exact annual tax savings in seconds.',
    ctaLabel: 'Open Full Tax Audit Dashboard',
    ctaHref: '/#tax',
    secondaryCtaLabel: 'Track Holdings Privately',
    secondaryCtaHref: '/#overview',
    comparisonHeading: 'Annual Legal Tax-Saving Levers for Indian Portfolios',
    comparisonRows: [
      {
        option: 'Equity LTCG Tax Harvesting',
        typicalReturn: 'Up to ₹1,25,000 gain/yr',
        taxImpact: 'Saves up to ₹15,625/yr (12.5% LTCG rate)',
        verdict: 'Resets cost basis higher legally every financial year',
      },
      {
        option: 'NPS Tier-I Section 80CCD(1B)',
        typicalReturn: '₹50,000 extra deduction',
        taxImpact: 'Saves up to ₹15,600/yr (Old Regime 30% slab)',
        verdict: 'Over and above ₹1.5L Section 80C limit',
      },
      {
        option: 'Employer NPS 80CCD(2)',
        typicalReturn: 'Up to 14% of Basic Salary',
        taxImpact: 'Allowed even under the New Tax Regime',
        verdict: 'One of the largest legal deductions in New Regime',
      },
    ],
    keyTakeaways: [
      'Booking up to ₹1.25 Lakh in long-term equity gains (>12 months holding) and reinvesting steps up your purchase cost—saving ₹15,625 in future 12.5% LTCG tax every year.',
      'Unlike the US wash-sale rule, Indian tax law permits re-buying equity mutual funds or stocks after realizing long-term gains (watch out for minor exit loads and STT).',
      'Combining annual LTCG harvesting with NPS 80CCD(1B) or Corporate NPS 80CCD(2) adds ₹30,000+ in risk-free annual tax alpha.',
    ],
    faqs: [
      {
        q: 'What is the current LTCG tax-free exemption limit in India?',
        a: 'Long-Term Capital Gains on listed Indian equities and equity-oriented mutual funds held for over 12 months are exempt up to ₹1,25,000 per financial year. Gains above ₹1.25 Lakh are taxed at 12.5% plus applicable cess.',
      },
      {
        q: 'Is LTCG tax harvesting legal in India?',
        a: 'Yes. Selling long-term equity units to realize up to ₹1.25 Lakh of tax-exempt gains and reinvesting the proceeds into the same or a better Direct-Growth fund is a standard, fully legal tax planning practice in India.',
      },
      {
        q: 'When is the deadline for LTCG tax harvesting each year?',
        a: 'Your sell order must settle within the financial year (before March 31). Executing by March 25–27 safely accounts for T+1 equity or mutual fund redemption settlement timelines.',
      },
    ],
  },
};

export const SEO_PAGE_LIST: SeoPageContent[] = [
  SEO_PAGES['home-loan-vs-fd-calculator'],
  SEO_PAGES['mutual-fund-rebalance-india'],
  SEO_PAGES['fd-maturity-reinvestment-guide'],
  SEO_PAGES['ltcg-tax-harvesting-india'],
];
