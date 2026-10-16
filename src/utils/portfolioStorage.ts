import { CurrencyCode, Holding, UserProfile } from '../types/wealth';
import { DEMO_PROFILES } from '../data/mockData';
import { withDerivedMaturity } from './maturity';

const STORAGE_KEY = 'vestora.portfolio.v1';

export interface PersistedPortfolio {
  profileId: string;
  baseCurrency: CurrencyCode;
  holdings: Holding[];
}

/** Sample holdings with maturity countdowns recomputed against today. */
export function sampleHoldingsFor(profile: UserProfile): Holding[] {
  return profile.holdings.map(withDerivedMaturity);
}

/**
 * Loads the persisted portfolio for this browser. Returns null when nothing
 * was saved (first visit) or the stored shape is unrecognized — callers then
 * fall back to sample data. Derived maturity fields are recomputed on load so
 * a portfolio reopened weeks later reflects the calendar, not the save date.
 */
export function loadPersistedPortfolio(): PersistedPortfolio | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPortfolio;
    const knownProfile = DEMO_PROFILES.some((p) => p.id === parsed.profileId);
    if (!knownProfile || !Array.isArray(parsed.holdings)) return null;
    return { ...parsed, holdings: parsed.holdings.map(withDerivedMaturity) };
  } catch {
    return null;
  }
}

/** Persists the portfolio; silently ignores private-mode quota failures. */
export function savePersistedPortfolio(portfolio: PersistedPortfolio): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
  } catch {
    // Storage unavailable (private mode / quota) — in-memory state still works.
  }
}

export function clearPersistedPortfolio(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
