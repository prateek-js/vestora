import type { BucketMix } from '../utils/smartDiversification';

export const BUCKETS: (keyof BucketMix)[] = ['equity', 'debt', 'gold', 'cash'];

export const BUCKET_LABEL: Record<keyof BucketMix, string> = {
  equity: 'Equity',
  debt: 'Debt',
  gold: 'Gold',
  cash: 'Cash',
};

/** CSS colour for each bucket; the same hue is used everywhere a bucket appears. */
export const BUCKET_COLOR: Record<keyof BucketMix, string> = {
  equity: 'var(--color-equity)',
  debt: 'var(--color-debt)',
  gold: 'var(--color-gold)',
  cash: 'var(--color-cash)',
};
