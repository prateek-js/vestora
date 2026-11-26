import type { AssetCategory, CurrencyCode, Holding } from '../types/wealth';
import { convertCurrency } from '../utils/currency';
import {
  AMFI_BENCHMARK_CONFIG,
  type BenchmarkKey,
  type LiveMarketBenchmarks,
} from '../utils/smartDiversification';

type BenchmarkId = BenchmarkKey['id'];

/** Plain-language group each benchmark stands for, so a holding is never shown against itself. */
const BENCHMARK_LABEL: Record<BenchmarkId, string> = {
  NIFTY50: 'the Nifty 50 index',
  FLEXI_CAP: 'flexi-cap funds',
  ARBITRAGE: 'arbitrage funds',
  LIQUID: 'liquid funds',
  CORP_BOND: 'corporate bond funds',
  GILT: 'government bond funds',
  GOLD_FOF: 'gold funds',
};

export interface BenchmarkRow {
  holding: Holding;
  benchmarkId: BenchmarkId;
  /** The specific fund the yield is read from. */
  benchmarkName: string;
  /** What to call the benchmark in a sentence. */
  benchmarkLabel: string;
  holdingPct: number;
  benchmarkPct: number;
  deltaPct: number;
}

/** Categories whose own stated rate is the honest "return" to compare. */
const RATE_CATEGORIES: AssetCategory[] = [
  'FIXED_DEPOSIT',
  'RECURRING_DEPOSIT',
  'CORP_BOND',
  'GOVT_BOND',
  'SAVINGS_CASH',
];

/** Under a year, compounding a short gain into a yearly rate turns noise into a headline, so we do not compare. */
const MIN_HOLDING_DAYS = 365;
const DAY_MS = 86_400_000;

/** Which benchmark is an honest yardstick for this holding, or null when none is. */
export function benchmarkIdFor(h: Holding): BenchmarkId | null {
  switch (h.category) {
    case 'EPF':
    case 'PPF':
    case 'NPS':
      return null;
    case 'EQUITY_STOCK':
      return h.listedVenue === 'FOREIGN' ? null : 'NIFTY50';
    case 'SOVEREIGN_GOLD_BOND':
      return 'GOLD_FOF';
    case 'CORP_BOND':
      return 'CORP_BOND';
    case 'GOVT_BOND':
      return 'GILT';
    case 'FIXED_DEPOSIT':
    case 'RECURRING_DEPOSIT':
    case 'SAVINGS_CASH':
      return 'LIQUID';
    case 'MUTUAL_FUND': {
      const name = h.name.toLowerCase();
      if (/nifty|index/.test(name)) return 'NIFTY50';
      if (/arbitrage/.test(name)) return 'ARBITRAGE';
      if (/liquid/.test(name)) return 'LIQUID';
      if (/gilt/.test(name)) return 'GILT';
      if (/gold/.test(name)) return 'GOLD_FOF';
      if (/corporate|bond|debt/.test(name)) return 'CORP_BOND';
      return 'FLEXI_CAP';
    }
  }
}

/** Yearly return for a holding: its stated rate for deposits and bonds, otherwise compounded price return. */
export function annualisedReturnPct(h: Holding, todayIso: string): number | null {
  if (RATE_CATEGORIES.includes(h.category) && h.interestRatePct !== undefined) {
    return h.interestRatePct;
  }
  if (h.investedAmount <= 0 || h.currentValue <= 0) return null;
  const days = (Date.parse(todayIso) - Date.parse(h.purchaseDate)) / DAY_MS;
  if (!Number.isFinite(days) || days < MIN_HOLDING_DAYS) return null;
  return (Math.pow(h.currentValue / h.investedAmount, 365 / days) - 1) * 100;
}

/** Live 3-year CAGR if we have it, else 1-year, else the stored fallback yield. */
export function benchmarkYieldPct(id: BenchmarkId, benchmarks: LiveMarketBenchmarks | null): number {
  const detail = benchmarks?.funds[id];
  const fallback = AMFI_BENCHMARK_CONFIG.find((c) => c.id === id)!.fallbackYieldPct;
  return detail?.cagr3yPct ?? detail?.cagr1yPct ?? fallback;
}

export function buildBenchmarkRows(
  holdings: Holding[],
  baseCurrency: CurrencyCode,
  benchmarks: LiveMarketBenchmarks | null,
  todayIso: string,
  limit = 6
): { rows: BenchmarkRow[]; unbenchmarked: Holding[] } {
  const candidates: { row: BenchmarkRow; value: number }[] = [];
  const unbenchmarked: Holding[] = [];

  for (const holding of holdings) {
    const benchmarkId = benchmarkIdFor(holding);
    const holdingPct = annualisedReturnPct(holding, todayIso);
    if (!benchmarkId || holdingPct === null) {
      unbenchmarked.push(holding);
      continue;
    }
    const benchmarkPct = benchmarkYieldPct(benchmarkId, benchmarks);
    candidates.push({
      value: convertCurrency(holding.currentValue, holding.currency, baseCurrency),
      row: {
        holding,
        benchmarkId,
        benchmarkName: AMFI_BENCHMARK_CONFIG.find((c) => c.id === benchmarkId)!.shortName,
        benchmarkLabel: BENCHMARK_LABEL[benchmarkId],
        holdingPct,
        benchmarkPct,
        deltaPct: holdingPct - benchmarkPct,
      },
    });
  }

  candidates.sort((a, b) => b.value - a.value);
  return { rows: candidates.slice(0, limit).map((c) => c.row), unbenchmarked };
}
