import { CurrencyCode, Holding, TaxTag } from '../types/wealth';
import { convertCurrency, formatCurrency } from './currency';
import {
  calculateHomeLoanPrepaymentImpact,
  fetchLiveGoldInrSpot,
  fetchLiveIndiaGsecRates,
  fetchLiveNpsSchemes,
  fetchLiveUsTreasuryRates,
  fetchMutualFundDetails,
  LISTED_MARKET_INSTRUMENTS,
  ListedMarketInstrument,
  MutualFundMarketDetail,
  NpsMarketScheme,
} from './marketDirectory';
import { computePortfolioRiskScore, computeTaxSectionAudit } from './taxAndDiversification';

export type DiversificationGoal = 'CONSERVATIVE' | 'BALANCED' | 'GROWTH';
export type TaxSlabOption = 0 | 10 | 20 | 30;
export type MacroBucket = 'equity' | 'debt' | 'gold' | 'cash';

export interface BucketMix {
  equity: number;
  debt: number;
  gold: number;
  cash: number;
}

export const TARGET_MIX_BY_GOAL: Record<
  DiversificationGoal,
  { label: string; subtitle: string; weights: BucketMix }
> = {
  CONSERVATIVE: {
    label: 'Conservative',
    subtitle: 'Capital preservation · 25% Equity / 55% Debt / 10% Gold / 10% Cash',
    weights: { equity: 25, debt: 55, gold: 10, cash: 10 },
  },
  BALANCED: {
    label: 'Balanced',
    subtitle: 'All-weather growth · 50% Equity / 30% Debt / 10% Gold / 10% Cash',
    weights: { equity: 50, debt: 30, gold: 10, cash: 10 },
  },
  GROWTH: {
    label: 'Growth',
    subtitle: 'Long-term compounding · 70% Equity / 15% Debt / 10% Gold / 5% Cash',
    weights: { equity: 70, debt: 15, gold: 10, cash: 5 },
  },
};

export interface SmartDiversificationPreferences {
  goal: DiversificationGoal;
  taxSlabPct: TaxSlabOption;
  hasHomeLoan: boolean;
  homeLoanRatePct: number;
  homeLoanPrincipal: number;
  homeLoanYearsLeft: number;
}

export interface SuggestedDestination {
  id: string;
  kind: 'MUTUAL_FUND' | 'MARKET_INSTRUMENT' | 'CUSTOM_ASSET' | 'HOME_LOAN';
  title: string;
  subtitle: string;
  category?: Holding['category'];
  institution?: string;
  currency: CurrencyCode;
  allocatedInBase: number;
  expectedRatePct?: number;
  schemeCode?: number;
  navOrPrice?: number;
  gain30dPct?: number;
  tenureDays?: number;
  taxTag?: TaxTag;
  loanRatePct?: number;
  loanInterestSaved?: number;
  loanMonthsSaved?: number;
}

export interface BenchmarkKey {
  id: 'NIFTY50' | 'FLEXI_CAP' | 'ARBITRAGE' | 'LIQUID' | 'CORP_BOND' | 'GILT' | 'GOLD_FOF';
  schemeCode: number;
  shortName: string;
  bucket: MacroBucket;
  fallbackYieldPct: number;
  taxTag: TaxTag;
}

export const AMFI_BENCHMARK_CONFIG: BenchmarkKey[] = [
  {
    id: 'NIFTY50',
    schemeCode: 120716,
    shortName: 'UTI Nifty 50 Index Direct',
    bucket: 'equity',
    fallbackYieldPct: 12.8,
    taxTag: 'LTCG_EQUITY',
  },
  {
    id: 'FLEXI_CAP',
    schemeCode: 122639,
    shortName: 'Parag Parikh Flexi Cap Direct',
    bucket: 'equity',
    fallbackYieldPct: 14.2,
    taxTag: 'LTCG_EQUITY',
  },
  {
    id: 'ARBITRAGE',
    schemeCode: 129052,
    shortName: 'HDFC Arbitrage Fund Direct',
    bucket: 'debt',
    fallbackYieldPct: 7.3,
    taxTag: 'LTCG_EQUITY',
  },
  {
    id: 'LIQUID',
    schemeCode: 119800,
    shortName: 'SBI Liquid Fund Direct',
    bucket: 'cash',
    fallbackYieldPct: 6.8,
    taxTag: 'SLAB_INCOME',
  },
  {
    id: 'CORP_BOND',
    schemeCode: 120692,
    shortName: 'ICICI Pru Corporate Bond Direct',
    bucket: 'debt',
    fallbackYieldPct: 7.6,
    taxTag: 'SLAB_INCOME',
  },
  {
    id: 'GILT',
    schemeCode: 119707,
    shortName: 'SBI Gilt Fund Direct',
    bucket: 'debt',
    fallbackYieldPct: 7.9,
    taxTag: 'SLAB_INCOME',
  },
  {
    id: 'GOLD_FOF',
    schemeCode: 119132,
    shortName: 'HDFC Gold ETF FoF Direct',
    bucket: 'gold',
    fallbackYieldPct: 11.5,
    taxTag: 'LTCG_EQUITY',
  },
];

