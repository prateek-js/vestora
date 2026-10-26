import { Holding } from '../types/wealth';

const DAY_MS = 86_400_000;

/** Today's date as a local YYYY-MM-DD string. */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** ISO date (YYYY-MM-DD) offset from today by `days`; negative = past. */
export function isoFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Whole days from `fromIso` to `toIso` (negative if `toIso` is in the past). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / DAY_MS);
}

/**
 * Recomputes isMatured / daysToMaturity from maturityDate so countdowns are
 * always current — sample data, imported rows, and persisted state all age,
 * calendars don't. Holdings without a maturityDate get the derived fields
 * stripped (they're meaningless for perpetual instruments).
 */
export function withDerivedMaturity<T extends Holding>(holding: T): T {
  if (!holding.maturityDate) {
    const { isMatured, daysToMaturity, ...rest } = holding;
    return { ...rest } as T;
  }
  const daysToMaturity = daysBetween(todayIso(), holding.maturityDate);
  return { ...holding, daysToMaturity, isMatured: daysToMaturity <= 0 };
}
