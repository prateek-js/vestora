import { CurrencyCode } from '../types/wealth';

// FX rates: seeded with static benchmarks, then overwritten in place by
// refreshFxRates() when live ECB fixes load (see liveRates.ts). Components
// read via convertCurrency(), so they pick up live rates with no re-render
// coupling — new valuations surface on the next interaction.
export const FX_RATES: Record<CurrencyCode, Record<CurrencyCode, number>> = {
  INR: {
    INR: 1,
    USD: 1 / 86.50,
    EUR: 1 / 93.80,
  },
  USD: {
    INR: 86.50,
    USD: 1,
    EUR: 86.50 / 93.80, // ~0.922
  },
  EUR: {
    INR: 93.80,
    USD: 93.80 / 86.50, // ~1.084
    EUR: 1,
  },
};

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): number {
  if (from === to) return amount;
  const rate = FX_RATES[from]?.[to] ?? 1;
  return amount * rate;
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  options?: { compact?: boolean; showDecimals?: boolean }
): string {
  const { compact = false, showDecimals = false } = options || {};

  if (currency === 'INR') {
    if (compact) {
      const abs = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      if (abs >= 10000000) {
        return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
      }
      if (abs >= 100000) {
        return `${sign}₹${(abs / 100000).toFixed(2)} L`;
      }
      if (abs >= 1000) {
        return `${sign}₹${(abs / 1000).toFixed(1)}k`;
      }
      return `${sign}₹${abs.toFixed(0)}`;
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(amount);
  }

  if (currency === 'USD') {
    if (compact) {
      const abs = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      if (abs >= 1000000) {
        return `${sign}$${(abs / 1000000).toFixed(2)}M`;
      }
      if (abs >= 1000) {
        return `${sign}$${(abs / 1000).toFixed(1)}k`;
      }
      return `${sign}$${abs.toFixed(0)}`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(amount);
  }

  // EUR
  if (compact) {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (abs >= 1000000) {
      return `${sign}€${(abs / 1000000).toFixed(2)}M`;
    }
    if (abs >= 1000) {
      return `${sign}€${(abs / 1000).toFixed(1)}k`;
    }
    return `${sign}€${abs.toFixed(0)}`;
  }
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);
}

export function formatPercent(value: number, decimals: number = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}
