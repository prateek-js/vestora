import type { BucketMix } from '../utils/smartDiversification';
import { BUCKETS, BUCKET_LABEL } from './buckets';

export interface BeamState {
  /** Positive tilts toward growth (equity-heavy), negative toward steadier assets. */
  tiltDeg: number;
  level: boolean;
  score: number;
}

const LABELS = BUCKET_LABEL;
const LEVEL_SCORE = 90;
const MAX_TILT_DEG = 14;

/** 100 when the mix matches the target; loses 2 points per point of total drift. */
export function balanceScore(current: BucketMix, target: BucketMix): number {
  const drift = BUCKETS.reduce((sum, b) => sum + Math.abs(current[b] - target[b]), 0);
  return Math.max(0, Math.round(100 - 2 * drift));
}

export function beamState(current: BucketMix, target: BucketMix): BeamState {
  const raw = (current.equity - target.equity) * 0.6;
  const clamped = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, raw));
  // `+ 0` turns -0 into 0 so a level beam never reports a negative zero.
  const tiltDeg = Math.round(clamped * 100) / 100 + 0;
  const score = balanceScore(current, target);
  return { tiltDeg, level: score >= LEVEL_SCORE, score };
}

export function gapSentence(current: BucketMix, target: BucketMix): string {
  let worst: keyof BucketMix | null = null;
  let worstGap = 0;
  for (const b of BUCKETS) {
    const gap = Math.abs(current[b] - target[b]);
    if (gap > worstGap) {
      worst = b;
      worstGap = gap;
    }
  }
  const points = Math.round(worstGap);
  if (!worst || points === 0) return 'Your mix is on target';
  const direction = current[worst] > target[worst] ? 'over' : 'under';
  return `${LABELS[worst]} is ${points} ${points === 1 ? 'point' : 'points'} ${direction} your target`;
}
