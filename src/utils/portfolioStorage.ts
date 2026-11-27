import { CurrencyCode, DebtPrepaymentRecord, Holding, UserProfile } from '../types/wealth';
import { DEMO_PROFILES } from '../data/mockData';
import { withDerivedMaturity } from './maturity';

const STORAGE_KEY = 'vestora.portfolio.v1';

// Personas removed from DEMO_PROFILES; kept here so a returning visitor whose
// saved portfolio was stored under one of these ids still loads their data.
const LEGACY_PROFILE_IDS = ['profile-growth-builder', 'profile-conservative'];

export interface PersistedPortfolio {
  profileId: string;
  baseCurrency: CurrencyCode;
  holdings: Holding[];
  mode?: 'demo' | 'personal';
  prepayments?: DebtPrepaymentRecord[];
}

/** Sample holdings with maturity countdowns recomputed against today. */
export function sampleHoldingsFor(profile: UserProfile): Holding[] {
  return profile.holdings.map(withDerivedMaturity);
}

/**
 * The pinned re-denomination rate: 86.50 INR per USD — the benchmark rate the
 * app displayed before multi-currency support was removed. Every saved
 * foreign-denominated figure is re-denominated at this single rate on
 * load/restore, so a returning visitor's numbers match what they saw
 * (38,500 USD × 86.50 = the ₹33,30,250 the app already showed for h-106).
 * The sample's only foreign holding was USD; one pinned rate keeps the
 * migration rule a single honest number.
 */
export const RENORM_RATE = 86.5;

/**
 * Maps any non-INR holding to INR: amounts × RENORM_RATE, currency INR,
 * listedVenue FOREIGN (its benchmark rows were already foreign-denied by
 * currency before, so the venue marker preserves that behaviour). INR
 * holdings pass through untouched — no listedVenue is invented for them.
 */
export function renormaliseHolding(h: Holding): Holding {
  if (h.currency === 'INR') return h;
  return {
    ...h,
    investedAmount: h.investedAmount * RENORM_RATE,
    currentValue: h.currentValue * RENORM_RATE,
    unrealizedGain: h.unrealizedGain * RENORM_RATE,
    currency: 'INR',
    listedVenue: 'FOREIGN',
  };
}

/**
 * Legacy prepayment records were written with `currency` set to the
 * then-active display base; their amounts are in that currency. Same rule as
 * holdings: non-INR figures re-denominate at the pinned rate, INR passes
 * through. Month counts are denomination-free.
 */
function renormalisePrepayment(p: DebtPrepaymentRecord): DebtPrepaymentRecord {
  if (p.currency === 'INR') return p;
  return {
    ...p,
    amountInBase: p.amountInBase * RENORM_RATE,
    interestSaved: p.interestSaved * RENORM_RATE,
    currency: 'INR',
  };
}

/**
 * Loads the persisted portfolio for this browser. Returns null when nothing
 * was saved (first visit) or the stored shape is unrecognized — callers then
 * fall back to sample data. Derived maturity fields are recomputed on load so
 * a portfolio reopened weeks later reflects the calendar, not the save date.
 * Holdings (and legacy prepayment records) saved before Vestora was INR-only
 * re-denominate to INR at the pinned rate on load; the loaded state is always INR.
 */
export function loadPersistedPortfolio(): PersistedPortfolio | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPortfolio;
    const knownProfile =
      DEMO_PROFILES.some((p) => p.id === parsed.profileId) ||
      parsed.profileId === 'custom' ||
      LEGACY_PROFILE_IDS.includes(parsed.profileId);
    if (!knownProfile || !Array.isArray(parsed.holdings)) return null;
    return {
      ...parsed,
      baseCurrency: 'INR',
      mode: parsed.mode ?? (parsed.profileId === 'custom' ? 'personal' : 'demo'),
      holdings: parsed.holdings.map(renormaliseHolding).map(withDerivedMaturity),
      prepayments: Array.isArray(parsed.prepayments)
        ? parsed.prepayments.map(renormalisePrepayment)
        : [],
    };
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
