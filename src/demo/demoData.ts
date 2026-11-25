import type { CurrencyCode, Holding } from '../types/wealth';
import { DEMO_PROFILES } from '../data/mockData';
import { convertCurrency } from '../utils/currency';
import { sampleHoldingsFor, type PersistedPortfolio } from '../utils/portfolioStorage';
import { fetchLiveMarketBenchmarks, type LiveMarketBenchmarks } from '../utils/smartDiversification';
import type { LoanInputs } from './splitEngine';

/** The full app's INR defaults for the Rebalance screen's home-loan comparison. */
export const DEFAULT_LOAN: LoanInputs = { principal: 4500000, ratePct: 8.55, yearsLeft: 15 };

export type BenchmarkStatus = 'loading' | 'live' | 'sample';

export interface DemoPortfolio {
  holdings: Holding[];
  baseCurrency: CurrencyCode;
  source: 'sample' | 'saved' | 'personal';
  /** Only known for the sample; saved and personal portfolios have no loan data and never get an invented one. */
  loan: LoanInputs | null;
}

function totalValue(holdings: Holding[], base: CurrencyCode): number {
  return holdings.reduce((sum, h) => sum + convertCurrency(h.currentValue, h.currency, base), 0);
}

/** Total value of a portfolio in its base currency; 0 when it has no holdings. */
export function portfolioTotal(p: { holdings: Holding[]; baseCurrency: CurrencyCode }): number {
  return totalValue(p.holdings, p.baseCurrency);
}

/** A portfolio the visitor built or imported in the demo itself. Never persisted, never given a loan. */
export function personalPortfolio(holdings: Holding[], baseCurrency: CurrencyCode): DemoPortfolio {
  return { holdings, baseCurrency, source: 'personal', loan: null };
}

/** The visitor's own saved portfolio when it has real value in it, otherwise the sample. */
export function pickPortfolio(persisted: PersistedPortfolio | null): DemoPortfolio {
  if (
    persisted &&
    persisted.mode === 'personal' &&
    Array.isArray(persisted.holdings) &&
    totalValue(persisted.holdings, persisted.baseCurrency) > 0
  ) {
    return {
      holdings: persisted.holdings,
      baseCurrency: persisted.baseCurrency,
      source: 'saved',
      loan: null,
    };
  }
  const profile = DEMO_PROFILES[0];
  return {
    holdings: sampleHoldingsFor(profile),
    baseCurrency: profile.baseCurrency,
    source: 'sample',
    loan: DEFAULT_LOAN,
  };
}

export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Live benchmark snapshot, or null when it fails or takes longer than `ms`. */
export function loadBenchmarks(
  ms = 4000,
  fetcher: () => Promise<LiveMarketBenchmarks> = fetchLiveMarketBenchmarks
): Promise<LiveMarketBenchmarks | null> {
  return withTimeout(
    fetcher().catch(() => null),
    ms,
    null
  );
}
