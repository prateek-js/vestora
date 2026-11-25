import { useCallback, useState } from 'react';
import type { MacroParameters } from '../types/wealth';
import type { DiversificationGoal } from '../utils/smartDiversification';

export type Chapter = 'story' | 'mine' | 'see' | 'play' | 'plan';

export const CHAPTERS: { id: Chapter; label: string }[] = [
  { id: 'story', label: 'The problem' },
  { id: 'see', label: 'See it' },
  { id: 'play', label: 'Play' },
  { id: 'plan', label: 'Your plan' },
];

/** The core chapters, with "Your numbers" after the story once the visitor has built a portfolio. */
export function visibleChapters(hasPersonal: boolean): { id: Chapter; label: string }[] {
  if (!hasPersonal) return [...CHAPTERS];
  return [CHAPTERS[0], { id: 'mine', label: 'Your numbers' }, ...CHAPTERS.slice(1)];
}

const NEXT_CHAPTER: Record<Chapter, Chapter | null> = {
  story: 'see',
  mine: 'see',
  see: 'play',
  play: 'plan',
  plan: null,
};

export function nextChapter(from: Chapter): Chapter | null {
  return NEXT_CHAPTER[from];
}

/** Same starting point as the full app's Stress Lab. */
export const DEFAULT_FACTORS: MacroParameters = {
  inflationRatePct: 6.5,
  interestRateHikeBps: 150,
  geopoliticalShockIndex: 5,
  equityMarketShockPct: -12,
  projectionHorizonYears: 5,
};

export interface JourneyState {
  chapter: Chapter;
  goal: DiversificationGoal;
  factors: MacroParameters;
  sourceId: string | null;
  moveAmountInBase: number;
  /** Destination id to amount in base currency. */
  allocations: Record<string, number>;
}

const INITIAL: JourneyState = {
  chapter: 'story',
  goal: 'BALANCED',
  factors: DEFAULT_FACTORS,
  sourceId: null,
  moveAmountInBase: 0,
  allocations: {},
};

export function useJourney(): { state: JourneyState; set: (patch: Partial<JourneyState>) => void } {
  const [state, setState] = useState<JourneyState>(INITIAL);
  const set = useCallback((patch: Partial<JourneyState>) => setState((s) => ({ ...s, ...patch })), []);
  return { state, set };
}
