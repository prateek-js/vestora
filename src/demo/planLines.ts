import type { Holding } from '../types/wealth';
import { TARGET_MIX_BY_GOAL, type BucketMix } from '../utils/smartDiversification';
import { BUCKET_LABEL } from './buckets';
import { segmentOf, type SegmentId, type SplitInput, type SplitResult } from './splitEngine';

export interface PlanLine {
  text: string;
  reason: string;
}

const SEGMENT_BUCKET: Record<Exclude<SegmentId, 'loan'>, keyof BucketMix> = {
  equity: 'equity',
  debt: 'debt',
  fd: 'debt',
  savings: 'cash',
  gold: 'gold',
};

/** Destinations in a split that can actually take money: known to the catalog, and a loan only when one is known. */
function placedDestinations(input: SplitInput) {
  return input.catalog
    .map((d) => ({ d, amount: input.allocations[d.id] ?? 0 }))
    .filter(({ d, amount }) => amount > 0 && (d.kind !== 'HOME_LOAN' || input.loan !== null));
}

/** How much money the split actually places. */
export function placedTotal(input: SplitInput): number {
  return placedDestinations(input).reduce((sum, p) => sum + p.amount, 0);
}

/** The moves in a split as plain sentences, each with why it matters. Biggest first. */
export function planLines(
  source: Holding,
  input: SplitInput,
  result: SplitResult,
  formatMoney: (n: number) => string
): PlanLine[] {
  const target = TARGET_MIX_BY_GOAL[input.goal].weights;
  const placed = placedDestinations(input).sort((a, b) => b.amount - a.amount);

  return placed.map(({ d, amount }) => {
    const segment = segmentOf(d);
    if (segment === 'loan') {
      const months = result.loanMonthsSaved;
      return {
        text: `Prepay ${formatMoney(amount)} of your home loan`,
        reason: `Saves ${formatMoney(result.loanInterestSaved)} in interest and ${months} ${months === 1 ? 'month' : 'months'} of payments.`,
      };
    }
    const bucket = SEGMENT_BUCKET[segment];
    return {
      text: `Move ${formatMoney(amount)} from ${source.name} into ${d.title}`,
      reason: `${BUCKET_LABEL[bucket]} goes from ${result.mixBefore[bucket]}% to ${result.mixAfter[bucket]}%, against a target of ${target[bucket]}%.`,
    };
  });
}
