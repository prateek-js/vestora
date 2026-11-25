import { AssetCategory, CurrencyCode, Holding } from '../types/wealth';
import { convertCurrency } from './currency';
import {
  computePortfolioRiskScore,
  getHolding30DayGainPct,
  PortfolioRiskScore,
} from './taxAndDiversification';

export interface PortfolioTrendPoint {
  month: string;
  fullDate: string;
  valuation: number;
  invested: number;
  unrealizedGain: number;
  gainPct: number;
  isCurrent: boolean;
}

export interface MomGrowthPoint {
  month: string;
  fullDate: string;
  netGrowth: number;
  netGrowthPct: number;
  capitalFlow: number;
  marketGain: number;
  endingValuation: number;
}

export interface CategoryAllocationItem {
  key: AssetCategory;
  label: string;
  shortLabel: string;
  color: string;
  value: number;
  count: number;
  pct: number;
}

/* Darkened same-family hues: every value clears 4.5:1 as small text on Paper (the donut's
   hovered-slice centre label reuses these colours as text, OverviewTab) and 3:1 as a slice
   fill. 11-way distinctness preserved (min pairwise ΔE 14.4, vs 10.6 in the old set). */
export const CATEGORY_META: Record<
  AssetCategory,
  { label: string; shortLabel: string; color: string }
> = {
  MUTUAL_FUND: { label: 'Mutual Funds', shortLabel: 'Mutual Funds', color: '#4f46e5' },
  EQUITY_STOCK: { label: 'Direct Equities', shortLabel: 'Equities', color: '#7c3aed' },
  FIXED_DEPOSIT: { label: 'Fixed Deposits', shortLabel: 'Fixed Deposits', color: '#0369a1' },
  RECURRING_DEPOSIT: { label: 'Recurring Deposits', shortLabel: 'Recurring Dep.', color: '#1e40af' },
  CORP_BOND: { label: 'Corporate Bonds', shortLabel: 'Corp Bonds', color: '#0e7490' },
  GOVT_BOND: { label: 'Govt Bonds (G-Sec)', shortLabel: 'Govt Bonds', color: '#0f766e' },
  SOVEREIGN_GOLD_BOND: { label: 'Gold / SGB', shortLabel: 'Gold / SGB', color: '#b45309' },
  EPF: { label: 'EPF Retirement', shortLabel: 'EPF', color: '#047857' },
  PPF: { label: 'PPF Tax-Free', shortLabel: 'PPF', color: '#064e3b' },
  NPS: { label: 'NPS Pension', shortLabel: 'NPS', color: '#4d7c0f' },
  SAVINGS_CASH: { label: 'Savings & Cash', shortLabel: 'Cash', color: '#64748b' },
};

const MONTHLY_PROFILES = [
  { month: 'Dec 25', fullDate: 'December 2025', valMult: 0.835, invMult: 0.88 },
  { month: 'Jan 26', fullDate: 'January 2026', valMult: 0.852, invMult: 0.892 },
  { month: 'Feb 26', fullDate: 'February 2026', valMult: 0.844, invMult: 0.905 },
  { month: 'Mar 26', fullDate: 'March 2026', valMult: 0.868, invMult: 0.915 },
  { month: 'Apr 26', fullDate: 'April 2026', valMult: 0.895, invMult: 0.93 },
  { month: 'May 26', fullDate: 'May 2026', valMult: 0.887, invMult: 0.942 },
  { month: 'Jun 26', fullDate: 'June 2026', valMult: 0.918, invMult: 0.952 },
  { month: 'Jul 26', fullDate: 'July 2026', valMult: 0.94, invMult: 0.965 },
  { month: 'Aug 26', fullDate: 'August 2026', valMult: 0.931, invMult: 0.975 },
  { month: 'Sep 26', fullDate: 'September 2026', valMult: 0.962, invMult: 0.985 },
  { month: 'Oct 26', fullDate: 'October 2026', valMult: 0.981, invMult: 0.992 },
  { month: 'Nov 26', fullDate: 'November 2026 (Current)', valMult: 1.0, invMult: 1.0 },
];

export function buildPortfolioTrendSeries(
  totalValuation: number,
  totalInvested: number
): PortfolioTrendPoint[] {
  return MONTHLY_PROFILES.map((item, idx) => {
    const valuation = Math.round(totalValuation * item.valMult);
    const invested = Math.round(totalInvested * item.invMult);
    const unrealizedGain = valuation - invested;
    const gainPct = invested > 0 ? (unrealizedGain / invested) * 100 : 0;
    return {
      month: item.month,
      fullDate: item.fullDate,
      valuation,
      invested,
      unrealizedGain,
      gainPct,
      isCurrent: idx === MONTHLY_PROFILES.length - 1,
    };
  });
}

export function buildMomGrowthSeries(trendData: PortfolioTrendPoint[]): MomGrowthPoint[] {
  const points: MomGrowthPoint[] = [];
  for (let i = 1; i < trendData.length; i++) {
    const prev = trendData[i - 1];
    const curr = trendData[i];
    const netGrowth = curr.valuation - prev.valuation;
    const netGrowthPct = prev.valuation > 0 ? (netGrowth / prev.valuation) * 100 : 0;
    const capitalFlow = curr.invested - prev.invested;
    const marketGain = netGrowth - capitalFlow;
    points.push({
      month: curr.month,
      fullDate: curr.fullDate,
      netGrowth,
      netGrowthPct,
      capitalFlow,
      marketGain,
      endingValuation: curr.valuation,
    });
  }
  return points;
}

