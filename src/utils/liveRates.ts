import { CurrencyCode } from '../types/wealth';
import { FX_RATES } from './currency';
import { trackEvent } from './analytics';

const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR,EUR';
const RATES_CACHE_KEY = 'vestora.fxCache.v1';
const RATES_TTL_MS = 6 * 60 * 60 * 1000; // 6h — ECB daily fixes change once a day

export interface LiveFxState {
  /** Live cross rates; null until first successful fetch. */
  rates: Record<CurrencyCode, Record<CurrencyCode, number>> | null;
  /** ISO date of the FX fix, e.g. "2026-10-15". */
  asOf: string | null;
  fetchedAt: number | null;
  /** 'live' = fresh fetch, 'cached' = served from localStorage, 'benchmark' = fallback. */
  source: 'live' | 'cached' | 'benchmark';
}

interface CacheEntry {
  usdPerInr: number;
  usdPerEur: number;
  date: string;
  fetchedAt: number;
}

function buildRates(usdPerInr: number, usdPerEur: number): Record<CurrencyCode, Record<CurrencyCode, number>> {
  return {
    INR: { INR: 1, USD: 1 / usdPerInr, EUR: usdPerEur / usdPerInr },
    USD: { INR: usdPerInr, USD: 1, EUR: usdPerEur },
    EUR: { INR: usdPerInr / usdPerEur, USD: 1 / usdPerEur, EUR: 1 },
  };
}

function cacheRates(entry: CacheEntry): void {
  try {
    window.localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Private mode — live rates still work for the session.
  }
}

function readCachedRates(): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(RATES_CACHE_KEY) as string | null;
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (
      typeof entry.usdPerInr === 'number' &&
      typeof entry.usdPerEur === 'number' &&
      typeof entry.date === 'string' &&
      typeof entry.fetchedAt === 'number'
    ) {
      return entry;
    }
  } catch {
    // Corrupt cache — ignore.
  }
  return null;
}

/**
 * Fetches live USD→INR/EUR fixes from Frankfurter (ECB data, CORS-open,
 * keyless). Refreshes at most once per TTL from localStorage cache; falls
 * back to cache when offline, then to the static benchmark rates. Never
 * throws.
 */
export async function refreshFxRates(): Promise<LiveFxState> {
  const cached = readCachedRates();

  if (cached && Date.now() - cached.fetchedAt < RATES_TTL_MS) {
    Object.assign(FX_RATES, buildRates(cached.usdPerInr, cached.usdPerEur));
    return {
      rates: { ...FX_RATES },
      asOf: cached.date,
      fetchedAt: cached.fetchedAt,
      source: 'cached',
    };
  }

  try {
    const res = await fetch(FRANKFURTER_URL);
    if (res.ok) {
      const json = (await res.json()) as {
        date: string;
        rates: { INR: number; EUR: number };
      };
      const usdPerInr = json.rates.INR;
      const usdPerEur = json.rates.EUR;
      if (usdPerInr > 0 && usdPerEur > 0) {
        cacheRates({ usdPerInr, usdPerEur, date: json.date, fetchedAt: Date.now() });
        Object.assign(FX_RATES, buildRates(usdPerInr, usdPerEur));
        trackEvent('fx_rates_refreshed', { as_of: json.date, source: 'live' });
        return { rates: { ...FX_RATES }, asOf: json.date, fetchedAt: Date.now(), source: 'live' };
      }
    }
  } catch {
    // Offline or API unavailable — fall through to cache/benchmark.
  }

  if (cached) {
    // Stale cache is still better than the hardcoded benchmark.
    Object.assign(FX_RATES, buildRates(cached.usdPerInr, cached.usdPerEur));
    return { rates: { ...FX_RATES }, asOf: cached.date, fetchedAt: cached.fetchedAt, source: 'cached' };
  }

  return { rates: null, asOf: null, fetchedAt: null, source: 'benchmark' };
}