export interface LiveMarketBenchmarks {
  funds: Record<BenchmarkKey['id'], MutualFundMarketDetail | null>;
  usTreasuries: ListedMarketInstrument[];
  indiaGsecs: ListedMarketInstrument[];
  npsSchemes: NpsMarketScheme[];
  goldInrPer10g: number | null;
  fetchedAt: string;
  liveFundCount: number;
}

export interface AllocationProfileAnalysis {
  totalValuation: number;
  currentPct: BucketMix;
  currentVal: BucketMix;
  targetPct: BucketMix;
  gapPct: BucketMix; // target - current (positive = underweight, negative = overweight)
  topHolding: { holding: Holding; sharePct: number; valInBase: number } | null;
  cashHoldings: Holding[];
  maturedHoldings: Holding[];
  dominantCurrency: CurrencyCode;
  singleCurrencySharePct: number;
}

export interface SmartDiversificationPlan {
  id: string;
  categoryLabel: string;
  title: string;
  rationale: string;
  sourceHolding: Holding;
  moveAmountInBase: number;
  destinations: SuggestedDestination[];
  benefitSummary: string;
  riskBefore: number;
  riskAfter: number;
  postureAfter: string;
  isLiveApiBacked: boolean;
}

function classifyHoldingBucket(h: Holding): MacroBucket {
  const lower = h.name.toLowerCase();
  if (h.category === 'SAVINGS_CASH') return 'cash';
  if (h.category === 'SOVEREIGN_GOLD_BOND' || /\bgold\b|\bsgb\b|silver/i.test(lower)) {
    return 'gold';
  }
  if (h.category === 'EQUITY_STOCK') return 'equity';
  if (h.category === 'MUTUAL_FUND') {
    if (/\bliquid\b|overnight|money market|ultra short/i.test(lower)) return 'cash';
    if (/arbitrage|\bgilt\b|corporate bond|short duration|\bdebt\b|psu bond/i.test(lower)) {
      return 'debt';
    }
    return 'equity';
  }
  if (h.category === 'NPS') return 'equity';
  return 'debt';
}

export function analyzeAllocationProfile(
  holdings: Holding[],
  baseCurrency: CurrencyCode,
  goal: DiversificationGoal
): AllocationProfileAnalysis {
  const targetPct = TARGET_MIX_BY_GOAL[goal].weights;
  const currentVal: BucketMix = { equity: 0, debt: 0, gold: 0, cash: 0 };
  const currencyTotals: Record<CurrencyCode, number> = { INR: 0, USD: 0, EUR: 0 };

  let topHolding: AllocationProfileAnalysis['topHolding'] = null;
  const cashHoldings: Holding[] = [];
  const maturedHoldings: Holding[] = [];

  holdings.forEach((h) => {
    const val = Math.max(0, convertCurrency(h.currentValue, h.currency, baseCurrency));
    currencyTotals[h.currency] = (currencyTotals[h.currency] || 0) + val;

    if (h.category === 'SAVINGS_CASH') cashHoldings.push(h);
    if (h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0)) {
      maturedHoldings.push(h);
    }

    if (h.category === 'NPS') {
      currentVal.equity += val * 0.5;
      currentVal.debt += val * 0.5;
    } else {
      const bucket = classifyHoldingBucket(h);
      currentVal[bucket] += val;
    }

    if (!topHolding || val > topHolding.valInBase) {
      topHolding = { holding: h, valInBase: val, sharePct: 0 };
    }
  });

  const totalValuation =
    currentVal.equity + currentVal.debt + currentVal.gold + currentVal.cash;

  const pct = (v: number) => (totalValuation > 0 ? Math.round((v / totalValuation) * 100) : 0);
  const currentPct: BucketMix = {
    equity: pct(currentVal.equity),
    debt: pct(currentVal.debt),
    gold: pct(currentVal.gold),
    cash: pct(currentVal.cash),
  };

  if (topHolding && totalValuation > 0) {
    (topHolding as { holding: Holding; sharePct: number; valInBase: number }).sharePct = Math.round(
      ((topHolding as { valInBase: number }).valInBase / totalValuation) * 100
    );
  }

  let dominantCurrency: CurrencyCode = baseCurrency;
  let maxCurrVal = -1;
  (Object.keys(currencyTotals) as CurrencyCode[]).forEach((ccy) => {
    if (currencyTotals[ccy] > maxCurrVal) {
      maxCurrVal = currencyTotals[ccy];
      dominantCurrency = ccy;
    }
  });

  const singleCurrencySharePct =
    totalValuation > 0 ? Math.round((maxCurrVal / totalValuation) * 100) : 0;

  return {
    totalValuation,
    currentPct,
    currentVal,
    targetPct,
    gapPct: {
      equity: targetPct.equity - currentPct.equity,
      debt: targetPct.debt - currentPct.debt,
      gold: targetPct.gold - currentPct.gold,
      cash: targetPct.cash - currentPct.cash,
    },
    topHolding,
    cashHoldings: cashHoldings.sort(
      (a, b) =>
        convertCurrency(b.currentValue, b.currency, baseCurrency) -
        convertCurrency(a.currentValue, a.currency, baseCurrency)
    ),
    maturedHoldings: maturedHoldings.sort(
      (a, b) =>
        convertCurrency(b.currentValue, b.currency, baseCurrency) -
        convertCurrency(a.currentValue, a.currency, baseCurrency)
    ),
    dominantCurrency,
    singleCurrencySharePct,
  };
}