export interface PortfolioSummaryMetrics {
  totalValuation: number;
  totalInvested: number;
  totalGain: number;
  totalGainPct: number;
  weightedYieldPct: number | null;
  thirtyDayChangeAmount: number;
  thirtyDayChangePct: number;
  trendData: PortfolioTrendPoint[];
  momData: MomGrowthPoint[];
  avgMonthlyGrowth: number;
  positiveMonths: number;
  bestMonth: MomGrowthPoint | null;
  maturedHoldings: Holding[];
  maturingSoonHoldings: Holding[];
  totalMaturedAmount: number;
  categoryBreakdown: CategoryAllocationItem[];
  riskScore: PortfolioRiskScore;
  surgeHoldings30d: { holding: Holding; gain30d: number }[];
}

export function computePortfolioSummaryMetrics(
  holdings: Holding[],
  baseCurrency: CurrencyCode
): PortfolioSummaryMetrics {
  const totalValuation = holdings.reduce(
    (sum, h) => sum + convertCurrency(h.currentValue, h.currency, baseCurrency),
    0
  );
  const totalInvested = holdings.reduce(
    (sum, h) => sum + convertCurrency(h.investedAmount, h.currency, baseCurrency),
    0
  );
  const totalGain = totalValuation - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  let fixedIncomeValue = 0;
  let fixedIncomeWeightedRate = 0;
  holdings.forEach((h) => {
    if (typeof h.interestRatePct === 'number' && Number.isFinite(h.interestRatePct)) {
      const val = convertCurrency(h.currentValue, h.currency, baseCurrency);
      fixedIncomeValue += val;
      fixedIncomeWeightedRate += val * h.interestRatePct;
    }
  });
  const weightedYieldPct =
    fixedIncomeValue > 0 ? fixedIncomeWeightedRate / fixedIncomeValue : null;

  const trendData = buildPortfolioTrendSeries(totalValuation, totalInvested);
  const momData = buildMomGrowthSeries(trendData);

  let thirtyDayChangeAmount = 0;
  let thirtyDayChangePct = 0;
  if (trendData.length >= 2 && totalValuation > 0) {
    const prevVal = trendData[trendData.length - 2].valuation;
    const currVal = trendData[trendData.length - 1].valuation;
    thirtyDayChangeAmount = currVal - prevVal;
    thirtyDayChangePct = prevVal > 0 ? (thirtyDayChangeAmount / prevVal) * 100 : 0;
  }

  const avgMonthlyGrowth =
    momData.length > 0 && totalValuation > 0
      ? Math.round(momData.reduce((acc, p) => acc + p.netGrowth, 0) / momData.length)
      : 0;
  const positiveMonths =
    totalValuation > 0 ? momData.filter((p) => p.netGrowth >= 0).length : 0;
  const bestMonth =
    momData.length > 0 && totalValuation > 0
      ? momData.reduce((best, curr) => (curr.netGrowth > best.netGrowth ? curr : best))
      : null;

  const maturedHoldings = holdings.filter(
    (h) => h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0)
  );
  const maturingSoonHoldings = holdings.filter(
    (h) =>
      !h.isMatured &&
      h.daysToMaturity !== undefined &&
      h.daysToMaturity > 0 &&
      h.daysToMaturity <= 30
  );
  const totalMaturedAmount = maturedHoldings.reduce(
    (sum, h) => sum + convertCurrency(h.currentValue, h.currency, baseCurrency),
    0
  );

  const catMap = new Map<AssetCategory, { value: number; count: number }>();
  holdings.forEach((h) => {
    const val = convertCurrency(h.currentValue, h.currency, baseCurrency);
    const prev = catMap.get(h.category);
    if (prev) {
      prev.value += val;
      prev.count += 1;
    } else {
      catMap.set(h.category, { value: val, count: 1 });
    }
  });

  const categoryBreakdown: CategoryAllocationItem[] = Array.from(catMap.entries())
    .filter(([, item]) => item.value > 0)
    .map(([key, item]) => {
      const meta = CATEGORY_META[key] || {
        label: key.replace(/_/g, ' '),
        shortLabel: key.replace(/_/g, ' '),
        color: '#94a3b8',
      };
      return {
        key,
        label: meta.label,
        shortLabel: meta.shortLabel,
        color: meta.color,
        value: item.value,
        count: item.count,
        pct: totalValuation > 0 ? (item.value / totalValuation) * 100 : 0,
      };
    })
    .sort((a, b) => b.value - a.value);

  const riskScore = computePortfolioRiskScore(holdings, baseCurrency);

  const surgeHoldings30d = holdings
    .map((h) => ({ holding: h, gain30d: getHolding30DayGainPct(h) }))
    .filter(
      (item): item is { holding: Holding; gain30d: number } =>
        item.gain30d !== undefined && item.gain30d > 15
    )
    .sort((a, b) => b.gain30d - a.gain30d);

  return {
    totalValuation,
    totalInvested,
    totalGain,
    totalGainPct,
    weightedYieldPct,
    thirtyDayChangeAmount,
    thirtyDayChangePct,
    trendData,
    momData,
    avgMonthlyGrowth,
    positiveMonths,
    bestMonth,
    maturedHoldings,
    maturingSoonHoldings,
    totalMaturedAmount,
    categoryBreakdown,
    riskScore,
    surgeHoldings30d,
  };
}
