import type { MacroParameters } from '../types/wealth';

/** The economic conditions behind a five-year figure, in plain words, so nobody has to guess what was assumed. */
export function describeConditions(f: MacroParameters): string {
  const points = Math.abs(f.interestRateHikeBps) / 100;
  const rates =
    f.interestRateHikeBps === 0
      ? 'unchanged'
      : `${f.interestRateHikeBps > 0 ? 'up' : 'down'} ${points} ${points === 1 ? 'point' : 'points'}`;
  const stocks =
    f.equityMarketShockPct === 0 ? 'flat' : `${f.equityMarketShockPct > 0 ? 'up' : 'down'} ${Math.abs(f.equityMarketShockPct)}%`;
  return `Inflation of ${f.inflationRatePct}% a year, interest rates ${rates}, global tension at ${f.geopoliticalShockIndex} out of 10, and stocks ${stocks}.`;
}