/**
 * Fetches live scheme NAVs, trailing 1Y/3Y CAGRs, and daily volatilities across
 * core AMFI benchmark funds + live India G-Sec yields + NPS Tier-I schemes + Gold INR spot + U.S. Treasuries.
 */
export async function fetchLiveMarketBenchmarks(): Promise<LiveMarketBenchmarks> {
  const [fundDetails, usTreasuries, indiaGsecs, npsSchemes, goldSpot] = await Promise.all([
    Promise.all(AMFI_BENCHMARK_CONFIG.map((cfg) => fetchMutualFundDetails(cfg.schemeCode))),
    fetchLiveUsTreasuryRates(),
    fetchLiveIndiaGsecRates(),
    fetchLiveNpsSchemes(),
    fetchLiveGoldInrSpot(),
  ]);

  const funds = {} as Record<BenchmarkKey['id'], MutualFundMarketDetail | null>;
  let liveFundCount = 0;

  AMFI_BENCHMARK_CONFIG.forEach((cfg, idx) => {
    const det = fundDetails[idx];
    funds[cfg.id] = det;
    if (det) liveFundCount += 1;
  });

  return {
    funds,
    usTreasuries,
    indiaGsecs,
    npsSchemes,
    goldInrPer10g: goldSpot?.inrPer10g ?? null,
    fetchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    liveFundCount,
  };
}

function buildMfDestination(
  key: BenchmarkKey['id'],
  amountInBase: number,
  benchmarks: LiveMarketBenchmarks | null
): SuggestedDestination {
  const cfg = AMFI_BENCHMARK_CONFIG.find((c) => c.id === key)!;
  const detail = benchmarks?.funds[key] ?? null;
  const rate = detail?.cagr3yPct ?? detail?.cagr1yPct ?? cfg.fallbackYieldPct;
  const volText =
    detail?.annualizedVolatilityPct !== null && detail?.annualizedVolatilityPct !== undefined
      ? ` · ${detail.annualizedVolatilityPct}% vol`
      : '';
  const cagrText =
    detail?.cagr3yPct !== null && detail?.cagr3yPct !== undefined
      ? `${detail.cagr3yPct.toFixed(1)}% 3Y CAGR`
      : detail?.cagr1yPct !== null && detail?.cagr1yPct !== undefined
      ? `${detail.cagr1yPct.toFixed(1)}% 1Y return`
      : `Est. ${cfg.fallbackYieldPct}% p.a.`;

  return {
    id: `mf-${cfg.schemeCode}`,
    kind: 'MUTUAL_FUND',
    title: detail?.schemeName ?? cfg.shortName,
    subtitle: detail
      ? `${detail.fundHouse} · NAV ₹${detail.latestNav.toFixed(2)} · ${cagrText}${volText}`
      : `AMFI #${cfg.schemeCode} · ${cagrText}`,
    category: 'MUTUAL_FUND',
    institution: detail?.fundHouse ?? 'AMFI Registered AMC',
    currency: 'INR',
    allocatedInBase: Math.round(amountInBase),
    expectedRatePct: Number(rate.toFixed(2)),
    schemeCode: cfg.schemeCode,
    navOrPrice: detail?.latestNav,
    gain30dPct:
      detail?.return30dPct !== null && detail?.return30dPct !== undefined
        ? Number(detail.return30dPct.toFixed(2))
        : undefined,
    taxTag: cfg.taxTag,
  };
}

