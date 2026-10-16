import { Holding } from '../types/wealth';
import { trackEvent } from './analytics';

const MFAPI_BASE = 'https://api.mfapi.in/mf';
const MFAPI_SEARCH = 'https://api.mfapi.in/mf/search';

export interface NavQuote {
  schemeCode: number;
  schemeName: string;
  nav: number;
  /** NAV date as DD-MM-YYYY (mfapi's native format). */
  navDate: string;
}

export interface NavRefreshOutcome {
  updatedHoldings: Holding[];
  /** Funds that resolved and updated. */
  updated: { id: string; name: string; oldNav: number | null; nav: number; navDate: string }[];
  /** Funds whose schemeCode no longer resolved (delisted, typo, etc.). */
  failed: { id: string; name: string; reason: string }[];
  /** Holdings with no schemeCode — need one-time fund search mapping. */
  unmapped: { id: string; name: string }[];
}

function parseNavDate(ddmmyyyy: string): Date {
  const [d, m, y] = ddmmyyyy.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isMutualFund(h: Holding): boolean {
  return h.category === 'MUTUAL_FUND';
}

/** Fetches the latest NAV for one scheme. Returns null if unreachable. */
async function fetchLatestNav(schemeCode: number): Promise<NavQuote | null> {
  try {
    const res = await fetch(`${MFAPI_BASE}/${schemeCode}/latest`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      meta: { scheme_code: number; scheme_name: string };
      data: { date: string; nav: string }[];
    };
    const latest = json.data?.[0];
    if (!latest) return null;
    return {
      schemeCode: json.meta.scheme_code,
      schemeName: json.meta.scheme_name,
      nav: parseFloat(latest.nav),
      navDate: latest.date,
    };
  } catch {
    return null;
  }
}

/** mfapi scheme search: exact-ish match against AMFI scheme names. */
export async function searchFunds(query: string): Promise<{ schemeCode: number; schemeName: string }[]> {
  try {
    const res = await fetch(`${MFAPI_SEARCH}?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { schemeCode: number; schemeName: string }[];
    return Array.isArray(json) ? json.slice(0, 12) : [];
  } catch {
    return [];
  }
}

/**
 * Refreshes mutual fund valuations from live AMFI NAVs (mfapi.in, keyless).
 *
 * First refresh adopts the holding's current valuation as units at today's
 * NAV (units = value ÷ NAV) — from then on the valuation moves with the
 * published NAV, which is exactly how a folio behaves between transactions.
 * Holdings without a schemeCode are reported as `unmapped` so the UI can
 * offer one-time fund-search mapping rather than being silently skipped.
 */
export async function refreshMutualFundNavs(holdings: Holding[]): Promise<NavRefreshOutcome> {
  const funds = holdings.filter(isMutualFund);
  const updated: NavRefreshOutcome['updated'] = [];
  const failed: NavRefreshOutcome['failed'] = [];
  const unmapped: NavRefreshOutcome['unmapped'] = [];
  const updatedHoldings = [...holdings];

  for (const fund of funds) {
    if (!fund.schemeCode) {
      unmapped.push({ id: fund.id, name: fund.name });
      continue;
    }

    const quote = await fetchLatestNav(fund.schemeCode);
    if (!quote || !Number.isFinite(quote.nav) || quote.nav <= 0) {
      failed.push({ id: fund.id, name: fund.name, reason: 'Could not reach NAV source or scheme not found' });
      continue;
    }

    const idx = updatedHoldings.findIndex((h) => h.id === fund.id);
    if (idx === -1) continue;

    const current = updatedHoldings[idx];
    const invested = current.investedAmount;

    // Adopt units on first refresh; preserve them on subsequent refreshes.
    const units = current.units && current.units > 0
      ? current.units
      : current.currentValue / quote.nav;

    const newValue = units * quote.nav;
    const oldNav = current.navOrPrice ?? null;

    updatedHoldings[idx] = {
      ...current,
      units,
      currentValue: newValue,
      navOrPrice: quote.nav,
      unrealizedGain: newValue - invested,
      unrealizedGainPct: invested > 0 ? ((newValue - invested) / invested) * 100 : 0,
    };

    updated.push({ id: current.id, name: current.name, oldNav, nav: quote.nav, navDate: quote.navDate });
  }

  if (updated.length > 0 || failed.length > 0 || unmapped.length > 0) {
    trackEvent('nav_refresh_completed', {
      updated: updated.length,
      failed: failed.length,
      unmapped: unmapped.length,
    });
  }

  return { updatedHoldings, updated, failed, unmapped };
}
