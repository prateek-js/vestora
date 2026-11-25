import type { AssetCategory, CurrencyCode, Holding, TaxTag } from '../types/wealth';
import { daysBetween, todayIso } from '../utils/maturity.ts';

/** What the hand-entry form holds while typing: every field is plain text. */
export interface HoldingDraft {
  name: string;
  category: AssetCategory;
  institution: string;
  investedAmount: string;
  currentValue: string;
  currency: CurrencyCode;
  interestRatePct: string;
  purchaseDate: string;
  maturityDate: string;
  notes: string;
}

/** The simple kinds of holding the demo's form offers. */
export const STARTER_CATEGORIES: { label: string; category: AssetCategory }[] = [
  { label: 'Mutual fund', category: 'MUTUAL_FUND' },
  { label: 'Fixed deposit', category: 'FIXED_DEPOSIT' },
  { label: 'Savings account', category: 'SAVINGS_CASH' },
];

export function emptyDraft(category: AssetCategory, currency: CurrencyCode): HoldingDraft {
  return {
    name: '',
    category,
    institution: '',
    investedAmount: '',
    currentValue: '',
    currency,
    interestRatePct: '',
    purchaseDate: todayIso(),
    maturityDate: '',
    notes: '',
  };
}

export function draftFromHolding(h: Holding): HoldingDraft {
  return {
    name: h.name,
    category: h.category,
    institution: h.institution ?? '',
    investedAmount: String(h.investedAmount),
    currentValue: String(h.currentValue),
    currency: h.currency,
    interestRatePct: h.interestRatePct !== undefined ? String(h.interestRatePct) : '',
    purchaseDate: h.purchaseDate || todayIso(),
    maturityDate: h.maturityDate ?? '',
    notes: h.notes ?? '',
  };
}

export function defaultTaxTag(category: AssetCategory): TaxTag {
  switch (category) {
    case 'MUTUAL_FUND':
    case 'EQUITY_STOCK':
      return 'LTCG_EQUITY';
    case 'PPF':
    case 'EPF':
      return 'TAX_EXEMPT_EEE';
    case 'NPS':
      return '80CCD';
    default:
      return 'SLAB_INCOME';
  }
}

const PLAIN_NUMBER = /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/**
 * Reads a typed number strictly: thousands commas are ignored, but the rest
 * must be a plain decimal (so "100abc", "0x10" and "Infinity" are refused).
 * Returns undefined for anything that is not a finite number.
 */
function parseAmount(text: string): number | undefined {
  const cleaned = text.trim().replace(/,/g, '');
  if (!PLAIN_NUMBER.test(cleaned)) return undefined;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return undefined;
  return value === 0 ? 0 : value; // turns -0 into 0
}

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

function newId(): string {
  const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return `h-custom-${Date.now()}-${suffix}`;
}

/** Checks the draft with the same rules and wording as the full app's Add Holding form. */
export function holdingFromDraft(
  draft: HoldingDraft,
  existing?: Holding,
): { ok: true; holding: Holding } | { ok: false; error: string } {
  if (!draft.name.trim()) {
    return { ok: false, error: 'Please provide a name for the investment.' };
  }
  const inv = parseAmount(draft.investedAmount);
  const currVal = parseAmount(draft.currentValue);
  if (inv === undefined || inv <= 0) {
    return { ok: false, error: 'Please enter a valid invested amount.' };
  }
  if (currVal === undefined || currVal < 0) {
    return { ok: false, error: 'Please enter a valid current valuation.' };
  }
  const parsedRate = draft.interestRatePct.trim() ? parseAmount(draft.interestRatePct) : undefined;
  if (draft.interestRatePct.trim() && parsedRate === undefined) {
    return { ok: false, error: 'Please enter a valid annual rate %.' };
  }
  if (draft.maturityDate && !isRealDate(draft.maturityDate)) {
    return { ok: false, error: 'Please enter a valid maturity date.' };
  }

  const unrealizedGain = Number((currVal - inv).toFixed(2));
  const unrealizedGainPct = Number(((unrealizedGain / inv) * 100).toFixed(2));

  let daysToMaturity: number | undefined;
  let isMatured = false;
  if (draft.maturityDate) {
    daysToMaturity = daysBetween(todayIso(), draft.maturityDate);
    isMatured = daysToMaturity <= 0;
  }

  // Editing keeps the tag already on the holding unless the category changed.
  const taxTag =
    existing && existing.category === draft.category ? existing.taxTag : defaultTaxTag(draft.category);

  const holding: Holding = {
    ...(existing ?? {}),
    id: existing ? existing.id : newId(),
    name: draft.name.trim(),
    category: draft.category,
    institution: draft.institution.trim() || 'Direct Account',
    investedAmount: inv,
    currentValue: currVal,
    currency: draft.currency,
    interestRatePct: parsedRate,
    purchaseDate: draft.purchaseDate || todayIso(),
    maturityDate: draft.maturityDate || undefined,
    daysToMaturity,
    isMatured,
    unrealizedGain,
    unrealizedGainPct,
    taxTag,
    notes: draft.notes.trim() || undefined,
  };
  return { ok: true, holding };
}