function simulatePlanRisk(
  holdings: Holding[],
  baseCurrency: CurrencyCode,
  sourceHolding: Holding,
  moveAmountInBase: number,
  destinations: SuggestedDestination[],
  beforeRisk: ReturnType<typeof computePortfolioRiskScore>
) {
  const sourceVal = Math.max(0, convertCurrency(sourceHolding.currentValue, sourceHolding.currency, baseCurrency));
  const movedRatio = sourceVal > 0 ? Math.min(1, moveAmountInBase / sourceVal) : 0;

  const sim: Holding[] = [];
  holdings.forEach((h) => {
    if (h.id !== sourceHolding.id) {
      sim.push(h);
      return;
    }
    if (movedRatio < 0.995) {
      const remainRatio = 1 - movedRatio;
      sim.push({
        ...h,
        currentValue: h.currentValue * remainRatio,
        investedAmount: h.investedAmount * remainRatio,
      });
    }
  });

  destinations.forEach((dest, idx) => {
    if (dest.kind === 'HOME_LOAN' || dest.allocatedInBase <= 0) return;
    const valDest = convertCurrency(dest.allocatedInBase, baseCurrency, dest.currency);
    sim.push({
      id: `smart-sim-${idx}`,
      name: dest.title,
      category: dest.category ?? 'MUTUAL_FUND',
      institution: dest.institution ?? 'Market',
      investedAmount: valDest,
      currentValue: valDest,
      currency: dest.currency,
      interestRatePct: dest.expectedRatePct,
      purchaseDate: '2026-11-16',
      unrealizedGain: 0,
      unrealizedGainPct: 0,
      taxTag: dest.taxTag ?? 'LTCG_EQUITY',
    });
  });

  const afterRisk = computePortfolioRiskScore(sim, baseCurrency);
  return {
    riskBefore: beforeRisk.score,
    riskAfter: afterRisk.score,
    postureAfter: afterRisk.posture,
  };
}

/**
 * Generates concrete, actionable diversification & rebalance plans tailored to the
 * user's actual holdings, tax bracket, optional home loan, and live AMFI / US Treasury rates.
 */
export function generateSmartDiversificationPlans(
  holdings: Holding[],
  baseCurrency: CurrencyCode,
  prefs: SmartDiversificationPreferences,
  benchmarks: LiveMarketBenchmarks | null
): {
  analysis: AllocationProfileAnalysis;
  plans: SmartDiversificationPlan[];
} {
  const analysis = analyzeAllocationProfile(holdings, baseCurrency, prefs.goal);
  const plans: SmartDiversificationPlan[] = [];
  if (holdings.length === 0 || analysis.totalValuation <= 0) {
    return { analysis, plans };
  }

  const beforeRisk = computePortfolioRiskScore(holdings, baseCurrency);
  const taxMultiplier = 1 - prefs.taxSlabPct / 100;
  const isLive = Boolean(benchmarks && benchmarks.liveFundCount > 0);

  // Pick a flexible non-locked source holding (never lock-in EPF/PPF unless nothing else exists)
  const movableHoldings = [...holdings].sort((a, b) => {
    const score = (h: Holding) => {
      if (h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0)) return 4;
      if (h.category === 'SAVINGS_CASH') return 3;
      if (h.category === 'EPF' || h.category === 'PPF') return 0;
      return 2;
    };
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return (
      convertCurrency(b.currentValue, b.currency, baseCurrency) -
      convertCurrency(a.currentValue, a.currency, baseCurrency)
    );
  });

  // ---------------------------------------------------------------------------
  // PLAN 1: Guaranteed Home Loan Prepayment vs Post-Tax Deposit Yield Arbitrage
  // ---------------------------------------------------------------------------
  if (prefs.hasHomeLoan && prefs.homeLoanRatePct > 0 && prefs.homeLoanPrincipal > 0) {
    const loanSource =
      analysis.maturedHoldings[0] ??
      analysis.cashHoldings[0] ??
      movableHoldings.find((h) => h.category !== 'EPF' && h.category !== 'PPF');

    if (loanSource) {
      const sourceVal = convertCurrency(loanSource.currentValue, loanSource.currency, baseCurrency);
      const sourceGrossPct =
        loanSource.interestRatePct ?? (loanSource.category === 'SAVINGS_CASH' ? 3.5 : 7.0);
      const sourcePostTaxPct =
        loanSource.taxTag === 'TAX_EXEMPT_EEE'
          ? sourceGrossPct
          : Number((sourceGrossPct * taxMultiplier).toFixed(2));

      if (sourceVal >= 1000 && prefs.homeLoanRatePct > sourcePostTaxPct) {
        const isMat =
          loanSource.isMatured || (loanSource.daysToMaturity !== undefined && loanSource.daysToMaturity <= 0);
        const moveAmt = Math.round(sourceVal * (isMat ? 0.8 : 0.6));
        const prepayAmt = Math.min(prefs.homeLoanPrincipal, Math.round(moveAmt * 0.7));
        const remainderAmt = Math.max(0, moveAmt - prepayAmt);

        const impact = calculateHomeLoanPrepaymentImpact(
          prefs.homeLoanPrincipal,
          prefs.homeLoanRatePct,
          prefs.homeLoanYearsLeft * 12,
          prepayAmt
        );

        const destinations: SuggestedDestination[] = [
          {
            id: 'home-loan-prepay',
            kind: 'HOME_LOAN',
            title: 'Home Loan Principal Prepayment',
            subtitle: `${prefs.homeLoanRatePct.toFixed(2)}% tax-free return · Saves ${formatCurrency(impact.interestSaved, baseCurrency, { compact: true })} interest (${impact.monthsSaved} mos off)`,
            currency: baseCurrency,
            allocatedInBase: prepayAmt,
            loanRatePct: prefs.homeLoanRatePct,
            loanInterestSaved: impact.interestSaved,
            loanMonthsSaved: impact.monthsSaved,
          },
        ];

        if (remainderAmt > 500) {
          destinations.push(buildMfDestination('ARBITRAGE', remainderAmt, benchmarks));
        }

        const totalMoved = destinations.reduce((s, d) => s + d.allocatedInBase, 0);
        const risk = simulatePlanRisk(holdings, baseCurrency, loanSource, totalMoved, destinations, beforeRisk);

        plans.push({
          id: 'smart-loan-arbitrage',
          categoryLabel: 'Debt vs. Post-Tax Yield Arbitrage',
          title: `Retire ${formatCurrency(prepayAmt, baseCurrency, { compact: true })} Home Loan Principal`,
          rationale: `${loanSource.name} yields ~${sourcePostTaxPct.toFixed(1)}% after your ${prefs.taxSlabPct}% tax slab, while your home loan costs ${prefs.homeLoanRatePct.toFixed(2)}% tax-free (~${impact.preTaxEquivalent30Pct.toFixed(1)}% pre-tax equivalent). Shifting 70% to principal payoff and 30% to equity-taxed arbitrage locks in guaranteed wealth creation.`,
          sourceHolding: loanSource,
          moveAmountInBase: totalMoved,
          destinations,
          benefitSummary: `+${formatCurrency(impact.interestSaved, baseCurrency, { compact: true })} interest saved · ${impact.monthsSaved} mos shaved`,
          ...risk,
          isLiveApiBacked: isLive,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // PLAN 2: Eliminate Idle Cash Drag / Deploy Matured Deposits
  // ---------------------------------------------------------------------------
  const idleSource = analysis.maturedHoldings[0] ?? analysis.cashHoldings[0];
  if (idleSource) {
    const idleVal = convertCurrency(idleSource.currentValue, idleSource.currency, baseCurrency);
    const targetCashReserve = (analysis.totalValuation * analysis.targetPct.cash) / 100;
    const isMat =
      idleSource.isMatured || (idleSource.daysToMaturity !== undefined && idleSource.daysToMaturity <= 0);
    const excessAmount = isMat
      ? Math.round(idleVal)
      : Math.round(Math.max(idleVal * 0.65, idleVal - targetCashReserve));

    if (excessAmount >= 1000 && excessAmount <= idleVal + 1) {
      const safeMove = Math.min(Math.round(idleVal), excessAmount);
      const equityShare = analysis.gapPct.equity > 4 ? 0.4 : 0.25;
      const goldShare = analysis.gapPct.gold > 3 ? 0.2 : 0;
      const debtShare = 1 - equityShare - goldShare;

      const destinations: SuggestedDestination[] = [];
      const eqAmt = Math.round(safeMove * equityShare);
      const goldAmt = Math.round(safeMove * goldShare);
      const debtAmt = Math.max(0, safeMove - eqAmt - goldAmt);

      if (debtAmt > 0) {
        if (prefs.taxSlabPct >= 20) {
          destinations.push(buildMfDestination('ARBITRAGE', debtAmt, benchmarks));
        } else {
          const liveGsec =
            benchmarks?.indiaGsecs.find((g) => /7\.10%|6\.79%/i.test(g.name)) ??
            benchmarks?.indiaGsecs[0] ??
            LISTED_MARKET_INSTRUMENTS.find((m) => m.id === 'gb-rbi-frsb')!;
          destinations.push({
            id: liveGsec.id,
            kind: 'MARKET_INSTRUMENT',
            title: liveGsec.name,
            subtitle: `${liveGsec.issuer} · ${liveGsec.rateOrYieldPct}% p.a. (${liveGsec.tenureLabel})`,
            category: liveGsec.category,
            institution: liveGsec.issuer,
            currency: liveGsec.currency,
            allocatedInBase: debtAmt,
            expectedRatePct: liveGsec.rateOrYieldPct,
            tenureDays: liveGsec.tenureDays,
            taxTag: liveGsec.taxTag,
          });
        }
      }
      if (eqAmt > 0) {
        destinations.push(buildMfDestination('NIFTY50', eqAmt, benchmarks));
      }
      if (goldAmt > 0) {
        destinations.push(buildMfDestination('GOLD_FOF', goldAmt, benchmarks));
      }

      const risk = simulatePlanRisk(holdings, baseCurrency, idleSource, safeMove, destinations, beforeRisk);
      const eqRate = destinations.find((d) => d.schemeCode === 120716)?.expectedRatePct ?? 12.8;
      const gsecBenchRate = benchmarks?.indiaGsecs[0]?.rateOrYieldPct ?? 6.8;

      plans.push({
        id: 'smart-cash-drag',
        categoryLabel: isMat ? 'Matured Capital Re-Deployment' : 'Idle Cash Optimization',
        title: isMat
          ? `Deploy Matured ${idleSource.name}`
          : `Put ${formatCurrency(safeMove, baseCurrency, { compact: true })} Excess Savings to Work`,
        rationale: isMat
          ? `${idleSource.name} has already matured and stops compounding efficiently if left idle. Splitting across live market funds matches your ${TARGET_MIX_BY_GOAL[prefs.goal].label} profile.`
          : `Cash represents ${analysis.currentPct.cash}% of your portfolio vs. your ${analysis.targetPct.cash}% target. Moving the surplus into ${prefs.taxSlabPct >= 20 ? 'equity-taxed Arbitrage (12.5% LTCG vs ' + prefs.taxSlabPct + '% slab)' : `Live GoI Sovereign Bonds (~${gsecBenchRate.toFixed(2)}%)`} and Nifty 50 Index (~${eqRate.toFixed(1)}% 3Y CAGR) stops inflation erosion while keeping T+2 liquidity.`,
        sourceHolding: idleSource,
        moveAmountInBase: safeMove,
        destinations,
        benefitSummary: isMat
          ? 'Re-deploys matured deposit into ~8.5%–11% blended mix'
          : 'Replaces ~3.5% cash yield with ~8.5%–11% blended return',
        ...risk,
        isLiveApiBacked: isLive,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // PLAN 3: Trim Single-Holding Concentration (> 22%) into Underweight Buckets
  // ---------------------------------------------------------------------------
  if (
    analysis.topHolding &&
    analysis.topHolding.sharePct > 22 &&
    analysis.topHolding.holding.category !== 'EPF' &&
    analysis.topHolding.holding.category !== 'PPF'
  ) {
    const topH = analysis.topHolding.holding;
    const maxRecommended = analysis.totalValuation * 0.18;
    const trimAmt = Math.min(
      Math.round(analysis.topHolding.valInBase * 0.6),
      Math.max(0, Math.round(analysis.topHolding.valInBase - maxRecommended))
    );

    if (trimAmt >= 1000) {
      const needGold = analysis.gapPct.gold > 3;
      const needDebt = analysis.gapPct.debt > 4;
      const needEquity = analysis.gapPct.equity > 4;

      const destinations: SuggestedDestination[] = [];
      if (needGold && needDebt) {
        const gAmt = Math.round(trimAmt * 0.35);
        const dAmt = trimAmt - gAmt;
        destinations.push(buildMfDestination('GOLD_FOF', gAmt, benchmarks));
        destinations.push(buildMfDestination('CORP_BOND', dAmt, benchmarks));
      } else if (needDebt) {
        const gAmt = Math.round(trimAmt * 0.25);
        const dAmt = trimAmt - gAmt;
        destinations.push(buildMfDestination('GILT', dAmt, benchmarks));
        destinations.push(buildMfDestination('GOLD_FOF', gAmt, benchmarks));
      } else if (needEquity) {
        const eqAmt = Math.round(trimAmt * 0.7);
        const gAmt = trimAmt - eqAmt;
        destinations.push(buildMfDestination('FLEXI_CAP', eqAmt, benchmarks));
        destinations.push(buildMfDestination('GOLD_FOF', gAmt, benchmarks));
      } else {
        const half = Math.round(trimAmt * 0.5);
        destinations.push(buildMfDestination('NIFTY50', half, benchmarks));
        destinations.push(buildMfDestination('CORP_BOND', trimAmt - half, benchmarks));
      }

      const risk = simulatePlanRisk(holdings, baseCurrency, topH, trimAmt, destinations, beforeRisk);
      const newTopShare = Math.round(
        ((analysis.topHolding.valInBase - trimAmt) / analysis.totalValuation) * 100
      );

      plans.push({
        id: 'smart-concentration-trim',
        categoryLabel: 'Concentration Risk Reduction',
        title: `Trim ${topH.name} (${analysis.topHolding.sharePct}% → ${newTopShare}%)`,
        rationale: `${topH.name} currently accounts for ${analysis.topHolding.sharePct}% of your entire net worth (above the 20% single-instrument threshold). Rotating ${formatCurrency(trimAmt, baseCurrency, { compact: true })} into uncorrelated market funds lowers single-asset drawdown risk.`,
        sourceHolding: topH,
        moveAmountInBase: trimAmt,
        destinations,
        benefitSummary: `Single-holding share ${analysis.topHolding.sharePct}% → ${newTopShare}%`,
        ...risk,
        isLiveApiBacked: isLive,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // PLAN 4: Cross-Currency & Sovereign Hedge (if > 90% in one currency)
  // ---------------------------------------------------------------------------
  const liquidForFx =
    analysis.cashHoldings[0] ??
    movableHoldings.find((h) => h.category !== 'EPF' && h.category !== 'PPF');

  if (
    analysis.singleCurrencySharePct >= 90 &&
    analysis.dominantCurrency !== 'USD' &&
    liquidForFx &&
    benchmarks &&
    benchmarks.usTreasuries.length > 0
  ) {
    const srcVal = convertCurrency(liquidForFx.currentValue, liquidForFx.currency, baseCurrency);
    const fxMoveAmt = Math.round(Math.min(srcVal * 0.4, analysis.totalValuation * 0.12));

    if (fxMoveAmt >= 1000) {
      const treasury =
        benchmarks.usTreasuries.find((t) => /Notes|Bills/i.test(t.name)) ?? benchmarks.usTreasuries[0];
      const sp500 = LISTED_MARKET_INSTRUMENTS.find((m) => m.id === 'eq-voo-us')!;

      const tAmt = Math.round(fxMoveAmt * 0.5);
      const eqAmt = fxMoveAmt - tAmt;

      const destinations: SuggestedDestination[] = [
        {
          id: treasury.id,
          kind: 'MARKET_INSTRUMENT',
          title: treasury.name,
          subtitle: `${treasury.issuer} · ${treasury.rateOrYieldPct.toFixed(2)}% USD yield (${treasury.asOf})`,
          category: treasury.category,
          institution: treasury.issuer,
          currency: 'USD',
          allocatedInBase: tAmt,
          expectedRatePct: treasury.rateOrYieldPct,
          tenureDays: treasury.tenureDays,
          taxTag: treasury.taxTag,
        },
        {
          id: sp500.id,
          kind: 'MARKET_INSTRUMENT',
          title: sp500.name,
          subtitle: `${sp500.issuer} · USD S&P 500 diversification`,
          category: sp500.category,
          institution: sp500.issuer,
          currency: 'USD',
          allocatedInBase: eqAmt,
          expectedRatePct: sp500.rateOrYieldPct,
          taxTag: sp500.taxTag,
        },
      ];

      const risk = simulatePlanRisk(holdings, baseCurrency, liquidForFx, fxMoveAmt, destinations, beforeRisk);

      plans.push({
        id: 'smart-currency-hedge',
        categoryLabel: 'Global & Currency Diversification',
        title: `Add USD Sovereign + S&P 500 Hedge (${analysis.singleCurrencySharePct}% in ${analysis.dominantCurrency})`,
        rationale: `${analysis.singleCurrencySharePct}% of your portfolio is denominated in ${analysis.dominantCurrency}. Allocating ~${Math.round((fxMoveAmt / analysis.totalValuation) * 100)}% into live U.S. ${treasury.name.replace('US ', '')} (${treasury.rateOrYieldPct.toFixed(2)}% USD) and Vanguard VOO cushions domestic currency depreciation.`,
        sourceHolding: liquidForFx,
        moveAmountInBase: fxMoveAmt,
        destinations,
        benefitSummary: `Adds ${Math.round((fxMoveAmt / analysis.totalValuation) * 100)}% USD sovereign & global equity exposure`,
        ...risk,
        isLiveApiBacked: true,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // PLAN 5: Section 80CCD(1B) Live NPS Tier-I Tax-Shield Plan
  // ---------------------------------------------------------------------------
  const taxSection = computeTaxSectionAudit(holdings, baseCurrency);
  const npsSource =
    analysis.cashHoldings[0] ??
    analysis.maturedHoldings[0] ??
    movableHoldings.find((h) => h.category !== 'EPF' && h.category !== 'PPF' && h.category !== 'NPS');

  if (
    prefs.taxSlabPct >= 20 &&
    taxSection.nps80ccdShortfall > 1000 &&
    npsSource &&
    benchmarks &&
    benchmarks.npsSchemes.length > 0
  ) {
    const srcVal = convertCurrency(npsSource.currentValue, npsSource.currency, baseCurrency);
    const npsMove = Math.min(Math.round(srcVal * 0.5), Math.round(taxSection.nps80ccdShortfall));

    if (npsMove >= 1000) {
      const topEqNps =
        [...benchmarks.npsSchemes]
          .filter((s) => s.assetClass === 'E')
          .sort((a, b) => (b.cagr3yPct ?? 0) - (a.cagr3yPct ?? 0))[0] ?? benchmarks.npsSchemes[0];
      const topCorpNps =
        [...benchmarks.npsSchemes]
          .filter((s) => s.assetClass === 'C')
          .sort((a, b) => (b.cagr3yPct ?? 0) - (a.cagr3yPct ?? 0))[0];

      const eqShare = prefs.goal === 'CONSERVATIVE' ? 0.5 : 0.75;
      const eqAmt = topCorpNps ? Math.round(npsMove * eqShare) : npsMove;
      const corpAmt = topCorpNps ? npsMove - eqAmt : 0;

      const destinations: SuggestedDestination[] = [
        {
          id: `nps-${topEqNps.schemeCode}`,
          kind: 'CUSTOM_ASSET',
          title: topEqNps.schemeName,
          subtitle: `${topEqNps.pfmName} · NAV ₹${topEqNps.nav.toFixed(2)} · ${topEqNps.cagr3yPct?.toFixed(2) ?? '11.5'}% 3Y CAGR`,
          category: 'NPS',
          institution: topEqNps.pfmName,
          currency: 'INR',
          allocatedInBase: eqAmt,
          expectedRatePct: topEqNps.cagr3yPct ?? 11.5,
          navOrPrice: topEqNps.nav,
          taxTag: '80CCD',
        },
      ];

      if (topCorpNps && corpAmt > 0) {
        destinations.push({
          id: `nps-${topCorpNps.schemeCode}`,
          kind: 'CUSTOM_ASSET',
          title: topCorpNps.schemeName,
          subtitle: `${topCorpNps.pfmName} · NAV ₹${topCorpNps.nav.toFixed(2)} · ${topCorpNps.cagr3yPct?.toFixed(2) ?? '7.4'}% 3Y CAGR`,
          category: 'NPS',
          institution: topCorpNps.pfmName,
          currency: 'INR',
          allocatedInBase: corpAmt,
          expectedRatePct: topCorpNps.cagr3yPct ?? 7.4,
          navOrPrice: topCorpNps.nav,
          taxTag: '80CCD',
        });
      }

      const taxSaved = Math.round(npsMove * (prefs.taxSlabPct / 100));
      const risk = simulatePlanRisk(holdings, baseCurrency, npsSource, npsMove, destinations, beforeRisk);

      plans.push({
        id: 'smart-nps-80ccd',
        categoryLabel: 'Section 80CCD(1B) Live NPS Shield',
        title: `Allocate ${formatCurrency(npsMove, baseCurrency, { compact: true })} to Top-Ranked NPS Tier I`,
        rationale: `You have unused Section 80CCD(1B) NPS deduction room. Deploying into live ${topEqNps.schemeName} (${topEqNps.cagr3yPct?.toFixed(1) ?? '11.5'}% 3Y CAGR) saves ~${formatCurrency(taxSaved, baseCurrency, { compact: true })} in direct income tax at your ${prefs.taxSlabPct}% slab.`,
        sourceHolding: npsSource,
        moveAmountInBase: npsMove,
        destinations,
        benefitSummary: `Saves ~${formatCurrency(taxSaved, baseCurrency, { compact: true })} income tax · 80CCD(1B)`,
        ...risk,
        isLiveApiBacked: true,
      });
    }
  }

  return { analysis, plans };
}
